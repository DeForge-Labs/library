import BaseNode from "../../core/BaseNode/node.js";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";
import { Downloader } from "nodejs-file-downloader";
import FirecrawlApp from '@mendable/firecrawl-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import axios from "axios";

const execAsync = promisify(exec);

dotenv.config();

const config = {
    title: "Knowledge Base",
    category: "processing",
    type: "rag_node",
    icon: {},
    desc: "Process your Knowledge Base to use it in LLMs",
    credit: 15,
    inputs: [
    ],
    outputs: [
        {
            desc: "RAG Database",
            name: "Rag Database",
            type: "Rag",
        },
    ],
    fields: [
        {
            desc: "The file to use as knowledge base",
            name: "File",
            type: "KnowledgeBase",
            value: "file",
        },
    ],
    difficulty: "easy",
    tags: ["api", "llm", "knowledge-base", "rag"],
}

class rag_node extends BaseNode {
    constructor() {
        super(config);
    }

    /**
     * Generate table name from URL and workflow
     */
    generateTableName(dataURL, workflowId) {
        const fileHash = crypto.createHash('sha256').update(dataURL).digest('hex').slice(0, 16);
        const sanitizedWorkflowId = workflowId.replaceAll("-", "_");
        return `rag_${sanitizedWorkflowId}_${fileHash}`;
    }

    /**
     * Check if table already exists and has data
     */
    async checkTableExists(tableName, webconsole) {
        try {
            // Initialize embeddings to create vector store connection
            const embeddings = new OpenAIEmbeddings({
                model: "text-embedding-3-small",
                apiKey: process.env.OPENAI_API_KEY,
            });

            // Try to create vector store instance to test table existence
            const vectorStore = new PGVectorStore(embeddings, {
                postgresConnectionOptions: {
                    connectionString: process.env.POSTGRESS_URL,
                    ssl: {
                        rejectUnauthorized: false
                    },
                },
                tableName: tableName,
                columns: {
                    idColumnName: "id",
                    vectorColumnName: "vector",
                    contentColumnName: "content",
                    metadataColumnName: "metadata",
                },
            });

            // Try to perform a similarity search to check if table has data
            const results = await vectorStore.similaritySearch("test", 1);
            if (results.length > 0) {
                webconsole.success(`RAG NODE | Table '${tableName}' already exists with data`);
                await vectorStore.end();
                return true;
            }
            
            webconsole.info(`RAG NODE | Table '${tableName}' exists but is empty`);
            await vectorStore.end();
            return false;
        } catch (error) {
            // If error, assume table doesn't exist
            webconsole.info(`RAG NODE | Table '${tableName}' does not exist`);
            return false;
        }
    }

    /**
     * Convert file to markdown using markitdown
     */
    async convertToMarkdown(filePath, workflowId, webconsole) {
        try {
            const outputPath = `./runtime_files/document_${workflowId}.md`;
            const command = `markitdown "${filePath}" -o "${outputPath}"`;
            
            webconsole.info(`RAG NODE | Converting file to markdown with command: ${command}`);
            
            const { stdout, stderr } = await execAsync(command);
            
            if (stderr) {
                webconsole.error(`RAG NODE | Markitdown stderr: ${stderr}`);
            }
            
            if (stdout) {
                webconsole.info(`RAG NODE | Markitdown stdout: ${stdout}`);
            }

            const markdownContent = fs.readFileSync(outputPath, 'utf-8');
            
            // Clean up the markdown file
            try {
                fs.unlinkSync(outputPath);
                webconsole.info("RAG NODE | Cleaned up markdown file");
            } catch (cleanupError) {
                webconsole.error(`RAG NODE | Error cleaning up markdown file: ${cleanupError.message}`);
            }

            return markdownContent;
        } catch (error) {
            webconsole.error(`RAG NODE | Error converting to markdown: ${error.message}`);
            throw error;
        }
    }

    /**
     * Save documents to PostgreSQL using PGVectorStore
     */
    async saveToPostgreSQL(documents, tableName, webconsole) {
        try {
            webconsole.info(`RAG NODE | Saving ${documents.length} documents to PostgreSQL table: ${tableName}`);

            const currentCreditUsage = this.getCredit();
            this.setCredit(currentCreditUsage + 15);

            const embeddings = new OpenAIEmbeddings({
                model: "text-embedding-3-small",
                apiKey: process.env.OPENAI_API_KEY,
            });

            await PGVectorStore.fromDocuments(
                documents,
                embeddings,
                {
                    postgresConnectionOptions: {
                        connectionString: process.env.POSTGRESS_URL,
                        ssl: {
                            rejectUnauthorized: false
                        },
                    },
                    tableName: tableName,
                    columns: {
                        idColumnName: "id",
                        vectorColumnName: "vector",
                        contentColumnName: "content",
                        metadataColumnName: "metadata",
                    },
                }
            );

            webconsole.success(`RAG NODE | Successfully saved ${documents.length} documents to PostgreSQL`);
            return true;
        } catch (error) {
            webconsole.error(`RAG NODE | Error saving to PostgreSQL: ${error.message}`);
            return false;
        }
    }

