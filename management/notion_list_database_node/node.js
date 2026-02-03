import BaseNode from "../../core/BaseNode/node.js";
import { Client } from "@notionhq/client";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Notion: List Databases",
  category: "management",
  type: "notion_list_database_node",
  icon: {},
  desc: "Fetches a list of all Notion databases shared with this integration.",
  credit: 5,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Optional query to filter databases by name",
      name: "Query",
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
      desc: "The list of databases found (JSON)",
      name: "Databases",
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
      name: "Query",
      type: "Text",
      value: "",
      desc: "Optional query to filter databases by name",
    },
    {
      name: "NOTION_API_KEY",
      type: "env",
      desc: "Your Notion Integration Token",
      defaultValue: "NOTION_API_KEY",
    },
  ],
  difficulty: "easy",
  tags: ["notion", "productivity", "search", "database"],
};

class notion_list_databases extends BaseNode {
  constructor() {
    super(config);
  }

  async listDatabases(apiKey, query, webconsole) {
    const notion = new Client({ auth: apiKey });

    try {
      webconsole.info("NOTION NODE | Searching for databases...");

      const searchParams = {
        filter: {
          value: "data_source",
          property: "object",
        },
        page_size: 100,
      };

      if (query && query.trim() !== "") {
        searchParams.query = query;
      }

      const response = await notion.search(searchParams);

      const databases = response.results.map((db) => ({
        id: db.id,
        title: db.title[0]?.plain_text || "Untitled Database",
        url: db.url,
        last_edited: db.last_edited_time,
      }));

      webconsole.success(`NOTION NODE | Found ${databases.length} databases.`);
      return databases;
    } catch (error) {
      webconsole.error(`NOTION ERROR | ${error.message}`);
      throw error;
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

    const apiKey = serverData.envList?.NOTION_API_KEY;
    const query = getValue("Query", "");

    if (!apiKey) {
      webconsole.error(
        "NOTION NODE | API Key missing. Please set NOTION_API_KEY.",
      );
      return { Databases: [], Tool: null, Credits: 0 };
    }

    const listDbTool = tool(
      async ({ query: tQuery }) => {
        try {
          const dbs = await this.listDatabases(
            apiKey,
            tQuery || "",
            webconsole,
          );
          this.setCredit(this.getCredit() + 5);
          return [JSON.stringify(dbs, null, 2), this.getCredit()];
        } catch (err) {
          return [`Error listing databases: ${err.message}`, this.getCredit()];
        }
      },
      {
        name: "notion_list_databases",
        description:
          "Get a list of all Notion databases I have access to. Use this to find the ID of a database by its name.",
        schema: z.object({
          query: z
            .string()
            .optional()
            .describe("Optional name to filter the list"),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    try {
      const dbs = await this.listDatabases(apiKey, query, webconsole);
      this.setCredit(5);

      return {
        Databases: dbs,
        Tool: listDbTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      return {
        Databases: [],
        Tool: listDbTool,
        Credits: 0,
      };
    }
  }
}

export default notion_list_databases;
