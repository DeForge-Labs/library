import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Send Widget Response",
    category: "output",
    type: "widget_msg_send",
    icon: {},
    desc: "Send a response to your support bot widget",
    credit: 0,
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Text to send",
            name: "Message",
            type: "Text",
        },
    ],
    outputs: [
        {
            desc: "The Flow to trigger",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "The final output object of chat bot",
            name: "Result",
            type: "JSON"
        },
    ],
    fields: [
        {
            desc: "Text to send",
            name: "Message",
            type: "TextArea",
            value: "text here ...",
        },
    ],
    difficulty: "easy",
    tags: ["output", "support", "bot", "widget"],
}

class widget_msg_send extends BaseNode {
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
        webconsole.info("WIDGET MSG NODE | Started execution");

        const MessageFilter = inputs.filter((e) => e.name === "Message");
        const Message = MessageFilter.length > 0 ? MessageFilter[0].value : contents.filter((e) => e.name === "Message")[0].value || "";

        if (!Message) {
            webconsole.error("WIDGET MSG NODE | Message contents empty");
            return null;
        }

        const ChatId = serverData.widgetPayload?.queryId || "";
        
        if (!ChatId) {
            webconsole.error("WIDGET MSG NODE | No Chat ID found");
            return null;
        }

        try {
            
            const responseObj = {
                "Message": Message,
                "ChatID": ChatId,
            };

            webconsole.success("WIDGET MSG NODE | Successfully generated and emitted respons object");

            return {
                "Result": responseObj
            };
        
        } catch (error) {
            webconsole.error(`WIDGET MSG NODE | Failed to generate output - ${error}`);
            return null;
        }
    }
}

export default widget_msg_send;