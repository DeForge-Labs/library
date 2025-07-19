import BaseNode from "../../core/BaseNode/node.js";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { PostgresChatMessageHistory } from "@langchain/community/stores/message/postgres";
import { formatDocumentsAsString } from "langchain/util/document";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
    AIMessage,
    HumanMessage,
    SystemMessage,
    trimMessages,
} from '@langchain/core/messages';
import {
    START,
    END,
    MessagesAnnotation,
    StateGraph,
    MemorySaver,
} from '@langchain/langgraph';
import { 
    ToolNode,
    toolsCondition,
} from "@langchain/langgraph/prebuilt";
import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;

dotenv.config();

const config = {
    title: "Custom Chat",
    category: "LLM",
    type: "custom_chat_node",
    icon: {},
    desc: "Chat with custom OpenAI-compatible LLMs",
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "The endpoint of the OpenAI compatible LLM API",
            name: "Endpoint",
            type: "Text",
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
            desc: "The endpoint of the OpenAI compatible LLM API",
            name: "Endpoint",
            type: "Text",
            value: "https://api.openai.com/v1",
        },
        {
            desc: "The LLM model",
            name: "Model",
            type: "Text",
            value: "gpt-4o",
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
        {
            desc: "Api Key for the custom LLM",
            name: "LLM_API_KEY",
            type: "env",
            defaultValue: "your-api-key-here",
        },
    ],
    difficulty: "hard",
    tags: ["api", "llm", "chatbot", "rag"],
}

class custom_chat_node extends BaseNode {

    constructor() {
        super(config);
        this.pgPool = new Pool({
            connectionString: process.env.POSTGRESS_URL,
            ssl: {
                rejectUnauthorized: false
            },
        });
        this.memoryStore = new MemorySaver();
    }

    async initializeVectorStore(embeddings, tableName, webconsole) {
        try {
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
            
            return vectorStore;
        } catch (error) {
            webconsole.error(`CUSTOM NODE | Failed to initialize PostgreSQL vector store '${tableName}': ${error.message}`);
            throw error;
        }
    }

    async initializeChatHistory(sessionId, webconsole) {
        try {
            const chatHistory = new PostgresChatMessageHistory({
                pool: this.pgPool,
                sessionId: sessionId,
                tableName: "message_store",
            });

            webconsole.success(`CUSTOM NODE | PostgreSQL chat history initialized for session: ${sessionId}`);
            return chatHistory;
        } catch (error) {
            webconsole.error(`CUSTOM NODE | Failed to initialize chat history: ${error.message}`);
            throw error;
        }
    }

    createRetriever(vectorStore, webconsole) {
        const retriever = vectorStore.asRetriever({
            k: 5, // Number of documents to retrieve
            searchType: "similarity",
        });

        webconsole.info("CUSTOM NODE | Created PostgreSQL-based retriever with k=5");
        return retriever;
    }

    createRagTool(vectorStore, webconsole) {
        const retriever = this.createRetriever(vectorStore, webconsole);
        
        return tool(
            async ({ query }) => {
                try {
                    const docs = await retriever.getRelevantDocuments(query);
                    const context = formatDocumentsAsString(docs);
                    
                    webconsole.info(`CUSTOM NODE | Retrieved ${docs.length} relevant documents from PostgreSQL`);
                    
                    if (docs.length === 0) {
                        await vectorStore.end();
                        return "No relevant information found in the knowledge base.";
                    }
                    
                    await vectorStore.end();
                    return `Relevant context from knowledge base:\n${context}`;
                } catch (error) {
                    webconsole.error(`CUSTOM NODE | Error in RAG tool: ${error.message}`);
                    await vectorStore.end();
                    return "Error retrieving information from knowledge base.";
                }
            },
            {
                name: "ragTool",
                description: "Retrieve relevant information from the knowledge base to answer questions",
                schema: z.object({ 
                    query: z.string().describe("The search query to find relevant information") 
                }),
                responseFormat: "content",
            }
        );
    }

