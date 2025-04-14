import BaseNode from "../../core/BaseNode";

const config = {
    title: "String",
    inputs: [],
    outputs: [
        {
            name: "Text",
            type: "String",
            desc: "",
        }
    ],
    fields: {text: "text"},
    tags: ['str', 'text'],
}

class int_lit extends BaseNode {
    constructor() {
        super(config);
    }

    run(inputs, contents) {
        return contents.text;
    }
}

export default int_lit;