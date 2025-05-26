import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Telegram Trigger",
    category: "trigger",
    type: "tg_trigger",
    icon: {},
    desc: "Triggers the flow when a message is recieved on the telegram bot",
    inputs: [
        {
            desc: "Text to send when recieving the /start command",
            name: "On Start",
            type: "Text",
        }
    ],
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
        },
        {
            desc: "Is the message a bot command ?",
            name: "Is Command",
            type: "Boolean"
        }
    ],
    fields: [
        {
            desc: "Text to send when recieving the /start command",
            name: "On Start",
            type: "TextArea",
            value: "text here ...",
        },
        {
            desc: "Api Key of your Telegram bot",
            name: "TG_API_KEY",
            type: "env",
            defaultValue: "eydnfnuani...",
        },
    ],
    difficulty: "easy",
    tags: ["trigger", "telegram"],
}

class tg_trigger extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        webconsole.info("TG NODE | Started execution");

        const payload = serverData.tgPayload;

        const onStartFilter = inputs.filter((e) => e.name === "On Start");
        const onStartText = onStartFilter.length > 0 ? onStartFilter[0].value : contents.filter((e) => e.name === "On Start")[0].value;

        const msg = payload.message.text;
        const chatID = serverData.chatId;
        const userName = msg.fron.username;
        const isCommand = Object.keys(payload.message).includes("entities");

        if (isCommand && msg.startsWith("/start")) {
            // Logic for telegram send message

            webconsole.success("TG NODE | Recieved start message, responded successfully");
            return {
                "Flow": false,
                "Message": msg,
                "Chat ID": chatID,
                "Username": userName,
                "Is Command": isCommand,
            };
        }

        webconsole.success("TG NODE | Message recieved, continuing flow");
        return {
            "Flow": true,
            "Message": msg,
            "Chat ID": chatID,
            "Username": userName,
            "Is Command": isCommand,
        };
    }
}

export default tg_trigger;