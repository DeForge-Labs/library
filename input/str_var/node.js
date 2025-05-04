import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "User Input",
    category: "input",
    type: "str_var",
    icon: {},
    desc: "String input from users",
    inputs: [],
    outputs: [
        {
            name: "Text",
            type: "String",
            desc: "",
        }
    ],
    fields: [
        {
            name: "text",
            type: "text",
            desc: "",
            value: "Enter text here...",
        }
    ],
    difficulty: "low",
    tags: ['str', 'text', 'user', 'input'],
}

class str_var extends BaseNode {
    constructor() {
        super(config);
    }

    run(inputs, contents) {
        return contents[0].value;
    }
}

export default str_var;