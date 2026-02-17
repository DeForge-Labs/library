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
      type: "Text",
    },
    {
      desc: "Reply Markup to add extra buttons to the message",
      name: "ReplyMarkup",
      type: "JSON",
    },
  ],
  outputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The response from Telegram containing message_id and chat details",
      name: "Response",
      type: "JSON",
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
      options: ["voice", "audio", "video", "gif", "photo", "document"],
    },
    {
      desc: "Reply Markup to add extra buttons to the message",
      name: "ReplyMarkup",
      type: "Map",
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
};

class tg_media_msg_send extends BaseNode {
  constructor() {
    super(config);
  }

  /**
   * Sanitizes text for Telegram MarkdownV2 format
   * Escapes special characters that need to be escaped in MarkdownV2
   */
  sanitizeForMarkdownV2(text) {
    if (!text || typeof text !== "string") {
      return "";
    }

    const specialChars = [
      "_",
      "*",
      "[",
      "]",
      "(",
      ")",
      "~",
      "`",
      ">",
      "#",
      "+",
      "-",
      "=",
      "|",
      "{",
      "}",
      ".",
      "!",
    ];

    let sanitized = text;
    specialChars.forEach((char) => {
      const regex = new RegExp("\\" + char, "g");
      sanitized = sanitized.replace(regex, "\\" + char);
    });

    return sanitized;
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

    // 1. Extract Chat ID
    const UserFilter = inputs.filter((e) => e.name === "ChatID");
    const UserID =
      UserFilter.length > 0
        ? UserFilter[0].value
        : contents.find((e) => e.name === "ChatID")?.value || "";

    if (!UserID) {
      webconsole.error("TG MEDIA MSG NODE | No User ID found");
      return null;
    }

    // 2. Extract Media Link
    const MediaLinkFilter = inputs.filter((e) => e.name === "Media Link");
    const MediaLink =
      MediaLinkFilter.length > 0
        ? MediaLinkFilter[0].value
        : contents.find((e) => e.name === "Media Link")?.value || "";

    if (!MediaLink) {
      webconsole.error("TG MEDIA MSG NODE | No Link to Media file found");
      return null;
    }

    // 3. Extract Media Type (Fixed space in "Media Type")
    let mediaTypeField =
      contents.find((e) => e.name === "Media Type")?.value || "voice";
    let mediaType = mediaTypeField === "gif" ? "animation" : mediaTypeField;

    const routeMap = {
      voice: "sendVoice",
      audio: "sendAudio",
      video: "sendVideo",
      animation: "sendAnimation",
      photo: "sendPhoto",
      document: "sendDocument",
    };

    // 4. Extract Caption (Telegram media caption limit is 1024 chars)
    const CaptionFilter = inputs.filter((e) => e.name === "Caption");
    let Caption =
      CaptionFilter.length > 0
        ? CaptionFilter[0].value
        : contents.find((e) => e.name === "Caption")?.value || "";
    Caption = Caption.length > 1024 ? Caption.slice(0, -3) + "..." : Caption;

    // 5. Extract ReplyMarkup
    const MarkupFilter = inputs.filter((e) => e.name === "ReplyMarkup");
    let RawMarkup =
      MarkupFilter.length > 0
        ? MarkupFilter[0].value
        : contents.find((e) => e.name === "ReplyMarkup")?.value || null;

    let finalizedMarkup = null;
    if (RawMarkup) {
      try {
        finalizedMarkup =
          typeof RawMarkup === "string" ? JSON.parse(RawMarkup) : RawMarkup;
      } catch (e) {
        webconsole.error(
          "TG MEDIA MSG NODE | Failed to parse ReplyMarkup JSON",
        );
      }
    }

    const botToken = serverData.envList?.TG_API_KEY || "";
    if (!botToken) {
      webconsole.error("TG MEDIA MSG NODE | No Bot token found");
      return null;
    }

    const endpoint = `https://api.telegram.org/bot${botToken}/${routeMap[mediaType]}`;

    // 6. Attempt MarkdownV2 Send (POST Request)
    try {
      webconsole.info("TG MEDIA MSG NODE | Attempting to send with MarkdownV2");
      const payload = {
        chat_id: UserID,
        [mediaType]: MediaLink, // Maps dynamically: e.g., photo: "url"
      };

      if (Caption) {
        payload.caption = this.sanitizeForMarkdownV2(Caption);
        payload.parse_mode = "MarkdownV2";
      }
      if (finalizedMarkup) payload.reply_markup = finalizedMarkup;

      const markdownResponse = await axios.post(endpoint, payload);

      if (markdownResponse.data.ok) {
        webconsole.success(
          "TG MEDIA MSG NODE | Sent media message with MarkdownV2 successfully",
        );
        return {
          Response: markdownResponse.data.result,
          Credits: this.getCredit(),
        };
      }
    } catch (error) {
      webconsole.info(
        "TG MEDIA MSG NODE | MarkdownV2 failed, falling back to plain text",
      );
    }

    // 7. Fallback: Plain Text Send (POST Request)
    try {
      webconsole.info("TG MEDIA MSG NODE | Sending as plain text");
      const payload = {
        chat_id: UserID,
        [mediaType]: MediaLink,
      };

      if (Caption) payload.caption = Caption;
      if (finalizedMarkup) payload.reply_markup = finalizedMarkup;

      const plainResponse = await axios.post(endpoint, payload);

      if (plainResponse.data.ok) {
        webconsole.success(
          "TG MEDIA MSG NODE | Sent media message as plain text successfully",
        );
        return {
          Response: plainResponse.data.result,
          Credits: this.getCredit(),
        };
      }
      return null;
    } catch (error) {
      webconsole.error(
        `TG MEDIA MSG NODE | Failed to send - ${error.response?.data?.description || error.message}`,
      );
      return null;
    }
  }
}

export default tg_media_msg_send;
