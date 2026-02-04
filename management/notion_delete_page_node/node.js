import BaseNode from "../../core/BaseNode/node.js";
import { Client } from "@notionhq/client";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Notion: Delete Page",
  category: "management",
  type: "notion_delete_page_node",
  icon: {},
  desc: "Move a Notion page to the Trash (Archive).",
  credit: 5,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The 32-character ID of the page to delete",
      name: "Page ID",
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
      desc: "Success status (true/false)",
      name: "Success",
      type: "Boolean",
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
      desc: "The ID of the page to delete",
    },
  ],
  difficulty: "easy",
  tags: ["notion", "delete", "archive", "remove"],
};

class notion_delete_page extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  async deletePage(accessToken, pageId, webconsole) {
    const notion = new Client({ auth: accessToken });

    try {
      webconsole.info(`NOTION NODE | Archiving (Deleting) page: ${pageId}`);

      await notion.pages.update({
        page_id: pageId,
        archived: true,
      });

      webconsole.success("NOTION NODE | Page moved to trash successfully.");
      return true;
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

    const tokens = serverData.socialList;
    if (!tokens || !Object.keys(tokens).includes("notion")) {
      this.setCredit(0);
      webconsole.error("NOTION NODE | Notion account not connected.");
      return { Success: false, Tool: null, Credits: 0 };
    }

    const notionData = tokens["notion"];
    const accessToken = notionData.access_token;

    if (!accessToken) {
      this.setCredit(0);
      webconsole.error("NOTION NODE | Access token missing.");
      return { Success: false, Tool: null, Credits: 0 };
    }

    const deletePageTool = tool(
      async ({ pageId: tPageId }) => {
        try {
          await this.deletePage(accessToken, tPageId || pageId, webconsole);
          this.setCredit(this.getCredit() + 5);
          return ["Successfully moved page to trash.", this.getCredit()];
        } catch (err) {
          this.setCredit(0);
          return [`Error deleting page: ${err.message}`, this.getCredit()];
        }
      },
      {
        name: "notion_delete_page",
        description:
          "Delete (Archive) a Notion page by its ID. This moves the page to the Trash.",
        schema: z.object({
          pageId: z
            .string()
            .describe("The 32-character ID of the page to delete"),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    if (!pageId) {
      return { Success: false, Tool: deletePageTool, Credits: 0 };
    }

    try {
      await this.deletePage(accessToken, pageId, webconsole);
      this.setCredit(5);
      return {
        Success: true,
        Tool: deletePageTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      return { Success: false, Tool: deletePageTool, Credits: 0 };
    }
  }
}

export default notion_delete_page;
