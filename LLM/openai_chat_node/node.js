import BaseNode from "../../core/BaseNode/node.js";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { PostgresChatMessageHistory } from "@langchain/community/stores/message/postgres";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { formatDocumentsAsString } from "langchain/util/document";
import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;

dotenv.config("./env");

const config = {
    title: "OpenAI Chat (PostgreSQL)",
    category: "LLM",
    type: "openai_chat_postgres_node",
    icon: {},
    desc: "Chat with OpenAI LLMs using PostgreSQL for RAG and memory",
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Chat text to send",
            name: "Query",
            type: "Text",
        },
        {
            desc: "System prompt for the LLM",
            name: "System Prompt",
            type: "Text",
        },
        {
            desc: "Creativity of the LLM",
            name: "Temperature",
            type: "Number",
        },
        {
            desc: "RAG Knowledge base (PostgreSQL table name)",
            name: "RAG",
            type: "Rag",
        },
        {
            desc: "Save chat as context for LLM",
            name: "Save Context",
            type: "Boolean",
        },
    ],
    outputs: [
        {
            desc: "The response of the LLM",
            name: "output",
            type: "Text",
        },
    ],
    fields: [
        {
            desc: "The LLM model",
            name: "Model",
            type: "select",
            value: "gpt-4o",
            options: [
                "gpt-4.1",
                "gpt-4.1-mini",
                "gpt-4.1-nano",
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4-turbo",
                "gpt-4",
                "gpt-3.5-turbo",
                "o3-mini",
                "o3",
                "o4-mini",
            ],
        },
        {
            desc: "Chat text to send",
            name: "Query",
            type: "TextArea",
            value: "Enter text here...",
        },
        {
            desc: "System prompt for the LLM",
            name: "System Prompt",
            type: "TextArea",
            value: "You are a helpful assistant",
        },
        {
            desc: "Creativity of the LLM",
            name: "Temperature",
            type: "Slider",
            value: 0.5,
            min: 0,
            max: 1,
            step: 0.01,
        },
        {
            desc: "Save chat as context for LLM",
            name: "Save Context",
            type: "CheckBox",
            value: true,
        },
    ],
    difficulty: "medium",
    tags: ["api", "llm", "chatbot", "postgresql", "rag"],
}

class openai_chat_postgres_node extends BaseNode {
    constructor() {
        super(config);
        this.pgPool = new Pool({
            connectionString: process.env.POSTGRESS_URL,
        });
    }

    /**
     * Initialize PostgreSQL vector store
     */
    async initializeVectorStore(embeddings, tableName, webconsole) {
        try {
            const vectorStore = new PGVectorStore(embeddings, {
                postgresConnectionOptions: {
                    connectionString: process.env.POSTGRESS_URL,
                },
                tableName: tableName,
                columns: {
                    idColumnName: "id",
                    vectorColumnName: "vector",
                    contentColumnName: "content",
                    metadataColumnName: "metadata",
                },
            });

            // Test the connection with a simple similarity search
            await vectorStore.similaritySearch("test", 1);
            webconsole.success(`OPENAI NODE | PostgreSQL vector store '${tableName}' connected successfully`);
            
            return vectorStore;
        } catch (error) {
            webconsole.error(`OPENAI NODE | Failed to initialize PostgreSQL vector store '${tableName}': ${error.message}`);
            throw error;
        }
    }

