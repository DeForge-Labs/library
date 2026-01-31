import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "Chatbot Trigger",
  category: "trigger",
  type: "chatbot_trigger",
  icon: {},
  desc: "Triggers the flow when a message is recieved from the Chat Bot UI",
  credit: 0,
  inputs: [],
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
      type: "TextArea",
      value: `🎉 Welcome! I'm your AI assistant. This is a demo workflow. Ask me anything!`,
    },
  ],
  difficulty: "easy",
  tags: ["trigger", "chat", "bot"],
};

class chatbot_trigger extends BaseNode {
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
      webconsole.info("CHAT BOT NODE | Started execution");

      const payload = serverData.chatbotPayload;
      const msg = payload.Message || "";

      webconsole.success("CHAT BOT NODE | Message recieved, continuing flow");
      return {
        Flow: true,
        Message: msg,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("CHAT BOT NODE | Some error occured");
      return null;
    }
  }
}

export default chatbot_trigger;
