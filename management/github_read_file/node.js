import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "GitHub: Read File",
  category: "management",
  type: "github_read_file",
  icon: {},
  desc: "Read the contents of a file from a GitHub repository",
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
      desc: "File Path (e.g., src/index.js)",
      name: "File Path",
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
      desc: "The plain text content of the file",
      name: "File Content",
      type: "Text",
    },
    {
      desc: "The name of the file",
      name: "File Name",
      type: "Text",
    },
    {
      desc: "The download URL of the file",
      name: "Download URL",
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
      desc: "Connect your GitHub account",
      name: "GitHub",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["action", "github", "file", "read", "code", "tool"],
};

class github_read_file extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  async executeReadFile(repo, path, accessToken, webconsole) {
    webconsole.info(`GITHUB READ FILE | Fetching ${path} from ${repo}`);

    const response = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}`,
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

    if (Array.isArray(responseData)) {
      throw new Error(
        "Target path is a directory, not a file. Please specify a file path.",
      );
    }

    let fileContent = "";
    if (responseData.encoding === "base64" && responseData.content) {
      fileContent = Buffer.from(responseData.content, "base64").toString(
        "utf-8",
      );
    } else {
      webconsole.warn(
        "GITHUB READ FILE | File encoding is not base64 or content is empty.",
      );
    }

    webconsole.success(
      `GITHUB READ FILE | Successfully read ${responseData.name}`,
    );

    return {
      success: true,
      fileContent: fileContent,
      fileName: responseData.name,
      downloadUrl: responseData.download_url || "",
    };
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("GITHUB READ FILE NODE | Started execution");

    const getVal = (name) => {
      const input = inputs.find((e) => e.name === name);
      return input
        ? input.value
        : contents.find((e) => e.name === name)?.value || "";
    };

    const tokens = serverData.socialList;
    if (!tokens || !tokens["github"] || !tokens["github"].access_token) {
      this.setCredit(0);
      webconsole.error("GITHUB READ FILE | GitHub account not connected");
      return null;
    }

    const accessToken = tokens["github"].access_token;

    const githubReadFileTool = tool(
      async ({ repo, path }) => {
        webconsole.info("GITHUB READ FILE TOOL | Invoking tool");

        try {
          const result = await this.executeReadFile(
            repo,
            path,
            accessToken,
            webconsole,
          );

          this.setCredit(this.getCredit() + 1);

          return [JSON.stringify(result), this.getCredit()];
        } catch (error) {
          this.setCredit(this.getCredit() - 1);
          webconsole.error(`GITHUB READ FILE TOOL | Error: ${error.message}`);
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
        name: "githubReadFileTool",
        description:
          "Read the exact string content of a specific file in a GitHub repository. Use this when you need to inspect code, configuration files, or documentation to answer a question or make a fix.",
        schema: z.object({
          repo: z
            .string()
            .describe("The repository name (e.g., 'octocat/Hello-World')"),
          path: z
            .string()
            .describe(
              "The exact file path inside the repo (e.g., 'src/index.js' or 'package.json')",
            ),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    const repo = getVal("Repository");
    const path = getVal("File Path");

    if (!repo || !path) {
      webconsole.info(
        "GITHUB READ FILE | Missing required fields, returning tool only",
      );
      this.setCredit(0);
      return {
        Flow: true,
        "File Content": "",
        "File Name": "",
        "Download URL": "",
        Tool: githubReadFileTool,
      };
    }

    try {
      const result = await this.executeReadFile(
        repo,
        path,
        accessToken,
        webconsole,
      );

      return {
        Flow: true,
        "File Content": result.fileContent,
        "File Name": result.fileName,
        "Download URL": result.downloadUrl,
        Tool: githubReadFileTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error(
        `GITHUB READ FILE | Failed to read file: ${error.message}`,
      );
      return {
        Flow: true,
        "File Content": "",
        "File Name": "",
        "Download URL": "",
        Tool: githubReadFileTool,
      };
    }
  }
}

export default github_read_file;
