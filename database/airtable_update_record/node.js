import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Airtable: Update Record",
  category: "database",
  type: "airtable_update_record",
  icon: {},
  desc: "Update a record in Airtable.",
  credit: 10,
  inputs: [
    { name: "Flow", type: "Flow" },
    { name: "Base ID", type: "Text" },
    { name: "Table Name", type: "Text" },
    { name: "Record ID", type: "Text" },
    { name: "Fields", type: "JSON", desc: "Fields to update" },
  ],
  outputs: [
    { name: "Flow", type: "Flow" },
    { name: "Success", type: "Boolean" },
    { name: "Tool", type: "Tool" },
  ],
  fields: [
    { name: "Base ID", type: "Text", value: "" },
    { name: "Table Name", type: "Text", value: "" },
    { name: "Record ID", type: "Text", value: "" },
    { name: "Fields", type: "Map", value: "", desc: "Fields to update" },
    {
      desc: "Connect your Airtable Account",
      name: "Airtable",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "medium",
  tags: ["airtable", "database", "update"],
};

class airtable_update_record extends BaseNode {
  constructor() {
    super(config);
  }

  async updateRecord(
    accessToken,
    baseId,
    tableName,
    recordId,
    fieldsData,
    webconsole,
  ) {
    try {
      webconsole.info(`AIRTABLE NODE | Updating record ${recordId}...`);

      const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${recordId}`;

      await axios.patch(
        url,
        { fields: fieldsData },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      webconsole.success("AIRTABLE NODE | Record updated successfully.");
      return true;
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
    let fieldsInput = getValue("Fields");

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
      return { Success: false, Tool: null, Credits: 0 };
    }
    const accessToken = tokens.airtable.access_token;

    const toolDef = tool(
      async ({ baseId: b, tableName: t, recordId: r, data }) => {
        try {
          const parsedData = typeof data === "string" ? JSON.parse(data) : data;
          await this.updateRecord(
            accessToken,
            b || baseId,
            t || tableName,
            r || recordId,
            parsedData,
            webconsole,
          );
          this.setCredit(this.getCredit() + 10);
          return ["Success", this.getCredit()];
        } catch (e) {
          return [e.message, this.getCredit()];
        }
      },
      {
        name: "airtable_update_record",
        description: "Update a record in Airtable.",
        schema: z.object({
          baseId: z.string(),
          tableName: z.string(),
          recordId: z.string(),
          data: z.string().describe("JSON string of fields to update"),
        }),
      },
    );

    if (!baseId || !tableName || !recordId || !fieldsInput) {
      return { Success: false, Tool: toolDef, Credits: 0 };
    }

    try {
      await this.updateRecord(
        accessToken,
        baseId,
        tableName,
        recordId,
        fieldsInput,
        webconsole,
      );
      this.setCredit(10);
      return { Success: true, Tool: toolDef, Credits: this.getCredit() };
    } catch (error) {
      this.setCredit(0);
      return { Success: false, Tool: toolDef, Credits: 0 };
    }
  }
}

export default airtable_update_record;
