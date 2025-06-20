import BaseNode from "../../core/BaseNode/node.js";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";
import { Downloader } from "nodejs-file-downloader";
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
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

    // Helper function to extract text from different file types
    async extractTextFromFile(filePath, fileExtension, webconsole) {
        try {
            switch (fileExtension.toLowerCase()) {
                case 'txt':
                case 'md':
                case 'html':
                case 'xml':
                case 'js':
                case 'py':
                case 'java':
                case 'cpp':
                case 'c':
                case 'css':
                    return fs.readFileSync(filePath, 'utf-8');
                
                case 'json':
                    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    return JSON.stringify(jsonData, null, 2);
                
                case 'csv':
                    const csvContent = fs.readFileSync(filePath, 'utf-8');
                    const lines = csvContent.split('\n');
                    const headers = lines[0]?.split(',') || [];
                    let formattedText = `CSV Data with columns: ${headers.join(', ')}\n\n`;
                    
                    for (let i = 1; i < Math.min(lines.length, 21); i++) {
                        if (lines[i]?.trim()) {
                            const values = lines[i].split(',');
                            formattedText += `Row ${i}: `;
                            headers.forEach((header, index) => {
                                formattedText += `${header?.trim()}: ${values[index]?.trim() || 'N/A'}, `;
                            });
                            formattedText += '\n';
                        }
                    }
                    
                    if (lines.length > 21) {
                        formattedText += `\n... and ${lines.length - 21} more rows`;
                    }
                    
                    return formattedText;
                
                default:
                    webconsole.info(`RAG NODE | Unknown file type ${fileExtension}, attempting to read as text`);
                    try {
                        return fs.readFileSync(filePath, 'utf-8');
                    } catch (encodingError) {
                        const buffer = fs.readFileSync(filePath);
                        return buffer.toString('utf-8', 0, Math.min(buffer.length, 10000));
                    }
            }
        } catch (error) {
            throw new Error(`Failed to extract text from ${fileExtension} file: ${error.message}`);
        }
    }

    // Save processed documents (simpler approach)
    async saveProcessedDocuments(documents, indexName, metadata, webconsole) {
        try {
            const storageDir = "./runtime_files/vector_stores/";
            if (!fs.existsSync(storageDir)) {
                fs.mkdirSync(storageDir, { recursive: true });
            }

            const documentData = {
                indexName: indexName,
                createdAt: new Date().toISOString(),
                metadata: metadata,
                documents: documents.map(doc => ({
                    pageContent: doc.pageContent,
                    metadata: doc.metadata
                })),
                totalDocuments: documents.length
            };

            const filePath = `${storageDir}${indexName}.json`;
            fs.writeFileSync(filePath, JSON.stringify(documentData, null, 2));
            
            webconsole.success(`RAG NODE | Saved ${documents.length} processed documents to ${filePath}`);
            return true;
        } catch (error) {
            webconsole.error(`RAG NODE | Error saving documents: ${error.message}`);
            return false;
        }
    }

    async run(inputs, contents, webconsole, serverData) {
        try {
            webconsole.info("RAG NODE | Starting execution with document persistence");
            
            let textContent = "";
            
            if (!serverData?.workflowId) {
                webconsole.error("RAG NODE | No workflowId in serverData");
                return null;
            }
            
            const workflowId = serverData.workflowId.replaceAll("-", "_");

            // Get Data Type from contents
            const dataTypeContent = contents.find((e) => e.name === "Data Type");
            const DataType = dataTypeContent?.value || "Link to a file";
            webconsole.info(`RAG NODE | Data Type: ${DataType}`);

            // Get Link from contents
            const linkContent = contents.find((e) => e.name === "Link");
            if (!linkContent?.value) {
                webconsole.error("RAG NODE | No link provided");
                return null;
            }

            const dataURL = linkContent.value;
            webconsole.info(`RAG NODE | Processing URL: ${dataURL}`);

            // Validate OpenAI API key
            if (!process.env.OPENAI_API_KEY) {
                webconsole.error("RAG NODE | OPENAI_API_KEY environment variable not set");
                return null;
            }

            // Generate index name
            const fileHash = crypto.createHash('sha256').update(dataURL).digest('hex').slice(0, 20);
            const index_name = `doc_${workflowId}_${fileHash}`;
            webconsole.info(`RAG NODE | Index name: ${index_name}`);

            // Check if documents already exist
            const existingDocPath = `./runtime_files/vector_stores/${index_name}.json`;
            if (fs.existsSync(existingDocPath)) {
                webconsole.success("RAG NODE | Processed documents already exist, skipping processing");
                return index_name;
            }

            // Text splitter for chunking
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 800,
                chunkOverlap: 150,
            });

            // Process data based on type
            if (DataType === "Link to a file") {
                webconsole.info("RAG NODE | Processing file download");
                
                if (!fs.existsSync("./runtime_files/")) {
                    fs.mkdirSync("./runtime_files/", { recursive: true });
                }

                const downloader = new Downloader({
                    url: dataURL,
                    directory: "./runtime_files/",
                    cloneFiles: false,
                    onBeforeSave: (fileName) => {
                        const file_ext = fileName.split(".").slice(-1)[0];
                        return `${index_name}.${file_ext}`;
                    }
                });

                try {
                    const { filePath } = await downloader.download();
                    const downloadedFilePath = `./runtime_files/${filePath.split('/').slice(-1)[0]}`;
                    const fileExtension = downloadedFilePath.split('.').pop();

                    webconsole.info(`RAG NODE | Processing ${fileExtension} file`);
                    textContent = await this.extractTextFromFile(downloadedFilePath, fileExtension, webconsole);
                    
                    if (!textContent || textContent.trim().length === 0) {
                        webconsole.error("RAG NODE | No text content extracted from file");
                        return null;
                    }

                    webconsole.info(`RAG NODE | Successfully extracted ${textContent.length} characters from file`);

                    // Clean up downloaded file
                    try {
                        fs.unlinkSync(downloadedFilePath);
                        webconsole.info("RAG NODE | Cleaned up downloaded file");
                    } catch (cleanupError) {
                        webconsole.error("RAG NODE | Error cleaning up file:", cleanupError.message);
                    }

                } catch (error) {
                    webconsole.error(`RAG NODE | Error processing file: ${error.message}`);
                    return null;
                }

            } else if (DataType === "Link to a webpage") {
                webconsole.info("RAG NODE | Processing webpage");
                
                try {
                    const axiosConfig = {
                        method: 'get',
                        maxBodyLength: Infinity,
                        url: `https://r.jina.ai/${dataURL}`,
                        headers: {},
                        timeout: 30000,
                    };

                    const response = await axios.request(axiosConfig);
                    if (response.status === 200) {
                        textContent = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
                        webconsole.info(`RAG NODE | Successfully extracted ${textContent.length} characters from webpage`);
                    } else {
                        throw new Error(`Failed to fetch webpage: ${response.status} ${response.statusText}`);
                    }

                } catch (error) {
                    webconsole.error(`RAG NODE | Error processing webpage: ${error.message}`);
                    return null;
                }
            } else {
                webconsole.error("RAG NODE | Invalid data type");
                return null;
            }

            if (!textContent || textContent.trim().length === 0) {
                webconsole.error("RAG NODE | No text content to process");
                return null;
            }

            webconsole.info("RAG NODE | Creating document and splitting into chunks");
            
            // Create document
            const document = new Document({
                pageContent: textContent,
                metadata: {
                    source: dataURL,
                    type: DataType,
                    processed_at: new Date().toISOString(),
                    workflow_id: workflowId,
                }
            });

            // Split document into chunks
            const chunks = await textSplitter.splitDocuments([document]);
            
            if (chunks.length === 0) {
                webconsole.error("RAG NODE | No chunks created from document");
                return null;
            }

            webconsole.info(`RAG NODE | Created ${chunks.length} chunks`);

            // Save processed documents instead of trying to save vector store
            const metadata = {
                source: dataURL,
                type: DataType,
                processed_at: new Date().toISOString(),
                workflow_id: workflowId,
                total_chunks: chunks.length,
                total_characters: textContent.length
            };

            const saved = await this.saveProcessedDocuments(chunks, index_name, metadata, webconsole);
            
            if (saved) {
                webconsole.success(`RAG NODE | Successfully processed and saved ${chunks.length} document chunks`);
                webconsole.success(`RAG NODE | Index name: ${index_name}`);
                webconsole.info("RAG NODE | Documents will be converted to vector store when needed by chat node");
                
                return index_name;
            } else {
                webconsole.error("RAG NODE | Failed to save processed documents");
                return null;
            }

        } catch (error) {
            webconsole.error(`RAG NODE | Error occurred: ${error.message}`);
            console.error("RAG NODE | Full error:", error);
            return null;
        }
    }
}

export default rag_node;