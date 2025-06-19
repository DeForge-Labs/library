import BaseNode from "../../core/BaseNode/node.js";
import { Mastra } from "@mastra/core";
import { createVectorQueryTool } from "@mastra/rag";
import { PgVector, PostgresStore } from "@mastra/pg";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { createOpenAI } from "@ai-sdk/openai";
import dotenv from 'dotenv';

dotenv.config("./env");

const config = {
    title: "Custom Chat",
    category: "LLM",
    type: "custom_chat_node",
    icon: {},
    desc: "Chat with custom LLMs",
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
            desc: "The LLM model",
            name: "Model",
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
            value: "endpoint...",
        },
        {
            desc: "The LLM model",
            name: "Model",
            type: "Text",
            value: "llama3-70b",
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
            desc: "Api Key of LLM",
            name: "LLM_API_KEY",
            type: "env",
            defaultValue: "eydnfnuani...",
        },
    ],
    difficulty: "hard",
    tags: ["api", "llm", "chatbot"],
}

class custom_chat_node extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {

        webconsole.info("CUSTOM NODE | Prepping inputs");

        const endpointFilter = inputs.filter((e) => e.name === "Endpoint");
        const endpoint = endpointFilter.length > 0 ? endpointFilter[0].value : contents.filter((e) => e.name === "Endpoint")[0].value;
        
        const queryFilter = inputs.filter((e) => e.name === "Query");
        const query = queryFilter.length > 0 ? queryFilter[0].value : contents.filter((e) => e.name === "Query")[0].value;

        const systemPromptFilter = inputs.filter((e) => e.name === "System Prompt");
        const systemPrompt = systemPromptFilter.length > 0 ? systemPromptFilter[0].value : contents.filter((e) => e.name === "System Prompt")[0].value;

        const modelFilter = inputs.filter((e) => e.name === "Model");
        const model = modelFilter.length > 0 ? modelFilter[0].value : contents.filter((e) => e.name === "Model")[0].value;

        const ragStoreFilter = inputs.filter((e) => e.name === "RAG");
        const ragStoreName = ragStoreFilter.length > 0 ? ragStoreFilter[0].value : "";

        const temperatureFilter = inputs.filter((e) => e.name === "Temperature");
        const temperature = temperatureFilter.length > 0 ? temperatureFilter[0].value : contents.filter((e) => e.name === "Temperature")[0].value;

        const saveMemory = contents.filter((e) => e.name === "Save Context")[0].value;

        if (saveMemory) {
            webconsole.info("CUSTOM NODE | Loading memories");
        }
        const memory  = saveMemory ? new Memory({
            storage: new PostgresStore({
                connectionString: process.env.POSTGRESS_URL,
            }),
            options: {
                lastMessages: 40,
                workingMemory: {
                    enabled: false,
                },
            }
        }) : null;

        const llm = createOpenAI({
            baseURL: endpoint,
            apiKey: serverData.envList?.LLM_API_KEY || "",
        })

        const openai = llm.languageModel;
        var agent;

        if (ragStoreName) {
            webconsole.info("CUSTOM NODE | Importing knowledge base");

            const ragTool = createVectorQueryTool({
                vectorStoreName: "postgres",
                indexName: ragStoreName,
                model: llm.embedding("text-embedding-3-small"),
                databaseConfig: {
                    pgvector: {
                        minScore: 0.7,
                    }
                }
            });

            const newAgent = new Agent({
                name: "UserAgent",
                instructions: systemPrompt,
                model: openai(model),
                ...(memory && { memory: memory }),
                tools: { ragTool },
            });

            const ragStore = new PgVector({
                connectionString: process.env.POSTGRESS_URL,
            });

            const mastra = new Mastra({
                agents: { newAgent },
                vectors: { ragStore },
            });
            agent = mastra.getAgent("UserAgent");
        }

        agent = new Agent({
            name: "UserAgent",
            instructions: systemPrompt,
            model: openai(model),
            ...(memory && { memory: memory })
        });
        
        webconsole.info("CUSTOM NODE | Prompting LLM");
        
        try {
            const response = await agent.generate(query, {
                temperature: temperature,
                ...(memory && { resourceId: `${serverData.workflowId}_custom` }),
                ...(memory && { threadId: serverData.chatId ? `${serverData.chatId}_${serverData.workflowId}` : `42069_${serverData.workflowId}` }),
            });

            webconsole.success(`CUSTOM NODE | Successfully responded`);
        
            return response.text;
        } catch (error) {
            webconsole.error(`CUSTOM NODE | Some error occured: ${error}`);
        
            return null;
        }
    }
}

export default custom_chat_node;