    async loadChatHistory(sessionId, webconsole) {
        try {
            const chatHistory = await this.initializeChatHistory(sessionId, webconsole);
            const messages = await chatHistory.getMessages();
            
            const langChainMessages = messages.map(msg => {
                if (msg.getType() === 'human') {
                    return new HumanMessage(msg.content);
                } else if (msg.getType() === 'ai') {
                    return new AIMessage(msg.content);
                } else if (msg.getType() === 'system') {
                    return new SystemMessage(msg.content);
                }
                return msg;
            });
            
            webconsole.info(`CUSTOM NODE | Loaded ${langChainMessages.length} messages from chat history`);
            return langChainMessages;
        } catch (error) {
            webconsole.error(`CUSTOM NODE | Error loading chat history: ${error.message}`);
            return [];
        }
    }

    createWorkflow(llm, systemPrompt, ragTool, webconsole) {

        const callModel = async (state, config) => {
            try {
                let messages = state.messages;
                if (!config.configurable.saveMemory) {
                    messages = messages.slice(-2);
                }
                
                const lastSystemMessage = messages.slice().reverse().find(msg => msg instanceof SystemMessage);
                
                if (!lastSystemMessage) {
                    
                    messages.unshift(new SystemMessage(systemPrompt));
                    webconsole.info("CUSTOM NODE | Added system prompt (no previous system message found)");
                } else if (lastSystemMessage.content !== systemPrompt) {
                    
                    messages.unshift(new SystemMessage(systemPrompt));
                    webconsole.info("CUSTOM NODE | Added updated system prompt (content changed)");
                } else {
                    
                    webconsole.info("CUSTOM NODE | Using existing system prompt (content unchanged)");
                }
                
                const response = await llm.invoke(messages);
                return { messages: response };
            } catch (error) {
                webconsole.error(`CUSTOM NODE | Error invoking LLM: ${error.message}`);
                throw error;
            }
        };

        let workflow;
        
        if (ragTool) {
            const ragNode = async (state) => {
                const llmWithTools = llm.bindTools([ragTool]);
                const response = await llmWithTools.invoke(state.messages);
                return { messages: [response] };
            };

            const tools = new ToolNode([ragTool]);

            workflow = new StateGraph(MessagesAnnotation)
                .addNode("rag", ragNode)
                .addNode("tools", tools)
                .addNode("model", callModel)
                .addEdge(START, "rag")
                .addConditionalEdges("rag", toolsCondition, {
                    [END]: END,
                    tools: "tools",
                })
                .addEdge("tools", "model")
                .addEdge("model", END);
        } else {

            workflow = new StateGraph(MessagesAnnotation)
                .addNode("model", callModel)
                .addEdge(START, "model")
                .addEdge("model", END);
        }

        return workflow.compile({ checkpointer: this.memoryStore });
    }

