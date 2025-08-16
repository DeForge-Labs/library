import BaseNode from "../../core/BaseNode/node.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { OpenAIEmbeddings } from "@langchain/openai";
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
    title: "Google Chat",
    category: "LLM",
    type: "google_chat_node",
    icon: {},
    desc: "Chat with Google based LLM",
    credit: 200,
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
            value: "gemini-2.0-flash",
            options: [
                "gemini-2.5-pro",
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite-preview-06-17",
                "gemini-2.0-flash",
                "gemini-2.0-flash-lite",
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
    tags: ["api", "llm", "chatbot", "gemini"],
}

class google_chat_node extends BaseNode {

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
            webconsole.error(`GOOGLE NODE | Failed to initialize PostgreSQL vector store '${tableName}': ${error.message}`);
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

            webconsole.success(`GOOGLE NODE | PostgreSQL chat history initialized for session: ${sessionId}`);
            return chatHistory;
        } catch (error) {
            webconsole.error(`GOOGLE NODE | Failed to initialize chat history: ${error.message}`);
            throw error;
        }
    }

    createRetriever(vectorStore, webconsole) {
        const retriever = vectorStore.asRetriever({
            k: 5, // Number of documents to retrieve
            searchType: "similarity",
        });

        webconsole.info("GOOGLE NODE | Created PostgreSQL-based retriever with k=5");
        return retriever;
    }

    createRagTool(vectorStore, webconsole) {
        const retriever = this.createRetriever(vectorStore, webconsole);
        
        return tool(
            async ({ query }) => {
                try {
                    const docs = await retriever.getRelevantDocuments(query);
                    const context = formatDocumentsAsString(docs);
                    
                    webconsole.info(`GOOGLE NODE | Retrieved ${docs.length} relevant documents from PostgreSQL`);
                    
                    if (docs.length === 0) {
                        await vectorStore.end();
                        return "No relevant information found in the knowledge base.";
                    }
                    
                    await vectorStore.end();
                    return `Relevant context from knowledge base:\n${context}`;
                } catch (error) {
                    webconsole.error(`GOOGLE NODE | Error in RAG tool: ${error.message}`);
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
            
            webconsole.info(`GOOGLE NODE | Loaded ${langChainMessages.length} messages from chat history`);
            return langChainMessages;
        } catch (error) {
            webconsole.error(`GOOGLE NODE | Error loading chat history: ${error.message}`);
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
                    webconsole.info("GOOGLE NODE | Added system prompt (no previous system message found)");
                } else if (lastSystemMessage.content !== systemPrompt) {
                    messages.unshift(new SystemMessage(systemPrompt));
                    webconsole.info("GOOGLE NODE | Added updated system prompt (content changed)");
                } else {
                    webconsole.info("GOOGLE NODE | Using existing system prompt (content unchanged)");
                }
                
                const response = await llm.invoke(messages);
                return { messages: response };
            } catch (error) {
                webconsole.error(`GOOGLE NODE | Error invoking LLM: ${error.message}`);
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
            webconsole.info("GOOGLE NODE | Starting LangGraph-based chat node");
            
            // Model tokens per minute limits (RPM * avg tokens per request, very approximate)
            const modelTokensPerMinute = {
                "gemini-2.5-pro": 2000000,
                "gemini-2.5-flash": 1000000,
                "gemini-2.5-flash-lite-preview-06-17": 4000000,
                "gemini-2.0-flash": 4000000,
                "gemini-2.0-flash-lite": 4000000,
            };

            // Model pricing per million tokens in deforge credits less than 200K tokens
            const modelPricingInputUnder200 = {
                "gemini-2.5-pro": 834,
                "gemini-2.5-flash": 200,
                "gemini-2.5-flash-lite-preview-06-17": 67,
                "gemini-2.0-flash": 100,
                "gemini-2.0-flash-lite": 50,
            }

            // Model pricing per million tokens in deforge credits more than 200K tokens
            const modelPricingInputOver200 = {
                "gemini-2.5-pro": 1667,
                "gemini-2.5-flash": 200,
                "gemini-2.5-flash-lite-preview-06-17": 67,
                "gemini-2.0-flash": 100,
                "gemini-2.0-flash-lite": 50,
            }

            // Model pricing output per million tokens in deforge credits less than 200K tokens
            const modelPricingOutputUnder200 = {
                "gemini-2.5-pro": 6667,
                "gemini-2.5-flash": 1667,
                "gemini-2.5-flash-lite-preview-06-17": 267,
                "gemini-2.0-flash": 400,
                "gemini-2.0-flash-lite": 200,
            }

            // Model pricing output per million tokens in deforge credits more than 200K tokens
            const modelPricingOutputOver200 = {
                "gemini-2.5-pro": 10000,
                "gemini-2.5-flash": 1667,
                "gemini-2.5-flash-lite-preview-06-17": 267,
                "gemini-2.0-flash": 400,
                "gemini-2.0-flash-lite": 200,
            }

            const queryFilter = inputs.filter((e) => e.name === "Query");
            let query = queryFilter.length > 0 ? queryFilter[0].value : contents.filter((e) => e.name === "Query")[0].value || "";

            if (!query.trim()) {
                webconsole.error("GOOGLE NODE | No query provided!");
                return null;
            }

            const systemPromptFilter = inputs.filter((e) => e.name === "System Prompt");
            const systemPrompt = systemPromptFilter.length > 0 ? systemPromptFilter[0].value : contents.filter((e) => e.name === "System Prompt")[0].value || "You are a helpful assistant";

            const temperatureFilter = inputs.filter((e) => e.name === "Temperature");
            let temperature = temperatureFilter.length > 0 ? temperatureFilter[0].value : contents.filter((e) => e.name === "Temperature")[0].value || 0.3;
            temperature = Number(temperature);

            const model = contents.filter((e) => e.name === "Model")[0].value || "gemini-2.0-flash";

            
            function estimateTokens(text) {
                return Math.ceil(text.length / 4);
            }

            // Trim query if needed to fit within tokens per minute limit
            const maxTokensPerMinute = modelTokensPerMinute[model] || 32000;
            const queryTokens = estimateTokens(query);
            if (queryTokens > maxTokensPerMinute) {
                const maxChars = maxTokensPerMinute * 4;
                query = query.slice(-maxChars);
                webconsole.warn(`GOOGLE NODE | Query trimmed to fit model tokens per minute limit (${maxTokensPerMinute} tokens, ~${maxChars} chars)`);
            }
            
            const saveMemory = contents.filter((e) => e.name === "Save Context")[0].value || false;

            const ragStoreFilter = inputs.filter((e) => e.name === "RAG");
            const ragTableName = ragStoreFilter.length > 0 ? ragStoreFilter[0].value : "";

            webconsole.info(`GOOGLE NODE | Configuration - Model: ${model}, Temperature: ${temperature}, Save Memory: ${saveMemory}, RAG Table: ${ragTableName || 'None'}`);

            if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
                throw new Error("GOOGLE_GENERATIVE_AI_API_KEY environment variable not set");
            }
            if (!process.env.POSTGRESS_URL) {
                throw new Error("POSTGRESS_URL environment variable not set");
            }

            const llm = new ChatGoogleGenerativeAI({
                model: model,
                temperature: temperature,
                apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
            });

            // Create session ID for memory
            const sessionId = serverData.chatId ? 
                `${serverData.chatId}_${serverData.workflowId}` : 
                `default_${serverData.workflowId}`;

            let ragTool = null;
            if (ragTableName && ragTableName.trim() !== "") {
                webconsole.info("GOOGLE NODE | Setting up PostgreSQL RAG tool");
                
                // For RAG, we still need OpenAI embeddings (industry standard)
                if (!process.env.OPENAI_API_KEY) {
                    throw new Error("OPENAI_API_KEY environment variable required for RAG embeddings");
                }
                
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
                webconsole.info("GOOGLE NODE | Loading chat history from PostgreSQL");
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

            webconsole.info("GOOGLE NODE | Invoking LangGraph workflow");
            
            const output = await app.invoke({ messages: inputMessages }, config);
            const response = output.messages[output.messages.length - 1];

            const resJSON = response.toJSON();

            const inputTokenUsage = resJSON.kwargs.usage_metadata.input_tokens;
            const outputTokenUsage = resJSON.kwargs.usage_metadata.output_tokens;

            const inputCreditRate = inputTokenUsage > 200000 ? modelPricingInputOver200[model] : modelPricingInputUnder200[model];
            const outputCreditRate = outputTokenUsage > 200000 ? modelPricingOutputOver200[model] : modelPricingOutputUnder200[model];

            const inputCreditUsage = Math.ceil(inputTokenUsage * (inputCreditRate / 1e6));
            const outputCreditUsage = Math.ceil(outputTokenUsage * (outputCreditRate / 1e6));
            const totalCreditUsage = inputCreditUsage + outputCreditUsage;

            this.setCredit(totalCreditUsage);

            if (saveMemory) {
                try {
                    const chatHistory = await this.initializeChatHistory(sessionId, webconsole);
                    
                    await chatHistory.addUserMessage(query);
                    await chatHistory.addAIMessage(response.content);
                    
                    webconsole.success("GOOGLE NODE | Chat history saved to PostgreSQL");
                } catch (error) {
                    webconsole.error(`GOOGLE NODE | Error saving chat history: ${error.message}`);
                }
            }

            webconsole.success("GOOGLE NODE | Successfully generated response with LangGraph");
            return response.content;

        } catch (error) {
            webconsole.error(`GOOGLE NODE | Error occurred: ${error.message}`);
            console.error("GOOGLE NODE | Full error:", error);
            return null;
        }
    }

    // Clean up PostgreSQL connections
    async destroy() {
        try {
            if (this.pgPool) {
                await this.pgPool.end();
                console.log("GOOGLE NODE | PostgreSQL connection pool closed");
            }
        } catch (error) {
            console.error("GOOGLE NODE | Error closing PostgreSQL pool:", error);
        }
    }
}

export default google_chat_node;