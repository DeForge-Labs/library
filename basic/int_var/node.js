import BaseNode from "../../core/BaseNode";

const config = {
    title: "Integer",
    inputs: [],
    outputs: [
        {
            name: "Number",
            type: "Integer",
            desc: "",
        }
    ],
    fields: {number: "number"},
    tags: ['int', 'number'],
}

class int_lit extends BaseNode {
    constructor() {
        super(config);
    }

    run(inputs, contents) {
        return contents.number;
    }
}

export default int_lit;