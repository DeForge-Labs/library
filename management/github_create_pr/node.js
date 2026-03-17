import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "GitHub: Create PR",
  category: "management",
  type: "github_create_pr",
  icon: {},
  desc: "Create a new Pull Request in a repository",
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
      desc: "Title of the Pull Request",
      name: "Title",
      type: "Text",
    },
    {
      desc: "Description/Body of the PR (Markdown supported)",
      name: "Body",
      type: "Text",
    },
    {
      desc: "The name of the branch where your changes are (e.g., 'feature-fix')",
      name: "Head Branch",
      type: "Text",
    },
    {
      desc: "The name of the branch you want to merge into (e.g., 'main')",
      name: "Base Branch",
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
      desc: "The URL of the created Pull Request",
      name: "PR URL",
      type: "Text",
    },
    {
      desc: "The Number of the created Pull Request",
      name: "PR Number",
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
      desc: "PR Title",
      name: "Title",
      type: "Text",
      value: "Automated PR from Deforge Agent",
    },
    {
      desc: "Source branch with changes",
      name: "Head Branch",
      type: "Text",
      value: "",
    },
    {
      desc: "Target branch to merge into",
      name: "Base Branch",
      type: "Text",
      value: "main",
    },
    {
      desc: "Connect your GitHub account",
      name: "GitHub",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "medium",
  tags: ["output", "github", "pr", "pull request", "merge", "tool"],
};

class github_create_pr extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  async executeCreatePR(
    repo,
    title,
    bodyText,
    head,
    base,
    accessToken,
    webconsole,
  ) {
    webconsole.info(
      `GITHUB CREATE PR | Creating PR from ${head} into ${base} on ${repo}`,
    );

    const response = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: title,
        body: bodyText,
        head: head,
        base: base,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // 422 usually means there are no commits between the branches, or a PR already exists
      throw new Error(
        errorData.message || `HTTP error! status: ${response.status}`,
      );
    }

    const responseData = await response.json();

    webconsole.success(
      `GITHUB CREATE PR | Pull Request created successfully: #${responseData.number}`,
    );

    return {
      success: true,
      prUrl: responseData.html_url,
      prNumber: responseData.number.toString(),
    };
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("GITHUB CREATE PR NODE | Started execution");

    const getVal = (name) => {
      const input = inputs.find((e) => e.name === name);
      return input
        ? input.value
        : contents.find((e) => e.name === name)?.value || "";
    };

    const tokens = serverData.socialList;
    if (!tokens || !tokens["github"] || !tokens["github"].access_token) {
      this.setCredit(0);
      webconsole.error("GITHUB CREATE PR | GitHub account not connected");
      return null;
    }

    const accessToken = tokens["github"].access_token;

    // Create the Tool for LLMs
    const githubCreatePrTool = tool(
      async ({ repo, title, bodyText, head, base }) => {
        webconsole.info("GITHUB CREATE PR TOOL | Invoking tool");

        try {
          const result = await this.executeCreatePR(
            repo,
            title,
            bodyText || "",
            head,
            base,
            accessToken,
            webconsole,
          );

          this.setCredit(this.getCredit() + 1);

          return [JSON.stringify(result), this.getCredit()];
        } catch (error) {
          this.setCredit(this.getCredit() - 1);
          webconsole.error(`GITHUB CREATE PR TOOL | Error: ${error.message}`);
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
        name: "githubCreatePrTool",
        description:
          "Create a new Pull Request in a GitHub repository. Use this to propose merging changes from a head branch into a base branch.",
        schema: z.object({
          repo: z
            .string()
            .describe("The repository name (e.g., 'octocat/Hello-World')"),
          title: z.string().describe("The title of the Pull Request"),
          bodyText: z
            .string()
            .optional()
            .describe("The description/body of the PR. Markdown supported."),
          head: z
            .string()
            .describe(
              "The name of the branch where your changes are (e.g., 'feature-fix')",
            ),
          base: z
            .string()
            .describe(
              "The name of the branch you want to merge into (e.g., 'main')",
            ),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    const repo = getVal("Repository");
    const title = getVal("Title");
    const bodyText = getVal("Body") || "";
    const head = getVal("Head Branch");
    const base = getVal("Base Branch");

    // If missing required fields, just return the tool so the agent can use it later
    if (!repo || !title || !head || !base) {
      webconsole.info(
        "GITHUB CREATE PR | Missing required fields, returning tool only",
      );
      this.setCredit(0);
      return {
        Flow: true,
        "PR URL": "",
        "PR Number": "",
        Tool: githubCreatePrTool,
      };
    }

    try {
      const result = await this.executeCreatePR(
        repo,
        title,
        bodyText,
        head,
        base,
        accessToken,
        webconsole,
      );

      return {
        Flow: true,
        "PR URL": result.prUrl,
        "PR Number": result.prNumber,
        Tool: githubCreatePrTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error(
        `GITHUB CREATE PR | Failed to create PR: ${error.message}`,
      );
      return {
        Flow: true,
        "PR URL": "",
        "PR Number": "",
        Tool: githubCreatePrTool,
      };
    }
  }
}

export default github_create_pr;