    /**
     * @override
     * @inheritdoc
     * 
     * @param {import("../../core/BaseNode/node.js").Inputs[]} inputs 
     * @param {import("../../core/BaseNode/node.js").Contents[]} contents 
     * @param {import("../../core/BaseNode/node.js").IWebConsole} webconsole 
     * @param {import("../../core/BaseNode/node.js").IServerData} serverData
     */
    async run(inputs, contents, webconsole, serverData) {
        try {
            webconsole.info("RAG NODE | Starting execution");
            
            if (!process.env.OPENAI_API_KEY) {
                webconsole.error("RAG NODE | OPENAI_API_KEY environment variable not set");
                this.setCredit(0);
                return {
                    "Rag Database": null,
                    "Credits": this.getCredit(),
                };
            }
            if (!process.env.POSTGRESS_URL) {
                webconsole.error("RAG NODE | POSTGRESS_URL environment variable not set");
                this.setCredit(0);
                return {
                    "Rag Database": null,
                    "Credits": this.getCredit(),
                };
            }
            if (!process.env.FIRECRAWL_API_KEY) {
                webconsole.error("RAG NODE | FIRECRAWL_API_KEY environment variable not set");
                this.setCredit(0);
                return {
                    "Rag Database": null,
                    "Credits": this.getCredit(),
                };
            }

            if (!serverData?.workflowId) {
                webconsole.error("RAG NODE | No workflowId in serverData");
                this.setCredit(0);
                return {
                    "Rag Database": null,
                    "Credits": this.getCredit(),
                };
            }
            
            const workflowId = serverData.workflowId;

            const dataTypeContent = contents.find((e) => e.name === "Data Type");
            const DataType = dataTypeContent?.value || "Link to a file";
            
            const linkContent = contents.find((e) => e.name === "Link");
            if (!linkContent?.value) {
                webconsole.error("RAG NODE | No link provided");
                this.setCredit(0);
                return {
                    "Rag Database": null,
                    "Credits": this.getCredit(),
                };
            }

            const dataURL = linkContent.value;
            webconsole.info(`RAG NODE | Processing ${DataType}: ${dataURL}`);

            const deepSearchFilter = contents.find((e) => e.name === "Deep Search");
            const deepSearch = deepSearchFilter?.value || false;

            const tableName = this.generateTableName(dataURL, workflowId);
            webconsole.info(`RAG NODE | Target PostgreSQL table: ${tableName}`);

            const tableExists = await this.checkTableExists(tableName, webconsole);
            if (tableExists) {
                webconsole.success(`RAG NODE | Table '${tableName}' already exists with data, skipping processing`);
                return {
                    "Rag Database": tableName,
                    "Credits": this.getCredit(),
                };
            }

            let markdownContent = "";

            if (!fs.existsSync("./runtime_files/")) {
                fs.mkdirSync("./runtime_files/", { recursive: true });
            }

            if (DataType === "Link to a file") {
                webconsole.info("RAG NODE | Processing file download");
                
                const fileHash = crypto.createHash('sha256').update(dataURL).digest('hex').slice(0, 16);
                const downloader = new Downloader({
                    url: dataURL,
                    directory: "./runtime_files/",
                    cloneFiles: false,
                    onBeforeSave: (fileName) => {
                        const file_ext = fileName.split(".").slice(-1)[0];
                        return `${tableName}_${fileHash}.${file_ext}`;
                    }
                });

                try {
                    const { filePath } = await downloader.download();
                    const downloadedFilePath = `./runtime_files/${filePath.split('/').slice(-1)[0]}`;
                    
                    webconsole.info(`RAG NODE | File downloaded: ${downloadedFilePath}`);

                    markdownContent = await this.convertToMarkdown(downloadedFilePath, workflowId, webconsole);
                    
                    // Clean up downloaded file
                    try {
                        fs.unlinkSync(downloadedFilePath);
                        webconsole.info("RAG NODE | Cleaned up downloaded file");
                    } catch (cleanupError) {
                        webconsole.error(`RAG NODE | Error cleaning up file: ${cleanupError.message}`);
                    }

                } catch (error) {
                    webconsole.error(`RAG NODE | Error processing file: ${error.message}`);
                    this.setCredit(0);
                    return {
                        "Rag Database": null,
                        "Credits": this.getCredit(),
                    };
                }

            } else if (DataType === "Link to a webpage") {
                webconsole.info("RAG NODE | Processing webpage");
                
                try {
                    if (deepSearch) {
                        webconsole.info("RAG NODE | Performing deep search on webpage");

                        const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

                        const crawResult = await firecrawl.crawlUrl(dataURL, {
                            limit: 50,
                            maxDepth: 3,
                            scrapeOptions: {
                                formats: ["markdown"],
                                onlyMainContent: true,
                                parsePDF: false,
                                maxAge: 14400000,
                            }
                        });

                        if (!crawResult.success) {
                            webconsole.error(`RAG NODE | Firecrawl error: ${crawResult.error}`);
                            throw new Error(`Firecrawl error: ${crawResult.error}`);
                        }

                        for (const item of crawResult.data) {
                            markdownContent += `Data from URL: ${item.metadata.sourceURL}\n${item.markdown}\n\n`;
                        }

                        const currentCreditUsage = this.getCredit();
                        this.setCredit(currentCreditUsage + 367);

                        webconsole.success(`RAG NODE | Successfully extracted ${crawResult.data?.length} items`);
                    }
                    else {
                        const axiosConfig = {
                            method: 'get',
                            maxBodyLength: Infinity,
                            url: `https://r.jina.ai/${dataURL}`,
                            headers: {},
                            timeout: 30000,
                        };

                        const response = await axios.request(axiosConfig);
                        if (response.status === 200) {
                            markdownContent = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
                            webconsole.success(`RAG NODE | Successfully extracted ${markdownContent.length} characters from webpage`);
                        } else {
                            throw new Error(`Failed to fetch webpage: ${response.status} ${response.statusText}`);
                        }
                    }

                } catch (error) {
                    webconsole.error(`RAG NODE | Error processing webpage: ${error.message}`);
                    this.setCredit(0);
                    return {
                        "Rag Database": null,
                        "Credits": this.getCredit(),
                    };
                }
            } else {
                webconsole.error("RAG NODE | Invalid data type");
                this.setCredit(0);
                return {
                    "Rag Database": null,
                    "Credits": this.getCredit(),
                };
            }

            if (!markdownContent || markdownContent.trim().length === 0) {
                webconsole.error("RAG NODE | No content to process");
                this.setCredit(0);
                return {
                    "Rag Database": null,
                    "Credits": this.getCredit(),
                };
            }

            webconsole.info("RAG NODE | Creating documents and splitting into chunks");
            
            // Create document
            const document = new Document({
                pageContent: markdownContent,
                metadata: {
                    source: dataURL,
                    type: DataType,
                    processed_at: new Date().toISOString(),
                    workflow_id: workflowId,
                    table_name: tableName,
                }
            });

            // Split document into chunks
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 800,
                chunkOverlap: 150,
            });

