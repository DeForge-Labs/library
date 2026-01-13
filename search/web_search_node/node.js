import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

dotenv.config();

const config = {
    title: "AI Web Search",
    category: "search",
    type: "web_search_node",
    icon: {},
    desc: "Search the web and get summarised information",
    credit: 10,
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Query to search",
            name: "Query",
            type: "Text",
        },
    ],
    outputs: [
        {
            desc: "The Flow to trigger",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "The content of all the search results in markdown",
            name: "output",
            type: "Text",
        },
        {
            desc: "The tool version of this node, to be used by LLMs",
            name: "Tool",
            type: "Tool",
        },
    ],
    fields: [
        {
            desc: "Query to search",
            name: "Query",
            type: "TextArea",
            value: "Enter text here...",
        },
        {
            desc: "The preferred search language",
            name: "Language",
            type: "select",
            value: "English",
            options: [
            "English",
            "Spanish",
            "French",
            "German",
            "Japanese",
            "Chinese",
            "Hindi",
            "Portugese",
            "Italian",
            "Korean",
            "Dutch",
            "Arabic",
            "Sweedish",
            "Hebrew",
            "Afrikaans",
            "Russian",         
            ],
        },
    ],
    difficulty: "easy",
    tags: ["llm", "search", "web"],
}

class web_search_node extends BaseNode {

    constructor() {
        super(config);
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

        webconsole.info("WEB SEARCH NODE | Searching your query");
        
        const langDict = {
            "English": "en",
            "Spanish": "es",
            "French": "fr",
            "German": "de",
            "Japanese": "ja",
            "Chinese": "zh-cn",
            "Hindi": "hi",
            "Portugese": "pt",
            "Italian": "it",
            "Korean": "ko",
            "Dutch": "nl",
            "Arabic": "ar",
            "Sweedish": "sv",
            "Hebrew": "iw",
            "Afrikaans": "af",
            "Russian": "ru",
        };

        if (!process.env.JINA_API_KEY) {
            webconsole.error("WEB SEARCH NODE | Jina API key not provided");
            return null;
        }

        webconsole.info("WEB SEARCH NODE | Generating tool");

        const webSearchTool = tool(
            async({ query, lang }, toolConfig) => {
                webconsole.info("WEB SEARCH NODE | Invoking tool");

                const langCode = Object.keys(langDict).includes(lang) ? langDict[lang] : "en";
                const searchParamsObj = {
                    q: query,
                    hl: langCode
                };
                const searchParams = new URLSearchParams(searchParamsObj).toString();
                const url = `https://s.jina.ai/?${searchParams}`;

                const axiosConfig = {
                    method: "get",
                    maxBodyLength: Infinity,
                    url: url,
                    headers: {
                        "Accept": "application/json",
                        "Authorization": `Bearer ${process.env.JINA_API_KEY}`,
                        "X-Engine": "direct",
                    },
                    timeout: 50000
                };

                let searchResultMD = "Extracted search results: \n";

                try {
                    const response = await axios.request(axiosConfig);
                    if (response.status === 200) {
                        webconsole.success("WEB SEARCH NODE | Successfully searched and extracted data");
                        const data = response.data;

                        for (const searchResItem of data.data) {
                            searchResultMD += `- Title: ${searchResItem.title}, Content: ${searchResItem.content}\n`;
                        }

                        return [
                            searchResultMD,
                            this.getCredit(),
                        ];
                    }
                    else {
                        webconsole.error("WEB SEARCH NODE | Some error occured");
                        return [
                            "Some error occured during web search",
                            this.getCredit(),
                        ];
                    }
                } catch (error) {
                    webconsole.error("WEB SEARCH NODE | Some error occured: ", error);
                        return [
                            "Some error occured during web search",
                            this.getCredit(),
                        ];
                }
            },
            {
                name: "webSearchTool",
                description: "Search the web for the given query in the given language and return results from various websites",
                schema: z.object({
                    query: z.string(),
                    lang: z.enum([
                        "English",
                        "Spanish",
                        "French",
                        "German",
                        "Japanese",
                        "Chinese",
                        "Hindi",
                        "Portugese",
                        "Italian",
                        "Korean",
                        "Dutch",
                        "Arabic",
                        "Sweedish",
                        "Hebrew",
                        "Afrikaans",
                        "Russian",         
                        ]
                    )
                }),
                responseFormat: "content_and_artifact",
            }
        );

        const queryFilter = inputs.find((e) => e.name === "Query");
        const query = queryFilter?.value || contents.find((e) => e.name === "Query")?.value || "";

        if (!query) {
            webconsole.error("WEB SEARCH NODE | No query found");
            this.setCredit(0);
            return {
                "output": null,
                "Tool": webSearchTool,
            };
        }

        const langFilter = contents.find((e) => e.name === "Language");
        const lang = langFilter?.value || "English";
        const langCode = Object.keys(langDict).includes(lang) ? langDict[lang] : "en";

        const searchParamsObj = {
            q: query,
            hl: langCode
        };
        const searchParams = new URLSearchParams(searchParamsObj).toString();
        const url = `https://s.jina.ai/?${searchParams}`;

        const axiosConfig = {
            method: "get",
            maxBodyLength: Infinity,
            url: url,
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${process.env.JINA_API_KEY}`,
                "X-Engine": "direct",
            },
            timeout: 50000
        };

        let searchResultMD = "Extracted search results: \n";

        try {
            const response = await axios.request(axiosConfig);
            if (response.status === 200) {
                webconsole.success("WEB SEARCH NODE | Successfully searched and extracted data");
                const data = response.data;

                for (const searchResItem of data.data) {
                    searchResultMD += `- Title: ${searchResItem.title}, Content: ${searchResItem.content}\n`;
                }

                return {
                    "output": searchResultMD,
                    "Tool": webSearchTool,
                    "Credits": this.getCredit(),
                };
            }
            else {
                webconsole.error("WEB SEARCH NODE | Some error occured");
                this.setCredit(0);
                return {
                    "output": null,
                    "Tool": webSearchTool,
                };
            }
        } catch (error) {
            webconsole.error("WEB SEARCH NODE | Some error occured: ", error);
            this.setCredit(0);
            return {
                "output": null,
                "Tool": webSearchTool,
            };
        }
    }
}

export default web_search_node;