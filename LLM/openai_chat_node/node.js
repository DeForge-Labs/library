import BaseNode from "../../core/BaseNode/node.js";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { PostgresChatMessageHistory } from "@langchain/community/stores/message/postgres";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Document } from "@langchain/core/documents";
import { formatDocumentsAsString } from "langchain/util/document";
import pkg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

const { Pool } = pkg;

dotenv.config("./env");

const config = {
    title: "OpenAI Chat",
    category: "LLM",
    type: "openai_chat_node",
    icon: {},
    desc: "Chat with OpenAI based LLMs",
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
            desc: "RAG Knowledge base",
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
            value: "gpt-4.1",
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
    tags: ["api", "llm", "chatbot"],
}

class openai_chat_node extends BaseNode {
    constructor() {
        super(config);
        this.pgPool = new Pool({
            connectionString: process.env.POSTGRESS_URL,
        });
    }

    async run(inputs, contents, webconsole, serverData) {
        webconsole.info("OPENAI NODE | Prepping inputs");
        
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
        const ragStoreName = ragStoreFilter.length > 0 ? ragStoreFilter[0].value : "";

        // Initialize OpenAI LLM
        const llm = new ChatOpenAI({
            model: model,
            temperature: temperature,
            apiKey: process.env.OPENAI_API_KEY,
        });

        try {
            if (ragStoreName) {
                webconsole.info("OPENAI NODE | Setting up RAG with knowledge base");
                
                // Initialize embeddings for vector search
                const embeddings = new OpenAIEmbeddings({
                    model: "text-embedding-3-small",
                    apiKey: process.env.OPENAI_API_KEY,
                });

                let vectorStore;

                // Try to load from saved documents first (new approach)
                const documentStorePath = `./runtime_files/vector_stores/${ragStoreName}.json`;
                if (fs.existsSync(documentStorePath)) {
                    webconsole.info("OPENAI NODE | Loading documents and creating vector store");
                    
                    try {
                        const documentData = JSON.parse(fs.readFileSync(documentStorePath, 'utf-8'));
                        const documents = documentData.documents.map(doc => new Document({
                            pageContent: doc.pageContent,
                            metadata: doc.metadata
                        }));
                        
                        webconsole.info(`OPENAI NODE | Creating vector store from ${documents.length} documents`);
                        vectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
                        webconsole.info(`OPENAI NODE | Vector store created successfully`);
                        
                    } catch (documentError) {
                        webconsole.error(`OPENAI NODE | Error loading documents: ${documentError.message}`);
                        return null;
                    }
                    
                } else {
                    // Fallback to PostgreSQL vector store
                    webconsole.info("OPENAI NODE | No document store found, attempting PostgreSQL vector store");
                    
                    try {
                        vectorStore = new PGVectorStore(embeddings, {
                            postgresConnectionOptions: {
                                connectionString: process.env.POSTGRESS_URL,
                            },
                            tableName: ragStoreName,
                            columns: {
                                idColumnName: "id",
                                vectorColumnName: "vector",
                                contentColumnName: "content",
                                metadataColumnName: "metadata",
                            },
                        });
                        
                        // Test the connection
                        await vectorStore.similaritySearch("test", 1);
                        webconsole.info("OPENAI NODE | PostgreSQL vector store loaded successfully");
                        
                    } catch (pgError) {
                        webconsole.error(`OPENAI NODE | PostgreSQL vector store failed: ${pgError.message}`);
                        webconsole.error("OPENAI NODE | No valid RAG data source found");
                        return null;
                    }
                }

                // Create retriever
                const retriever = vectorStore.asRetriever({
                    k: 5, // Number of documents to retrieve
                    searchType: "similarity",
                });

                // RAG prompt template
                const ragPromptTemplate = PromptTemplate.fromTemplate(`
${systemPrompt}

Use the following context to answer the question. If the context doesn't contain relevant information, say so.

Context:
{context}

Question: {question}

Answer:`);

                // Create RAG chain
                const ragChain = RunnableSequence.from([
                    {
                        context: retriever.pipe(formatDocumentsAsString),
                        question: new RunnablePassthrough(),
                    },
                    ragPromptTemplate,
                    llm,
                    new StringOutputParser(),
                ]);

                if (saveMemory) {
                    webconsole.info("OPENAI NODE | Setting up memory with RAG");
                    
                    // Create session ID for memory
                    const sessionId = serverData.chatId ? 
                        `${serverData.chatId}_${serverData.workflowId}` : 
                        `42069_${serverData.workflowId}`;

                    // Initialize PostgreSQL chat message history
                    const chatHistory = new PostgresChatMessageHistory({
                        pool: this.pgPool,
                        sessionId: sessionId,
                        tableName: "message_store",
                    });

                    // Create memory with chat history
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

Use the following context to answer the question. If the context doesn't contain relevant information, say so.

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

                    // Get context from RAG
                    const docs = await retriever.getRelevantDocuments(query);
                    const context = formatDocumentsAsString(docs);

                    webconsole.info("OPENAI NODE | Prompting LLM with RAG and memory");
                    
                    // Generate response with context injection
                    const response = await conversationChain.call({
                        input: query,
                        context: context,
                    });

                    webconsole.success("OPENAI NODE | Successfully responded with RAG and memory");
                    return response.response;

                } else {
                    webconsole.info("OPENAI NODE | Prompting LLM with RAG only");
                    
                    const response = await ragChain.invoke(query);
                    
                    webconsole.success("OPENAI NODE | Successfully responded with RAG");
                    return response;
                }

            } else {
                // No RAG, just regular chat
                if (saveMemory) {
                    webconsole.info("OPENAI NODE | Setting up memory without RAG");
                    
                    const sessionId = serverData.chatId ? 
                        `${serverData.chatId}_${serverData.workflowId}` : 
                        `42069_${serverData.workflowId}`;

                    const chatHistory = new PostgresChatMessageHistory({
                        pool: this.pgPool,
                        sessionId: sessionId,
                        tableName: "message_store",
                    });

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

                    webconsole.info("OPENAI NODE | Prompting LLM with memory");
                    
                    const response = await conversationChain.call({
                        input: query,
                    });

                    webconsole.success("OPENAI NODE | Successfully responded with memory");
                    return response.response;

                } else {
                    webconsole.info("OPENAI NODE | Prompting LLM without memory or RAG");
                    
                    const promptTemplate = PromptTemplate.fromTemplate(`
${systemPrompt}

Question: {input}

Answer:`);

                    const chain = promptTemplate.pipe(llm).pipe(new StringOutputParser());
                    
                    const response = await chain.invoke({
                        input: query,
                    });

                    webconsole.success("OPENAI NODE | Successfully responded");
                    return response;
                }
            }

        } catch (error) {
            webconsole.error(`OPENAI NODE | Some error occurred: ${error.message}`);
            console.error("Full error:", error);
            return null;
        }
    }

    // Clean up database connections
    async destroy() {
        if (this.pgPool) {
            await this.pgPool.end();
        }
    }
}

export default openai_chat_node;