import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Text Input",
    category: "input",
    type: "str_var",
    icon: {},
    desc: "String input from users",
    inputs: [],
    outputs: [
        {
            name: "Text",
            type: "Text",
            desc: "",
        }
    ],
    fields: [
        {
            name: "Text",
            type: "Text",
            desc: "",
            value: "Enter text here...",
        }
    ],
    difficulty: "easy",
    tags: ['str', 'text', 'user', 'input'],
}

class str_var extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        webconsole.info("User Input | emitting output");
        return contents[0].value;
    }
}

export default str_var;