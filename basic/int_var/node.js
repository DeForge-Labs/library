import BaseNode from "../../core/BaseNode";

const config = {
    title: "Integer",
    inputs: [],
    outputs: ["int-lit"],
    conn_color: "#FFFFFF",

    content: {number: "number-field"}
}

class int_lit extends BaseNode {
    constructor() {
        super(config);
    }

    run(inputs) {
        return this.content.number;
    }
}

export default int_lit;