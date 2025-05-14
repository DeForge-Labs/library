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
    fields: [
        {
            name: "code",
            type: "textArea",
            desc: "",
            value: "Enter code here...",
        }
    ],
    difficulty: "hard",
    tags: ['code', 'function', 'transform'],
}

class function_node extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        webconsole.success(contents.code.value);
        return contents[0].value;
    }
}

export default function_node;