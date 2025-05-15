import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Output Text",
    category: "output",
    type: "output_text",
    icon: {},
    desc: "Outputs text to the user",
    inputs: [
        {
            desc: "Text to output",
            name: "Text",
            type: "Text",
        },
    ],
    outputs: [],
    fields: [
        {
            desc: "Text to output",
            name: "Text",
            type: "Text",
            value: "Enter text here...",
        },
    ],
    difficulty: "easy",
    tags: ["output", "text"],
}

class output_text extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        
    }
}

export default output_text;