import BaseNode from "../../core/BaseNode/node.js";
import { WebClient } from "@slack/web-api";

const config = {
    title: "Send Slack Message",
    category: "output",
    type: "slack_msg_send",
    icon: {},
    desc: "Send a message via your Slack bot",
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
        {
            desc: "Channel ID to send the text to",
            name: "ChannelID",
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
            desc: "Channel ID to send the text to",
            name: "ChannelID",
            type: "Text",
            value: "123456",
        },
    ],
    difficulty: "easy",
    tags: ["output", "slack", "bot"],
}

class slack_msg_send extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        webconsole.info("SLACK MSG NODE | Started execution");

        const MessageFilter = inputs.filter((e) => e.name === "Message");
        let Message = MessageFilter.length > 0 ? MessageFilter[0].value : contents.filter((e) => e.name === "Message")[0].value || "";
        Message = Message.length > 39990 ? Message.slice(0, -3) + "..." : Message;

        if (!Message) {
            webconsole.error("SLACK MSG NODE | Message contents empty");
            return null;
        }

        const ChannelFilter = inputs.filter((e) => e.name === "ChannelID");
        const channelID = ChannelFilter.length > 0 ? ChannelFilter[0].value : contents.filter((e) => e.name === "ChannelID")[0].value || "";
        
        if (!channelID) {
            webconsole.error("SLACK MSG NODE | No Channel ID found");
            return null;
        }

        const tokens = serverData.socialList;
        if (!Object.keys(tokens).includes("slack")) {
            webconsole.error("SLACK MSG NODE | Please connect your slack account");
            return null;
        }

        const botToken = tokens["slack"].access_token;

        if (!botToken) {
            webconsole.error("SLACK MSG NODE | No Bot token found");
            return null;
        }

        try {
            webconsole.info("SLACK MSG NODE | Sending message to ", channelID);
            
            const client = new WebClient(botToken);

            const response = await client.chat.postMessage({
                channel: channelID,
                text: Message,
            });

            if (response.ok) {
                webconsole.success("SLACK MSG NODE | Sent message successfully as plain text");
                return response;
            }

            webconsole.error(`SLACK MSG NODE | Error message - Error: ${response.error}`);
            return response.error;

        } catch (error) {
            webconsole.error(`SLACK MSG NODE | Failed to send message - ${error}`);
            return null
        }
    }
}

export default slack_msg_send;