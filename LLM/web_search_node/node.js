import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const config = {
    title: "AI Web Search",
    category: "LLM",
    type: "web_search_node",
    icon: {},
    desc: "Search the web and get summarised information",
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
            desc: "The content of all the search results in markdown",
            name: "output",
            type: "Text",
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
    difficulty: "medium",
    tags: ["llm", "search", "web"],
}

class web_search_node extends BaseNode {

    constructor() {
        super(config);
    }


    async run(inputs, contents, webconsole, serverData) {
        
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

        webconsole.info("WEB SEARCH NODE | Searching your query");

        const queryFilter = inputs.find((e) => e.name === "Query");
        const query = queryFilter?.value || contents.find((e) => e.name === "Query")?.value || "";

        if (!query) {
            webconsole.error("WEB SEARCH NODE | No query found");
            return null;
        }

        const langFilter = contents.find((e) => e.name === "Language");
        const lang = langFilter?.value || "English";
        const langCode = Object.keys(langDict).includes(lang) ? langDict[lang] : "en";

        if (!process.env.JINA_API_KEY) {
            webconsole.error("WEB SEARCH NODE | Jina API key not provided");
            return null;
        }

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

        const response = await axios.request(axiosConfig);
        if (response.status === 200) {
            webconsole.success("WEB SEARCH NODE | Successfully searched and extracted data");
            const data = response.data;

            for (const searchResItem of data.data) {
                searchResultMD += `- Title: ${searchResItem.title}, Content: ${searchResItem.content}\n`;
            }

            return searchResultMD;
        }
        else {
            webconsole.error("WEB SEARCH NODE | Some error occured");
            return null;
        }
    }
}

export default web_search_node;