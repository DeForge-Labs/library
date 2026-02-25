import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "List Discord Roles",
  category: "social",
  type: "discord_list_roles",
  icon: {},
  desc: "Retrieve a list of all roles in the server, or search for a specific role by name",
  credit: 5,
  inputs: [
    { desc: "The flow of the workflow", name: "Flow", type: "Flow" },
    {
      desc: "(Optional) The name of a specific role to find",
      name: "Role Name",
      type: "Text",
    },
  ],
  outputs: [
    { desc: "The Flow to trigger next", name: "Flow", type: "Flow" },
    {
      desc: "JSON Array of roles (Filtered if a name was provided)",
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
      desc: "(Optional) The name of a specific role to find",
      name: "Role Name",
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
  tags: ["action", "discord", "bot", "role", "list", "find"],
};

class discord_list_roles extends BaseNode {
  constructor() {
    super(config);
  }

  async executeListRoles(serverID, botToken, roleNameFilter, webconsole) {
    webconsole.info(
      `DISCORD LIST ROLES | Fetching all roles for server: ${serverID}`,
    );
    try {
      const response = await axios.get(
        `https://discord.com/api/v10/guilds/${serverID}/roles`,
        { headers: { Authorization: `Bot ${botToken}` } },
      );

      let roles = response.data;

      // --- DEFORGE: OPTIONAL FILTERING LOGIC ---
      if (roleNameFilter && roleNameFilter.trim() !== "") {
        webconsole.info(
          `DISCORD LIST ROLES | Filtering roles for name: '${roleNameFilter}'`,
        );
        const foundRole = roles.find(
          (r) => r.name.toLowerCase() === roleNameFilter.toLowerCase(),
        );

        if (foundRole) {
          roles = [foundRole]; // Return as the first and only object in the array
          webconsole.success(
            `DISCORD LIST ROLES | Found role ${foundRole.name} (${foundRole.id})`,
          );
        } else {
          roles = []; // Return empty array if the specific role wasn't found
          webconsole.error(
            `DISCORD LIST ROLES | Role '${roleNameFilter}' not found`,
          );
        }
      } else {
        webconsole.success(
          `DISCORD LIST ROLES | Successfully retrieved ${roles.length} roles`,
        );
      }
      // -----------------------------------------

      return roles;
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      webconsole.error(`DISCORD LIST ROLES | Failed - ${msg}`);
      throw new Error(msg);
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("DISCORD LIST ROLES NODE | Started execution");

    const getValue = (name) => {
      const input = inputs.find((i) => i.name === name);
      if (input?.value !== undefined) return input.value;
      const content = contents.find((c) => c.name === name);
      return content?.value || "";
    };

    const RoleName = getValue("Role Name");
    const ServerID =
      serverData.discordPayload?.guild_id || serverData.discordGuildId;
    const botToken = process.env.DISCORD_BOT_TOKEN;

    const listRolesTool = tool(
      async ({ roleName: toolRoleName }) => {
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
            toolRoleName,
            webconsole,
          );

          // Map down to just ID and Name to save LLM context window limits
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
          "Retrieve a list of all available roles in the Discord server, or optionally search for a specific role by providing its name.",
        schema: z.object({
          roleName: z
            .string()
            .optional()
            .describe(
              "Optional: The exact name of the role you want to find (e.g., 'Admin'). Leave undefined to list all roles.",
            ),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    if (!ServerID || !botToken) {
      this.setCredit(0);
      return { Flow: true, "Roles Array": [], Tool: listRolesTool };
    }

    try {
      const roles = await this.executeListRoles(
        ServerID,
        botToken,
        RoleName,
        webconsole,
      );
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
