import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Test",
    category: "basic",
    inputs: [],
    outputs: [
        
    ],
    fields: {
    },
    tags: ['test'],
}

class test_node extends BaseNode {
    constructor() {
        super(config);
    }

    run(inputs, contents) {
        console.log("Test node executed");
        return 0;
    }
}

export default test_node;