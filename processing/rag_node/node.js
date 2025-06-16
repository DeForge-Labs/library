import BaseNode from "../../core/BaseNode/node.js";
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { LibSQLVector } from '@mastra/core/vector/libsql';
import { MDocument } from '@mastra/rag'
import { Downloader } from "nodejs-file-downloader";
import { exec } from 'child_process';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    title: "Knowledge Base",
    category: "processing",
    type: "rag_node",
    icon: {},
    desc: "Process your Knowledge Base to use it in LLMs",
    inputs: [],
    outputs: [
        {
            desc: "RAG Database",
            name: "Rag Database",
            type: "Rag",
        },
    ],
    fields: [
        {
            desc: "The knowledge base file link",
            name: "File Link",
            type: "Text",
            value: "https://yourfilelink.com/",
        },
    ],
    difficulty: "easy",
    tags: ["api", "llm", "knowledge-base", "rag"],
}

class rag_node extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        let isEmbedded = false;
        let fileHash = "";

        const workflowId = serverData.workflowId.replaceAll("-", "_");

        const fileUrl = contents[0].value;
        const allowedTypes = ["pdf", "docx", "txt", "json", "md"];

        const downloader = new Downloader({
            url: fileUrl,
            directory: "./",
            cloneFiles: false,
            onBeforeSave: (fileName) => {
                fileHash = crypto.createHash('sha256').update(fileName).digest('hex');

                if (fs.existsSync(`./${workflowId}_${fileHash}.db`)) {
                    isEmbedded = true;
                }
            }
        });

        const store = new LibSQLVector({
            connectionUrl: `file:./${workflowId}_${fileHash}.db`,
        });

        if (isEmbedded) {
            webconsole.success("RAG NODE | DB exists");
            return `${workflowId}_${fileHash}.db`;
        }

        try {
            const { filePath, downloadStatus } = await downloader.download();

            if (!allowedTypes.some(type => filePath.endsWith(type))) {
                webconsole.error("RAG NODE | Unsupported file type.");
                return null;
            }

            const command = `markitdown ${filePath} -o document.md`;
            exec(command, (error, stdout, stderr) => {
                    if (error) {
                        webconsole.error(`Error executing command: ${error.message}`);
                        return;
                    }
                    if (stderr) {
                        webconsole.error(`Command stderr: ${stderr}`);
                        return;
                    }
                    webconsole.info(`Command stdout: ${stdout}`);
                });
            fs.unlink(filePath, (err) => {
                if (err) {
                    webconsole.error("RAG NODE | error deleting the uploaded file");
                }
            });

            const data = fs.readFileSync('./document.md', 'utf-8');
            const doc = MDocument.fromMarkdown(data);
            const chunks = await doc.chunk();

            const { embeddings } = await embedMany({
                model: openai.embedding("text-embedding-3-small"),
                values: chunks.map((chunk) => chunk.text),
            });

            await store.createIndex({
                indexName: `collection`,
                dimension: 1536,
            });

            await store.upsert({
                indexName: `collection`,
                vectors: embeddings,
                metadata: chunks.map(chunk => ({ text: chunk.text }))
            });

            webconsole.success("RAG NODE | Vector DB created");

            return `${workflowId}_${fileHash}.db`;

        } catch (error) {
            webconsole.error("RAG NODE | some error occured: ", error);
            return null;
        }
    }
}

export default rag_node;