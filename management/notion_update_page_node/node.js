import BaseNode from "../../core/BaseNode/node.js";
import { Client } from "@notionhq/client";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Notion: Update Page",
  category: "management",
  type: "notion_update_page_node",
  icon: {},
  desc: "Update properties of a Notion page or archive (delete) it.",
  credit: 10,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The 32-character ID of the page to update",
      name: "Page ID",
      type: "Text",
    },
    {
      desc: "JSON object of properties to update (e.g., { 'Status': 'Done' })",
      name: "Properties",
      type: "JSON",
    },
  ],
  outputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The URL of the updated page",
      name: "Page URL",
      type: "Text",
    },
    {
      desc: "The tool version for LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "Connect your Notion Workspace",
      name: "Notion",
      type: "social",
      defaultValue: "",
    },
    {
      name: "Page ID",
      type: "Text",
      value: "",
      desc: "The ID of the page to update",
    },
    {
      name: "Properties",
      type: "Map",
      value: "",
      desc: "JSON object of properties to update (e.g., { 'Status': 'Done' })",
    },
    {
      name: "Archive Page",
      type: "Boolean",
      value: false,
      desc: "If true, this page will be moved to Trash (Soft Delete)",
    },
  ],
  difficulty: "medium",
  tags: ["notion", "update", "edit", "database"],
};

class notion_update_page extends BaseNode {
  constructor() {
    super(config);
  }

  formatProperties(simpleProps) {
    if (!simpleProps || typeof simpleProps !== "object") return {};

    const formatted = {};
    for (const [key, value] of Object.entries(simpleProps)) {
      if (typeof value === "boolean") {
        formatted[key] = { checkbox: value };
      } else if (typeof value === "string") {
        if (key.toLowerCase() === "title" || key.toLowerCase() === "name") {
          formatted[key] = { title: [{ text: { content: value } }] };
        } else {
          formatted[key] = { rich_text: [{ text: { content: value } }] };
        }
      } else if (typeof value === "object" && value !== null) {
        formatted[key] = value;
      }
    }
    return formatted;
  }

  async updatePage(accessToken, pageId, properties, archive, webconsole) {
    const notion = new Client({ auth: accessToken });

    try {
      webconsole.info(`NOTION NODE | Updating page: ${pageId}`);

      const updateBody = {
        page_id: pageId,
      };

      if (archive) {
        updateBody.archived = true;
        webconsole.warn(`NOTION NODE | Archiving page ${pageId}`);
      } else if (properties && Object.keys(properties).length > 0) {
        updateBody.properties = properties;
      }

      const response = await notion.pages.update(updateBody);

      webconsole.success("NOTION NODE | Update successful");
      return response.url;
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

    const pageId = getValue("Page ID");

    const archiveField = contents.find((c) => c.name === "Archive Page");
    const shouldArchive =
      archiveField?.value === true || archiveField?.value === "true";

    let properties = {};
    const propsInput = inputs.find((i) => i.name === "Properties")?.value;
    if (propsInput) {
      try {
        properties =
          typeof propsInput === "string" ? JSON.parse(propsInput) : propsInput;
      } catch (e) {
        webconsole.warn(
          "NOTION NODE | Invalid Properties JSON provided. Ignoring properties.",
        );
      }
    }

    const tokens = serverData.socialList;
    if (!tokens || !Object.keys(tokens).includes("notion")) {
      this.setCredit(0);
      webconsole.error("NOTION NODE | Notion account not connected.");
      return { "Page URL": null, Tool: null, Credits: 0 };
    }

    const notionData = tokens["notion"];
    const accessToken = notionData.access_token;

    if (!accessToken) {
      this.setCredit(0);
      webconsole.error("NOTION NODE | Access token missing.");
      return { "Page URL": null, Tool: null, Credits: 0 };
    }

    const updatePageTool = tool(
      async ({ pageId: tPageId, properties: tProps, archive: tArchive }) => {
        try {
          const parsedProps =
            typeof tProps === "string" ? JSON.parse(tProps) : tProps;

          const url = await this.updatePage(
            accessToken,
            tPageId || pageId,
            parsedProps,
            tArchive,
            webconsole,
          );
          this.setCredit(this.getCredit() + 10);
          return [`Successfully updated page. URL: ${url}`, this.getCredit()];
        } catch (err) {
          this.setCredit(0);
          return [`Error updating page: ${err.message}`, this.getCredit()];
        }
      },
      {
        name: "notion_update_page",
        description:
          "Update a Notion page's properties (like Status, Title, Date) or archive (delete) it. Requires the Property JSON structure specific to Notion's API.",
        schema: z.object({
          pageId: z
            .string()
            .describe("The 32-character ID of the page to update"),
          properties: z
            .string()
            .optional()
            .describe(
              "JSON string of properties to update. Example: { 'Status': { 'select': { 'name': 'Done' } } }",
            ),
          archive: z
            .boolean()
            .optional()
            .describe("Set to true to move the page to Trash"),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    if (!pageId) {
      return { "Page URL": null, Tool: updatePageTool, Credits: 0 };
    }

    try {
      const url = await this.updatePage(
        accessToken,
        pageId,
        properties,
        shouldArchive,
        webconsole,
      );
      this.setCredit(10);
      return {
        "Page URL": url,
        Tool: updatePageTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      return { "Page URL": null, Tool: updatePageTool, Credits: 0 };
    }
  }
}

export default notion_update_page;
