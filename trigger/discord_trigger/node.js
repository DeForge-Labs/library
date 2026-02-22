import BaseNode from "../../core/BaseNode/node.js";

const config = {
  title: "Discord Trigger",
  category: "trigger",
  type: "discord_trigger",
  icon: {},
  desc: "Triggers the flow when a user uses a slash command, clicks a button, or sends a text message on your Discord bot",
  credit: 0,
  inputs: [],
  outputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Type of interaction (COMMAND, BUTTON, or MESSAGE)",
      name: "Interaction Type",
      type: "Text",
    },
    {
      desc: "The name of the slash command, or the custom ID of the button clicked",
      name: "Action Value",
      type: "Text",
    },
    {
      desc: "Message received by the bot (or the query from a slash command)",
      name: "Message",
      type: "Text",
    },
    {
      desc: "Channel ID where the interaction happened",
      name: "Channel ID",
      type: "Text",
    },
    {
      desc: "User ID of the person who interacted",
      name: "User ID",
      type: "Text",
    },
    {
      desc: "Server (Guild) ID where the interaction happened",
      name: "Server ID",
      type: "Text",
    },
    {
      desc: "The full raw payload from Discord",
      name: "Payload",
      type: "JSON",
    },
  ],
  fields: [
    {
      desc: "Connect to your Discord bot",
      name: "Discord",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["trigger", "discord", "bot", "command", "button", "message"],
};

class discord_trigger extends BaseNode {
  constructor() {
    super(config);
  }

  /**
   * @override
   * @inheritdoc
   * * @param {import("../../core/BaseNode/node.js").Inputs[]} inputs
   * @param {import("../../core/BaseNode/node.js").Contents[]} contents
   * @param {import("../../core/BaseNode/node.js").IWebConsole} webconsole
   * @param {import("../../core/BaseNode/node.js").IServerData} serverData
   */
  async run(inputs, contents, webconsole, serverData) {
    try {
      webconsole.info("DISCORD TRIGGER | Started execution");

      const payload = serverData.discordPayload;
      if (!payload) {
        webconsole.error(
          "DISCORD TRIGGER | Invalid or missing Discord payload",
        );
        return null;
      }

      const channelID = payload.channel_id || "";
      const serverID = payload.guild_id || "";
      const userID = payload.member?.user?.id || payload.user?.id || "";

      let interactionType = "UNKNOWN";
      let actionValue = "";
      let msg = "";

      if (payload.type === 2) {
        interactionType = "COMMAND";
        actionValue = payload.data?.name || "";
        msg = payload.deforge_query || "";
      } else if (payload.type === 3) {
        interactionType = "BUTTON";
        actionValue = payload.data?.custom_id || "";
      } else if (payload.type === "MESSAGE") {
        interactionType = "MESSAGE";
        msg = payload.data?.content || "";
      }

      webconsole.success(
        `DISCORD TRIGGER | Received ${interactionType} interaction, continuing flow`,
      );

      return {
        Flow: true,
        "Interaction Type": interactionType,
        "Action Value": actionValue,
        Message: msg,
        "Channel ID": channelID,
        "User ID": userID,
        "Server ID": serverID,
        Payload: payload,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("DISCORD TRIGGER | Some error occurred: ", error);
      return null;
    }
  }
}

export default discord_trigger;
