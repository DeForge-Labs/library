import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";

const config = {
  title: "Send Discord Message",
  category: "output",
  type: "discord_msg_send",
  icon: {},
  desc: "Send a text, media message, or interactive components via your Discord bot",
  credit: 5,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The main text message you want to send",
      name: "Message",
      type: "Text",
    },
    {
      desc: "Channel ID to send the message to",
      name: "ChannelID",
      type: "Text",
    },
    {
      desc: "(Optional) Direct link to an image/media file you want to embed",
      name: "Media Link",
      type: "Text",
    },
    {
      desc: "(Optional) Array of JSON objects representing Discord Components (Action Rows)",
      name: "Components",
      type: "JSON[]",
    },
  ],
  outputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The response from Discord containing the message ID",
      name: "Response",
      type: "JSON",
    },
  ],
  fields: [
    {
      desc: "The main text message you want to send",
      name: "Message",
      type: "TextArea",
      value: "Hello from Deforge!",
    },
    {
      desc: "Channel ID to send the message to",
      name: "ChannelID",
      type: "Text",
      value: "123456789",
    },
    {
      desc: "(Optional) Direct link to an image/media file you want to embed",
      name: "Media Link",
      type: "Text",
      value: "",
    },
    {
      desc: "(Optional) Array of Discord Components",
      name: "Components",
      type: "JSON[]",
      value: "[]",
    },
    {
      desc: "Connect to your Discord account",
      name: "Discord",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["output", "discord", "bot", "message", "media", "components"],
};

class discord_msg_send extends BaseNode {
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
    webconsole.info("DISCORD MSG NODE | Started execution");

    const ChannelFilter = inputs.filter((e) => e.name === "ChannelID");
    const ChannelID =
      ChannelFilter.length > 0
        ? ChannelFilter[0].value
        : contents.filter((e) => e.name === "ChannelID")[0].value || "";

    if (!ChannelID) {
      webconsole.error("DISCORD MSG NODE | No channel ID found");
      return null;
    }

    const MessageFilter = inputs.filter((e) => e.name === "Message");
    let MessageText =
      MessageFilter.length > 0
        ? MessageFilter[0].value
        : contents.filter((e) => e.name === "Message")[0].value || "";

    MessageText =
      MessageText.length > 2000
        ? MessageText.slice(0, 1997) + "..."
        : MessageText;

    if (!MessageText) {
      webconsole.error("DISCORD MSG NODE | No message text provided");
      return null;
    }

    const MediaLinkFilter = inputs.find((e) => e.name === "Media Link");
    const MediaLink =
      MediaLinkFilter?.value ||
      contents.find((e) => e.name === "Media Link")?.value ||
      "";

    const ComponentsFilter = inputs.find((e) => e.name === "Components");
    let ComponentsArray =
      ComponentsFilter?.value ||
      contents.find((e) => e.name === "Components")?.value ||
      [];

    if (
      ComponentsArray &&
      !Array.isArray(ComponentsArray) &&
      typeof ComponentsArray === "object"
    ) {
      ComponentsArray = [ComponentsArray];
    }

    const tokens = serverData.socialList;
    if (!tokens || !Object.keys(tokens).includes("discord")) {
      webconsole.error(
        "DISCORD MSG NODE | Please connect your Discord account in the node settings",
      );
      return null;
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;

    if (!botToken) {
      webconsole.error(
        "DISCORD MSG NODE | Server configuration error: No DISCORD_BOT_TOKEN found in backend env",
      );
      return null;
    }

    try {
      webconsole.info(
        `DISCORD MSG NODE | Sending message to Channel ${ChannelID}...`,
      );

      const payload = {
        content: MessageText,
      };

      if (MediaLink) {
        payload.embeds = [
          {
            image: {
              url: MediaLink,
            },
          },
        ];
      }

      // --- DEFORGE: ATTACH COMPONENTS TO PAYLOAD ---
      if (ComponentsArray && ComponentsArray.length > 0) {
        // Discord only allows a maximum of 5 Action Rows per message
        if (ComponentsArray.length > 5) {
          webconsole.info(
            "DISCORD MSG NODE | Truncating components array to maximum allowed 5 Action Rows",
          );
          payload.components = ComponentsArray.slice(0, 5);
        } else {
          payload.components = ComponentsArray;
        }
      }
      // ---------------------------------------------

      const response = await axios.post(
        `https://discord.com/api/v10/channels/${ChannelID}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.status === 200) {
        webconsole.success("DISCORD MSG NODE | Sent message successfully");
        return {
          Flow: true,
          Response: response.data,
          Credits: this.getCredit(),
        };
      }
    } catch (error) {
      const discordError = error.response?.data?.message || error.message;
      webconsole.error(
        `DISCORD MSG NODE | Failed to send message - ${discordError}`,
      );
      return null;
    }
  }
}

export default discord_msg_send;
