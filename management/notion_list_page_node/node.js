import BaseNode from "../../core/BaseNode/node.js";
import { Client } from "@notionhq/client";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Notion: List Pages",
  category: "management",
  type: "notion_list_page_node",
  icon: {},
  desc: "Search for specific pages in your Notion workspace to get their IDs.",
  credit: 5,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Optional query to filter pages by title",
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
      desc: "The list of pages found (JSON)",
      name: "Pages",
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
      desc: "Optional query to filter pages by title",
    },
    {
      desc: "Connect your Notion Workspace",
      name: "Notion",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["notion", "productivity", "search", "docs"],
};

class notion_list_pages extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  async listPages(accessToken, query, webconsole) {
    const notion = new Client({ auth: accessToken });

    try {
      webconsole.info("NOTION NODE | Searching for pages...");

      const searchParams = {
        filter: {
          value: "page",
          property: "object",
        },
        sort: {
          direction: "descending",
          timestamp: "last_edited_time",
        },
        page_size: 100,
      };

      if (query && query.trim() !== "") {
        searchParams.query = query;
      }

      const response = await notion.search(searchParams);

      const pages = response.results.map((page) => {
        let title = "Untitled Page";
        if (page.properties) {
          const titleProp = Object.values(page.properties).find(
            (prop) => prop.id === "title" || prop.type === "title",
          );
          if (titleProp && titleProp.title && titleProp.title.length > 0) {
            title = titleProp.title[0].plain_text;
          }
        }

        return {
          id: page.id,
          title: title,
          url: page.url,
          last_edited: page.last_edited_time,
          parent_type: page.parent.type,
        };
      });

      webconsole.success(`NOTION NODE | Found ${pages.length} pages.`);
      return pages;
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
      return { Pages: [], Tool: null, Credits: 0 };
    }

    const notionData = tokens["notion"];
    const accessToken = notionData.access_token;

    if (!accessToken) {
      this.setCredit(0);
      webconsole.error("NOTION NODE | Access token missing.");
      return { Pages: [], Tool: null, Credits: 0 };
    }

    const listPagesTool = tool(
      async ({ query: tQuery }) => {
        try {
          const pages = await this.listPages(
            accessToken,
            tQuery || "",
            webconsole,
          );
          this.setCredit(this.getCredit() + 5);
          return [JSON.stringify(pages, null, 2), this.getCredit()];
        } catch (err) {
          this.setCredit(0);
          return [`Error listing pages: ${err.message}`, this.getCredit()];
        }
      },
      {
        name: "notion_list_pages",
        description:
          "Search for Notion pages by title to get their IDs. Useful when you need to read or update a specific document.",
        schema: z.object({
          query: z
            .string()
            .optional()
            .describe(
              "The title (or part of the title) of the page you are looking for",
            ),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    try {
      const pages = await this.listPages(accessToken, query, webconsole);
      this.setCredit(5);

      return {
        Pages: pages,
        Tool: listPagesTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      return {
        Pages: [],
        Tool: listPagesTool,
        Credits: 0,
      };
    }
  }
}

export default notion_list_pages;