            const chunks = await textSplitter.splitDocuments([document]);
            
            if (chunks.length === 0) {
                webconsole.error("RAG NODE | No chunks created from document");
                this.setCredit(0);
                return {
                    "Rag Database": null,
                    "Credits": this.getCredit(),
                };
            }

            webconsole.info(`RAG NODE | Created ${chunks.length} chunks`);

            // Save to PostgreSQL
            const saved = await this.saveToPostgreSQL(chunks, tableName, webconsole);
            
            if (saved) {
                webconsole.success(`RAG NODE | Successfully processed and saved ${chunks.length} document chunks to PostgreSQL`);
                webconsole.success(`RAG NODE | PostgreSQL table name: ${tableName}`);
                return {
                    "Rag Database": tableName,
                    "Credits": this.getCredit(),
                };
            } else {
                webconsole.error("RAG NODE | Failed to save documents to PostgreSQL");
                this.setCredit(0);
                return {
                    "Rag Database": null,
                    "Credits": this.getCredit(),
                };
            }

        } catch (error) {
            webconsole.error(`RAG NODE | Error occurred: ${error.message}`);
            console.error("RAG NODE | Full error:", error);
            this.setCredit(0);
            return {
                "Rag Database": null,
                "Credits": this.getCredit(),
            };
        }
    }

    // Clean up method
    async destroy() {
        console.log("RAG NODE | No persistent connections to clean up");
    }
}

export default rag_node;