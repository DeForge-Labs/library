import BaseNode from "../../core/BaseNode/node.js";
import { Client } from "@notionhq/client";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Notion: Create Page",
  category: "management",
  type: "notion_create_page_node",
  icon: {},
  desc: "Create a new page inside a Database or as a sub-page of another Page.",
  credit: 10,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Title of the new page",
      name: "Title",
      type: "Text",
    },
    {
      desc: "Body content (Markdown supported)",
      name: "Content",
      type: "Text",
    },
    {
      desc: "ID of the parent Database or Page",
      name: "Parent ID",
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
      desc: "The ID of the newly created page",
      name: "Page ID",
      type: "Text",
    },
    {
      desc: "The URL of the newly created page",
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
      name: "Title",
      type: "Text",
      value: "",
      desc: "Title of the new page",
    },
    {
      name: "Content",
      type: "TextArea",
      value: "",
      desc: "Body content (Markdown supported)",
    },
    {
      name: "Parent Type",
      type: "select",
      value: "database_id",
      options: ["database_id", "page_id"],
      desc: "Are you creating this inside a Database or a Page?",
    },
    {
      name: "Parent ID",
      type: "Text",
      value: "",
      desc: "The ID of the parent (Database or Page)",
    },
    {
      name: "Title Property Name",
      type: "Text",
      value: "Name",
      desc: "Only for Databases: The name of the primary title column (e.g. 'Name', 'Task', 'Topic')",
    },
  ],
  difficulty: "medium",
  tags: ["notion", "create", "write", "database"],
};

class notion_create_page extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  async createPage(
    accessToken,
    title,
    content,
    parentId,
    parentType,
    titlePropName,
    webconsole,
  ) {
    const notion = new Client({ auth: accessToken });

    try {
      webconsole.info(
        `NOTION NODE | Creating page under ${parentType}: ${parentId}`,
      );

      const parent = { [parentType]: parentId };
      let properties = {};

      if (parentType === "database_id") {
        properties[titlePropName] = {
          title: [{ text: { content: title || "Untitled" } }],
        };
      } else {
        properties = {
          title: [{ text: { content: title || "Untitled" } }],
        };
      }

      const children = [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: content ? content.slice(0, 2000) : "",
                },
              },
            ],
          },
        },
      ];

      const response = await notion.pages.create({
        parent: parent,
        properties: properties,
        children: children,
      });

      webconsole.success("NOTION NODE | Page created successfully.");
      return { id: response.id, url: response.url };
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

    const title = getValue("Title", "Untitled");
    const content = getValue("Content", "");
    const parentId = getValue("Parent ID");

    const parentType =
      contents.find((c) => c.name === "Parent Type")?.value || "database_id";
    const titlePropName =
      contents.find((c) => c.name === "Title Property Name")?.value || "Name";

    const tokens = serverData.socialList;
    if (!tokens || !Object.keys(tokens).includes("notion")) {
      this.setCredit(0);
      webconsole.error("NOTION NODE | Notion account not connected.");
      return {
        "Page ID": null,
        "Page URL": null,
        Tool: null,
        Credits: 0,
      };
    }

    const notionData = tokens["notion"];
    const accessToken = notionData.access_token;

    if (!accessToken) {
      this.setCredit(0);
      webconsole.error("NOTION NODE | Access token missing.");
      return {
        "Page ID": null,
        "Page URL": null,
        Tool: null,
        Credits: 0,
      };
    }

    const createPageTool = tool(
      async ({
        title: tTitle,
        content: tContent,
        parentId: tParentId,
        parentType: tType,
      }) => {
        try {
          const pType = tType || "database_id";

          const res = await this.createPage(
            accessToken,
            tTitle,
            tContent,
            tParentId || parentId,
            pType,
            titlePropName,
            webconsole,
          );
          this.setCredit(this.getCredit() + 10);
          return [`Page created. URL: ${res.url}`, this.getCredit()];
        } catch (err) {
          this.setCredit(0);
          return [`Error creating page: ${err.message}`, this.getCredit()];
        }
      },
      {
        name: "notion_create_page",
        description:
          "Create a new page in Notion. Can be added to a Database or as a sub-page of an existing Page.",
        schema: z.object({
          title: z.string().describe("The title of the new page"),
          content: z.string().describe("The text content for the page body"),
          parentId: z
            .string()
            .describe("The ID of the parent Database or Page"),
          parentType: z
            .enum(["database_id", "page_id"])
            .optional()
            .describe("Whether the parent is a 'database_id' or 'page_id'"),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    if (!parentId) {
      return {
        "Page ID": null,
        "Page URL": null,
        Tool: createPageTool,
        Credits: 0,
      };
    }

    try {
      const result = await this.createPage(
        accessToken,
        title,
        content,
        parentId,
        parentType,
        titlePropName,
        webconsole,
      );
      this.setCredit(10);
      return {
        "Page ID": result.id,
        "Page URL": result.url,
        Tool: createPageTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      return {
        "Page ID": null,
        "Page URL": null,
        Tool: createPageTool,
        Credits: 0,
      };
    }
  }
}

export default notion_create_page;
