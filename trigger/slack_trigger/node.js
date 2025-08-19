import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Slack Trigger",
    category: "trigger",
    type: "slack_trigger",
    icon: {},
    desc: "Triggers the flow when a message is recieved on the slack bot",
    credit: 0,
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
            desc: "Channel ID of the channel or DM",
            name: "Channel ID",
            type: "Text",
        },
        {
            desc: "User ID of the user",
            name: "User ID",
            type: "Text",
        },
        {
            desc: "Is the message a bot command ?",
            name: "Is Command",
            type: "Boolean"
        }
    ],
    fields: [],
    difficulty: "easy",
    tags: ["trigger", "slack", "bot"],
}

class slack_trigger extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        try {
            webconsole.info("SLACK TRIGGER | Started execution");

            const payload = serverData.slackPayload;
            if (payload?.event) {
                webconsole.error("SLACK TRIGGER | Invalid or missing Slack payload");
                return null;
            }

            const msg = payload.event.text || "";
            const channelID = payload.event.channel;
            const userID = payload.event.user;

            webconsole.success("SLACK TRIGGER | Message recieved, continuing flow");
            return {
                "Flow": true,
                "Message": msg,
                "Channel ID": channelID,
                "User ID": userID,
            };
        } catch (error) {
            webconsole.error("SLACK TRIGGER | Some error occured: ", error);
            return null;
        }
    }
}

export default slack_trigger;