    /**
     * Create PostgreSQL chat message history
     */
    async initializeChatHistory(sessionId, webconsole) {
        try {
            const chatHistory = new PostgresChatMessageHistory({
                pool: this.pgPool,
                sessionId: sessionId,
                tableName: "message_store",
            });

            webconsole.success(`OPENAI NODE | PostgreSQL chat history initialized for session: ${sessionId}`);
            return chatHistory;
        } catch (error) {
            webconsole.error(`OPENAI NODE | Failed to initialize chat history: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create retriever with PostgreSQL vector store
     */
    createRetriever(vectorStore, webconsole) {
        const retriever = vectorStore.asRetriever({
            k: 5, // Number of documents to retrieve
            searchType: "similarity",
        });

        webconsole.info("OPENAI NODE | Created PostgreSQL-based retriever with k=5");
        return retriever;
    }

    /**
     * Handle RAG with memory using PostgreSQL
     */
    async handleRagWithMemory(llm, systemPrompt, query, vectorStore, sessionId, webconsole) {
        try {
            // Initialize retriever
            const retriever = this.createRetriever(vectorStore, webconsole);

            // Initialize chat history
            const chatHistory = await this.initializeChatHistory(sessionId, webconsole);

            // Create memory with PostgreSQL chat history
            const memory = new BufferMemory({
                chatHistory: chatHistory,
                returnMessages: true,
                memoryKey: "chat_history",
                inputKey: "question",
                outputKey: "answer",
            });

            // Enhanced RAG prompt with memory
            const ragMemoryPromptTemplate = PromptTemplate.fromTemplate(`
${systemPrompt}

Previous conversation:
{chat_history}

Use the following context to answer the question. If the context doesn't contain relevant information, say so clearly.

Context:
{context}

Question: {question}

Answer:`);

            // Create conversation chain with RAG and memory
            const conversationChain = new ConversationChain({
                llm: llm,
                memory: memory,
                prompt: ragMemoryPromptTemplate,
            });

            // Get context from PostgreSQL RAG
            const docs = await retriever.getRelevantDocuments(query);
            const context = formatDocumentsAsString(docs);

            webconsole.info(`OPENAI NODE | Retrieved ${docs.length} relevant documents from PostgreSQL`);
            webconsole.info("OPENAI NODE | Generating response with RAG and memory");

            // Generate response with context injection
            const response = await conversationChain.call({
                input: query,
                context: context,
            });

            return response.response;
        } catch (error) {
            webconsole.error(`OPENAI NODE | Error in RAG with memory: ${error.message}`);
            throw error;
        }
    }

    /**
     * Handle RAG only using PostgreSQL
     */
    async handleRagOnly(llm, systemPrompt, query, vectorStore, webconsole) {
        try {
            // Initialize retriever
            const retriever = this.createRetriever(vectorStore, webconsole);

            // RAG prompt template
            const ragPromptTemplate = PromptTemplate.fromTemplate(`
${systemPrompt}

Use the following context to answer the question. If the context doesn't contain relevant information, say so clearly.

Context:
{context}

Question: {question}

Answer:`);

            // Create RAG chain using PostgreSQL
            const ragChain = RunnableSequence.from([
                {
                    context: retriever.pipe(formatDocumentsAsString),
                    question: new RunnablePassthrough(),
                },
                ragPromptTemplate,
                llm,
                new StringOutputParser(),
            ]);

            webconsole.info("OPENAI NODE | Generating response with PostgreSQL RAG only");
            
            const response = await ragChain.invoke(query);
            return response;
        } catch (error) {
            webconsole.error(`OPENAI NODE | Error in RAG only: ${error.message}`);
            throw error;
        }
    }

    /**
     * Handle memory only using PostgreSQL
     */
    async handleMemoryOnly(llm, systemPrompt, query, sessionId, webconsole) {
        try {
            // Initialize chat history
            const chatHistory = await this.initializeChatHistory(sessionId, webconsole);

            // Create memory with PostgreSQL chat history
            const memory = new BufferMemory({
                chatHistory: chatHistory,
                returnMessages: true,
                memoryKey: "chat_history",
                inputKey: "input",
                outputKey: "response",
            });

            const promptTemplate = PromptTemplate.fromTemplate(`
${systemPrompt}

Previous conversation:
{chat_history}

Current question: {input}

Answer:`);

            const conversationChain = new ConversationChain({
                llm: llm,
                memory: memory,
                prompt: promptTemplate,
            });

            webconsole.info("OPENAI NODE | Generating response with PostgreSQL memory only");
            
            const response = await conversationChain.call({
                input: query,
            });

            return response.response;
        } catch (error) {
            webconsole.error(`OPENAI NODE | Error in memory only: ${error.message}`);
            throw error;
        }
    }

    /**
     * Handle simple chat without PostgreSQL enhancements
     */
    async handleSimpleChat(llm, systemPrompt, query, webconsole) {
        try {
            const promptTemplate = PromptTemplate.fromTemplate(`
${systemPrompt}

Question: {input}

Answer:`);

            const chain = promptTemplate.pipe(llm).pipe(new StringOutputParser());
            
            webconsole.info("OPENAI NODE | Generating simple response without PostgreSQL enhancements");
            
            const response = await chain.invoke({
                input: query,
            });

            return response;
        } catch (error) {
            webconsole.error(`OPENAI NODE | Error in simple chat: ${error.message}`);
            throw error;
        }
    }

    async run(inputs, contents, webconsole, serverData) {
        try {
            webconsole.info("OPENAI NODE | Starting PostgreSQL-only chat node");
            
            // Extract inputs with fallback to contents
            const queryFilter = inputs.filter((e) => e.name === "Query");
            const query = queryFilter.length > 0 ? queryFilter[0].value : contents.filter((e) => e.name === "Query")[0].value;

            const systemPromptFilter = inputs.filter((e) => e.name === "System Prompt");
            const systemPrompt = systemPromptFilter.length > 0 ? systemPromptFilter[0].value : contents.filter((e) => e.name === "System Prompt")[0].value;

            const temperatureFilter = inputs.filter((e) => e.name === "Temperature");
            let temperature = temperatureFilter.length > 0 ? temperatureFilter[0].value : contents.filter((e) => e.name === "Temperature")[0].value;
            temperature = Number(temperature);

            const model = contents.filter((e) => e.name === "Model")[0].value;
            const saveMemory = contents.filter((e) => e.name === "Save Context")[0].value;

            const ragStoreFilter = inputs.filter((e) => e.name === "RAG");
            const ragTableName = ragStoreFilter.length > 0 ? ragStoreFilter[0].value : "";

            webconsole.info(`OPENAI NODE | Configuration - Model: ${model}, Temperature: ${temperature}, Save Memory: ${saveMemory}, RAG Table: ${ragTableName || 'None'}`);

            // Validate required environment variables
            if (!process.env.OPENAI_API_KEY) {
                throw new Error("OPENAI_API_KEY environment variable not set");
            }
            if (!process.env.POSTGRESS_URL) {
                throw new Error("POSTGRESS_URL environment variable not set");
            }

            // Initialize OpenAI LLM
            const llm = new ChatOpenAI({
                model: model,
                temperature: temperature,
                apiKey: process.env.OPENAI_API_KEY,
            });

            // Create session ID for memory
            const sessionId = serverData.chatId ? 
                `${serverData.chatId}_${serverData.workflowId}` : 
                `default_${serverData.workflowId}`;

            // Route to appropriate handler based on configuration
            if (ragTableName && ragTableName.trim() !== "") {
                webconsole.info("OPENAI NODE | Setting up PostgreSQL RAG");
                
                // Initialize embeddings for PostgreSQL vector search
                const embeddings = new OpenAIEmbeddings({
                    model: "text-embedding-3-small",
                    apiKey: process.env.OPENAI_API_KEY,
                });

                // Initialize PostgreSQL vector store
                const vectorStore = await this.initializeVectorStore(embeddings, ragTableName, webconsole);

                if (saveMemory) {
                    // Mode 1: PostgreSQL RAG + Memory
                    webconsole.info("OPENAI NODE | Using PostgreSQL RAG with memory");
                    const response = await this.handleRagWithMemory(llm, systemPrompt, query, vectorStore, sessionId, webconsole);
                    webconsole.success("OPENAI NODE | Successfully responded with PostgreSQL RAG and memory");
                    return response;
                } else {
                    // Mode 2: PostgreSQL RAG only
                    webconsole.info("OPENAI NODE | Using PostgreSQL RAG only");
                    const response = await this.handleRagOnly(llm, systemPrompt, query, vectorStore, webconsole);
                    webconsole.success("OPENAI NODE | Successfully responded with PostgreSQL RAG");
                    return response;
                }
            } else {
                if (saveMemory) {
                    // Mode 3: PostgreSQL Memory only
                    webconsole.info("OPENAI NODE | Using PostgreSQL memory only");
                    const response = await this.handleMemoryOnly(llm, systemPrompt, query, sessionId, webconsole);
                    webconsole.success("OPENAI NODE | Successfully responded with PostgreSQL memory");
                    return response;
                } else {
                    // Mode 4: Simple chat (no PostgreSQL enhancements)
                    webconsole.info("OPENAI NODE | Using simple chat without PostgreSQL");
                    const response = await this.handleSimpleChat(llm, systemPrompt, query, webconsole);
                    webconsole.success("OPENAI NODE | Successfully responded with simple chat");
                    return response;
                }
            }

        } catch (error) {
            webconsole.error(`OPENAI NODE | Error occurred: ${error.message}`);
            console.error("OPENAI NODE | Full error:", error);
            return null;
        }
    }

    // Clean up PostgreSQL connections
    async destroy() {
        try {
            if (this.pgPool) {
                await this.pgPool.end();
                console.log("OPENAI NODE | PostgreSQL connection pool closed");
            }
        } catch (error) {
            console.error("OPENAI NODE | Error closing PostgreSQL pool:", error);
        }
    }
}

export default openai_chat_postgres_node;