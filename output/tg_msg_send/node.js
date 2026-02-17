import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";

const config = {
  title: "Send Telegram Message",
  category: "output",
  type: "tg_msg_send",
  icon: {},
  desc: "Send a message via your telegram bot",
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
  ],
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
  tags: ["output", "telegram", "bot"],
};

class tg_msg_send extends BaseNode {
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

    // Characters that need to be escaped in MarkdownV2
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
   * Validates if text is safe for MarkdownV2 format
   * Returns true if the text should work with MarkdownV2
   */
  validateMarkdownV2(text) {
    if (!text || typeof text !== "string") {
      return false;
    }

    // Check for balanced markdown elements
    const backticks = (text.match(/`/g) || []).length;
    const asterisks = (text.match(/\*/g) || []).length;
    const underscores = (text.match(/_/g) || []).length;
    const tildes = (text.match(/~/g) || []).length;

    // Basic validation - even number of markdown characters (should be paired)
    return (
      backticks % 2 === 0 &&
      asterisks % 2 === 0 &&
      underscores % 2 === 0 &&
      tildes % 2 === 0
    );
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
    webconsole.info("TG MSG NODE | Started execution");

    // 1. Extract Message
    const MessageFilter = inputs.filter((e) => e.name === "Message");
    let Message =
      MessageFilter.length > 0
        ? MessageFilter[0].value
        : contents.find((e) => e.name === "Message")?.value || "";
    Message = Message.length > 3950 ? Message.slice(0, -3) + "..." : Message;

    if (!Message) {
      webconsole.error("TG MSG NODE | Message contents empty");
      return null;
    }

    // 2. Extract ChatID
    const UserFilter = inputs.filter((e) => e.name === "ChatID");
    let UserID =
      UserFilter.length > 0
        ? UserFilter[0].value
        : contents.find((e) => e.name === "ChatID")?.value || "";

    if (!UserID) {
      webconsole.error("TG MSG NODE | No User ID found");
      return null;
    }

    // 3. Extract ReplyMarkup
    const MarkupFilter = inputs.filter((e) => e.name === "ReplyMarkup");
    let RawMarkup =
      MarkupFilter.length > 0
        ? MarkupFilter[0].value
        : contents.find((e) => e.name === "ReplyMarkup")?.value || null;

    let finalizedMarkup = null;
    if (RawMarkup) {
      try {
        // For POST requests via Axios, we want this to be a JSON object, not a string
        finalizedMarkup =
          typeof RawMarkup === "string" ? JSON.parse(RawMarkup) : RawMarkup;
      } catch (e) {
        webconsole.error("TG MSG NODE | Failed to parse ReplyMarkup JSON");
      }
    }

    const botToken = serverData.envList?.TG_API_KEY || "";
    if (!botToken) {
      webconsole.error("TG MSG NODE | No Bot token found");
      return null;
    }

    // 4. Attempt MarkdownV2 Send (POST Request)
    try {
      const sanitizedMessage = this.sanitizeForMarkdownV2(Message);
      const payload = {
        chat_id: UserID,
        text: sanitizedMessage,
        parse_mode: "MarkdownV2",
      };
      if (finalizedMarkup) payload.reply_markup = finalizedMarkup;

      const markdownResponse = await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        payload,
      );

      if (markdownResponse.data.ok) {
        webconsole.success(
          "TG MSG NODE | Sent message with MarkdownV2 and Buttons",
        );
        return markdownResponse.data;
      }
    } catch (error) {
      webconsole.info(
        "TG MSG NODE | MarkdownV2 failed, falling back to plain text",
      );
    }

    // 5. Fallback: Plain Text Send (POST Request)
    try {
      const payload = {
        chat_id: UserID,
        text: Message,
      };
      if (finalizedMarkup) payload.reply_markup = finalizedMarkup;

      const plainResponse = await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        payload,
      );

      if (plainResponse.data.ok) {
        webconsole.success(
          "TG MSG NODE | Sent message as plain text with Buttons",
        );
        return plainResponse.data;
      }
      return null;
    } catch (error) {
      webconsole.error(
        `TG MSG NODE | Failed to send - ${error.response?.data?.description || error.message}`,
      );
      return null;
    }
  }
}

export default tg_msg_send;
