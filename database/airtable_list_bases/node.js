import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Airtable: List Bases",
  category: "database",
  type: "airtable_list_bases",
  icon: {},
  desc: "Get a list of all Airtable Bases you have access to.",
  credit: 5,
  inputs: [{ name: "Flow", type: "Flow" }],
  outputs: [
    { name: "Flow", type: "Flow" },
    { name: "Bases", type: "JSON", desc: "List of Bases with IDs and Names" },
    { name: "Tool", type: "Tool" },
  ],
  fields: [
    {
      desc: "Connect your Airtable Account",
      name: "Airtable",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["airtable", "database", "search", "meta"],
};

class airtable_list_bases extends BaseNode {
  constructor() {
    super(config);
  }

  async listBases(accessToken, webconsole) {
    try {
      webconsole.info("AIRTABLE NODE | Fetching list of bases...");

      const response = await axios.get(
        "https://api.airtable.com/v0/meta/bases",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const bases = response.data.bases.map((b) => ({
        id: b.id,
        name: b.name,
        permissionLevel: b.permissionLevel,
      }));

      webconsole.success(`AIRTABLE NODE | Found ${bases.length} bases.`);
      return bases;
    } catch (error) {
      const errMsg = error.response?.data?.error?.message || error.message;
      webconsole.error(`AIRTABLE ERROR | ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    const tokens = serverData.socialList;
    if (!tokens?.airtable?.access_token) {
      this.setCredit(0);
      webconsole.error("AIRTABLE NODE | Account not connected.");
      return { Bases: [], Tool: null, Credits: 0 };
    }
    const accessToken = tokens.airtable.access_token;

    const toolDef = tool(
      async () => {
        try {
          const bases = await this.listBases(accessToken, webconsole);
          this.setCredit(this.getCredit() + 5);
          return [JSON.stringify(bases), this.getCredit()];
        } catch (e) {
          return [e.message, this.getCredit()];
        }
      },
      {
        name: "airtable_list_bases",
        description:
          "List all Airtable Bases available to the user. Returns Names and IDs.",
        schema: z.object({}),
      },
    );

    try {
      const bases = await this.listBases(accessToken, webconsole);
      this.setCredit(5);
      return { Bases: bases, Tool: toolDef, Credits: this.getCredit() };
    } catch (error) {
      this.setCredit(0);
      return { Bases: [], Tool: toolDef, Credits: 0 };
    }
  }
}

export default airtable_list_bases;
