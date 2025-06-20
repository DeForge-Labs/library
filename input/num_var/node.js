import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Number Input",
    category: "input",
    type: "num_var",
    icon: {},
    desc: "Number variable",
    inputs: [],
    outputs: [
        {
            name: "Number",
            type: "Number",
            desc: "",
        }
    ],
    fields: [
        {
            name: "Number",
            type: "Number",
            desc: "",
            value: 0,
        },
    ],
    difficulty: "easy",
    tags: ['int', 'float', 'number'],
}

class num_var extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        webconsole.info("Number Input | emitting output value");
        return contents[0].value;
    }
}

export default num_var;