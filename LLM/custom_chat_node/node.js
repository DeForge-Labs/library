import BaseNode from "../../core/BaseNode/node.js";
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
            name: "sysPrompt",
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
            name: "sysPrompt",
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

        const sysPromptFilter = inputs.filter((e) => e.name === "sysPrompt");
        const systemPrompt = sysPromptFilter.length > 0 ? sysPromptFilter[0].value : contents.filter((e) => e.name === "sysPrompt")[0].value;

        const modelFilter = inputs.filter((e) => e.name === "model");
        const model = modelFilter.length > 0 ? modelFilter[0].value : contents.filter((e) => e.name === "model")[0].value;

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

        const llm = createOpenAI({
            baseURL: endpoint,
            apiKey: serverData.envList?.LLM_API_KEY || "",
        })

        const openai = llm.languageModel;

        const agent = new Agent({
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