import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "String",
    category: "basic",
    type: "str_var",
    inputs: [],
    outputs: [
        {
            name: "Text",
            type: "String",
            desc: "",
        }
    ],
    fields: {
        text: {
            type: "text",
            desc: "",
            value: "Enter text here...",
        }
    },
    tags: ['str', 'text'],
}

class str_var extends BaseNode {
    constructor() {
        super(config);
    }

    run(inputs, contents) {
        return contents.text.value;
    }
}

export default int_lit;