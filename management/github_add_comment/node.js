import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "GitHub: Add Comment",
  category: "management",
  type: "github_add_comment",
  icon: {},
  desc: "Add a comment to an existing Issue or Pull Request",
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
    {
      desc: "The comment text (Markdown supported)",
      name: "Comment",
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
      desc: "The URL of the posted comment",
      name: "Comment URL",
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
      desc: "Issue or PR Number",
      name: "Issue Number",
      type: "Text",
      value: "",
    },
    {
      desc: "Comment Text",
      name: "Comment",
      type: "TextArea",
      value: "Leaving a comment...",
    },
    {
      desc: "Connect your GitHub account",
      name: "GitHub",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["output", "github", "comment", "pr", "tool"],
};

class github_add_comment extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  async executeAddComment(
    repo,
    issueNumber,
    commentText,
    accessToken,
    webconsole,
  ) {
    webconsole.info(`GITHUB ADD COMMENT | Posting to ${repo}#${issueNumber}`);

    const response = await fetch(
      `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: commentText,
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
    webconsole.success("GITHUB ADD COMMENT | Comment posted successfully!");

    return {
      success: true,
      commentUrl: responseData.html_url,
    };
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("GITHUB ADD COMMENT NODE | Started execution");

    const getVal = (name) => {
      const input = inputs.find((e) => e.name === name);
      return input
        ? input.value
        : contents.find((e) => e.name === name)?.value || "";
    };

    const tokens = serverData.socialList;
    if (!tokens || !tokens["github"] || !tokens["github"].access_token) {
      this.setCredit(0);
      webconsole.error("GITHUB ADD COMMENT | GitHub account not connected");
      return null;
    }

    const accessToken = tokens["github"].access_token;

    // Create the Tool for LLMs
    const githubAddCommentTool = tool(
      async ({ repo, issueNumber, commentText }) => {
        webconsole.info("GITHUB ADD COMMENT TOOL | Invoking tool");

        try {
          const result = await this.executeAddComment(
            repo,
            issueNumber,
            commentText,
            accessToken,
            webconsole,
          );

          this.setCredit(this.getCredit() + 1);

          return [JSON.stringify(result), this.getCredit()];
        } catch (error) {
          this.setCredit(this.getCredit() - 1);
          webconsole.error(`GITHUB ADD COMMENT TOOL | Error: ${error.message}`);
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
        name: "githubAddCommentTool",
        description:
          "Add a comment to an existing GitHub Issue or Pull Request. Useful for replying to users or leaving code review feedback.",
        schema: z.object({
          repo: z
            .string()
            .describe("The repository name (e.g., 'octocat/Hello-World')"),
          issueNumber: z
            .string()
            .describe("The Issue or Pull Request Number (e.g., '42')"),
          commentText: z
            .string()
            .describe("The comment text to post. Markdown is supported."),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    const repo = getVal("Repository");
    const issueNumber = getVal("Issue Number");
    const commentText = getVal("Comment");

    // If missing required fields, just return the tool so the agent can use it later
    if (!repo || !issueNumber || !commentText) {
      webconsole.info(
        "GITHUB ADD COMMENT | Missing required fields, returning tool only",
      );
      this.setCredit(0);
      return {
        Flow: true,
        "Comment URL": "",
        Tool: githubAddCommentTool,
      };
    }

    try {
      const result = await this.executeAddComment(
        repo,
        issueNumber,
        commentText,
        accessToken,
        webconsole,
      );

      return {
        Flow: true,
        "Comment URL": result.commentUrl,
        Tool: githubAddCommentTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error(
        `GITHUB ADD COMMENT | Failed to post comment: ${error.message}`,
      );
      return {
        Flow: true,
        "Comment URL": "",
        Tool: githubAddCommentTool,
      };
    }
  }
}

export default github_add_comment;
