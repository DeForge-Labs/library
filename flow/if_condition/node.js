import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "If Condition",
    category: "flow",
    type: "if_condition",
    icon: {},
    desc: "Performs a conditional operation based on a condition",
    inputs: [
        {
            desc: "First input",
            name: "Input 1",
            type: "Any",
        },
        {
            desc: "Second input",
            name: "Input 2",
            type: "Any",
        },
    ],
    outputs: [
        {
            desc: "The Flow of the Condition if true",
            name: "True",
            type: "Flow",
        },
        {
            desc: "The Flow of the Condition if false",
            name: "False",
            type: "Flow",
        },
    ],
    fields: [
        {
            desc: "First input",
            name: "Input 1",
            type: "Any",
            value: "Enter input here...",
        },
        {
            desc: "Condition",
            name: "Condition",
            type: "select",
            value: "==",
            options: ["==", "!=", ">", "<", ">=", "<="],
        },
        {
            desc: "Second input",
            name: "Input 2",
            type: "Any",
            value: "Enter input here...",
        },
    ],
    difficulty: "easy",
    tags: ["condition", "if"],
}

class if_condition extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        
    }
}

export default if_condition;