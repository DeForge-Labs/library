import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Math Operation",
    category: "processing",
    type: "math_operation",
    icon: {},
    desc: "Performs a mathematical operation on two numbers",
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "First number",
            name: "Number 1",
            type: "Number",
        },
        {
            desc: "Second number",
            name: "Number 2",
            type: "Number",
        },
    ],
    outputs: [
        {
            desc: "The result of the operation",
            name: "Result",
            type: "Number",
        },
    ],
    fields: [
        {
            desc: "First number",
            name: "Number 1",
            type: "Number",
            value: 0,
        },
        {
            desc: "Operation",
            name: "Operation",
            type: "select",
            value: "+",
            options: ["+", "-", "*", "/"],
        },
        {
            desc: "Second number",
            name: "Number 2",
            type: "Number",
            value: 0,
        },
    ],
    difficulty: "easy",
    tags: ["math", "operation"],
}

class math_operation extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        
    }
}

export default math_operation;