import BaseNode from "../../core/BaseNode/node.js";
import axios from 'axios';

const config = {
    title: "API Call",
    category: "processing",
    type: "api_node",
    icon: {},
    desc: "call external API",
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "The endpoint of the API",
            name: "endpoint",
            type: "Text",
        },
        {
            desc: "The body of the API",
            name: "body",
            type: "JSON",
        },
        {
            desc: "The headers of the API",
            name: "headers",
            type: "JSON",
        },
    ],
    outputs: [
        {
            desc: "The response of the API",
            name: "output",
            type: "JSON",
        },
    ],
    fields: [
        {
            desc: "The method of the API",
            name: "method",
            type: "select",
            value: "GET",
            options: ["GET", "POST", "PUT", "DELETE"],
        },
        {
            desc: "The endpoint of the API",
            name: "endpoint",
            type: "Text",
            value: "endpoint...",
        },
        {
            desc: "The body of the API",
            name: "body",
            type: "Map",
            value: "Enter body here...",
        },
        {
            desc: "The headers of the API",
            name: "headers",
            type: "Map",
            value: "Enter headers here...",
        }
    ],
    difficulty: "medium",
    tags: ['api', 'http', 'external'],
}

class api_node extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        
        const endpointFilter = inputs.filter((e) => e.name === "endpoint");
        const endpoint = endpointFilter.length > 0 ? endpointFilter[0].value : contents.filter((e) => e.name === "endpoint")[0].value;

        const bodyFilter = inputs.filter((e) => e.name === "body");
        const body = bodyFilter.length > 0 ? bodyFilter[0].value : contents.filter((e) => e.name === "body")[0].value;

        const headersFilter = inputs.filter((e) => e.name === "headers");
        const headers = headersFilter.length > 0 ? headersFilter[0].value : contents.filter((e) => e.name === "headers")[0].value;

        const method = contents.filter((e) => e.name === "method")[0].value;

        const requestConfig = {
            method: method,
            maxBodyLength: Infinity,
            url: endpoint,
            ...(headers !== null && { headers: headers }),
            data: JSON.stringify(body)
        };

        try {

            const response = await axios.request(requestConfig);
            webconsole.info(JSON.stringify(response.data));
            return JSON.stringify(response.data);

        } catch (error) {
            
            webconsole.error(error);
            return JSON.stringify(error);
        }
    }
}

export default api_node;