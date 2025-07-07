import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Output Text",
    category: "output",
    type: "output_text",
    icon: {},
    desc: "Outputs text to the user",
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
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
        const StringOutput = Object.keys(inputs).length > 0 ? inputs[0].value : "";

        webconsole.info("TEXT OUTPUT | Emmitting JSON output");

        return StringOutput;
    }
}

export default output_text;