import BaseNode from "../../core/BaseNode/node.js";
import { WebClient } from "@slack/web-api";
import axios from "axios";

const config = {
    title: "Send Slack Media Message",
    category: "output",
    type: "slack_media_msg_send",
    icon: {},
    desc: "Send a media message via your slack bot",
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
            desc: "Channel ID to send the text to",
            name: "ChannelID",
            type: "Text"
        }
    ],
    outputs: [],
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
            desc: "Channel ID to send the text to",
            name: "ChannelID",
            type: "Text",
            value: "123456",
        },
    ],
    difficulty: "easy",
    tags: ["output", "media", "slack", "bot"],
}

class slack_media_msg_send extends BaseNode {
    constructor() {
        super(config);
    }

    async run(inputs, contents, webconsole, serverData) {
        webconsole.info("SLACK MEDIA MSG NODE | Started execution");

        const CaptionFilter = inputs.filter((e) => e.name === "Caption");
        let Caption = CaptionFilter.length > 0 ? CaptionFilter[0].value : contents.filter((e) => e.name === "Caption")[0].value || "";
        Caption = Caption.length > 39990 ? Caption.slice(0, -3) + "..." : Caption;

        const ChannelFilter = inputs.filter((e) => e.name === "ChatID");
        const ChannelID = ChannelFilter.length > 0 ? ChannelFilter[0].value : contents.filter((e) => e.name === "ChannelID")[0].value || "";
        
        if (!ChannelID) {
            webconsole.error("SLACK MEDIA MSG NODE | No channel ID found");
            return null;
        }

        const MediaLinkFilter = inputs.find((e) => e.name === "Media Link");
        const MediaLink = MediaLinkFilter?.value || contents.find((e) => e.name === "Media Link")?.value || "";

        if (!MediaLink) {
            webconsole.error("SLACK MEDIA MSG NODE | No Link to Media file found");
        }

        const tokens = serverData.socialList;
        if (!Object.keys(tokens).includes("slack")) {
            webconsole.error("SLACK MSG NODE | Please connect your slack account");
            return null;
        }

        const botToken = tokens["slack"].access_token;

        if (!botToken) {
            webconsole.error("SLACK MEDIA MSG NODE | No Bot token found");
            return null;
        }

        try {
            webconsole.info("SLACK MEDIA MSG NODE | Downloading file from URL");
            
            const fileResponse = await axios.get(MediaLink, {
                responseType: 'arraybuffer',
                maxBodyLength: 1024 * 1024 * 1024,
            });
            const fileBuffer = Buffer.from(fileResponse.data, 'binary');
            const fileName = MediaLink.split('/').pop() || 'file-upload';

            const client = new WebClient(botToken);
            webconsole.info(`SLACK MEDIA MSG NODE | Uploading file to ${ChannelID}...`);

            const response = await client.files.uploadV2({
                channel_id: ChannelID,
                initial_comment: Caption,
                file: fileBuffer,
                filename: fileName,
            });

            if (response.ok) {
                webconsole.success("SLACK MEDIA MSG NODE | Sent message successfully");
                return response;
            }

            webconsole.error(`SLACK MEDIA MSG NODE | Error sending media message - Error: ${response.error}`);
            return response.error;

        } catch (error) {
            webconsole.error(`SLACK MEDIA MSG NODE | Failed to send message - ${error}`);
            return null;
        }
    }
}

export default slack_media_msg_send;