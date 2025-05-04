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
            name: "endpoint",
            type: "String",
            desc: "",
        },
        {
            name: "body",
            type: "String",
            desc: "",
        }
    ],
    outputs: [
        {
            name: "output",
            type: "String",
            desc: "",
        }
    ],
    fields: [
        {
            name: "method",
            type: "select",
            desc: "",
            value: "GET",
            options: ["GET", "POST", "PUT", "DELETE"]
        },
        {
            name: "endpoint",
            type: "text",
            desc: "",
            value: "endpoint..."
        },
        {
            name: "body",
            type: "textArea",
            desc: "",
            value: "Enter body here...",
        },
        {
            name: "TG_API_KEY",
            type: "env",
            desc: "Api Key of Telegram Bot",
            defaultValue: "eydnfnuani...",
        },
    ],
    difficulty: "medium",
    tags: ['api', 'http', 'external'],
}

class api_node extends BaseNode {
    constructor() {
        super(config);
    }

    run(inputs, contents) {
        
        const endpointFilter = inputs.filter((e) => e.name === "endpoint");
        const endpoint = endpointFilter.length > 0 ? endpointFilter[0].value : contents[1].value;

        const bodyFilter = inputs.filter((e) => e.name === "body");
        const body = bodyFilter.length > 0 ? bodyFilter[0].value : contents[2].value;

        const method = contents[0].value;

        const requestConfig = {
            method: method,
            maxBodyLength: Infinity,
            url: endpoint,
            headers: {
                'Content-Type': "application/json"
            },
            data: JSON.stringify(body)
        };

        axios.request(requestConfig)
            .then((response) => {
                console.log(JSON.stringify(response.data));
                return JSON.stringify(response.data);
            })
            .catch((error) => {
                console.error(error);
                return JSON.stringify(error);
            });
    }
}

export default api_node;