import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Airtable: Create Records",
  category: "database",
  type: "airtable_create_records",
  icon: {},
  desc: "Create new records in an Airtable Base.",
  credit: 10,
  inputs: [
    { name: "Flow", type: "Flow" },
    { name: "Base ID", type: "Text" },
    { name: "Table Name", type: "Text" },
    {
      name: "Fields",
      type: "JSON",
      desc: "JSON object of fields (e.g. {'Name': 'John'})",
    },
  ],
  outputs: [
    { name: "Flow", type: "Flow" },
    { name: "Created IDs", type: "JSON", desc: "List of new Record IDs" },
    { name: "Tool", type: "Tool" },
  ],
  fields: [
    { name: "Base ID", type: "Text", value: "" },
    { name: "Table Name", type: "Text", value: "" },
    { name: "Fields", type: "Map", value: "", desc: "Fields to create" },
    {
      desc: "Connect your Airtable Account",
      name: "Airtable",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "medium",
  tags: ["airtable", "database", "create"],
};

class airtable_create_records extends BaseNode {
  constructor() {
    super(config);
  }

  async createRecords(accessToken, baseId, tableName, fieldsData, webconsole) {
    try {
      webconsole.info(`AIRTABLE NODE | Creating records in ${tableName}...`);

      const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;

      let records = [];
      if (Array.isArray(fieldsData)) {
        records = fieldsData.map((f) => ({ fields: f }));
      } else {
        records = [{ fields: fieldsData }];
      }

      const response = await axios.post(
        url,
        { records },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      const ids = response.data.records.map((r) => r.id);
      webconsole.success(`AIRTABLE NODE | Created ${ids.length} records.`);
      return ids;
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
    let fieldsInput = getValue("Fields");

    // Parse JSON string if needed
    if (fieldsInput && typeof fieldsInput === "string") {
      try {
        fieldsInput = JSON.parse(fieldsInput);
      } catch (e) {}
    }

    // Auth Check
    const tokens = serverData.socialList;
    if (!tokens?.airtable?.access_token) {
      this.setCredit(0);
      webconsole.error("AIRTABLE NODE | Account not connected.");
      return { "Created IDs": [], Tool: null, Credits: 0 };
    }
    const accessToken = tokens.airtable.access_token;

    const toolDef = tool(
      async ({ baseId: b, tableName: t, data }) => {
        try {
          const parsedData = typeof data === "string" ? JSON.parse(data) : data;
          const ids = await this.createRecords(
            accessToken,
            b || baseId,
            t || tableName,
            parsedData,
            webconsole,
          );
          this.setCredit(this.getCredit() + 10);
          return [`Created records: ${ids.join(", ")}`, this.getCredit()];
        } catch (e) {
          return [e.message, this.getCredit()];
        }
      },
      {
        name: "airtable_create_records",
        description:
          "Create records in Airtable. Requires JSON data for fields.",
        schema: z.object({
          baseId: z.string(),
          tableName: z.string(),
          data: z
            .string()
            .describe("JSON string of fields. e.g. {'Name': 'New Item'}"),
        }),
      },
    );

    if (!baseId || !tableName || !fieldsInput) {
      return { "Created IDs": [], Tool: toolDef, Credits: 0 };
    }

    try {
      const ids = await this.createRecords(
        accessToken,
        baseId,
        tableName,
        fieldsInput,
        webconsole,
      );
      this.setCredit(10);
      return { "Created IDs": ids, Tool: toolDef, Credits: this.getCredit() };
    } catch (error) {
      this.setCredit(0);
      return { "Created IDs": [], Tool: toolDef, Credits: 0 };
    }
  }
}

export default airtable_create_records;
