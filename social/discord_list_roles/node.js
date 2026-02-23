import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "List Discord Roles",
  category: "social",
  type: "discord_list_roles",
  icon: {},
  desc: "Retrieve a list of all roles available in the server",
  credit: 5,
  inputs: [{ desc: "The flow of the workflow", name: "Flow", type: "Flow" }],
  outputs: [
    { desc: "The Flow to trigger next", name: "Flow", type: "Flow" },
    {
      desc: "JSON Array of all roles in the server",
      name: "Roles Array",
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
      desc: "Connect Discord",
      name: "Discord",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["action", "discord", "bot", "role", "list"],
};

class discord_list_roles extends BaseNode {
  constructor() {
    super(config);
  }

  async executeListRoles(serverID, botToken, webconsole) {
    webconsole.info(
      `DISCORD LIST ROLES | Fetching all roles for server: ${serverID}`,
    );
    try {
      const response = await axios.get(
        `https://discord.com/api/v10/guilds/${serverID}/roles`,
        { headers: { Authorization: `Bot ${botToken}` } },
      );

      const roles = response.data;
      webconsole.success(
        `DISCORD LIST ROLES | Successfully retrieved ${roles.length} roles`,
      );
      return roles;
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      webconsole.error(`DISCORD LIST ROLES | Failed - ${msg}`);
      throw new Error(msg);
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("DISCORD LIST ROLES NODE | Started execution");

    const ServerID =
      serverData.discordPayload?.guild_id || serverData.discordGuildId;
    const botToken = process.env.DISCORD_BOT_TOKEN;

    const listRolesTool = tool(
      async () => {
        webconsole.info("DISCORD LIST ROLES TOOL | Invoking tool");
        if (!ServerID || !botToken)
          return [
            JSON.stringify({ error: "Missing Server ID or Bot Token" }),
            this.getCredit(),
          ];

        try {
          const roles = await this.executeListRoles(
            ServerID,
            botToken,
            webconsole,
          );
          const simplifiedRoles = roles.map((r) => ({
            id: r.id,
            name: r.name,
          }));
          return [
            JSON.stringify({ success: true, roles: simplifiedRoles }),
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
        name: "discordListRoles",
        description:
          "Retrieve a list of all available roles in the Discord server, including their names and numerical IDs.",
        schema: z.object({}),
        responseFormat: "content_and_artifact",
      },
    );

    if (!ServerID || !botToken) {
      this.setCredit(0);
      return { Flow: true, "Roles Array": [], Tool: listRolesTool };
    }

    try {
      const roles = await this.executeListRoles(ServerID, botToken, webconsole);
      return {
        Flow: true,
        "Roles Array": roles,
        Tool: listRolesTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      return {
        Flow: true,
        "Roles Array": [],
        Tool: listRolesTool,
        Credits: this.getCredit(),
      };
    }
  }
}

export default discord_list_roles;
