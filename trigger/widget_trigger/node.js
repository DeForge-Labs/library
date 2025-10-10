import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Widget Trigger",
    category: "trigger",
    type: "widget_trigger",
    icon: {},
    desc: "Triggers the flow when a message is recieved from the support bot Widget",
    credit: 0,
    inputs: [
        {
            desc: "Intro message shown by the bot",
            name: "Intro",
            type: "Text",
        },
        {
            desc: "Company Name shown in the widget header",
            name: "Company Name",
            type: "Text",
        },
        {
            desc: "Company or Chatbot description shown in the widget header",
            name: "Description",
            type: "Text",
        },
        {
            desc: "Company Logo shown in the widget header (SVG)",
            name: "Logo",
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
        {
            desc: "Company Name shown in the widget header",
            name: "Company Name",
            type: "Text",
            value: "Deforge Assistant",
        },
        {
            desc: "Company or Chatbot description shown in the widget header",
            name: "Description",
            type: "Text",
            value: "AI Agent is ready to help!",
        },
        {
            desc: "Company Logo shown in the widget header (SVG)",
            name: "Logo",
            type: "TextArea",
            value: "<svg width=\"100%\"...><path d=\"M12...\"/></svg>",
        },
    ],
    difficulty: "easy",
    tags: ["trigger", "support", "bot", 'widget'],
}

class widget_trigger extends BaseNode {
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
        try {
            webconsole.info("WIDGET NODE | Started execution");

            const IntroFilter = inputs.find((e) => e.name === "Intro");
            const Intro = IntroFilter?.value || contents.find((e) => e.name === "Intro")?.value || `🎉 Welcome! I'm your AI assistant. This is a demo workflow. Ask me anything!`;

            const CompanyNameFilter = inputs.find((e) => e.name === "Company Name");
            const CompanyName = CompanyNameFilter?.value || contents.find((e) => e.name === "Company Name")?.value || "Deforge Assistant";

            const DescriptionFilter = inputs.find((e) => e.name === "Description");
            const Description = DescriptionFilter?.value || contents.find((e) => e.name === "Description")?.value || "AI Agent is ready to help!";

            const LogoFilter = inputs.find((e) => e.name === "Logo");
            const Logo = LogoFilter?.value || contents.find((e) => e.name === "Logo")?.value || "";

            const payload = serverData.widgetPayload;
            const msg = payload.Message || "";

            const initReq = payload.init || false;

            if (initReq) {
                webconsole.success("WIDGET NODE | Recieved init request, responded successfully");
                return {
                    "Flow": false,
                    "Message": "",
                    "intro": Intro,
                    "companyName": CompanyName,
                    "companyDescription": Description,
                    "companyLogo": Logo,
                    "__terminate": true,
                    "Credits": this.getCredit(),
                };
            }

            webconsole.success("WIDGET NODE | Message recieved, continuing flow");
            return {
                "Flow": true,
                "Message": msg,
                "Credits": this.getCredit(),
            };
        } catch (error) {
            webconsole.error("WIDGET NODE | Some error occured");
            return null;
        }
    }
}

export default widget_trigger;