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
            name: "Text",
            type: "Text",
            desc: "",
        }
    ],
    outputs: [
        
    ],
    fields: [
        {
            name: "Text",
            type: "Text",
            desc: "",
            value: "Enter text here...",
        }
    ],
    difficulty: "hard",
    tags: ['test'],
}

class cowsay_node extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {

        let text = "";
        if (contents?.length > 0) {
            text = contents[0].value;
        }
        else {
            text = inputs[0].value;
        }

        webconsole.info(cowsay.say({
            text: text,
            e: "oO",
            T: "U "
        }));
        return 0;
    }
}

export default cowsay_node;