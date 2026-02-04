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
    { desc: "The flow of the workflow", name: "Flow", type: "Flow" },
    {
      desc: "Optional query to filter databases by name",
      name: "Query",
      type: "Text",
    },
  ],
  outputs: [
    { desc: "The Flow to trigger", name: "Flow", type: "Flow" },
    {
      desc: "The list of databases found (JSON)",
      name: "Databases",
      type: "JSON",
    },
    { desc: "The tool version of this node", name: "Tool", type: "Tool" },
  ],
  fields: [
    {
      name: "Query",
      type: "Text",
      value: "",
      desc: "Optional query to filter databases by name",
    },
    {
      desc: "Connect your Notion Workspace",
      name: "Notion",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["notion", "productivity", "search", "database"],
};

class notion_list_databases extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  extractIdFromUrl(url) {
    const match = url.match(/([a-f0-9]{32})(?=\?|$|#)/);
    if (match && match[0]) {
      const raw = match[0];
      return `${raw.substr(0, 8)}-${raw.substr(8, 4)}-${raw.substr(12, 4)}-${raw.substr(16, 4)}-${raw.substr(20)}`;
    }
    return null;
  }

  async listDatabases(accessToken, query, webconsole) {
    const notion = new Client({ auth: accessToken });

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

      const databases = response.results.map((db) => {
        const urlId = this.extractIdFromUrl(db.url);

        return {
          id: urlId || db.id,
          api_id: db.id,
          title: db.title?.[0]?.plain_text || "Untitled Database",
          url: db.url,
          last_edited: db.last_edited_time,
        };
      });

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

    const query = getValue("Query", "");

    const tokens = serverData.socialList;
    if (!tokens || !Object.keys(tokens).includes("notion")) {
      this.setCredit(0);
      webconsole.error("NOTION NODE | Notion account not connected.");
      return {
        success: false,
        message: "Notion account not connected",
        Databases: [],
        Tool: null,
      };
    }

    const notionData = tokens["notion"];
    const accessToken = notionData.access_token;

    if (!accessToken) {
      this.setCredit(0);
      webconsole.error(
        "NOTION NODE | Access token missing from connection data.",
      );
      return {
        success: false,
        message: "Invalid Notion connection",
        Databases: [],
        Tool: null,
      };
    }

    const listDbTool = tool(
      async ({ query: tQuery }) => {
        try {
          const dbs = await this.listDatabases(
            accessToken,
            tQuery || "",
            webconsole,
          );
          this.setCredit(this.getCredit() + 5);
          return [JSON.stringify(dbs, null, 2), this.getCredit()];
        } catch (err) {
          this.setCredit(0);
          return [`Error listing databases: ${err.message}`, this.getCredit()];
        }
      },
      {
        name: "notion_list_databases",
        description:
          "Get a list of all Notion databases the user has shared with the integration.",
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
      const dbs = await this.listDatabases(accessToken, query, webconsole);
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
