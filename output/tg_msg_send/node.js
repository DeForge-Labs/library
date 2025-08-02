import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";

const config = {
    title: "Send Telegram Message",
    category: "output",
    type: "tg_msg_send",
    icon: {},
    desc: "Send a message via your telegram bot",
    credit: 100,
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

    /**
     * Sanitizes text for Telegram MarkdownV2 format
     * Escapes special characters that need to be escaped in MarkdownV2
     */
    sanitizeForMarkdownV2(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        // Characters that need to be escaped in MarkdownV2
        const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
        
        let sanitized = text;
        specialChars.forEach(char => {
            const regex = new RegExp('\\' + char, 'g');
            sanitized = sanitized.replace(regex, '\\' + char);
        });

        return sanitized;
    }

    /**
     * Validates if text is safe for MarkdownV2 format
     * Returns true if the text should work with MarkdownV2
     */
    validateMarkdownV2(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }

        // Check for balanced markdown elements
        const backticks = (text.match(/`/g) || []).length;
        const asterisks = (text.match(/\*/g) || []).length;
        const underscores = (text.match(/_/g) || []).length;
        const tildes = (text.match(/~/g) || []).length;

        // Basic validation - even number of markdown characters (should be paired)
        return backticks % 2 === 0 && asterisks % 2 === 0 && underscores % 2 === 0 && tildes % 2 === 0;
    }

    async run(inputs, contents, webconsole, serverData) {
        webconsole.info("TG MSG NODE | Started execution");

        const MessageFilter = inputs.filter((e) => e.name === "Message");
        let Message = MessageFilter.length > 0 ? MessageFilter[0].value : contents.filter((e) => e.name === "Message")[0].value || "";
        Message = Message.length > 3950 ? Message.slice(0, -3) + "..." : Message;

        if (!Message) {
            webconsole.error("TG MSG NODE | Message contents empty");
            return null;
        }

        const UserFilter = inputs.filter((e) => e.name === "ChatID");
        let UserID = UserFilter.length > 0 ? UserFilter[0].value : contents.filter((e) => e.name === "ChatID")[0].value || "";
        
        if (!UserID) {
            webconsole.error("TG MSG NODE | No User ID found");
            return null;
        }

        const botToken = serverData.envList?.TG_API_KEY || "";

        if (!botToken) {
            webconsole.error("TG MSG NODE | No Bot token found");
            return null;
        }

        // First try to send with MarkdownV2 format
        try {
            webconsole.info("TG MSG NODE | Attempting to send with MarkdownV2 format");
            
            // Sanitize the message for MarkdownV2
            const sanitizedMessage = this.sanitizeForMarkdownV2(Message);
            
            const markdownResponse = await axios.get(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                params: {
                    chat_id: UserID,
                    text: sanitizedMessage,
                    parse_mode: 'MarkdownV2'
                }
            });

            if (markdownResponse.data.ok) {
                webconsole.success("TG MSG NODE | Sent message successfully with MarkdownV2 format");
                return markdownResponse.data;
            }
        } catch (error) {
            webconsole.info("TG MSG NODE | MarkdownV2 format failed, falling back to plain text");
            webconsole.info(`Error: ${error.response?.data?.description || error.message}`);
        }

        // Fallback: send as plain text
        try {
            webconsole.info("TG MSG NODE | Sending as plain text");
            
            const plainResponse = await axios.get(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                params: {
                    chat_id: UserID,
                    text: Message
                }
            });

            if (plainResponse.data.ok) {
                webconsole.success("TG MSG NODE | Sent message successfully as plain text");
                return plainResponse.data;
            }

            webconsole.error(`TG MSG NODE | Error sending plain text message - Error code: ${plainResponse.data.error_code}, Description: ${plainResponse.data.description}`);
            return plainResponse.data;

        } catch (error) {
            webconsole.error(`TG MSG NODE | Failed to send message - ${error.response?.data?.description || error.message}`);
            return null
        }
    }
}

export default tg_msg_send;