import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";

const config = {
    title: "Send Telegram Message",
    category: "output",
    type: "tg_msg_send",
    icon: {},
    desc: "Send a message via your telegram bot",
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
            desc: "Chat ID to send the text to",
            name: "ChatID",
            type: "Text"
        }
    ],
    outputs: [],
    fields: [
        {
            desc: "Text to send",
            name: "Message",
            type: "TextArea",
            value: "text here ...",
        },
        {
            desc: "Chat ID to send the text to",
            name: "ChatID",
            type: "Text",
            value: "123456",
        },
        {
            desc: "Api Key of your Telegram bot",
            name: "TG_API_KEY",
            type: "env",
            defaultValue: "eydnfnuani...",
        },
    ],
    difficulty: "easy",
    tags: ["output", "telegram", "bot"],
}

class tg_msg_send extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        webconsole.info("TG MSG NODE | Started execution");

        const MessageFilter = inputs.filter((e) => e.name === "Message");
        let Message = MessageFilter.length > 0 ? MessageFilter[0].value : contents.filter((e) => e.name === "Message")[0].value;
        Message = Message.length > 4096 ? Message.slice(0, -3) + "..." : Message;

        const UserFilter = inputs.filter((e) => e.name === "ChatID");
        let UserID = UserFilter.length > 0 ? UserFilter[0].value : contents.filter((e) => e.name === "ChatID")[0].value;

        const botToken = serverData.envList?.TG_API_KEY || "";

        const startResponse = await axios.get(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${UserID}&text=${Message}`);

        if (startResponse.data.ok) {
            webconsole.success("TG MSG NODE | Sent message successfully");
            return startResponse.data;
        }

        webconsole.error(`TG NODE | Some error occured when sending message \nError code: ${startResponse.data.error_code}, Description: ${startResponse.data.description}`);
        return startResponse.data;
    }
}

export default tg_msg_send;