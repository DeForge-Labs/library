import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "GitHub: Create/Update File",
  category: "management",
  type: "github_update_file",
  icon: {},
  desc: "Update an existing file or create a new one via a direct commit",
  credit: 5,
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
      desc: "File Path (e.g., src/index.js)",
      name: "File Path",
      type: "Text",
    },
    {
      desc: "The new text/code content of the file",
      name: "New Content",
      type: "Text",
    },
    {
      desc: "Commit message",
      name: "Commit Message",
      type: "Text",
    },
    {
      desc: "Branch to commit to (defaults to main/master if empty)",
      name: "Branch",
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
      desc: "The URL of the created commit",
      name: "Commit URL",
      type: "Text",
    },
    {
      desc: "The SHA hash of the commit",
      name: "Commit SHA",
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
      desc: "Path to the file",
      name: "File Path",
      type: "Text",
      value: "README.md",
    },
    {
      desc: "Commit Message",
      name: "Commit Message",
      type: "Text",
      value: "Update file via Deforge Agent",
    },
    {
      desc: "Target Branch",
      name: "Branch",
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
  difficulty: "hard",
  tags: ["action", "github", "file", "write", "commit", "code", "tool"],
};

class github_update_file extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  async executeUpdateFile(
    repo,
    path,
    newContent,
    commitMessage,
    branch,
    accessToken,
    webconsole,
  ) {
    let fileSha = undefined;

    webconsole.info(
      `GITHUB UPDATE FILE | Checking if ${path} exists to get SHA...`,
    );

    let checkUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
    if (branch) checkUrl += `?ref=${branch}`;

    const checkResponse = await fetch(checkUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      if (Array.isArray(checkData)) {
        throw new Error(
          "Target path is a directory. Please specify a file path.",
        );
      }
      fileSha = checkData.sha;
      webconsole.info(
        `GITHUB UPDATE FILE | File exists (SHA: ${fileSha}). Overwriting...`,
      );
    } else if (checkResponse.status === 404) {
      webconsole.info(
        "GITHUB UPDATE FILE | File does not exist. Creating a new file...",
      );
    } else {
      const errorData = await checkResponse.json().catch(() => ({}));
      throw new Error(
        `Failed to check file status: ${
          errorData.message || checkResponse.status
        }`,
      );
    }

    const base64Content = Buffer.from(newContent).toString("base64");

    const bodyPayload = {
      message: commitMessage,
      content: base64Content,
    };
    if (fileSha) bodyPayload.sha = fileSha;
    if (branch) bodyPayload.branch = branch;

    const commitResponse = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      },
    );

    if (!commitResponse.ok) {
      const errorData = await commitResponse.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP error! status: ${commitResponse.status}`,
      );
    }

    const commitData = await commitResponse.json();

    webconsole.success("GITHUB UPDATE FILE | File committed successfully!");

    return {
      success: true,
      commitUrl: commitData.commit.html_url,
      commitSha: commitData.commit.sha,
    };
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("GITHUB UPDATE FILE NODE | Started execution");

    const getVal = (name) => {
      const input = inputs.find((e) => e.name === name);
      return input
        ? input.value
        : contents.find((e) => e.name === name)?.value || "";
    };

    const tokens = serverData.socialList;
    if (!tokens || !tokens["github"] || !tokens["github"].access_token) {
      this.setCredit(0);
      webconsole.error("GITHUB UPDATE FILE | GitHub account not connected");
      return null;
    }

    const accessToken = tokens["github"].access_token;

    // Create the Tool for LLMs
    const githubUpdateFileTool = tool(
      async ({ repo, path, newContent, commitMessage, branch }) => {
        webconsole.info("GITHUB UPDATE FILE TOOL | Invoking tool");

        try {
          const result = await this.executeUpdateFile(
            repo,
            path,
            newContent,
            commitMessage || "Update file via Deforge Agent",
            branch,
            accessToken,
            webconsole,
          );

          this.setCredit(this.getCredit() + 5);

          return [JSON.stringify(result), this.getCredit()];
        } catch (error) {
          this.setCredit(this.getCredit() - 5);
          webconsole.error(`GITHUB UPDATE FILE TOOL | Error: ${error.message}`);
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
        name: "githubUpdateFileTool",
        description:
          "Update an existing file or create a new one directly in a GitHub repository via a commit. Use this to write code, fix bugs, or update text.",
        schema: z.object({
          repo: z
            .string()
            .describe("The repository name (e.g., 'octocat/Hello-World')"),
          path: z
            .string()
            .describe(
              "The exact file path inside the repo (e.g., 'src/index.js' or 'README.md')",
            ),
          newContent: z
            .string()
            .describe(
              "The full new text/code content of the file. This will completely overwrite the existing file.",
            ),
          commitMessage: z
            .string()
            .optional()
            .describe("A short message describing the changes."),
          branch: z
            .string()
            .optional()
            .describe(
              "The branch to commit to. Defaults to the repository's default branch if left empty.",
            ),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    const repo = getVal("Repository");
    const path = getVal("File Path");
    const newContent = getVal("New Content") || "";
    const commitMessage = getVal("Commit Message") || "Update file";
    const branch = getVal("Branch");

    // If missing required fields, just return the tool so the agent can use it later
    if (!repo || !path) {
      webconsole.info(
        "GITHUB UPDATE FILE | Missing required fields, returning tool only",
      );
      this.setCredit(0);
      return {
        Flow: true,
        "Commit URL": "",
        "Commit SHA": "",
        Tool: githubUpdateFileTool,
      };
    }

    try {
      const result = await this.executeUpdateFile(
        repo,
        path,
        newContent,
        commitMessage,
        branch,
        accessToken,
        webconsole,
      );

      return {
        Flow: true,
        "Commit URL": result.commitUrl,
        "Commit SHA": result.commitSha,
        Tool: githubUpdateFileTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error(
        `GITHUB UPDATE FILE | Failed to update file: ${error.message}`,
      );
      return {
        Flow: true,
        "Commit URL": "",
        "Commit SHA": "",
        Tool: githubUpdateFileTool,
      };
    }
  }
}

export default github_update_file;