    async run(inputs, contents, webconsole, serverData) {
        try {
            webconsole.info("CUSTOM NODE | Starting LangGraph-based chat node");
            
            const endpointFilter = inputs.filter((e) => e.name === "Endpoint");
            const endpoint = endpointFilter.length > 0 ? endpointFilter[0].value : contents.filter((e) => e.name === "Endpoint")[0].value || "";

            if (!endpoint.trim()) {
                webconsole.error("CUSTOM NODE | No endpoint provided");
                return null;
            }
            
            const queryFilter = inputs.filter((e) => e.name === "Query");
            const query = queryFilter.length > 0 ? queryFilter[0].value : contents.filter((e) => e.name === "Query")[0].value || "";

            if (!query.trim()) {
                webconsole.error("CUSTOM NODE | No query provided");
            }

            const systemPromptFilter = inputs.filter((e) => e.name === "System Prompt");
            const systemPrompt = systemPromptFilter.length > 0 ? systemPromptFilter[0].value : contents.filter((e) => e.name === "System Prompt")[0].value || "You are a helpful assistant";

            const temperatureFilter = inputs.filter((e) => e.name === "Temperature");
            let temperature = temperatureFilter.length > 0 ? temperatureFilter[0].value : contents.filter((e) => e.name === "Temperature")[0].value || 0.3;
            temperature = Number(temperature);

            const model = contents.filter((e) => e.name === "Model")[0].value || "";

            if (!model.trim()) {
                webconsole.error("CUSTOM NODE | No model provided");
            }

            const saveMemory = contents.filter((e) => e.name === "Save Context")[0].value || false;

            const ragStoreFilter = inputs.filter((e) => e.name === "RAG");
            const ragTableName = ragStoreFilter.length > 0 ? ragStoreFilter[0].value : "";

            webconsole.info(`CUSTOM NODE | Configuration - Endpoint: ${endpoint}, Model: ${model}, Temperature: ${temperature}, Save Memory: ${saveMemory}, RAG Table: ${ragTableName || 'None'}`);

            if (!serverData.envList?.LLM_API_KEY) {
                throw new Error("LLM_API_KEY environment variable not set");
            }
            if (!process.env.POSTGRESS_URL) {
                throw new Error("POSTGRESS_URL environment variable not set");
            }

            const llm = new ChatOpenAI({
                model: model,
                temperature: temperature,
                apiKey: serverData.envList.LLM_API_KEY,
                configuration: {
                    baseURL: endpoint,
                },
            });

            // Create session ID for memory
            const sessionId = serverData.chatId ? 
                `${serverData.chatId}_${serverData.workflowId}` : 
                `default_${serverData.workflowId}`;

            let ragTool = null;
            if (ragTableName && ragTableName.trim() !== "") {
                webconsole.info("CUSTOM NODE | Setting up PostgreSQL RAG tool");
                
                const embeddings = new OpenAIEmbeddings({
                    model: "text-embedding-3-small",
                    apiKey: process.env.OPENAI_API_KEY,
                });

                const vectorStore = await this.initializeVectorStore(embeddings, ragTableName, webconsole);
                ragTool = this.createRagTool(vectorStore, webconsole);
            }

            const app = this.createWorkflow(llm, systemPrompt, ragTool, webconsole);

            const config = {
                configurable: {
                    thread_id: sessionId,
                    saveMemory: saveMemory
                }
            };

            let pastMessages = [];
            if (saveMemory) {
                webconsole.info("CUSTOM NODE | Loading chat history from PostgreSQL");
                pastMessages = await this.loadChatHistory(sessionId, webconsole);
                
                if (pastMessages.length > 0) {
                    
                    const trimmedMessages = await trimMessages(pastMessages, {
                        maxTokens: 30000,
                        strategy: "last",
                        tokenCounter: llm,
                        includeSystem: true,
                        startOn: "human",
                    });

                    await app.updateState(config, {
                        messages: trimmedMessages,
                    });
                }
            }

            const inputMessages = [new HumanMessage(query)];

            if (pastMessages.length === 0) {
                inputMessages.unshift(new SystemMessage(systemPrompt));
            }

            webconsole.info("CUSTOM NODE | Invoking LangGraph workflow");
            
            const output = await app.invoke({ messages: inputMessages }, config);
            const response = output.messages[output.messages.length - 1];

            if (saveMemory) {
                try {
                    const chatHistory = await this.initializeChatHistory(sessionId, webconsole);
                    
                    await chatHistory.addUserMessage(query);
                    await chatHistory.addAIMessage(response.content);
                    
                    webconsole.success("CUSTOM NODE | Chat history saved to PostgreSQL");
                } catch (error) {
                    webconsole.error(`CUSTOM NODE | Error saving chat history: ${error.message}`);
                }
            }

            webconsole.success("CUSTOM NODE | Successfully generated response with LangGraph");
            return response.content;

        } catch (error) {
            webconsole.error(`CUSTOM NODE | Error occurred: ${error.message}`);
            console.error("CUSTOM NODE | Full error:", error);
            return null;
        }
    }

    // Clean up PostgreSQL connections
    async destroy() {
        try {
            if (this.pgPool) {
                await this.pgPool.end();
                console.log("CUSTOM NODE | PostgreSQL connection pool closed");
            }
        } catch (error) {
            console.error("CUSTOM NODE | Error closing PostgreSQL pool:", error);
        }
    }
}

export default custom_chat_node;