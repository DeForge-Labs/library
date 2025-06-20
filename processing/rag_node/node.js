import BaseNode from "../../core/BaseNode/node.js";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";
import { Downloader } from "nodejs-file-downloader";
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import axios from "axios";
import pkg from 'pg';

const { Pool } = pkg;

dotenv.config();

const config = {
    title: "Knowledge Base (PostgreSQL)",
    category: "processing",
    type: "rag_postgres_node",
    icon: {},
    desc: "Process your Knowledge Base and store in PostgreSQL for LLM RAG",
    inputs: [],
    outputs: [
        {
            desc: "PostgreSQL RAG Database Table Name",
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
        {
            desc: "Custom table name (optional)",
            name: "Table Name",
            type: "Text",
            value: "",
        },
    ],
    difficulty: "easy",
    tags: ["api", "llm", "knowledge-base", "rag"],
}

class rag_node extends BaseNode {
    constructor() {
        super(config);
        // No longer initializing pool in constructor
    }

    /**
     * Get PostgreSQL connection options based on URL
     */
    getConnectionOptions(webconsole) {
        if (!process.env.POSTGRESS_URL) {
            throw new Error("POSTGRESS_URL environment variable not set");
        }

        const connectionString = process.env.POSTGRESS_URL;
        webconsole.info("RAG NODE | Configuring PostgreSQL connection");

        // For Kinsta and similar cloud providers that might not require SSL
        // Start with no SSL and let the connection string dictate requirements
        webconsole.info("RAG NODE | Using connection without forced SSL");
        return {
            connectionString: connectionString,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        };
    }

    /**
     * Create a new PostgreSQL connection pool
     */
    createPool(webconsole) {
        try {
            const connectionOptions = this.getConnectionOptions(webconsole);
            webconsole.info(`RAG NODE | Creating PostgreSQL connection pool`);
            
            const pool = new Pool(connectionOptions);
            return pool;
        } catch (error) {
            webconsole.error(`RAG NODE | Error creating pool: ${error.message}`);
            throw error;
        }
    }

    /**
     * Test PostgreSQL connection
     */
    async testConnection(webconsole) {
        const pool = this.createPool(webconsole);
        
        try {
            const client = await pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            webconsole.success("RAG NODE | PostgreSQL connection test successful");
            return true;
        } catch (error) {
            webconsole.error(`RAG NODE | PostgreSQL connection test failed: ${error.message}`);
            return false;
        } finally {
            await pool.end();
        }
    }

    /**
     * Check if PostgreSQL table exists and has data
     */
    async checkTableExists(tableName, webconsole) {
        const pool = this.createPool(webconsole);
        
        try {
            // Test connection first
            const connectionOk = await this.testConnection(webconsole);
            if (!connectionOk) {
                return { exists: false, count: 0 };
            }

            const client = await pool.connect();
            try {
                // Check if table exists
                const tableCheckResult = await client.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = $1
                    );
                `, [tableName]);

                if (!tableCheckResult.rows[0].exists) {
                    webconsole.info(`RAG NODE | Table '${tableName}' does not exist`);
                    return { exists: false, count: 0 };
                }

                // Check row count
                const countResult = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
                const count = parseInt(countResult.rows[0].count);

                webconsole.info(`RAG NODE | Table '${tableName}' exists with ${count} documents`);
                return { exists: true, count: count };

            } finally {
                client.release();
            }
        } catch (error) {
            webconsole.error(`RAG NODE | Error checking table: ${error.message}`);
            return { exists: false, count: 0 };
        } finally {
            await pool.end();
        }
    }

    /**
     * Verify table exists and is accessible
     */
    async verifyTableExists(tableName, webconsole) {
        const pool = this.createPool(webconsole);
        
        try {
            const client = await pool.connect();
            try {
                // Check if table exists
                const result = await client.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = $1
                    );
                `, [tableName]);
                
                const exists = result.rows[0].exists;
                webconsole.info(`RAG NODE | Table '${tableName}' exists: ${exists}`);
                
                if (exists) {
                    // Check table structure
                    const structure = await client.query(`
                        SELECT column_name, data_type 
                        FROM information_schema.columns 
                        WHERE table_name = $1 
                        ORDER BY ordinal_position;
                    `, [tableName]);
                    
                    webconsole.info(`RAG NODE | Table structure:`, structure.rows);
                }
                
                return exists;
                
            } finally {
                client.release();
            }
        } catch (error) {
            webconsole.error(`RAG NODE | Error verifying table: ${error.message}`);
            return false;
        } finally {
            await pool.end();
        }
    }

    /**
     * Create table manually with proper error handling
     */
    async createTableManually(tableName, webconsole) {
        const pool = this.createPool(webconsole);
        
        try {
            const client = await pool.connect();
            try {
                webconsole.info(`RAG NODE | Creating table manually: ${tableName}`);
                
                // Check if vector extension exists
                const extCheck = await client.query(`
                    SELECT EXISTS (
                        SELECT FROM pg_extension WHERE extname = 'vector'
                    );
                `);
                
                if (!extCheck.rows[0].exists) {
                    webconsole.info("RAG NODE | Vector extension not found, attempting to create...");
                    try {
                        await client.query('CREATE EXTENSION vector;');
                        webconsole.success("RAG NODE | Vector extension created successfully");
                    } catch (extError) {
                        webconsole.error(`RAG NODE | Failed to create vector extension: ${extError.message}`);
                        throw new Error("Vector extension not available. Please contact your database administrator.");
                    }
                } else {
                    webconsole.info("RAG NODE | Vector extension already exists");
                }
                
                // Create the table
                await client.query(`
                    CREATE TABLE IF NOT EXISTS ${tableName} (
                        id SERIAL PRIMARY KEY,
                        content TEXT,
                        metadata JSONB,
                        vector vector(1536)
                    );
                `);
                
                webconsole.success(`RAG NODE | Table '${tableName}' created successfully`);
                
                // Verify the table was created
                const verify = await this.verifyTableExists(tableName, webconsole);
                return verify;
                
            } finally {
                client.release();
            }
        } catch (error) {
            webconsole.error(`RAG NODE | Error creating table manually: ${error.message}`);
            return false;
        } finally {
            await pool.end();
        }
    }
    async createVectorTableDirectly(tableName, webconsole) {
        const pool = this.createPool(webconsole);
        
        try {
            const client = await pool.connect();
            try {
                webconsole.info(`RAG NODE | Creating vector table directly: ${tableName}`);
                
                // Create vector extension if it doesn't exist
                await client.query('CREATE EXTENSION IF NOT EXISTS vector');
                webconsole.info("RAG NODE | Vector extension created/verified");
                
                // Drop table if exists to ensure clean state
                await client.query(`DROP TABLE IF EXISTS ${tableName}`);
                webconsole.info(`RAG NODE | Dropped existing table if any`);
                
                // Create the table with exact schema LangChain expects
                await client.query(`
                    CREATE TABLE ${tableName} (
                        id SERIAL PRIMARY KEY,
                        content TEXT,
                        metadata JSONB,
                        vector vector(1536)
                    )
                `);
                
                webconsole.success(`RAG NODE | Table '${tableName}' created successfully`);
                return true;
                
            } finally {
                client.release();
            }
        } catch (error) {
            webconsole.error(`RAG NODE | Error creating table directly: ${error.message}`);
            // If vector extension doesn't exist, provide helpful error
            if (error.message.includes('type "vector" does not exist')) {
                webconsole.error("RAG NODE | Vector extension not available. Please install pgvector extension in your PostgreSQL database.");
                webconsole.info("RAG NODE | Run: CREATE EXTENSION vector; in your PostgreSQL database");
            }
            return false;
        } finally {
            await pool.end();
        }
    }
    /**
     * Initialize PostgreSQL table and vector extension using PGVectorStore
     */
    async initializeVectorTableWithPGVectorStore(tableName, webconsole) {
        try {
            // First create table directly
            const tableCreated = await this.createVectorTableDirectly(tableName, webconsole);
            if (!tableCreated) {
                throw new Error("Failed to create vector table");
            }

            webconsole.info(`RAG NODE | Initializing PGVectorStore for table: ${tableName}`);
            
            // Initialize embeddings
            const embeddings = new OpenAIEmbeddings({
                model: "text-embedding-3-small",
                apiKey: process.env.OPENAI_API_KEY,
            });

            // Get connection options
            const connectionOptions = this.getConnectionOptions(webconsole);

            // Create vector store with existing table
            const vectorStore = new PGVectorStore(embeddings, {
                postgresConnectionOptions: connectionOptions,
                tableName: tableName,
                columns: {
                    idColumnName: "id",
                    vectorColumnName: "vector",
                    contentColumnName: "content",
                    metadataColumnName: "metadata",
                },
            });

            webconsole.success(`RAG NODE | PGVectorStore initialized for table '${tableName}'`);
            return vectorStore;
            
        } catch (error) {
            webconsole.error(`RAG NODE | Error initializing PGVectorStore: ${error.message}`);
            throw error;
        }
    }
    /**
     * Create PostgreSQL vector store and save documents
     */
    /**
     * Create PostgreSQL vector store and save documents
     */
    /**
     * Create PostgreSQL vector store and save documents
     */
    async saveToPostgreSQL(documents, tableName, metadata, webconsole) {
        try {
            if (documents.length === 0) {
                webconsole.error("RAG NODE | No documents to save");
                return false;
            }

            webconsole.info(`RAG NODE | Initializing PostgreSQL vector store for table: ${tableName}`);

            // Validate environment variables
            if (!process.env.POSTGRESS_URL) {
                throw new Error("POSTGRESS_URL environment variable not set");
            }
            if (!process.env.OPENAI_API_KEY) {
                throw new Error("OPENAI_API_KEY environment variable not set");
            }

            // Step 1: Ensure table exists
            let tableExists = await this.verifyTableExists(tableName, webconsole);
            
            if (!tableExists) {
                webconsole.info("RAG NODE | Table doesn't exist, creating manually...");
                tableExists = await this.createTableManually(tableName, webconsole);
                
                if (!tableExists) {
                    throw new Error("Failed to create table");
                }
            }

            // Step 2: Initialize embeddings
            const embeddings = new OpenAIEmbeddings({
                model: "text-embedding-3-small",
                apiKey: process.env.OPENAI_API_KEY,
            });

            // Step 3: Get connection options
            const connectionOptions = this.getConnectionOptions(webconsole);

            // Step 4: Try fromDocuments method first (safest)
            try {
                webconsole.info(`RAG NODE | Using fromDocuments method to save ${documents.length} documents`);
                
                const vectorStore = await PGVectorStore.fromDocuments(
                    documents, 
                    embeddings, 
                    {
                        postgresConnectionOptions: connectionOptions,
                        tableName: tableName,
                        columns: {
                            idColumnName: "id",
                            vectorColumnName: "vector",
                            contentColumnName: "content",
                            metadataColumnName: "metadata",
                        },
                    }
                );

                webconsole.success(`RAG NODE | Successfully saved ${documents.length} documents using fromDocuments`);
                
            } catch (fromDocsError) {
                // Fallback: Try with existing table and addDocuments
                webconsole.info("RAG NODE | fromDocuments failed, trying addDocuments method...");
                
                const vectorStore = new PGVectorStore(embeddings, {
                    postgresConnectionOptions: connectionOptions,
                    tableName: tableName,
                    columns: {
                        idColumnName: "id",
                        vectorColumnName: "vector",
                        contentColumnName: "content",
                        metadataColumnName: "metadata",
                    },
                });

                await vectorStore.addDocuments(documents);
                webconsole.success(`RAG NODE | Successfully saved ${documents.length} documents using addDocuments`);
            }

            // Save metadata to a separate metadata table for tracking
            await this.saveProcessingMetadata(tableName, metadata, documents.length, webconsole);

            return true;

        } catch (error) {
            webconsole.error(`RAG NODE | Error saving to PostgreSQL: ${error.message}`);
            console.error("RAG NODE | Full PostgreSQL error:", error);
            
            // If it's a vector extension error, provide helpful guidance
            if (error.message.includes('type "vector" does not exist')) {
                webconsole.error("RAG NODE | Vector extension not installed. Please install pgvector extension:");
                webconsole.info("RAG NODE | Contact Kinsta support to enable pgvector extension on your database");
            }
            
            return false;
        }
    }

    /**
     * Save processing metadata to PostgreSQL for tracking
     */
    async saveProcessingMetadata(tableName, metadata, documentCount, webconsole) {
        const pool = this.createPool(webconsole);
        
        try {
            const client = await pool.connect();
            try {
                // Create metadata table if it doesn't exist
                await client.query(`
                    CREATE TABLE IF NOT EXISTS rag_processing_metadata (
                        id SERIAL PRIMARY KEY,
                        table_name TEXT UNIQUE,
                        source_url TEXT,
                        data_type TEXT,
                        processed_at TIMESTAMP,
                        workflow_id TEXT,
                        total_documents INTEGER,
                        total_characters INTEGER,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    )
                `);

                // Insert or update metadata
                await client.query(`
                    INSERT INTO rag_processing_metadata 
                    (table_name, source_url, data_type, processed_at, workflow_id, total_documents, total_characters)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (table_name) 
                    DO UPDATE SET 
                        source_url = EXCLUDED.source_url,
                        data_type = EXCLUDED.data_type,
                        processed_at = EXCLUDED.processed_at,
                        workflow_id = EXCLUDED.workflow_id,
                        total_documents = EXCLUDED.total_documents,
                        total_characters = EXCLUDED.total_characters,
                        updated_at = NOW()
                `, [
                    tableName,
                    metadata.source,
                    metadata.type,
                    metadata.processed_at,
                    metadata.workflow_id,
                    documentCount,
                    metadata.total_characters
                ]);

                webconsole.info(`RAG NODE | Saved processing metadata for table '${tableName}'`);

            } finally {
                client.release();
            }
        } catch (error) {
            webconsole.error(`RAG NODE | Error saving metadata: ${error.message}`);
        } finally {
            await pool.end();
        }
    }

    // Helper function to extract text from different file types (same as before)
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

    /**
     * Generate table name from URL and workflow
     */
    generateTableName(dataURL, workflowId, customTableName) {
        if (customTableName && customTableName.trim() !== "") {
            // Sanitize custom table name
            return customTableName.trim()
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, '_')
                .replace(/_{2,}/g, '_')
                .replace(/^_+|_+$/g, '');
        }

        // Generate from URL hash and workflow ID
        const fileHash = crypto.createHash('sha256').update(dataURL).digest('hex').slice(0, 16);
        const sanitizedWorkflowId = workflowId.replaceAll("-", "_");
        return `rag_${sanitizedWorkflowId}_${fileHash}`;
    }

    async run(inputs, contents, webconsole, serverData) {
        try {
            webconsole.info("RAG NODE | Starting PostgreSQL-integrated execution");
            
            let textContent = "";
            
            if (!serverData?.workflowId) {
                webconsole.error("RAG NODE | No workflowId in serverData");
                return null;
            }
            
            const workflowId = serverData.workflowId;

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

            // Get custom table name
            const tableNameContent = contents.find((e) => e.name === "Table Name");
            const customTableName = tableNameContent?.value || "";

            const dataURL = linkContent.value;
            webconsole.info(`RAG NODE | Processing URL: ${dataURL}`);

            // Validate required environment variables
            if (!process.env.OPENAI_API_KEY) {
                webconsole.error("RAG NODE | OPENAI_API_KEY environment variable not set");
                return null;
            }
            if (!process.env.POSTGRESS_URL) {
                webconsole.error("RAG NODE | POSTGRESS_URL environment variable not set");
                return null;
            }

            webconsole.info(`RAG NODE | Environment variables validated successfully`);

            // Generate table name
            const tableName = this.generateTableName(dataURL, workflowId, customTableName);
            webconsole.info(`RAG NODE | Target PostgreSQL table: ${tableName}`);

            // Check if table already exists and has data
            const tableStatus = await this.checkTableExists(tableName, webconsole);
            if (tableStatus.exists && tableStatus.count > 0) {
                webconsole.success(`RAG NODE | Table '${tableName}' already exists with ${tableStatus.count} documents, skipping processing`);
                return tableName;
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
                    table_name: tableName,
                }
            });

            // Split document into chunks
            const chunks = await textSplitter.splitDocuments([document]);
            
            if (chunks.length === 0) {
                webconsole.error("RAG NODE | No chunks created from document");
                return null;
            }

            webconsole.info(`RAG NODE | Created ${chunks.length} chunks`);

            // Prepare metadata for tracking
            const metadata = {
                source: dataURL,
                type: DataType,
                processed_at: new Date().toISOString(),
                workflow_id: workflowId,
                total_chunks: chunks.length,
                total_characters: textContent.length
            };

            // Save to PostgreSQL
            const saved = await this.saveToPostgreSQL(chunks, tableName, metadata, webconsole);
            
            if (saved) {
                webconsole.success(`RAG NODE | Successfully processed and saved ${chunks.length} document chunks to PostgreSQL`);
                webconsole.success(`RAG NODE | PostgreSQL table name: ${tableName}`);
                webconsole.info("RAG NODE | Ready for use by PostgreSQL chat node");
                
                return tableName;
            } else {
                webconsole.error("RAG NODE | Failed to save documents to PostgreSQL");
                return null;
            }

        } catch (error) {
            webconsole.error(`RAG NODE | Error occurred: ${error.message}`);
            console.error("RAG NODE | Full error:", error);
            return null;
        }
    }

    // Clean up method (no longer needed since pools are created per function)
    async destroy() {
        // No persistent connections to clean up
        console.log("RAG NODE | No persistent connections to clean up");
    }
}

export default rag_node;