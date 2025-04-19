import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Integer",
    category: "basic",
    type: "int_var",
    desc: "Integer variable",
    inputs: [],
    outputs: [
        {
            name: "Number",
            type: "Integer",
            desc: "",
        }
    ],
    fields: {
        number: {
            type: "number",
            desc: "",
            value: 0,
        },
    },
    difficulty: "low",
    tags: ['int', 'number'],
}

class int_var extends BaseNode {
    constructor() {
        super(config);
    }

    run(inputs, contents) {
        return contents.number.value;
    }
}

export default int_var;