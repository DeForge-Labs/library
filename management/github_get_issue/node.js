import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "GitHub: Get Issue",
  category: "management",
  type: "github_get_issue",
  icon: {},
  desc: "Get the full details of a GitHub Issue or Pull Request",
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
      desc: "The Issue or Pull Request Number",
      name: "Issue Number",
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
      desc: "Title of the issue",
      name: "Title",
      type: "Text",
    },
    {
      desc: "Full markdown body of the issue",
      name: "Body",
      type: "Text",
    },
    {
      desc: "State (open/closed)",
      name: "State",
      type: "Text",
    },
    {
      desc: "Creator's username",
      name: "Author",
      type: "Text",
    },
    {
      desc: "Array of applied labels",
      name: "Labels",
      type: "JSON",
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
      desc: "Issue or PR Number",
      name: "Issue Number",
      type: "Text",
      value: "",
    },
    {
      desc: "Connect your GitHub account",
      name: "GitHub",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["action", "github", "issue", "pr", "read", "tool"],
};

class github_get_issue extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  async executeGetIssue(repo, issueNumber, accessToken, webconsole) {
    webconsole.info(`GITHUB GET ISSUE | Fetching ${repo}#${issueNumber}`);

    const response = await fetch(
      `https://api.github.com/repos/${repo}/issues/${issueNumber}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP error! status: ${response.status}`,
      );
    }

    const responseData = await response.json();

    const labels = responseData.labels
      ? responseData.labels.map((l) => ({
          name: l.name,
          description: l.description,
        }))
      : [];

    webconsole.success(
      `GITHUB GET ISSUE | Successfully fetched issue: "${responseData.title}"`,
    );

    return {
      success: true,
      title: responseData.title,
      body: responseData.body || "",
      state: responseData.state,
      author: responseData.user?.login || "",
      labels: labels,
    };
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("GITHUB GET ISSUE NODE | Started execution");

    const getVal = (name) => {
      const input = inputs.find((e) => e.name === name);
      return input
        ? input.value
        : contents.find((e) => e.name === name)?.value || "";
    };

    const tokens = serverData.socialList;
    if (!tokens || !tokens["github"] || !tokens["github"].access_token) {
      this.setCredit(0);
      webconsole.error("GITHUB GET ISSUE | GitHub account not connected");
      return null;
    }

    const accessToken = tokens["github"].access_token;

    // Create the Tool for LLMs
    const githubGetIssueTool = tool(
      async ({ repo, issueNumber }) => {
        webconsole.info("GITHUB GET ISSUE TOOL | Invoking tool");

        try {
          const result = await this.executeGetIssue(
            repo,
            issueNumber,
            accessToken,
            webconsole,
          );

          this.setCredit(this.getCredit() + 1);

          return [JSON.stringify(result), this.getCredit()];
        } catch (error) {
          this.setCredit(this.getCredit() - 1);
          webconsole.error(`GITHUB GET ISSUE TOOL | Error: ${error.message}`);
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
        name: "githubGetIssueTool",
        description:
          "Get the full details (title, body, author, status, labels) of a specific GitHub Issue or Pull Request. Use this to gather context on what a bug report or feature request is asking for.",
        schema: z.object({
          repo: z
            .string()
            .describe("The repository name (e.g., 'octocat/Hello-World')"),
          issueNumber: z
            .string()
            .describe("The Issue or Pull Request Number (e.g., '42')"),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    const repo = getVal("Repository");
    const issueNumber = getVal("Issue Number");

    // If missing required fields, just return the tool so the agent can use it later
    if (!repo || !issueNumber) {
      webconsole.info(
        "GITHUB GET ISSUE | Missing required fields, returning tool only",
      );
      this.setCredit(0);
      return {
        Flow: true,
        Title: "",
        Body: "",
        State: "",
        Author: "",
        Labels: [],
        Tool: githubGetIssueTool,
      };
    }

    try {
      const result = await this.executeGetIssue(
        repo,
        issueNumber,
        accessToken,
        webconsole,
      );

      return {
        Flow: true,
        Title: result.title,
        Body: result.body,
        State: result.state,
        Author: result.author,
        Labels: result.labels,
        Tool: githubGetIssueTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error(
        `GITHUB GET ISSUE | Failed to get issue: ${error.message}`,
      );
      return {
        Flow: true,
        Title: "",
        Body: "",
        State: "",
        Author: "",
        Labels: [],
        Tool: githubGetIssueTool,
      };
    }
  }
}

export default github_get_issue;
