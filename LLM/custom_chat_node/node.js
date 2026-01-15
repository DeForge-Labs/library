import BaseNode from "../../core/BaseNode/node.js";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { PostgresChatMessageHistory } from "@langchain/community/stores/message/postgres";
import { formatDocumentsAsString } from "langchain/util/document";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { Downloader } from "nodejs-file-downloader";
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
import fs from "fs";
import dotenv from 'dotenv';

const { Pool } = pkg;

dotenv.config();

const config = {
    title: "Custom Chat",
    category: "LLM",
    type: "custom_chat_node",
    icon: {},
    desc: "Chat with custom OpenAI-compatible LLMs",
    credit: 10,
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
            desc: "List of tools that the LLM can use",
            name: "Tools",
            type: "Tool[]",
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
            desc: "The Flow to trigger",
            name: "Flow",
            type: "Flow",
        },
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
            desc: "List of tools that the LLM can use",
            name: "Tools",
            type: "Tool[]",
            value: "",
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
            max: 2,
            step: 0.1,
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
    tags: ["llm", "chatbot"],
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
            async ({ query }, toolConfig) => {
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

    createWorkflow(llm, systemPrompt, tools, webconsole) {

        if (Array.isArray(tools) && tools.length > 0) {
            llm = llm.bindTools(tools);
        }

        const callModel = async (state, config) => {
            try {
                let messages = state.messages;
                
                let creditsFromTools = 0;
                const reversedMessages = [...messages].reverse();

                const lastHumanMesageIndex = reversedMessages.findIndex(msg => msg.getType() === 'human');

                if (lastHumanMesageIndex > 0) {
                    const lastTurnMessages = reversedMessages.slice(0, lastHumanMesageIndex);

                    const toolMessages = lastTurnMessages.filter((msg) => msg.getType() === "tool");

                    for (const toolMsg of toolMessages) {
                        if (toolMsg.artifact !== undefined && toolMsg.artifact !== null) {
                            const artifactValue = Number(toolMsg.artifact);
                            if (!isNaN(artifactValue) && artifactValue >= 0) {
                                creditsFromTools += artifactValue;
                            }
                        }
                    }
                }

                this.setCredit(creditsFromTools);
                
                const response = await llm.invoke(messages);
                return { messages: response };
            } catch (error) {
                webconsole.error(`CUSTOM NODE | Error invoking LLM: ${error.message}`);
                throw error;
            }
        };

        let workflow;
        
        if (Array.isArray(tools) && tools.length > 0) {

            const ragNode = async (state) => {

                const response = await llm.invoke(state.messages);
                return { messages: [response] };
            };

            const toolsNode = new ToolNode(tools);

            workflow = new StateGraph(MessagesAnnotation)
                .addNode("rag", ragNode)
                .addNode("tools", toolsNode)
                .addNode("model", callModel)
                .addEdge(START, "rag")
                .addConditionalEdges("rag", toolsCondition, {
                    [END]: END,
                    tools: "tools",
                })
                .addEdge("tools", "model")
                .addConditionalEdges("model", toolsCondition, {
                    [END]: END,
                    tools: "tools",
                });
        } else {

            workflow = new StateGraph(MessagesAnnotation)
                .addNode("model", callModel)
                .addEdge(START, "model")
                .addEdge("model", END);
        }

        return workflow.compile({ checkpointer: this.memoryStore });
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

            let files = inputs.find((e) => e.name === "Files")?.value || [];
            if (files && !Array.isArray(files)) {
                files = [files];
            }

            const systemPromptFilter = inputs.filter((e) => e.name === "System Prompt");
            const systemPrompt = systemPromptFilter.length > 0 ? systemPromptFilter[0].value : contents.filter((e) => e.name === "System Prompt")[0].value || "You are a helpful assistant";

            let tools = inputs.find((e) => e.name === "Tools")?.value || [];
            if (tools && !Array.isArray(tools)) {
                tools = [tools];
            }
            tools = tools.filter((e) => e !== null);

            if (tools.length > 0) {
                webconsole.info("GOOGLE NODE | Generating tool descriptions for system prompt");
                const toolDescriptions = tools.map(tool => `- ${tool.name}: ${tool.description}`).join("\n");
                const toolsPrompt = `\nYou have access to the following tools:\n${toolDescriptions}\nUse them to fetch relevant information when needed.\n`;
                systemPrompt += toolsPrompt;
            }

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
            let toolList = [];
            if (ragTableName && ragTableName.trim() !== "") {
                webconsole.info("CUSTOM NODE | Setting up PostgreSQL RAG tool");
                
                const embeddings = new OpenAIEmbeddings({
                    model: "text-embedding-3-small",
                    apiKey: process.env.OPENAI_API_KEY,
                });

                const vectorStore = await this.initializeVectorStore(embeddings, ragTableName, webconsole);
                ragTool = this.createRagTool(vectorStore, webconsole);

                toolList = [ragTool];
            }

            toolList = [...toolList, ...tools];

            const app = this.createWorkflow(llm, systemPrompt, toolList, webconsole);

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
                        maxTokens: 200000,
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

            const fileObjs = [];
            let fileCount = 0;
            // Files parsing
            for (const fileLink of files) {
                fileCount += 1;
                if (fileCount > 5) {
                    webconsole.warn("CUSTOM NODE | Maximum of 5 files are allowed, skipping remaining files");
                    break;
                }
                try {
                                    
                const tempDir = "./runtime_files";
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }
                                    
                let skipFile = false;
                let pdfFile = false;
                let pdfFileName = "document.pdf";
                let audioFile = false;
                let audioType = "";
                                    
                const downloader = new Downloader({
                    url: fileLink,
                    directory: tempDir,
                    onResponse: (response) => {
                        // Check header for size, content type
                        const contentLength = response.headers['content-length'];
                        const contentType = response.headers['content-type'];
                                    
                        // If file size is larger than 25 MB, return false
                        if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
                            webconsole.error(`CUSTOM NODE | File at ${fileLink} exceeds the 25 MB size limit. Skipping this file.`);
                            skipFile = true;
                            return false;
                        }
                                    
                        // If file type is not image, return false
                        if (contentType && !contentType.startsWith('image/') && !contentType.startsWith('application/pdf') && !contentType.startsWith('audio/')) {
                            webconsole.error(`CUSTOM NODE | File at ${fileLink} is not an image or PDF (content-type: ${contentType}). Skipping this file. If you believe this is an error, please upload the file to some other service`);
                            skipFile = true;
                            return false;
                        }
                                    
                        if (contentType && contentType.startsWith('application/pdf')) {
                            pdfFile = true;
                            const contentDisposition = response.headers['content-disposition'];
                            if (contentDisposition) {
                                const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
                                if (fileNameMatch && fileNameMatch[1]) {
                                    pdfFileName = fileNameMatch[1];
                                }
                            }
                        }
            
                        if (contentType && contentType.startsWith('audio/')) {
                            audioFile = true;
                            audioType = contentType.substring(6);
                            return true;
                        }
                                    
                        return false;
                                    
                        }
                });
                                    
                const tempRes = await downloader.download();
                if (!skipFile) {
                    if (pdfFile) {
                        fileObjs.push({
                            type: "file",
                            "file": {
                                "filename": pdfFileName,
                                "file_data": fileLink,
                            }
                        });
                    } else if (audioFile) {
                        const audioPath = tempRes.filePath;
                        const audioData = fs.readFile(audioPath);
                        const audioBase64 = audioData.toString('base64');
                        fileObjs.push({
                            type: "input_audio",
                            "input_audio": {
                                "data": audioBase64,
                                "format": audioType,
                            }
                        });
            
                        fs.unlinkSync(audioPath);
                    } else {
                        fileObjs.push({
                            "type": "image_url",
                            "image_url": {
                                "url": fileLink
                            }
                        });
                    }
                }
                                    
                } catch (error) {
                    webconsole.error("CUSTOM NODE | Some problem occured parsing file, skipping: ", error);                    
                }
            }
                                    
            const inputMessages = [];
            if (fileObjs.length > 0) {
                webconsole.info(`CUSTOM NODE | Attaching ${fileObjs.length} files to the prompt`);
                inputMessages.push(new HumanMessage({
                    content: [
                        {
                            type: "text",
                            "text": query,
                        },
                        ...fileObjs
                    ]
                }));
            }
            else {
                inputMessages.push(new HumanMessage(query));
            }

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
            return {
                "output": response.content,
                "Credits": this.getCredit()
            };

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