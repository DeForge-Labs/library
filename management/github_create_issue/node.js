import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "GitHub: Create Issue",
  category: "management",
  type: "github_create_issue",
  icon: {},
  desc: "Create a new issue in a GitHub repository",
  credit: 1,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Repository (e.g., octocat/Hello-World)",
      name: "Repository",
      type: "Text",
    },
    {
      desc: "Title of the issue",
      name: "Title",
      type: "Text",
    },
    {
      desc: "Body/Description of the issue (Markdown supported)",
      name: "Body",
      type: "Text",
    },
  ],
  outputs: [
    {
      desc: "The Flow to continue",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The URL of the created issue",
      name: "Issue URL",
      type: "Text",
    },
    {
      desc: "The Number of the created issue",
      name: "Issue Number",
      type: "Text",
    },
    {
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "Repository (e.g., owner/repo)",
      name: "Repository",
      type: "Text",
      value: "",
    },
    {
      desc: "Issue Title",
      name: "Title",
      type: "Text",
      value: "Automated Bug Report",
    },
    {
      desc: "Issue Body",
      name: "Body",
      type: "TextArea",
      value: "Describe the issue here...",
    },
    {
      desc: "Connect your GitHub account",
      name: "GitHub",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["output", "github", "issue", "create", "tool"],
};

class github_create_issue extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  async executeCreateIssue(repo, title, body, accessToken, webconsole) {
    webconsole.info(`GITHUB CREATE ISSUE | Creating issue in ${repo}`);

    const response = await fetch(
      `https://api.github.com/repos/${repo}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title,
          body: body,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP error! status: ${response.status}`,
      );
    }

    const responseData = await response.json();
    webconsole.success(
      `GITHUB CREATE ISSUE | Issue created successfully: #${responseData.number}`,
    );

    return {
      success: true,
      issueUrl: responseData.html_url,
      issueNumber: responseData.number.toString(),
    };
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("GITHUB CREATE ISSUE NODE | Started execution");

    const getVal = (name) => {
      const input = inputs.find((e) => e.name === name);
      return input
        ? input.value
        : contents.find((e) => e.name === name)?.value || "";
    };

    const tokens = serverData.socialList;
    if (!tokens || !tokens["github"] || !tokens["github"].access_token) {
      this.setCredit(0);
      webconsole.error("GITHUB CREATE ISSUE | GitHub account not connected");
      return null;
    }

    const accessToken = tokens["github"].access_token;

    // Create the Tool for LLMs
    const githubCreateIssueTool = tool(
      async ({ repo, title, body }) => {
        webconsole.info("GITHUB CREATE ISSUE TOOL | Invoking tool");

        try {
          const result = await this.executeCreateIssue(
            repo,
            title,
            body,
            accessToken,
            webconsole,
          );

          this.setCredit(this.getCredit() + 1);

          return [JSON.stringify(result), this.getCredit()];
        } catch (error) {
          this.setCredit(this.getCredit() - 1);
          webconsole.error(
            `GITHUB CREATE ISSUE TOOL | Error: ${error.message}`,
          );
          return [
            JSON.stringify({
              success: false,
              message: error.message,
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "githubCreateIssueTool",
        description:
          "Create a new issue in a GitHub repository. Useful for opening bug reports, feature requests, or tracking tasks.",
        schema: z.object({
          repo: z
            .string()
            .describe("The repository name (e.g., 'octocat/Hello-World')"),
          title: z.string().describe("The title of the new issue"),
          body: z
            .string()
            .optional()
            .describe(
              "The detailed description of the issue. Markdown is supported.",
            ),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    const repo = getVal("Repository");
    const title = getVal("Title");
    const body = getVal("Body");

    // If missing required fields, just return the tool so the agent can use it later
    if (!repo || !title) {
      webconsole.info(
        "GITHUB CREATE ISSUE | Missing required fields, returning tool only",
      );
      this.setCredit(0);
      return {
        Flow: true,
        "Issue URL": "",
        "Issue Number": "",
        Tool: githubCreateIssueTool,
      };
    }

    try {
      const result = await this.executeCreateIssue(
        repo,
        title,
        body,
        accessToken,
        webconsole,
      );

      return {
        Flow: true,
        "Issue URL": result.issueUrl,
        "Issue Number": result.issueNumber,
        Tool: githubCreateIssueTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error(
        `GITHUB CREATE ISSUE | Failed to create issue: ${error.message}`,
      );
      return {
        Flow: true,
        "Issue URL": "",
        "Issue Number": "",
        Tool: githubCreateIssueTool,
      };
    }
  }
}

export default github_create_issue;
