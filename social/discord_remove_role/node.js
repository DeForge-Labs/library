import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Remove Discord Role",
  category: "social",
  type: "discord_remove_role",
  icon: {},
  desc: "Remove a specific role from a user in the server",
  credit: 5,
  inputs: [
    { desc: "The flow of the workflow", name: "Flow", type: "Flow" },
    {
      desc: "The ID of the User to remove the role from",
      name: "User ID",
      type: "Text",
    },
    { desc: "The ID of the Role to remove", name: "Role ID", type: "Text" },
  ],
  outputs: [
    { desc: "The Flow to trigger next", name: "Flow", type: "Flow" },
    {
      desc: "Was the role removed successfully?",
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
  tags: ["social", "discord", "bot", "role", "remove"],
};

class discord_remove_role extends BaseNode {
  constructor() {
    super(config);
  }

  async executeRemoveRole(userID, roleID, serverID, botToken, webconsole) {
    webconsole.info(
      `DISCORD REMOVE ROLE | Attempting to remove Role ${roleID} from User ${userID}...`,
    );
    try {
      await axios.delete(
        `https://discord.com/api/v10/guilds/${serverID}/members/${userID}/roles/${roleID}`,
        { headers: { Authorization: `Bot ${botToken}` } },
      );
      webconsole.success("DISCORD REMOVE ROLE | Successfully removed role");
      return true;
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      webconsole.error(`DISCORD REMOVE ROLE | Failed - ${msg}`);
      throw new Error(msg);
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("DISCORD REMOVE ROLE NODE | Started execution");

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

    const removeRoleTool = tool(
      async ({ userID: toolUserID, roleID: toolRoleID }) => {
        webconsole.info("DISCORD REMOVE ROLE TOOL | Invoking tool");
        if (!ServerID || !botToken)
          return [
            JSON.stringify({ error: "Missing Server ID or Bot Token" }),
            this.getCredit(),
          ];

        try {
          await this.executeRemoveRole(
            toolUserID,
            toolRoleID,
            ServerID,
            botToken,
            webconsole,
          );
          return [
            JSON.stringify({
              success: true,
              message: `Removed role ${toolRoleID} from user ${toolUserID}`,
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
        name: "discordRemoveRole",
        description:
          "Remove a specific Discord role from a specific user in the server. You must provide the exact Discord User ID and Role ID.",
        schema: z.object({
          userID: z.string().describe("The numerical Discord ID of the user"),
          roleID: z
            .string()
            .describe("The numerical Discord ID of the role to remove"),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    if (!UserID || !RoleID || !ServerID || !botToken) {
      this.setCredit(0);
      return { Flow: true, Success: false, Tool: removeRoleTool };
    }

    try {
      await this.executeRemoveRole(
        UserID,
        RoleID,
        ServerID,
        botToken,
        webconsole,
      );
      return {
        Flow: true,
        Success: true,
        Tool: removeRoleTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      return {
        Flow: true,
        Success: false,
        Tool: removeRoleTool,
        Credits: this.getCredit(),
      };
    }
  }
}

export default discord_remove_role;
