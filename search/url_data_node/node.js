import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

dotenv.config();

const config = {
    title: "Get URL Data",
    category: "search",
    type: "url_data_node",
    icon: {},
    desc: "Scrape data from a given URL",
    credit: 10,
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "URL to get data from",
            name: "URL",
            type: "Text",
        },
    ],
    outputs: [
        {
            desc: "The scraped content in markdown",
            name: "output",
            type: "Text",
        },
        {
            desc: "The tool version of this node, to be used by LLMs",
            name: "Tool",
            type: "Tool",
        }
    ],
    fields: [
        {
            desc: "URL to scrape",
            name: "URL",
            type: "Text",
            value: "Enter text here...",
        },
    ],
    difficulty: "easy",
    tags: ["link", "search", "web", "scrape"],
}

class url_data_node extends BaseNode {

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

        webconsole.info("URL DATA NODE | Generating tool...");

        if (!process.env.JINA_API_KEY) {
            webconsole.error("URL DATA NODE | Jina API key not provided");
            return null;
        }

        const urlTool = tool(
            async ({ url }, toolConfig) => {
                webconsole.info("URL TOOL | Invoking tool");

                const details = [];
                for (const link of url) {
                    const reqConfig = {
                        method: 'get',
                        maxBodyLength: Infinity,
                        url: `https://r.jina.ai/${link}`,
                        headers: {
                            "Authorization": `Bearer ${process.env.JINA_API_KEY}`
                        }
                    };

                    let res = "";
                    try {
                        const response = await axios.request(reqConfig);
                        if (response.status === 200) {
                            const PageContent = JSON.stringify(response.data);
                            res = `URL content for ${link} in markdown: \n${PageContent.length > 10000 ? PageContent.slice(10000) : PageContent}`;
                            this.setCredit(this.getCredit() + 10);
                            
                        }
                        else {
                            res = `Some error occured fetching data from ${link}`;
                        }
                    } catch (error) {
                        this.setCredit(this.getCredit() - 10);
                        res = `Some error occured fetching data from ${link}`;
                    } finally {
                        details.push(res);
                    }
                }

                return [
                    details.join("\n"),
                    this.getCredit(),
                ];
            },
            {
                name: "urlTool",
                description: "Retrieve information from a given set of urls",
                schema: z.object({ url: z.array(z.string()) }),
                responseFormat: "content_and_artifact",
            }
        );

        webconsole.info("URL DATA NODE | Scraping data from URL...");

        const urlFilter = inputs.find((e) => e.name === "URL");
        const url = urlFilter?.value || contents.find((e) => e.name === "URL")?.value || "";

        if (!url) {
            webconsole.error("URL DATA NODE | No URL found");
            this.setCredit(0);
            return {
                "output": null,
                "Tool": urlTool,
            }
        }

        const axiosConfig = {
            method: "get",
            maxBodyLength: Infinity,
            url: `https://r.jina.ai/${url}`,
            headers: {
                "Authorization": `Bearer ${process.env.JINA_API_KEY}`,
            },
            timeout: 50000
        };

        try {
            
            let scrapeResultMD = "Extracted search results: \n";

            const response = await axios.request(axiosConfig);
            if (response.status === 200) {
                webconsole.success("URL DATA NODE | Successfully scraped data");
                const data = response.data;
                scrapeResultMD += `\n${data}`;

                return {
                    "output": scrapeResultMD,
                    "Tool": urlTool,
                    "Credits": this.getCredit(),
                };
            }
            else {
                webconsole.error("URL DATA NODE | Some error occured");
                this.setCredit(0);
                return {
                    "output": null,
                    "Tool": urlTool,
                }
            }

        } catch (error) {
            webconsole.error("URL DATA NODE | Some error occured: ", error);
            
            this.setCredit(0);
            return {
                "output": null,
                "Tool": urlTool,
            }
        }
    }
}

export default url_data_node;