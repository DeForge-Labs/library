import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Number Input",
    category: "input",
    type: "num_var",
    icon: {},
    desc: "Number variable",
    inputs: [],
    outputs: [
        {
            name: "Number",
            type: "Number",
            desc: "",
        }
    ],
    fields: [
        {
            name: "Number",
            type: "Number",
            desc: "",
            value: 0,
        },
    ],
    difficulty: "easy",
    tags: ['int', 'float', 'number'],
}

class num_var extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        try {
            if (contents.length === 0) {
                webconsole.error("NUMBER INPUT | No input given");
                return null;
            }

            if ([NaN, undefined, null].includes(typeof(contents[0].value))) {
                webconsole.error("NUMBER NODE | Invalid input given");
                return null;
            }

            webconsole.info("NUMBER INPUT | emitting output value");
            return contents[0].value;
        } catch (error) {
            webconsole.error("NUMBER NODE | Some error occured: ", error);
            return null;
        }
    }
}

export default num_var;