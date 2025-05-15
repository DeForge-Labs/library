import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Extract JSON",
    category: "processing",
    type: "json_extract",
    icon: {},
    desc: "Gets the Value from JSON and Provided key as input",
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "JSON to parse",
            name: "Object",
            type: "JSON",
        },
        {
            desc: "Key to extract",
            name: "Key",
            type: "Text",
        },
    ],
    outputs: [
        {
            desc: "The value of the key",
            name: "Value",
            type: "Text",
        },
    ],
    fields: [
        {
            desc: "JSON to parse",
            name: "Object",
            type: "Map",
            value: "Enter JSON here...",
        },
        {
            desc: "Key to extract",
            name: "Key",
            type: "Text",
            value: "key",
        },
    ],
    difficulty: "easy",
    tags: ["json", "extract"],
  }

class json_extract extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        
    }
}

export default json_extract;