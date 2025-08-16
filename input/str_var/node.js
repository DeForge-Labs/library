import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Text Input",
    category: "input",
    type: "str_var",
    icon: {},
    desc: "String input from users",
    credit: 0,
    inputs: [],
    outputs: [
        {
            name: "Text",
            type: "Text",
            desc: "",
        }
    ],
    fields: [
        {
            name: "Text",
            type: "Text",
            desc: "",
            value: "Enter text here...",
        }
    ],
    difficulty: "easy",
    tags: ['str', 'text', 'user', 'input'],
}

class str_var extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        try {
            if (contents.length === 0) {
                webconsole.error("USER INPUT | No input given");
                return null;
            }

            if ([undefined, null].includes(typeof(contents[0].value))) {
                webconsole.error("USER INPUT | Invalid input given");
                return null;
            }

            webconsole.info("USER INPUT | emitting output");
            return contents[0].value || "";
            
        } catch (error) {
            webconsole.error("USER INPUT | Some error occured: ", error);
            return null;
        }
    }
}

export default str_var;