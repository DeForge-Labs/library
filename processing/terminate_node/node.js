import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Terminate Agent",
    category: "processing",
    type: "terminate_node",
    icon: {},
    desc: "Terminate the flow of the agent",
    credit: 0,
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Reason for terminating the agent (Optional)",
            name: "Reason",
            type: "Text",
        }
    ],
    outputs: [],
    fields: [
        {
            desc: "Reason for terminating the agent (Optional)",
            name: "Reason",
            type: "TextArea",
            value: "text here ...",
        },
    ],
    difficulty: "easy",
    tags: ["terminate", "stop", "quit"],
}

class terminate_node extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        try {
            webconsole.info("TERMINATE NODE | Terminating agent");

            const reasonFilter = inputs.filter((e) => e.name === "Reason");
            const reasonText = reasonFilter.length > 0 ? reasonFilter[0].value : contents.filter((e) => e.name === "Reason")[0].value || "";

            webconsole.info("TERMINATE NODE | Reason for termination: ", reasonText);

            return {
                "__terminate": true,
            };
                
        } catch (error) {
            webconsole.error("TERMINATE NODE | Some error occured: ", error);
            return null;
        }
    }
}

export default terminate_node;