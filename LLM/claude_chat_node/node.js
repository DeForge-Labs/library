import BaseNode from "../../core/BaseNode/node.js";
import { Mastra } from "@mastra/core";
import { createVectorQueryTool } from "@mastra/rag";
import { PgVector, PostgresStore } from "@mastra/pg";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from '@ai-sdk/openai';
import dotenv from 'dotenv';

dotenv.config("./env");

const config = {
    title: "Anthropic Chat",
    category: "LLM",
    type: "claude_chat_node",
    icon: {},
    desc: "Chat with Anthropic based LLM",
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
            value: "claude-3-5-sonnet-20241022",
            options: [
                "claude-3-7-sonnet-20250219",
                "claude-3-5-sonnet-20241022",
                "claude-3-5-haiku-20241022",
                "claude-3-opus-20240229",
                "claude-3-sonnet-20240229",
                "claude-3-haiku-20240307",
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

class claude_chat_node extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {

        webconsole.info("CLAUDE NODE | Prepping inputs");
        
        const queryFilter = inputs.filter((e) => e.name === "Query");
        const query = queryFilter.length > 0 ? queryFilter[0].value : contents.filter((e) => e.name === "Query")[0].value;

        const systemPromptFilter = inputs.filter((e) => e.name === "System Prompt");
        const systemPrompt = systemPromptFilter.length > 0 ? systemPromptFilter[0].value : contents.filter((e) => e.name === "System Prompt")[0].value;

        const temperatureFilter = inputs.filter((e) => e.name === "Temperature");
        const temperature = temperatureFilter.length > 0 ? temperatureFilter[0].value : contents.filter((e) => e.name === "Temperature")[0].value;

        const model = contents.filter((e) => e.name === "Model")[0].value;
        const saveMemory = contents.filter((e) => e.name === "Save Context")[0].value;

        const ragStoreFilter = inputs.filter((e) => e.name === "RAG");
        const ragStoreName = ragStoreFilter.length > 0 ? ragStoreFilter[0].value : "";

        if (saveMemory) {
            webconsole.info("CLAUDE NODE | Loading memories");
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

        const openai = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const llm = createAnthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        })

        const anthropic = llm.languageModel;
        var agent;

        if (ragStoreName) {
            webconsole.info("CLAUDE NODE | Importing knowledge base");

            const ragTool = createVectorQueryTool({
                vectorStoreName: "ragStore",
                indexName: ragStoreName,
                model: openai.embedding("text-embedding-3-small"),
                databaseConfig: {
                    pgvector: {
                        minScore: 0.5,
                    }
                }
            });

            const newAgent = new Agent({
                name: "UserAgent",
                instructions: systemPrompt,
                model: anthropic(model),
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
            agent = mastra.getAgent("newAgent");
        }
        else {
            agent = new Agent({
                name: "UserAgent",
                instructions: systemPrompt,
                model: anthropic(model),
                ...(memory && { memory: memory })
            }); 
        }

        webconsole.info("CLAUDE NODE | Prompting LLM");
        
        try {
            const response = await agent.generate(query, {
                temperature: temperature,
                ...(memory && { resourceId: `${serverData.workflowId}_claude` }),
                ...(memory && { threadId: serverData.chatId ? `${serverData.chatId}_${serverData.workflowId}` : `42069_${serverData.workflowId}` }),
            });

            webconsole.success(`CLAUDE NODE | Successfully responed`);
        
            return response.text;
        } catch (error) {
            webconsole.error(`CLAUDE NODE | Some error occured: ${error}`);
        
            return null;
        }
    }
}

export default claude_chat_node;