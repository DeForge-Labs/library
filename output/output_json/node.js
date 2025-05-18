import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Output JSON",
    category: "output",
    type: "output_json",
    icon: {},
    desc: "Outputs JSON to the user",
    inputs: [
        {
            desc: "JSON to output",
            name: "JSON",
            type: "JSON",
        },
    ],
    outputs: [],
    fields: [
        {
            desc: "JSON to output",
            name: "JSON",
            type: "Map",
            value: "Enter JSON here...",
        },
    ],
    difficulty: "easy",
    tags: ["output", "json"],
}

class output_json extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        
    }
}

export default output_json;