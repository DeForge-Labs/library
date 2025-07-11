import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Send Support Message",
    category: "output",
    type: "support_msg_send",
    icon: {},
    desc: "Send a message to your support bot chat",
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
        {
            desc: "User ID of the user who sent the text",
            name: "UserID",
            type: "Text"
        }
    ],
    outputs: [
        {
            desc: "The final output object of support bot",
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
        {
            desc: "User ID of the user who sent the text",
            name: "UserID",
            type: "Text",
            value: "123456",
        },
    ],
    difficulty: "easy",
    tags: ["output", "support", "bot"],
}

class support_msg_send extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        webconsole.info("SUPPORT MSG NODE | Started execution");

        const MessageFilter = inputs.filter((e) => e.name === "Message");
        const Message = MessageFilter.length > 0 ? MessageFilter[0].value : contents.filter((e) => e.name === "Message")[0].value || "";

        if (!Message) {
            webconsole.error("SUPPORT MSG NODE | Message contents empty");
            return null;
        }

        const UserFilter = inputs.filter((e) => e.name === "UserID");
        const UserID = UserFilter.length > 0 ? UserFilter[0].value : contents.filter((e) => e.name === "UserID")[0].value || "";
        
        if (!UserID) {
            webconsole.error("SUPPORT MSG NODE | No User ID found");
            return null;
        }

        try {
            
            const responseObj = {
                "Message": Message,
                "UserID": UserID,
            };

            return {
                "Result": responseObj
            };
        
        } catch (error) {
            webconsole.error(`SUPPORT MSG NODE | Failed to generate output - ${error}`);
            return null;
        }
    }
}

export default support_msg_send;