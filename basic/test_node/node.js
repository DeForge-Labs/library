import BaseNode from "../../core/BaseNode/node.js";
import cowsay from 'cowsay';

const config = {
    title: "Test",
    category: "basic",
    type: "test_node",
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
        console.log(cowsay.say({
            text: "Executed test node",
            e: "oO",
            T: "U "
        }));
        return 0;
    }
}

export default test_node;