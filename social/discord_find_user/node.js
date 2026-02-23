import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Find Discord User",
  category: "social",
  type: "discord_find_user",
  icon: {},
  desc: "Search for a user in the server by their username or nickname",
  credit: 5,
  inputs: [
    { desc: "The flow of the workflow", name: "Flow", type: "Flow" },
    {
      desc: "The username or nickname to search for",
      name: "Search Query",
      type: "Text",
    },
  ],
  outputs: [
    { desc: "The Flow to trigger next", name: "Flow", type: "Flow" },
    { desc: "The ID of the found user", name: "User ID", type: "Text" },
    {
      desc: "Full JSON object of the guild member",
      name: "User Data",
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
      desc: "Username or nickname to search",
      name: "Search Query",
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
  tags: ["action", "discord", "bot", "user", "find"],
};

class discord_find_user extends BaseNode {
  constructor() {
    super(config);
  }

  async executeFindUser(searchQuery, serverID, botToken, webconsole) {
    webconsole.info(`DISCORD FIND USER | Searching for user: ${searchQuery}`);
    try {
      const response = await axios.get(
        `https://discord.com/api/v10/guilds/${serverID}/members/search?query=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { Authorization: `Bot ${botToken}` } },
      );

      const members = response.data;
      if (!members || members.length === 0)
        throw new Error(`User '${searchQuery}' not found`);

      const user = members[0];
      webconsole.success(
        `DISCORD FIND USER | Found user ${user.user.username} (${user.user.id})`,
      );
      return user;
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      webconsole.error(`DISCORD FIND USER | Failed - ${msg}`);
      throw new Error(msg);
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("DISCORD FIND USER NODE | Started execution");

    const getValue = (name) => {
      const input = inputs.find((i) => i.name === name);
      if (input?.value !== undefined) return input.value;
      const content = contents.find((c) => c.name === name);
      return content?.value || "";
    };

    const SearchQuery = getValue("Search Query");
    const ServerID =
      serverData.discordPayload?.guild_id || serverData.discordGuildId;
    const botToken = process.env.DISCORD_BOT_TOKEN;

    const findUserTool = tool(
      async ({ query: toolQuery }) => {
        webconsole.info("DISCORD FIND USER TOOL | Invoking tool");
        if (!ServerID || !botToken)
          return [
            JSON.stringify({ error: "Missing Server ID or Bot Token" }),
            this.getCredit(),
          ];

        try {
          const user = await this.executeFindUser(
            toolQuery,
            ServerID,
            botToken,
            webconsole,
          );
          return [
            JSON.stringify({
              success: true,
              user_id: user.user.id,
              username: user.user.username,
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
        name: "discordFindUser",
        description:
          "Search for a specific Discord user in the server by their username or server nickname to retrieve their User ID.",
        schema: z.object({
          query: z.string().describe("The username or nickname to search for"),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    if (!SearchQuery || !ServerID || !botToken) {
      this.setCredit(0);
      return {
        Flow: true,
        "User ID": "",
        "User Data": null,
        Tool: findUserTool,
      };
    }

    try {
      const user = await this.executeFindUser(
        SearchQuery,
        ServerID,
        botToken,
        webconsole,
      );
      return {
        Flow: true,
        "User ID": user.user.id,
        "User Data": user,
        Tool: findUserTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      return {
        Flow: true,
        "User ID": "",
        "User Data": null,
        Tool: findUserTool,
        Credits: this.getCredit(),
      };
    }
  }
}

export default discord_find_user;
