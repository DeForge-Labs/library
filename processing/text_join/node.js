import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Text Join",
    category: "processing",
    type: "text_join",
    icon: {},
    desc: "Joins multiple text strings into a single string",
    credit: 0,
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Text to join",
            name: "Text",
            type: "Text[]",
        },
    ],
    outputs: [
        {
            desc: "The joined text",
            name: "Text",
            type: "Text",
        },
    ],
    fields: [
        {
            desc: "Text to join",
            name: "Text",
            type: "Text[]",
            value: "Enter text here...",
        },
        {
            desc: "Separator",
            name: "Separator",
            type: "Text",
            value: ",",
        },
    ],
    difficulty: "easy",
    tags: ["text", "join"],
}

class text_join extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        try {
            webconsole.info("TEXT JOIN NODE | Gathering texts");

            const inputTextsFilter = inputs.find((e) => e.name === "Text");
            const inputTexts = inputTextsFilter?.value || [];

            const separatorFilter = contents.find((e) => e.name === "Separator");
            const separator = separatorFilter?.value || "";

            const res = inputTexts.join(separator);

            webconsole.success("TEXT JOIN NODE | Joined texts");
            return res;
        } catch (error) {
            webconsole.error("TEXT JOIN NODE | Some error occured: ", error);
            return null;
        }
    }
}

export default text_join;