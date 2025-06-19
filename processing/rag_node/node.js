import BaseNode from "../../core/BaseNode/node.js";
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { PgVector } from "@mastra/pg";
import { MDocument } from '@mastra/rag'
import { Downloader } from "nodejs-file-downloader";
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';

const execAsync = promisify(exec);
import axios from "axios";

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
            desc: "The type of data you are providing",
            name: "Data Type",
            type: "select",
            value: "Link to a file",
            options: [
                "Link to a file",
                "Link to a webpage",
            ],
        },
        {
            desc: "The knowledge base link",
            name: "Link",
            type: "Text",
            value: "https://yourlink.com/",
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
        let index_name = "";
        let md_data = "";

        const download_location = process.env.DOWNLOAD_LOCATION;

        const workflowId = serverData.workflowId.replaceAll("-", "_");

        const DataType = contents.filter((e) => e.name === "Data Type")[0].value;
        const dataURLFilter = contents.filter((e) => e.name === "Link")
        
        if (dataURLFilter.length === 0) {
            webconsole.error("No link provided");
            return null;
        }

        const dataURL = dataURLFilter[0].value;

        const store = new PgVector({
            connectionString: process.env.POSTGRESS_URL,
        });
        const indices_list = await store.listIndexes();

        if (DataType === "Link to a file") {

            const downloader = new Downloader({
                url: dataURL,
                directory: "./runtime_files/",
                cloneFiles: false,
                onBeforeSave: (fileName) => {
                    const file_ext = fileName.split(".").slice(-1)[0];

                    fileHash = crypto.createHash('sha256').update(fileName).digest('hex').slice(0, 20);
                    index_name = `pg_${workflowId}_${fileHash}`
                    if (indices_list.includes(index_name)) {
                        isEmbedded = true;
                    }

                    return `${index_name}.${file_ext}`;
                }
            });

            try {

                // Download file
                const { filePath, downloadStatus } = await downloader.download();

                if (isEmbedded) {
                    // Delete downloaded file
                    fs.unlink(`./runtime_files/${filePath.split('//').slice(-1)[0]}`, (err) => {
                        if (err) {
                            webconsole.error("RAG NODE | error deleting the file");
                        }
                    });

                    webconsole.success("RAG NODE | DB already exists");
                    return index_name;
                }

                // Convert file to markdown
                const command = `markitdown "${download_location}/${filePath.split('//').slice(-1)[0]}" -o "${download_location}/document_${workflowId}.md"`;
                
                try {
                    const { stdout, stderr } = await execAsync(command);
                    if (stderr) {
                        webconsole.error(`RAG NODE | Command stderr: ${stderr}`);
                        return null;
                    }
                    webconsole.info(`RAG NODE | Command stdout: ${stdout}`);
                } catch (error) {
                    webconsole.error(`RAG NODE | Error executing command: ${error.message}`);
                    return null;
                }

                // Delete downloaded file
                fs.unlink(`./runtime_files/${filePath.split('//').slice(-1)[0]}`, (err) => {
                    if (err) {
                        webconsole.error("RAG NODE | error deleting the file");
                    }
                });

                // Read markdown file
                md_data = fs.readFileSync(`/root/DeForge server/runtime_files/document_${workflowId}.md`, 'utf-8');

                // Delete converted markdown file
                fs.unlink(`./runtime_files/document_${workflowId}.md`, (err) => {
                    if (err) {
                        webconsole.error("RAG NODE | error deleting the file");
                    }
                });
            } catch (error) {
                webconsole.error(`RAG NODE | some error occured while downloading and converting file: ${error}`);
                return null;
            }
        }
        else if (DataType === "Link to a webpage") {

            fileHash = crypto.createHash('sha256').update(dataURL).digest('hex').slice(0, 20);
            index_name = `pg_${workflowId}_${fileHash}`;

            if (indices_list.includes(index_name)) {
                webconsole.success("RAG NODE | DB already exists");
                return index_name;
            }

            const config = {
                method: 'get',
                maxBodyLength: Infinity,
                url: `https://r.jina.ai/${dataURL}`,
                headers: {},
            };

            const response = await axios.request(config);
            if (response.status == 200) {
                md_data = JSON.stringify(response.data);
            }
            else {
                webconsole.error(`RAG NODE | some error occured while gathering data from webpage: ${response.statusText}`);
                return null;
            }

        }
        else {
            webconsole.error("RAG NODE | How did you even get here? There is no other option");
            return null;
        }

        try {

            const doc = MDocument.fromMarkdown(md_data);
            const chunks = await doc.chunk();

            const { embeddings } = await embedMany({
                model: openai.embedding("text-embedding-3-small"),
                values: chunks.map((chunk) => chunk.text),
            });

            await store.createIndex({
                indexName: index_name,
                dimension: 1536,
            });

            await store.upsert({
                indexName: index_name,
                vectors: embeddings,
                metadata: chunks.map(chunk => ({ text: chunk.text }))
            });

            webconsole.success("RAG NODE | Vector DB created");

            return index_name;

        } catch (error) {
            webconsole.error(`RAG NODE | some error occured: ${error}`);
            return null;
        }
    }
}

export default rag_node;