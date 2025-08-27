import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Dummy Tool",
    category: "tools",
    type: "dummy_tool",
    icon: {},
    desc: "Tool input from users",
    credit: 0,
    inputs: [
        {
            desc: "Tools to use",
            name: "Tools",
            type: "Tool[]",
        },
    ],
    outputs: [
        {
            name: "Tool",
            type: "Tool",
            desc: "",
        }
    ],
    fields: [
        {
            desc: "Tools to use",
            name: "Tools",
            type: "Tool[]",
            value: "Enter tools here...",
        },
    ],
    difficulty: "easy",
    tags: ['str', 'text', 'user', 'input'],
}

class dummy_tool extends BaseNode {
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
            webconsole.info("DUMMY TOOL INVOKED");
            return "Lol"
            
        } catch (error) {
            webconsole.error("DUMMY TOOL | Some error occured: ", error);
            return null;
        }
    }
}

export default dummy_tool;