import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Airtable: List Records",
  category: "database",
  type: "airtable_list_records",
  icon: {},
  desc: "Fetch records from an Airtable Base using OAuth.",
  credit: 5,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The Base ID (starts with app...)",
      name: "Base ID",
      type: "Text",
    },
    {
      desc: "The Table Name or ID (starts with tbl...)",
      name: "Table Name",
      type: "Text",
    },
  ],
  outputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The records found (JSON)",
      name: "Records",
      type: "JSON",
    },
    {
      desc: "The tool version of this node",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      name: "Base ID",
      type: "Text",
      value: "",
      desc: "The Base ID (e.g., appAbc123...)",
    },
    {
      name: "Table Name",
      type: "Text",
      value: "",
      desc: "The Table Name (e.g., Tasks)",
    },
    {
      desc: "Connect your Airtable Account",
      name: "Airtable",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "medium",
  tags: ["airtable", "database", "list"],
};

class airtable_list_records extends BaseNode {
  constructor() {
    super(config);
  }

  async fetchRecords(accessToken, baseId, tableName, webconsole) {
    try {
      webconsole.info(`AIRTABLE NODE | Fetching records from ${tableName}...`);

      const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          maxRecords: 100,
        },
      });

      const records = response.data.records.map((r) => ({
        id: r.id,
        createdTime: r.createdTime,
        fields: r.fields,
      }));

      webconsole.success(`AIRTABLE NODE | Found ${records.length} records.`);
      return records;
    } catch (error) {
      const errMsg = error.response?.data?.error?.message || error.message;
      webconsole.error(`AIRTABLE ERROR | ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    const getValue = (name, defaultValue = null) => {
      const input = inputs.find((i) => i.name === name);
      if (input?.value !== undefined && input.value !== "") return input.value;
      const content = contents.find((c) => c.name === name);
      if (content?.value !== undefined) return content.value;
      return defaultValue;
    };

    const baseId = getValue("Base ID");
    const tableName = getValue("Table Name");

    const tokens = serverData.socialList;
    if (!tokens || !Object.keys(tokens).includes("airtable")) {
      this.setCredit(0);
      webconsole.error("AIRTABLE NODE | Airtable account not connected.");
      return { Records: [], Tool: null, Credits: 0 };
    }

    const airtableData = tokens["airtable"];
    const accessToken = airtableData.access_token;

    if (!accessToken) {
      this.setCredit(0);
      webconsole.error("AIRTABLE NODE | Access token missing.");
      return { Records: [], Tool: null, Credits: 0 };
    }

    if (!baseId || !tableName) {
      webconsole.error("AIRTABLE NODE | Base ID and Table Name are required.");
      return { Records: [], Tool: null, Credits: 0 };
    }

    const atTool = tool(
      async ({ baseId: tBase, tableName: tTable }) => {
        try {
          const recs = await this.fetchRecords(
            accessToken,
            tBase || baseId,
            tTable || tableName,
            webconsole,
          );
          this.setCredit(this.getCredit() + 5);
          return [JSON.stringify(recs), this.getCredit()];
        } catch (err) {
          return [
            `Error fetching Airtable records: ${err.message}`,
            this.getCredit(),
          ];
        }
      },
      {
        name: "airtable_list_records",
        description:
          "List records from an Airtable base. Requires Base ID and Table Name.",
        schema: z.object({
          baseId: z
            .string()
            .describe("The Airtable Base ID (starts with app...)"),
          tableName: z.string().describe("The Table Name"),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    try {
      const records = await this.fetchRecords(
        accessToken,
        baseId,
        tableName,
        webconsole,
      );
      this.setCredit(5);

      return {
        Records: records,
        Tool: atTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      return {
        Records: [],
        Tool: atTool,
        Credits: 0,
      };
    }
  }
}

export default airtable_list_records;
