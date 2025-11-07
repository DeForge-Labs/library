import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import fs from "fs";
import { Downloader } from "nodejs-file-downloader";
import { fileTypeFromFile } from "file-type";
import { v4 as uuidv4 } from "uuid";

const config = {
    title: "Telegram Trigger",
    category: "trigger",
    type: "tg_trigger",
    icon: {},
    desc: "Triggers the flow when a message is recieved on the telegram bot",
    credit: 0,
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
            webconsole.info("TG NODE | Started execution");

            const payload = serverData.tgPayload;

            const onStartFilter = inputs.filter((e) => e.name === "On Start");
            let onStartText = onStartFilter.length > 0 ? onStartFilter[0].value : contents.filter((e) => e.name === "On Start")[0].value || "";
            onStartText = onStartText.length > 4096 ? onStartText.slice(0, -3) + "..." : onStartText;

            const msg = payload.message.text || "";
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
                        "Credits": this.getCredit(),
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
                    "Credits": this.getCredit(),
                };
            }

            let voiceFileURL = "";
            if (voice) {
                const getFileURL = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${voice}`)
                if (getFileURL.data.ok) {
                    const fileURLFromTG = getFileURL.data.result.file_path;
                    const tgVoiceFileURL = `https://api.telegram.org/file/bot${botToken}/${fileURLFromTG}`;

                    const tempDir = "./runtime_files";
                    if (!fs.existsSync(tempDir)) {
                        fs.mkdirSync(tempDir, { recursive: true });
                    }

                    const downloader = new Downloader({
                        url: tgVoiceFileURL,
                        directory: tempDir,
                        onBeforeSave: (fileName) => {
                            const file_ext = fileName.split(".").slice(-1)[0];
                            return `${uuidv4()}.${file_ext}`;
                        }
                    });

                    const { filePath } = await downloader.download();
                    if (!filePath) {
                        webconsole.error("TG NODE | Media download failed.");
                        return null;
                    }
                                
                    const fileType = await fileTypeFromFile(filePath);
                    if (!fileType || (!fileType.mime.startsWith('audio/'))) {
                        webconsole.error("TG NODE | The downloaded file is not a valid audio file.");
                        fs.unlinkSync(filePath);
                        return null;
                    }

                    // Get a readable stream of the downloaded voice file
                    const readVoiceFile = fs.createReadStream(filePath);
                    const { success, fileURL, message } = await serverData.s3Util.addFile(
                        `${uuidv4()}.${fileType.ext}`,
                        readVoiceFile,
                        fileType.mime,
                    );
                    fs.unlinkSync(filePath);

                    if (!success) {
                        webconsole.error("TG NODE | Upload to S3 failed: ", message);
                        throw new Error("Upload to S3 failed");
                    }

                    voiceFileURL = fileURL;
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
                "Credits": this.getCredit(),
            };
        } catch (error) {
            webconsole.error("TG NODE | Some error occured: ", error);
            return null;
        }
    }
}

export default tg_trigger;