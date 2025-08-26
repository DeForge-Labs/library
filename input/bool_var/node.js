import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Boolean Input",
    category: "input",
    type: "bool_var",
    icon: {},
    desc: "Boolean variable",
    credit: 0,
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

    /**
     * @override
     * @inheritdoc
     * 
     * @param {import("../../core/BaseNode/node.js").Inputs[]} inputs 
     * @param {import("../../core/BaseNode/node.js").Contents[]} contents 
     * @param {import("../../core/BaseNode/node.js").IWebConsole} webconsole 
     * @param {import("../../core/BaseNode/node.js").IServerData} serverData
     */
    async run(inputs, contents, webconsole, serverData) {
        try {
            if (contents.length === 0) {
                webconsole.error("BOOLEAN INPUT | No input given");
                return null;
            }

            webconsole.info("BOOLEAN INPUT | emitting output value");
            return {
                "Boolean": contents[0].value,
                "Credits": this.getCredit(),
            };
        } catch (error) {
            webconsole.error("BOOLEAN INPUT | Some error occured: ", error);
            this.setCredit(0);
            return null;
        }
    }
}

export default bool_var;