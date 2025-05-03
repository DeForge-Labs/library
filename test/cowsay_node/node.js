import BaseNode from "../../core/BaseNode/node.js";
import cowsay from 'cowsay';

const config = {
    title: "CowSay",
    category: "test",
    type: "cowsay_node",
    icon: {},
    desc: "This is the test cowsay node",
    inputs: [],
    outputs: [
        
    ],
    fields: {
        text: {
            type: "text",
            desc: "",
            value: "Enter text here...",
        }
    },
    difficulty: "high",
    tags: ['test'],
}

class cowsay_node extends BaseNode {
    constructor() {
        super(config);
    }

    run(inputs, contents) {
        console.log(cowsay.say({
            text: contents.text.value | "Executed test node",
            e: "oO",
            T: "U "
        }));
        return 0;
    }
}

export default cowsay_node;