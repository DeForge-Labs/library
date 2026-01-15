import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";

const config = {
    title: "Send Telegram Media Message",
    category: "output",
    type: "tg_media_msg_send",
    icon: {},
    desc: "Send a media message via your telegram bot",
    credit: 0,
    inputs: [
        {
            desc: "The flow of the workflow",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Direct link to the Media file you want to send",
            name: "Media Link",
            type: "Text",
        },
        {
            desc: "Caption text to send",
            name: "Caption",
            type: "Text",
        },
        {
            desc: "Chat ID to send the text to",
            name: "ChatID",
            type: "Text"
        }
    ],
    outputs: [
        {
            desc: "The Flow to trigger",
            name: "Flow",
            type: "Flow",
        },
    ],
    fields: [
        {
            desc: "Direct link to the Media file you want to send",
            name: "Media Link",
            type: "Text",
            value: "link here ...",
        },
        {
            desc: "Caption text to send",
            name: "Caption",
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
            desc: "Media type that you want to send",
            name: "Media Type",
            type: "select",
            value: "voice",
            options: [
                "voice",
                "audio",
                "video",
                "gif",
                "photo",
                "document",
            ],
        },
        {
            desc: "Api Key of your Telegram bot",
            name: "TG_API_KEY",
            type: "env",
            defaultValue: "eydnfnuani...",
        },
    ],
    difficulty: "easy",
    tags: ["output", "media", "telegram", "bot"],
}

class tg_media_msg_send extends BaseNode {
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
        webconsole.info("TG MEDIA MSG NODE | Started execution");

        const CaptionFilter = inputs.filter((e) => e.name === "Caption");
        let Caption = CaptionFilter.length > 0 ? CaptionFilter[0].value : contents.filter((e) => e.name === "Caption")[0].value || "";
        Caption = Caption.length > 1024 ? Caption.slice(0, -3) + "..." : Caption;

        const UserFilter = inputs.filter((e) => e.name === "ChatID");
        const UserID = UserFilter.length > 0 ? UserFilter[0].value : contents.filter((e) => e.name === "ChatID")[0].value || "";
        
        if (!UserID) {
            webconsole.error("TG MEDIA MSG NODE | No User ID found");
            return null;
        }

        let mediaType = contents.find((e) => e.name === "MediaType")?.value || "voice";
        mediaType = mediaType === "gif" ? "animation" : mediaType;

        const routeMap = {
            "voice": "sendVoice",
            "audio": "sendAudio",
            "video": "sendVideo",
            "animation": "sendAnimation",
            "photo": "sendPhoto",
            "document": "sendDocument",
        }

        const MediaLinkFilter = inputs.find((e) => e.name === "Media Link");
        const MediaLink = MediaLinkFilter?.value || contents.find((e) => e.name === "Media Link")?.value || "";

        if (!MediaLink) {
            webconsole.error("TG MEDIA MSG NODE | No Link to Media file found");
        }

        const botToken = serverData.envList?.TG_API_KEY || "";

        if (!botToken) {
            webconsole.error("TG MEDIA MSG NODE | No Bot token found");
            return null;
        }

        try {
            webconsole.info("TG MEDIA MSG NODE | Sending message");
            
            const plainResponse = await axios.get(`https://api.telegram.org/bot${botToken}/${routeMap[mediaType]}`, {
                params: {
                    chat_id: UserID,
                    ...(Caption && { caption: Caption }),
                    [mediaType]: MediaLink,
                }
            });

            if (plainResponse.data.ok) {
                webconsole.success("TG MEDIA MSG NODE | Sent message successfully");
                return plainResponse.data;
            }

            webconsole.error(`TG MEDIA MSG NODE | Error sending media message - Error code: ${plainResponse.data.error_code}, Description: ${plainResponse.data.description}`);
            return plainResponse.data;

        } catch (error) {
            webconsole.error(`TG MEDIA MSG NODE | Failed to send message - ${error.response?.data?.description || error.message}`);
            return null
        }
    }
}

export default tg_media_msg_send;