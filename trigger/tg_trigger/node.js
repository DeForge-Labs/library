import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import FormData from "form-data";

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
            desc: "Link to the voice message recieved by the bot",
            name: "Voice",
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
    tags: ["trigger", "telegram", "bot"],
}

class tg_trigger extends BaseNode {
    constructor() {
        super(config);
    }

    uploadTo0x0st = async (fileURL) => {
            const url = 'https://0x0.st';
            const form = new FormData();
            form.append("url", fileURL);

            try {
                const response = await axios.post(url, form, {
                    headers: {
                        ...form.getHeaders(),
                        'User-Agent': 'Deforge/1.0 (contact@deforge.io)',
                    },
                });

                if (response.status === 200) {
                    const uploadedUrl = response.data.trim();
                    return uploadedUrl;
                } else {
                    throw new Error(`0x0.st upload failed with status ${response.status}: ${response.data}`);
                }
            } catch (error) {
                webconsole.error(`TG NODE | Error uploading voice to 0x0.st: ${error.message}`);
            }
        }

    async run(inputs, contents, webconsole, serverData) {
        try {
            webconsole.info("TG NODE | Started execution");

            const payload = serverData.tgPayload;

            const onStartFilter = inputs.filter((e) => e.name === "On Start");
            let onStartText = onStartFilter.length > 0 ? onStartFilter[0].value : contents.filter((e) => e.name === "On Start")[0].value || "";
            onStartText = onStartText.length > 4096 ? onStartText.slice(0, -3) + "..." : onStartText;

            const msg = payload.message.text;
            const voice = payload.message.voice?.file_id || "";
            const chatID = serverData.chatId;
            const userName = payload.message.from.username;
            const isCommand = Object.keys(payload.message).includes("entities");

            const botToken = serverData.envList?.TG_API_KEY || "";

            if (isCommand && msg.startsWith("/start")) {

                const startResponse = await axios.get(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatID}&text=${onStartText}`);

                if (startResponse.data.ok) {
                    webconsole.success("TG NODE | Recieved start message, responded successfully");
                    return {
                        "Flow": false,
                        "Message": msg,
                        "Chat ID": chatID,
                        "Username": userName,
                        "Is Command": isCommand,
                        "__terminate": true,
                    };
                }

                webconsole.error(`TG NODE | Recieved start message but some error occured when responding \nError code: ${startResponse.data.error_code}, Description: ${startResponse.data.description}`);
                return {
                    "Flow": false,
                    "Message": msg,
                    "Chat ID": chatID,
                    "Username": userName,
                    "Is Command": isCommand,
                    "__terminate": true,
                };
            }

            let voiceFileURL = "";
            if (voice) {
                const getFileURL = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${voice}`)
                if (getFileURL.data.ok) {
                    const fileURLFromTG = getFileURL.data.result.file_path;
                    voiceFileURL = this.uploadTo0x0st(`https://api.telegram.org/file/bot${botToken}/${fileURLFromTG}`);
                }
            }

            webconsole.success("TG NODE | Message recieved, continuing flow");
            return {
                "Flow": true,
                "Message": msg,
                "Voice": voiceFileURL,
                "Chat ID": chatID,
                "Username": userName,
                "Is Command": isCommand,
            };
        } catch (error) {
            webconsole.error("TG NODE | Some error occured");
            return null;
        }
    }
}

export default tg_trigger;