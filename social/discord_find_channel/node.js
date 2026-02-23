import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Find Discord Channel",
  category: "social",
  type: "discord_find_channel",
  icon: {},
  desc: "Search for a channel by its name and return its ID",
  credit: 5,
  inputs: [
    { desc: "The flow of the workflow", name: "Flow", type: "Flow" },
    {
      desc: "The name of the channel to find (e.g., 'general')",
      name: "Channel Name",
      type: "Text",
    },
  ],
  outputs: [
    { desc: "The Flow to trigger next", name: "Flow", type: "Flow" },
    { desc: "The ID of the found channel", name: "Channel ID", type: "Text" },
    {
      desc: "Full JSON object of the channel",
      name: "Channel Data",
      type: "JSON",
    },
    {
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "The name of the channel to find",
      name: "Channel Name",
      type: "Text",
      value: "",
    },
    {
      desc: "Connect Discord",
      name: "Discord",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["action", "discord", "bot", "channel", "find"],
};

class discord_find_channel extends BaseNode {
  constructor() {
    super(config);
  }

  async executeFindChannel(channelName, serverID, botToken, webconsole) {
    webconsole.info(
      `DISCORD FIND CHANNEL | Searching for channel: ${channelName}`,
    );
    try {
      const response = await axios.get(
        `https://discord.com/api/v10/guilds/${serverID}/channels`,
        { headers: { Authorization: `Bot ${botToken}` } },
      );
      const channel = response.data.find(
        (c) => c.name.toLowerCase() === channelName.toLowerCase(),
      );

      if (!channel) throw new Error(`Channel '${channelName}' not found`);

      webconsole.success(
        `DISCORD FIND CHANNEL | Found ${channel.name} (${channel.id})`,
      );
      return channel;
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      webconsole.error(`DISCORD FIND CHANNEL | Failed - ${msg}`);
      throw new Error(msg);
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("DISCORD FIND CHANNEL NODE | Started execution");

    const getValue = (name) => {
      const input = inputs.find((i) => i.name === name);
      if (input?.value !== undefined) return input.value;
      const content = contents.find((c) => c.name === name);
      return content?.value || "";
    };

    const ChannelName = getValue("Channel Name");
    const ServerID =
      serverData.discordPayload?.guild_id || serverData.discordGuildId;
    const botToken = process.env.DISCORD_BOT_TOKEN;

    const findChannelTool = tool(
      async ({ channelName: toolChannelName }) => {
        webconsole.info("DISCORD FIND CHANNEL TOOL | Invoking tool");
        if (!ServerID || !botToken)
          return [
            JSON.stringify({ error: "Missing Server ID or Bot Token" }),
            this.getCredit(),
          ];

        try {
          const channel = await this.executeFindChannel(
            toolChannelName,
            ServerID,
            botToken,
            webconsole,
          );
          return [
            JSON.stringify({
              success: true,
              channel_id: channel.id,
              name: channel.name,
            }),
            this.getCredit(),
          ];
        } catch (error) {
          return [
            JSON.stringify({ success: false, error: error.message }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "discordFindChannel",
        description:
          "Search for a Discord channel by its exact text name (e.g., 'general', 'support') to retrieve its ID.",
        schema: z.object({
          channelName: z
            .string()
            .describe("The name of the channel to search for"),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    if (!ChannelName || !ServerID || !botToken) {
      this.setCredit(0);
      return {
        Flow: true,
        "Channel ID": "",
        "Channel Data": null,
        Tool: findChannelTool,
      };
    }

    try {
      const channel = await this.executeFindChannel(
        ChannelName,
        ServerID,
        botToken,
        webconsole,
      );
      return {
        Flow: true,
        "Channel ID": channel.id,
        "Channel Data": channel,
        Tool: findChannelTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      return {
        Flow: true,
        "Channel ID": "",
        "Channel Data": null,
        Tool: findChannelTool,
        Credits: this.getCredit(),
      };
    }
  }
}

export default discord_find_channel;
