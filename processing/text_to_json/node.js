import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Text to JSON",
    category: "processing",
    type: "text_to_json",
    icon: {},
    desc: "Converts text to JSON",
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Text to convert",
            name: "Text",
            type: "Text",
        },
    ],
    outputs: [
        {
            desc: "The JSON of the text",
            name: "JSON",
            type: "JSON",
        },
    ],
    fields: [
        {
            desc: "Text to convert",
            name: "Text",
            type: "Text",
            value: "Enter text here...",
        },
    ],
    difficulty: "easy",
    tags: ["text", "json"],
}

class text_to_json extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        
    }
}

export default text_to_json;