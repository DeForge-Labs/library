import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Output Text",
    category: "output",
    type: "output_text",
    icon: {},
    desc: "Outputs text to the user",
    credit: 100,
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
        try {
            const StringOutput = Object.keys(inputs).length > 0 ? inputs[0].value : "";

            webconsole.info("TEXT OUTPUT | Emmitting JSON output");

            return StringOutput;
        } catch (error) {
            webconsole.error("TEXT OUTPUT | Some error occured: ", error);
            return null;
        }
    }
}

export default output_text;