import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Telegram Trigger",
    category: "trigger",
    type: "tg_trigger",
    icon: {},
    desc: "Triggers the flow when a message is recieved on the telegram bot",
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
        
    }
}

export default tg_trigger;