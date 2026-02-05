import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Airtable: List Tables",
  category: "database",
  type: "airtable_list_tables",
  icon: {},
  desc: "Get a list of Tables inside a specific Airtable Base.",
  credit: 5,
  inputs: [
    { name: "Flow", type: "Flow" },
    { name: "Base ID", type: "Text", desc: "The ID of the Base to inspect" },
  ],
  outputs: [
    { name: "Flow", type: "Flow" },
    {
      name: "Tables",
      type: "JSON",
      desc: "List of Tables with IDs, Names, and Fields",
    },
    { name: "Tool", type: "Tool" },
  ],
  fields: [
    { name: "Base ID", type: "Text", value: "", desc: "The Base ID (app...)" },
    {
      desc: "Connect your Airtable Account",
      name: "Airtable",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["airtable", "database", "schema", "meta"],
};

class airtable_list_tables extends BaseNode {
  constructor() {
    super(config);
  }

  async listTables(accessToken, baseId, webconsole) {
    try {
      webconsole.info(`AIRTABLE NODE | Fetching tables for base ${baseId}...`);

      const response = await axios.get(
        `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const tables = response.data.tables.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        fields: t.fields
          ? t.fields.map((f) => ({ name: f.name, type: f.type }))
          : [],
      }));

      webconsole.success(`AIRTABLE NODE | Found ${tables.length} tables.`);
      return tables;
    } catch (error) {
      const errMsg = error.response?.data?.error?.message || error.message;
      webconsole.error(`AIRTABLE ERROR | ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    const getValue = (n) =>
      inputs.find((i) => i.name === n)?.value ||
      contents.find((c) => c.name === n)?.value;
    const baseId = getValue("Base ID");

    const tokens = serverData.socialList;
    if (!tokens?.airtable?.access_token) {
      this.setCredit(0);
      webconsole.error("AIRTABLE NODE | Account not connected.");
      return { Tables: [], Tool: null, Credits: 0 };
    }
    const accessToken = tokens.airtable.access_token;

    const toolDef = tool(
      async ({ baseId: tBase }) => {
        try {
          const tables = await this.listTables(
            accessToken,
            tBase || baseId,
            webconsole,
          );
          this.setCredit(this.getCredit() + 5);
          return [JSON.stringify(tables), this.getCredit()];
        } catch (e) {
          return [e.message, this.getCredit()];
        }
      },
      {
        name: "airtable_list_tables",
        description:
          "List all Tables inside a specific Airtable Base. Returns schema information (column names).",
        schema: z.object({
          baseId: z.string().describe("The Base ID to inspect"),
        }),
      },
    );

    if (!baseId) {
      return { Tables: [], Tool: toolDef, Credits: 0 };
    }

    try {
      const tables = await this.listTables(accessToken, baseId, webconsole);
      this.setCredit(5);
      return { Tables: tables, Tool: toolDef, Credits: this.getCredit() };
    } catch (error) {
      this.setCredit(0);
      return { Tables: [], Tool: toolDef, Credits: 0 };
    }
  }
}

export default airtable_list_tables;
