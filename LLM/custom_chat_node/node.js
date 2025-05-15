import BaseNode from "../../core/BaseNode/node.js";
import { Mastra } from "@mastra/core";
import { createVectorQueryTool } from "@mastra/rag";
import { LibSQLVector } from '@mastra/core/vector/libsql';
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { createOpenAI } from "@ai-sdk/openai";
import { LibSQLStore } from "@mastra/libsql";

const config = {
    title: "Custom Chat",
    category: "LLM",
    type: "custom_chat_node",
    icon: {},
    desc: "chat with LLMs",
    inputs: [
        {
            desc: "The endpoint of the OpenAI compatible LLM API",
            name: "endpoint",
            type: "Text",
        },
        {
            desc: "The LLM model",
            name: "model",
            type: "Text",
        },
        {
            desc: "Chat text to send",
            name: "query",
            type: "Text",
        },
        {
            desc: "System prompt for the LLM",
            name: "systemPrompt",
            type: "Text"
        },
        {
            desc: "Knowledge base",
            name: "KnowledgeBase",
            type: "RAG"
        }
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
            name: "endpoint",
            type: "Text",
            value: "endpoint...",
        },
        {
            desc: "The LLM model",
            name: "model",
            type: "Text",
            value: "llama3-70b",
        },
        {
            desc: "Chat text to send",
            name: "query",
            type: "Text",
            value: "Enter text here...",
        },
        {
            desc: "System prompt for the LLM",
            name: "systemPrompt",
            type: "Text",
            value: "You are a helpful assistant"
        },
        {
            desc: "Save chat as context for LLM",
            name: "saveContext",
            type: "Boolean",
            value: true
        },
        {
            desc: "Api Key of LLM",
            name: "LLM_API_KEY",
            type: "env",
            defaultValue: "eydnfnuani...",
        }
    ],
    difficulty: "medium",
    tags: ['api', 'llm', 'chatbot'],
}

class custom_chat_node extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {

        const endpointFilter = inputs.filter((e) => e.name === "endpoint");
        const endpoint = endpointFilter.length > 0 ? endpointFilter[0].value : contents.filter((e) => e.name === "endpoint")[0].value;
        
        const queryFilter = inputs.filter((e) => e.name === "query");
        const query = queryFilter.length > 0 ? queryFilter[0].value : contents.filter((e) => e.name === "body")[0].value;

        const systemPromptFilter = inputs.filter((e) => e.name === "systemPrompt");
        const systemPrompt = systemPromptFilter.length > 0 ? systemPromptFilter[0].value : contents.filter((e) => e.name === "systemPrompt")[0].value;

        const modelFilter = inputs.filter((e) => e.name === "model");
        const model = modelFilter.length > 0 ? modelFilter[0].value : contents.filter((e) => e.name === "model")[0].value;

        const ragStoreFilter = inputs.filter((e) => e.name === "KnowledgeBase");
        const ragStoreName = ragStoreFilter.length > 0 ? ragStoreFilter[0].value : "";

        const saveMemory = contents.filter((e) => e.name === "saveContext")[0].value;

        const memory  = saveMemory ? new Memory({
            storage: new LibSQLStore({
                url: `file:./local.db`,
            }),
            options: {
                lastMessages: 40,
                workingMemory: {
                    enabled: false,
                },
            }
        }) : null;

        const ragTool = createVectorQueryTool({
            vectorStoreName: "libStore",
            indexName: "collection",
            model: openai.embedding("text-embedding-3-small"),
        });

        const llm = createOpenAI({
            baseURL: endpoint,
            apiKey: serverData.envList?.LLM_API_KEY || "",
        })

        const openai = llm.languageModel;

        var agent;

        if (ragStoreName) {
            const newAgent = new Agent({
                name: "UserAgent",
                instructions: systemPrompt,
                model: openai(model),
                ...(memory && { memory: memory }),
                tools: { ragTool },
            });

            const ragStore = new LibSQLVector({
                connectionUrl: `file:./${ragStoreName}`
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
        
        const response = await agent.generate(query, {
            ...(memory && { resourceId: serverData.userId }),
            ...(memory && { threadId: serverData.chatId ? serverData.chatId : "42069" }),
        });

        webconsole.info(`OpenAI LLM Response: ${response.text}`);
        
        return response.text;
    }
}

export default custom_chat_node;