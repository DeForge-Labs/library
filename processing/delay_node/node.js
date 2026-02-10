import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Delay",
  category: "processing",
  type: "delay_node",
  icon: {},
  desc: "Pauses the workflow execution for a specified duration.",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
  ],
  outputs: [
    {
      desc: "The Flow to trigger after delay",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The tool version of this node",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "Duration to wait",
      name: "Duration",
      type: "select",
      value: "5 secs",
      options: ["5 secs", "10 secs", "30 secs", "1 min"],
    },
  ],
  difficulty: "easy",
  tags: ["delay", "wait", "sleep", "pause"],
};

class delay_node extends BaseNode {
  constructor() {
    super(config);
  }

  /**
   * Helper to get values from inputs/contents
   */
  getValue(inputs, contents, name, defaultValue = null) {
    const input = inputs.find((i) => i.name === name);
    if (input?.value !== undefined) return input.value;
    const content = contents.find((c) => c.name === name);
    if (content?.value !== undefined) return content.value;
    return defaultValue;
  }

  /**
   * Helper to parse duration string to milliseconds
   */
  parseDuration(durationStr) {
    switch (durationStr) {
      case "5 secs":
        return 5000;
      case "10 secs":
        return 10000;
      case "30 secs":
        return 30000;
      case "1 min":
        return 60000;
      default:
        // Attempt to parse raw numbers if passed dynamically
        const num = parseInt(durationStr);
        return isNaN(num) ? 5000 : num * 1000; // Default 5s
    }
  }

  /**
   * Core delay logic
   */
  async executeDelay(durationStr, webconsole) {
    const ms = this.parseDuration(durationStr);
    webconsole.info(`DELAY NODE | Waiting for ${ms / 1000} seconds...`);
    
    await new Promise((resolve) => setTimeout(resolve, ms));
    
    webconsole.success(`DELAY NODE | Finished waiting.`);
    return true;
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("DELAY NODE | Begin execution");

    const duration = this.getValue(inputs, contents, "Duration", "5 secs");

    // Tool definition (useful if an agent needs to intentionally wait)
    const delayTool = tool(
      async ({ duration }, toolConfig) => {
        webconsole.info("DELAY TOOL | Invoking tool");
        try {
          await this.executeDelay(duration, webconsole);
          return [JSON.stringify({ success: true, message: `Waited ${duration}` }), this.getCredit()];
        } catch (error) {
          return [JSON.stringify({ error: error.message }), this.getCredit()];
        }
      },
      {
        name: "delayExecution",
        description: "Pauses execution for a specified duration.",
        schema: z.object({
          duration: z.enum(["5 secs", "10 secs", "30 secs", "1 min"])
            .default("5 secs")
            .describe("The duration to wait."),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    try {
      // Execute the delay directly
      await this.executeDelay(duration, webconsole);

      return {
        Credits: this.getCredit(),
        Tool: delayTool,
      };
    } catch (error) {
      webconsole.error("DELAY NODE | Error: " + error.message);
      return {
        Credits: this.getCredit(),
        Tool: delayTool,
        Error: error.message,
      };
    }
  }
}

export default delay_node;