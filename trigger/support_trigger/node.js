import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Support Bot Trigger",
    category: "trigger",
    type: "support_trigger",
    icon: {},
    desc: "Triggers the flow when a message is recieved from the Support Bot UI",
    inputs: [],
    outputs: [
        {
            desc: "The Flow to trigger",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Message recieved by the bot",
            name: "Message",
            type: "Text",
        },
        {
            desc: "Chat ID of the user",
            name: "Chat ID",
            type: "Text",
        },
        {
            desc: "Username of the user",
            name: "Username",
            type: "Text",
        }
    ],
    fields: [],
    difficulty: "medium",
    tags: ["trigger", "support", "bot"],
}

class support_trigger extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        try {
            webconsole.info("SUPPORT BOT NODE | Started execution");

            const payload = serverData.supportPayload;
            const msg = payload.message.text;
            const chatID = serverData.chatId;
            const userName = payload.userName;

            webconsole.success("SUPPORT BOT NODE | Message recieved, continuing flow");
            return {
                "Flow": true,
                "Message": msg,
                "Chat ID": chatID,
                "Username": userName,
            };
        } catch (error) {
            webconsole.error("SUPPORT BOT NODE | Some error occured");
            return null;
        }
    }
}

export default support_trigger;