import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Suno Music Status",
  category: "GenAI",
  type: "suno_music_status",
  icon: {},
  desc: "Check the status of a Suno generation task. Returns Audio URL if complete.",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The Task ID from the Generation Node",
      name: "Task ID",
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
      desc: "Current Status (PENDING, SUCCESS, etc)",
      name: "Status",
      type: "Text",
    },
    {
      desc: "The Audio URL (if ready)",
      name: "Audio URL",
      type: "Text",
    },
    {
      desc: "Full JSON Data (Includes both tracks)",
      name: "Full Data",
      type: "JSON",
    },
    {
      desc: "The tool version of this node",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "The Task ID",
      name: "Task ID",
      type: "Text",
      value: "",
    },
  ],
  difficulty: "easy",
  tags: ["suno", "status", "check"],
};

class suno_music_status extends BaseNode {
  constructor() {
    super(config);
  }

  getValue(inputs, contents, name, defaultValue = null) {
    const input = inputs.find((i) => i.name === name);
    if (input?.value !== undefined) return input.value;
    const content = contents.find((c) => c.name === name);
    if (content?.value !== undefined) return content.value;
    return defaultValue;
  }

  async executeCheck(taskId, webconsole) {
    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) throw new Error("Missing SUNO_API_KEY environment variable.");
    if (!taskId) throw new Error("Task ID is required.");

    webconsole.info(`SUNO STATUS | Checking Task ID: ${taskId}`);

    try {
      const response = await fetch(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${taskId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      const jsonResp = await response.json();

      if (!response.ok) {
        throw new Error(jsonResp.msg || jsonResp.message || "Failed to check status");
      }

      const status = jsonResp.data?.status;
      const tracks = jsonResp.data?.response?.sunoData || [];
      
      let audioUrl = null;

      if (status === "SUCCESS" && tracks.length > 0) {
        audioUrl = tracks[0].audioUrl;
      } else if (status === "FIRST_SUCCESS" && tracks.length > 0) {
        audioUrl = tracks[0].audioUrl;
      }

      webconsole.info(`SUNO STATUS | Status: ${status}`);

      return {
        status: status,
        audioUrl: audioUrl,
        fullData: tracks
      };

    } catch (error) {
      throw new Error(`Suno Status Check Failed: ${error.message}`);
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("SUNO STATUS | Begin execution");

    const taskId = this.getValue(inputs, contents, "Task ID", "");

    const sunoStatusTool = tool(
      async ({ taskId }, toolConfig) => {
        try {
          const result = await this.executeCheck(taskId, webconsole);
          return [JSON.stringify(result), this.getCredit()];
        } catch (error) {
          return [JSON.stringify({ error: error.message }), this.getCredit()];
        }
      },
      {
        name: "sunoStatusChecker",
        description: "Checks the status of a Suno music generation task using the Task ID.",
        schema: z.object({
          taskId: z.string().describe("The Task ID provided by the generator node."),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    if (!taskId) {
       webconsole.info("SUNO STATUS | Missing Task ID, returning tool.");
       this.setCredit(0);
       return { "Status": null, "Audio URL": null, Tool: sunoStatusTool };
    }

    try {
      const result = await this.executeCheck(taskId, webconsole);
      return {
        "Status": result.status,
        "Audio URL": result.audioUrl,
        "Full Data": result.fullData,
        Credits: this.getCredit(),
        Tool: sunoStatusTool,
      };
    } catch (error) {
      webconsole.error("SUNO STATUS | Error: " + error.message);
      return {
        "Status": "ERROR",
        "Audio URL": null,
        "Full Data": null,
        Credits: this.getCredit(),
        Tool: sunoStatusTool,
        Error: error.message
      };
    }
  }
}

export default suno_music_status;