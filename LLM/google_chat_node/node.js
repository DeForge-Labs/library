import BaseNode from "../../core/BaseNode/node.js";
import { Mastra } from "@mastra/core";
import { createVectorQueryTool } from "@mastra/rag";
import { LibSQLVector } from '@mastra/core/vector/libsql';
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { google } from "@ai-sdk/google";
import { openai } from '@ai-sdk/openai';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    title: "Google Chat",
    category: "LLM",
    type: "google_chat_node",
    icon: {},
    desc: "chat with LLMs",
    inputs: [
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
            desc: "RAG Knowledge base",
            name: "rag",
            type: "Text"
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
            desc: "The LLM model",
            name: "model",
            type: "select",
            value: "gemini-2.0-flash",
            options: ["gemini-2.5-pro-preview-05-06", "gemini-2.5-flash-preview-04-17", "gemini-2.0-flash", "gemini-1.5-pro-latest", "gemini-1.5-flash-latest", "gemini-1.5-flash-8b-latest"],
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
        }
    ],
    difficulty: "medium",
    tags: ['api', 'llm', 'chatbot'],
}

class google_chat_node extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        
        const queryFilter = inputs.filter((e) => e.name === "query");
        const query = queryFilter.length > 0 ? queryFilter[0].value : contents.filter((e) => e.name === "body")[0].value;

        const systemPromptFilter = inputs.filter((e) => e.name === "systemPrompt");
        const systemPrompt = systemPromptFilter.length > 0 ? systemPromptFilter[0].value : contents.filter((e) => e.name === "systemPrompt")[0].value;

        const model = contents.filter((e) => e.name === "model")[0].value;
        const saveMemory = contents.filter((e) => e.name === "saveContext")[0].value;

        const ragStoreFilter = inputs.filter((e) => e.name === "rag");
        const ragStoreName = ragStoreFilter.length > 0 ? ragStoreFilter[0].value : "";

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

        var agent;

        if (ragStoreName) {
            const newAgent = new Agent({
                name: "UserAgent",
                instructions: systemPrompt,
                model: google(model),
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
            model: google(model),
            ...(memory && { memory: memory })
        }); 

        const response = await agent.generate(query, {
            ...(memory && { resourceId: serverData.userId }),
            ...(memory && { threadId: serverData.chatId ? serverData.chatId : "42069" }),
        });

        webconsole.info(`Google LLM Response: ${response.text}`);
        
        return response.text;
    }
}

export default google_chat_node;