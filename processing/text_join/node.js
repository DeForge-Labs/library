import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Text Join",
    category: "processing",
    type: "text_join",
    icon: {},
    desc: "Joins multiple text strings into a single string",
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Text to join",
            name: "Text",
            type: "Text[]",
        },
    ],
    outputs: [
        {
            desc: "The joined text",
            name: "Text",
            type: "Text",
        },
    ],
    fields: [
        {
            desc: "Text to join",
            name: "Text",
            type: "Text[]",
            value: "Enter text here...",
        },
        {
            desc: "Separator",
            name: "Separator",
            type: "Text",
            value: ",",
        },
    ],
    difficulty: "easy",
    tags: ["text", "join"],
}

class text_join extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        
    }
}

export default text_join;