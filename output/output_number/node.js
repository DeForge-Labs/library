import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Output Number",
    category: "output",
    type: "output_number",
    icon: {},
    desc: "Outputs number to the user",
    inputs: [
        {
            desc: "Number to output",
            name: "Number",
            type: "Number",
        },
    ],
    outputs: [],
    fields: [
        {
            desc: "Number to output",
            name: "Number",
            type: "Number",
            value: 0,
        },
    ],
    difficulty: "easy",
    tags: ["output", "number"],
}

class output_number extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        const NumberOutput = Object.keys(inputs).length > 0 ? inputs[0].value : null;

        webconsole.info("NUMBER OUTPUT | Emmitting JSON output");

        return NumberOutput;
    }
}

export default output_number;