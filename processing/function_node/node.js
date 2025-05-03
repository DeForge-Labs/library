import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Function",
    category: "processing",
    type: "function_node",
    icon: {},
    desc: "Process data with custom logic",
    inputs: [
        {
            name: "input",
            type: "any",
            desc: "",
        }
    ],
    outputs: [
        {
            name: "output",
            type: "any",
            desc: "",
        }
    ],
    fields: {
        code: {
            type: "textArea",
            desc: "",
            value: "Enter code here...",
        }
    },
    difficulty: "high",
    tags: ['code', 'function', 'transform'],
}

class function_node extends BaseNode {
    constructor() {
        super(config);
    }

    run(inputs, contents) {
        console.log(contents.code.value);
        return contents.code.value;
    }
}

export default function_node;