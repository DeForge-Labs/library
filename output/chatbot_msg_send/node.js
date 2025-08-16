import BaseNode from "../../core/BaseNode/node.js";

const config = {
    title: "Send Chatbot Response",
    category: "output",
    type: "chatbot_msg_send",
    icon: {},
    desc: "Send a response to your chat bot chat",
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
    tags: ["output", "chat", "bot"],
}

class chatbot_msg_send extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        webconsole.info("CHATBOT MSG NODE | Started execution");

        const MessageFilter = inputs.filter((e) => e.name === "Message");
        const Message = MessageFilter.length > 0 ? MessageFilter[0].value : contents.filter((e) => e.name === "Message")[0].value || "";

        if (!Message) {
            webconsole.error("CHATBOT MSG NODE | Message contents empty");
            return null;
        }

        const ChatId = serverData.chatbotPayload?.queryId || "";
        
        if (!ChatId) {
            webconsole.error("CHATBOT MSG NODE | No Chat ID found");
            return null;
        }

        try {
            
            const responseObj = {
                "Message": Message,
                "ChatID": ChatId,
            };

            webconsole.success("CHATBOT MSG NODE | Successfully generated and emitted respons object");

            return {
                "Result": responseObj
            };
        
        } catch (error) {
            webconsole.error(`CHATBOT MSG NODE | Failed to generate output - ${error}`);
            return null;
        }
    }
}

export default chatbot_msg_send;