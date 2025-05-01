import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Number",
    category: "basic",
    type: "num_var",
    desc: "Number variable",
    inputs: [],
    outputs: [
        {
            name: "Number",
            type: "Number",
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
    tags: ['int', 'float', 'number'],
}

class num_var extends BaseNode {
    constructor() {
        super(config);
    }

    run(inputs, contents) {
        return contents.number.value;
    }
}

export default num_var;