import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Add Discord Role",
  category: "social",
  type: "discord_add_role",
  icon: {},
  desc: "Assign a specific role to a user in the server",
  credit: 5,
  inputs: [
    { desc: "The flow of the workflow", name: "Flow", type: "Flow" },
    {
      desc: "The ID of the User to receive the role",
      name: "User ID",
      type: "Text",
    },
    { desc: "The ID of the Role to assign", name: "Role ID", type: "Text" },
  ],
  outputs: [
    { desc: "The Flow to trigger next", name: "Flow", type: "Flow" },
    {
      desc: "Was the role added successfully?",
      name: "Success",
      type: "Boolean",
    },
    {
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    { desc: "The ID of the User", name: "User ID", type: "Text", value: "" },
    { desc: "The ID of the Role", name: "Role ID", type: "Text", value: "" },
    {
      desc: "Connect Discord",
      name: "Discord",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["action", "discord", "bot", "role", "add"],
};

class discord_add_role extends BaseNode {
  constructor() {
    super(config);
  }

  async executeAddRole(userID, roleID, serverID, botToken, webconsole) {
    webconsole.info(
      `DISCORD ADD ROLE | Attempting to add Role ${roleID} to User ${userID}...`,
    );
    try {
      await axios.put(
        `https://discord.com/api/v10/guilds/${serverID}/members/${userID}/roles/${roleID}`,
        {},
        { headers: { Authorization: `Bot ${botToken}` } },
      );
      webconsole.success("DISCORD ADD ROLE | Successfully added role");
      return true;
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      webconsole.error(`DISCORD ADD ROLE | Failed - ${msg}`);
      throw new Error(msg);
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("DISCORD ADD ROLE NODE | Started execution");

    const getValue = (name) => {
      const input = inputs.find((i) => i.name === name);
      if (input?.value !== undefined) return input.value;
      const content = contents.find((c) => c.name === name);
      return content?.value || "";
    };

    const UserID = getValue("User ID");
    const RoleID = getValue("Role ID");

    const ServerID =
      serverData.discordPayload?.guild_id || serverData.discordGuildId;
    const botToken = process.env.DISCORD_BOT_TOKEN;

    const addRoleTool = tool(
      async ({ userID: toolUserID, roleID: toolRoleID }) => {
        webconsole.info("DISCORD ADD ROLE TOOL | Invoking tool");
        if (!ServerID || !botToken)
          return [
            JSON.stringify({ error: "Missing Server ID or Bot Token" }),
            this.getCredit(),
          ];

        try {
          await this.executeAddRole(
            toolUserID,
            toolRoleID,
            ServerID,
            botToken,
            webconsole,
          );
          return [
            JSON.stringify({
              success: true,
              message: `Added role ${toolRoleID} to user ${toolUserID}`,
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
        name: "discordAddRole",
        description:
          "Assign a specific Discord role to a specific user in the server. You must provide the exact Discord User ID and Role ID.",
        schema: z.object({
          userID: z.string().describe("The numerical Discord ID of the user"),
          roleID: z
            .string()
            .describe("The numerical Discord ID of the role to assign"),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    if (!UserID || !RoleID || !ServerID || !botToken) {
      this.setCredit(0);
      return { Flow: true, Success: false, Tool: addRoleTool };
    }

    try {
      await this.executeAddRole(UserID, RoleID, ServerID, botToken, webconsole);
      return {
        Flow: true,
        Success: true,
        Tool: addRoleTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      return {
        Flow: true,
        Success: false,
        Tool: addRoleTool,
        Credits: this.getCredit(),
      };
    }
  }
}

export default discord_add_role;
