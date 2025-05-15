import BaseNode from "../../core/BaseNode/node.js";
import { Mastra } from "@mastra/core";
import { createVectorQueryTool } from "@mastra/rag";
import { LibSQLVector } from '@mastra/core/vector/libsql';
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from '@ai-sdk/openai';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    title: "Anthropic Chat",
    category: "LLM",
    type: "claude_chat_node",
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
            name: "sysPrompt",
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
            value: "claude-3-5-sonnet-20241022",
            options: ["claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
        },
        {
            desc: "Chat text to send",
            name: "query",
            type: "Text",
            value: "Enter text here...",
        },
        {
            desc: "System prompt for the LLM",
            name: "sysPrompt",
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

class claude_chat_node extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        
        const queryFilter = inputs.filter((e) => e.name === "query");
        const query = queryFilter.length > 0 ? queryFilter[0].value : contents.filter((e) => e.name === "body")[0].value;

        const sysPromptFilter = inputs.filter((e) => e.name === "sysPrompt");
        const systemPrompt = sysPromptFilter.length > 0 ? sysPromptFilter[0].value : contents.filter((e) => e.name === "sysPrompt")[0].value;

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

        const newAgent = new Agent({
            name: "UserAgent",
            instructions: systemPrompt,
            model: anthropic(model),
            ...(memory && { memory: memory }),
            ...(ragStoreName && { tools: { ragTool } }),
        });

        const ragStore = new LibSQLVector({
            connectionUrl: `file:./${ragStoreName}`
        });
        
        const mastra = new Mastra({
            agents: { newAgent },
            vectors: { ragStore },
        });
        const agent = mastra.getAgent("UserAgent");

        const response = await agent.generate(query, {
            ...(memory && { resourceId: serverData.userId }),
            ...(memory && { threadId: serverData.chatId ? serverData.chatId : "42069" }),
        });

        webconsole.info(`Anthropic LLM Response: ${response.text}`);
        
        return response.text;
    }
}

export default claude_chat_node;