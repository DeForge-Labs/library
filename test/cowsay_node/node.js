import BaseNode from "../../core/BaseNode/node.js";
import cowsay from 'cowsay';

const config = {
    title: "CowSay",
    category: "test",
    type: "cowsay_node",
    icon: {},
    desc: "This is the test cowsay node",
    inputs: [
        {
            name: "text",
            type: "text",
            desc: "",
        }
    ],
    outputs: [
        
    ],
    fields: [
        {
            name: "text",
            type: "text",
            desc: "",
            value: "Enter text here...",
        }
    ],
    difficulty: "high",
    tags: ['test'],
}

class cowsay_node extends BaseNode {
    constructor() {
        super(config);
    }

    run(inputs, contents) {

        let text = "";
        if (contents?.length > 0) {
            text = contents[0].value;
        }
        else {
            text = inputs[0].value;
        }

        console.log(cowsay.say({
            text: text,
            e: "oO",
            T: "U "
        }));
        return 0;
    }
}

export default cowsay_node;