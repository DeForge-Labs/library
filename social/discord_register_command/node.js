import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";

const config = {
  title: "Register Discord Command",
  category: "social",
  type: "discord_register_command",
  icon: {},
  desc: "Checks if a slash command exists in the connected server, and registers it if it doesn't",
  credit: 5,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The name of the slash command (lowercase, no spaces)",
      name: "Command Name",
      type: "Text",
    },
    {
      desc: "Description of what the command does",
      name: "Description",
      type: "Text",
    },
  ],
  outputs: [
    {
      desc: "The Flow to trigger next",
      name: "Flow",
      type: "Flow",
    },
  ],
  fields: [
    {
      desc: "The name of the slash command (e.g., check-inventory)",
      name: "Command Name",
      type: "Text",
      value: "",
    },
    {
      desc: "Description of what the command does",
      name: "Description",
      type: "Text",
      value: "A custom Deforge agent command",
    },
    {
      desc: "Connect to your Discord account",
      name: "Discord",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["action", "discord", "bot", "setup", "command"],
};

class discord_register_command extends BaseNode {
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
    webconsole.info("DISCORD REGISTER CMD NODE | Started execution");

    const CmdFilter = inputs.find((e) => e.name === "Command Name");
    let CommandName =
      CmdFilter?.value ||
      contents.find((e) => e.name === "Command Name")?.value ||
      "";
    CommandName = CommandName.toLowerCase().replace(/\s+/g, "-");

    const DescFilter = inputs.find((e) => e.name === "Description");
    const Description =
      DescFilter?.value ||
      contents.find((e) => e.name === "Description")?.value ||
      "A custom Deforge agent command";

    if (!CommandName) {
      webconsole.error("DISCORD REGISTER CMD NODE | Missing Command Name");
      return null;
    }

    const ServerID =
      serverData.discordPayload?.guild_id || serverData.discordGuildId;

    if (!ServerID) {
      webconsole.error(
        "DISCORD REGISTER CMD NODE | Could not determine Server ID. Ensure the workspace is connected to a Discord server.",
      );
      return null;
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID;

    if (!botToken || !clientId) {
      webconsole.error(
        "DISCORD REGISTER CMD NODE | Missing Bot credentials in backend environment",
      );
      return null;
    }

    const baseUrl = `https://discord.com/api/v10/applications/${clientId}/guilds/${ServerID}/commands`;
    const headers = {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    };

    try {
      webconsole.info(
        `DISCORD REGISTER CMD NODE | Checking if /${CommandName} exists in server ${ServerID}...`,
      );
      const getResponse = await axios.get(baseUrl, { headers });

      const existingCommands = getResponse.data;
      const commandExists = existingCommands.some(
        (cmd) => cmd.name === CommandName,
      );

      if (commandExists) {
        webconsole.success(
          `DISCORD REGISTER CMD NODE | Command /${CommandName} already exists. Skipping registration.`,
        );
        return {
          Flow: true,
          Credits: this.getCredit(),
        };
      }

      webconsole.info(
        `DISCORD REGISTER CMD NODE | Command not found. Registering /${CommandName}...`,
      );

      const payload = {
        name: CommandName,
        description: Description,
        type: 1,
      };

      await axios.post(baseUrl, payload, { headers });

      webconsole.success(
        `DISCORD REGISTER CMD NODE | Successfully registered /${CommandName}`,
      );
      return {
        Flow: true,
        Credits: this.getCredit(),
      };
    } catch (error) {
      const discordError = error.response?.data?.message || error.message;
      webconsole.error(
        `DISCORD REGISTER CMD NODE | Failed API call - ${discordError}`,
      );
      return null;
    }
  }
}

export default discord_register_command;
