import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Airtable: Get Record",
  category: "database",
  type: "airtable_get_record",
  icon: {},
  desc: "Fetch a single record by its ID in an Airtable Base.",
  credit: 5,
  inputs: [
    { name: "Flow", type: "Flow" },
    { name: "Base ID", type: "Text" },
    { name: "Table Name", type: "Text" },
    { name: "Record ID", type: "Text" },
  ],
  outputs: [
    { name: "Flow", type: "Flow" },
    { name: "Fields", type: "JSON", desc: "The record fields" },
    { name: "Tool", type: "Tool" },
  ],
  fields: [
    { name: "Base ID", type: "Text", value: "", desc: "The Base ID (app...)" },
    { name: "Table Name", type: "Text", value: "", desc: "The Table Name" },
    {
      name: "Record ID",
      type: "Text",
      value: "",
      desc: "The Record ID (rec...)",
    },
    {
      desc: "Connect your Airtable Account",
      name: "Airtable",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["airtable", "database", "get"],
};

class airtable_get_record extends BaseNode {
  constructor() {
    super(config);
  }

  async getRecord(accessToken, baseId, tableName, recordId, webconsole) {
    try {
      webconsole.info(`AIRTABLE NODE | Fetching record ${recordId}...`);

      const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${recordId}`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      webconsole.success("AIRTABLE NODE | Record fetched successfully.");
      return response.data.fields;
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
    const tableName = getValue("Table Name");
    const recordId = getValue("Record ID");

    // Auth Check
    const tokens = serverData.socialList;
    if (!tokens?.airtable?.access_token) {
      this.setCredit(0);
      webconsole.error("AIRTABLE NODE | Account not connected.");
      return { Fields: {}, Tool: null, Credits: 0 };
    }
    const accessToken = tokens.airtable.access_token;

    const toolDef = tool(
      async ({ baseId: b, tableName: t, recordId: r }) => {
        try {
          const fields = await this.getRecord(
            accessToken,
            b || baseId,
            t || tableName,
            r || recordId,
            webconsole,
          );
          this.setCredit(this.getCredit() + 5);
          return [JSON.stringify(fields), this.getCredit()];
        } catch (e) {
          return [e.message, this.getCredit()];
        }
      },
      {
        name: "airtable_get_record",
        description: "Get a specific record from Airtable.",
        schema: z.object({
          baseId: z.string(),
          tableName: z.string(),
          recordId: z.string(),
        }),
      },
    );

    if (!baseId || !tableName || !recordId) {
      return { Fields: {}, Tool: toolDef, Credits: 0 };
    }

    try {
      const fields = await this.getRecord(
        accessToken,
        baseId,
        tableName,
        recordId,
        webconsole,
      );
      this.setCredit(5);
      return { Fields: fields, Tool: toolDef, Credits: this.getCredit() };
    } catch (error) {
      this.setCredit(0);
      return { Fields: {}, Tool: toolDef, Credits: 0 };
    }
  }
}

export default airtable_get_record;
