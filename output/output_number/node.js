import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Output Number",
    category: "output",
    type: "output_number",
    icon: {},
    desc: "Outputs number to the user",
    credit: 0,
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Number to output",
            name: "Number",
            type: "Number",
        },
    ],
    outputs: [],
    fields: [
        {
            desc: "Number to output",
            name: "Number",
            type: "Number",
            value: 0,
        },
    ],
    difficulty: "easy",
    tags: ["output", "number"],
}

class output_number extends BaseNode {
    constructor() {
        super(config);
    }

    getValue(inputs, contents, name, defaultValue = null) {
        const input = inputs.find((i) => i.name === name);
        if (input?.value !== undefined) return input.value;
        const content = contents.find((c) => c.name === name);
        if (content?.value !== undefined) return content.value;
        return defaultValue;
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
            const NumberOutput = this.getValue(inputs, contents, "Number", 0);

            webconsole.info("NUMBER OUTPUT | Emmitting number output");

            return {
                "Number": NumberOutput,
                "Credits": this.getCredit(),
            };
        } catch (error) {
            webconsole.error("NUMBER OUTPUT | Some error occured: ", error);
            return null;
        }
    }
}

export default output_number;