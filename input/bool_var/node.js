import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Boolean Input",
    category: "input",
    type: "bool_var",
    icon: {},
    desc: "Boolean variable",
    inputs: [],
    outputs: [
        {
            name: "Boolean",
            type: "Boolean",
            desc: "",
        }
    ],
    fields: [
        {
            name: "Boolean",
            type: "CheckBox",
            desc: "",
            value: true,
        },
    ],
    difficulty: "easy",
    tags: ['bool', 'true', 'false'],
}

class bool_var extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        try {
            if (contents.length === 0) {
                webconsole.error("BOOLEAN INPUT | No input given");
                return null;
            }

            webconsole.info("BOOLEAN INPUT | emitting output value");
            return contents[0].value;
        } catch (error) {
            webconsole.error("BOOLEAN INPUT | Some error occured: ", error);
            return null;
        }
    }
}

export default bool_var;