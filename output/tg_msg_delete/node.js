import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";

const config = {
  title: "Delete Telegram Message",
  category: "output",
  type: "tg_msg_delete",
  icon: {},
  desc: "Delete a specific message in a Telegram chat",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Chat ID where the message is located",
      name: "ChatID",
      type: "Text",
    },
    {
      desc: "ID of the message to delete",
      name: "MessageID",
      type: "Text",
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
      desc: "Chat ID where the message is located",
      name: "ChatID",
      type: "Text",
      value: "123456",
    },
    {
      desc: "ID of the message to delete",
      name: "MessageID",
      type: "Text",
      value: "987",
    },
    {
      desc: "Api Key of your Telegram bot",
      name: "TG_API_KEY",
      type: "env",
      defaultValue: "eydnfnuani...",
    },
  ],
  difficulty: "easy",
  tags: ["action", "telegram", "bot", "delete"],
};

class tg_msg_delete extends BaseNode {
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
    webconsole.info("TG DELETE NODE | Started execution");

    const ChatFilter = inputs.filter((e) => e.name === "ChatID");
    let ChatID =
      ChatFilter.length > 0
        ? ChatFilter[0].value
        : contents.find((e) => e.name === "ChatID")?.value || "";

    if (!ChatID) {
      webconsole.error("TG DELETE NODE | No Chat ID found");
      return null;
    }

    const MsgFilter = inputs.filter((e) => e.name === "MessageID");
    let MessageID =
      MsgFilter.length > 0
        ? MsgFilter[0].value
        : contents.find((e) => e.name === "MessageID")?.value || "";

    if (!MessageID) {
      webconsole.error("TG DELETE NODE | No Message ID found");
      return null;
    }

    const botToken = serverData.envList?.TG_API_KEY || "";
    if (!botToken) {
      webconsole.error("TG DELETE NODE | No Bot token found");
      return null;
    }

    try {
      const payload = {
        chat_id: ChatID,
        message_id: MessageID,
      };

      const response = await axios.post(
        `https://api.telegram.org/bot${botToken}/deleteMessage`,
        payload,
      );

      if (response.data.ok) {
        webconsole.success(
          `TG DELETE NODE | Successfully deleted message ${MessageID} in chat ${ChatID}`,
        );
        return response.data;
      }
    } catch (error) {
      webconsole.error(
        `TG DELETE NODE | Failed to delete message - ${error.response?.data?.description || error.message}`,
      );
      return null;
    }
  }
}

export default tg_msg_delete;
