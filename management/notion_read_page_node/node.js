import BaseNode from "../../core/BaseNode/node.js";
import { Client } from "@notionhq/client";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Notion: Read Page",
  category: "management",
  type: "notion_read_page_node",
  icon: {},
  desc: "Reads the content of a specific Notion page and converts it to Markdown text.",
  credit: 5,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The 32-character ID of the page to read",
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
      desc: "The full text content of the page",
      name: "Content",
      type: "Text",
    },
    {
      desc: "The title of the page",
      name: "Title",
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
      desc: "The ID from the URL (e.g., 18c369...)",
    },
  ],
  difficulty: "medium",
  tags: ["notion", "read", "content", "ocr"],
};

class notion_read_page extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  blockToMarkdown(block) {
    const { type } = block;
    if (!block[type] || !block[type].rich_text) return "";

    const text = block[type].rich_text.map((t) => t.plain_text).join("");

    switch (type) {
      case "heading_1":
        return `# ${text}\n`;
      case "heading_2":
        return `## ${text}\n`;
      case "heading_3":
        return `### ${text}\n`;
      case "bulleted_list_item":
        return `* ${text}\n`;
      case "numbered_list_item":
        return `1. ${text}\n`;
      case "to_do":
        return `[${block.to_do.checked ? "x" : " "}] ${text}\n`;
      case "quote":
        return `> ${text}\n`;
      case "code":
        return `\`\`\`${block.code.language}\n${text}\n\`\`\`\n`;
      case "callout":
        return `> 💡 ${text}\n`;
      default:
        return `${text}\n`;
    }
  }

  async getPageContent(accessToken, pageId, webconsole) {
    const notion = new Client({ auth: accessToken });

    try {
      webconsole.info(`NOTION NODE | Reading page: ${pageId}`);

      const pageInfo = await notion.pages.retrieve({ page_id: pageId });
      let title = "Untitled";

      if (pageInfo.properties) {
        const titleProp = Object.values(pageInfo.properties).find(
          (p) => p.type === "title",
        );
        if (titleProp?.title?.[0]) {
          title = titleProp.title.map((t) => t.plain_text).join("");
        }
      }

      let allBlocks = [];
      let cursor = undefined;

      do {
        const response = await notion.blocks.children.list({
          block_id: pageId,
          start_cursor: cursor,
          page_size: 100,
        });
        allBlocks.push(...response.results);
        cursor = response.next_cursor;
      } while (cursor);

      const markdown = allBlocks.map((b) => this.blockToMarkdown(b)).join("\n");

      return { title, content: markdown };
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
      return { Content: "", Title: "", Tool: null, Credits: 0 };
    }

    const notionData = tokens["notion"];
    const accessToken = notionData.access_token;

    if (!accessToken) {
      this.setCredit(0);
      webconsole.error("NOTION NODE | Access token missing.");
      return { Content: "", Title: "", Tool: null, Credits: 0 };
    }

    const readPageTool = tool(
      async ({ pageId: tPageId }) => {
        try {
          const res = await this.getPageContent(
            accessToken,
            tPageId || pageId,
            webconsole,
          );
          this.setCredit(this.getCredit() + 5);
          return [
            `Title: ${res.title}\n\nContent:\n${res.content}`,
            this.getCredit(),
          ];
        } catch (err) {
          this.setCredit(0);
          return [`Error reading page: ${err.message}`, this.getCredit()];
        }
      },
      {
        name: "notion_read_page",
        description: "Read the text content of a Notion page using its ID.",
        schema: z.object({
          pageId: z
            .string()
            .describe("The 32-character ID of the page to read"),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    if (!pageId) {
      return { Content: "", Title: "", Tool: readPageTool, Credits: 0 };
    }

    try {
      const result = await this.getPageContent(accessToken, pageId, webconsole);
      this.setCredit(5);
      return {
        Content: result.content,
        Title: result.title,
        Tool: readPageTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      return { Content: "", Title: "", Tool: readPageTool, Credits: 0 };
    }
  }
}

export default notion_read_page;
