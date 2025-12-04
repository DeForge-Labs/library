import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Output JSON",
    category: "output",
    type: "output_json",
    icon: {},
    desc: "Outputs JSON to the user",
    credit: 0,
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "JSON to output",
            name: "JSON",
            type: "JSON",
        },
    ],
    outputs: [],
    fields: [
        {
            desc: "JSON to output",
            name: "JSON",
            type: "Map",
            value: "Enter JSON here...",
        },
    ],
    difficulty: "easy",
    tags: ["output", "json"],
}

class output_json extends BaseNode {
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
            const JSONOutput = this.getValue(inputs, contents, "JSON", {});

            webconsole.info("JSON OUTPUT | Emmitting JSON output: ", JSONOutput);

            return {
                "JSON": JSONOutput,
                "Credits": this.getCredit(),
            };
        } catch (error) {
            webconsole.error("JSON OUTPUT | Some error occured: ", error);
            return null;
        }
    }
}

export default output_json;