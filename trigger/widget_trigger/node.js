import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Widget Trigger",
    category: "trigger",
    type: "widget_trigger",
    icon: {},
    desc: "Triggers the flow when a message is recieved from the support bot Widget",
    credit: 100,
    inputs: [
        {
            desc: "Intro message shown by the bot",
            name: "Intro",
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
            desc: "Message recieved by the bot",
            name: "Message",
            type: "Text",
        },
    ],
    fields: [
        {
            desc: "Intro message shown by the bot",
            name: "Intro",
            type: "Text",
            value: `🎉 Welcome! I'm your AI assistant. This is a demo workflow. Ask me anything!`,
        },
    ],
    difficulty: "easy",
    tags: ["trigger", "support", "bot", 'widget'],
}

class widget_trigger extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        try {
            webconsole.info("WIDGET NODE | Started execution");

            const IntroFilter = inputs.find((e) => e.name === "Intro");
            const Intro = IntroFilter?.value || contents.find((e) => e.name === "Intro")?.value || `🎉 Welcome! I'm your AI assistant. This is a demo workflow. Ask me anything!`;

            const payload = serverData.widgetPayload;
            const msg = payload.Message || "";

            const initReq = payload.init || false;

            if (initReq) {
                webconsole.success("WIDGET NODE | Recieved init request, responded successfully");
                return {
                    "Flow": false,
                    "Message": "",
                    "intro": Intro,
                    "__terminate": true,
                };
            }

            webconsole.success("WIDGET NODE | Message recieved, continuing flow");
            return {
                "Flow": true,
                "Message": msg,
            };
        } catch (error) {
            webconsole.error("WIDGET NODE | Some error occured");
            return null;
        }
    }
}

export default widget_trigger;