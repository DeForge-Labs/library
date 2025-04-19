import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Float",
    category: "basic",
    type: "float_var",
    desc: "Float variable",
    inputs: [],
    outputs: [
        {
            name: "Number",
            type: "Float",
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
    tags: ['float', 'number'],
}

class float_var extends BaseNode {
    constructor() {
        super(config);
    }

    run(inputs, contents) {
        return contents.number.value;
    }
}

export default float_var;