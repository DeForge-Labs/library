import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Cache: Set",
  category: "processing",
  type: "cache_set",
  icon: {},
  desc: "Store temporary data in the workflow cache (Max 500KB, up to 90 seconds).",
  credit: 5,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The unique key for the cache entry",
      name: "Key",
      type: "Text",
    },
    {
      desc: "The data to store",
      name: "Payload",
      type: "Text",
    },
    {
      desc: "Time to live in seconds (Max 90)",
      name: "Timeout",
      type: "Number",
    },
  ],
  outputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "True if successfully cached",
      name: "Success",
      type: "Boolean",
    },
    {
      desc: "The tool version for LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      name: "Key",
      type: "Text",
      value: "",
      desc: "The unique key for this cache entry",
    },
    {
      name: "Payload",
      type: "TextArea",
      value: "",
      desc: "The data you want to store (String or JSON)",
    },
    {
      name: "Timeout",
      type: "Number",
      value: 90,
      desc: "Time to live in seconds (Max 90)",
    },
  ],
  difficulty: "easy",
  tags: ["cache", "storage", "memory", "temporary"],
};

class cache_set_node extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  async run(inputs, contents, webconsole, serverData) {
    const getValue = (name, defaultValue = null) => {
      const input = inputs.find((i) => i.name === name);
      if (input?.value !== undefined && input.value !== "") return input.value;
      const content = contents.find((c) => c.name === name);
      if (content?.value !== undefined && content.value !== "")
        return content.value;
      return defaultValue;
    };

    const key = getValue("Key");
    const payload = getValue("Payload");
    const timeout = Number(getValue("Timeout", 90));

    const workflowId = serverData.workflowId;
    const cacheUtil = serverData.cacheUtil;

    if (!cacheUtil || !cacheUtil.cacheSet) {
      this.setCredit(0);
      webconsole.error(
        "CACHE SET NODE | Cache utility not found in serverData.",
      );
      return { Success: false, Tool: null, Credits: 0 };
    }

    if (!workflowId) {
      this.setCredit(0);
      webconsole.error("CACHE SET NODE | Workflow ID not found.");
      return { Success: false, Tool: null, Credits: 0 };
    }

    const cacheSetTool = tool(
      async ({ key: tKey, payload: tPayload, timeout: tTimeout }) => {
        try {
          const success = await cacheUtil.cacheSet(
            workflowId,
            tKey || key,
            tPayload || payload,
            tTimeout || timeout,
          );
          this.setCredit(this.getCredit() + 1);
          return [
            success ? "Data successfully cached." : "Failed to cache data.",
            this.getCredit(),
          ];
        } catch (err) {
          this.setCredit(0);
          return [`Error caching data: ${err.message}`, this.getCredit()];
        }
      },
      {
        name: "cache_set_data",
        description:
          "Store temporary data (like intermediate results or state) in the workflow cache for up to 90 seconds. Max 5 keys allowed per workflow.",
        schema: z.object({
          key: z.string().describe("Unique identifier for the data"),
          payload: z
            .string()
            .describe("The data to store (text or JSON string)"),
          timeout: z
            .number()
            .optional()
            .describe("Time to live in seconds (Default/Max 90)"),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    if (!key || !payload) {
      return { Success: false, Tool: cacheSetTool, Credits: 0 };
    }

    try {
      webconsole.info(`CACHE SET NODE | Storing key: ${key}`);
      const success = await cacheUtil.cacheSet(
        workflowId,
        key,
        payload,
        timeout,
      );

      if (success) {
        webconsole.success(`CACHE SET NODE | Successfully stored key: ${key}`);
      } else {
        webconsole.error(`CACHE SET NODE | Failed to store key: ${key}`);
      }

      this.setCredit(1);
      return {
        Success: success,
        Tool: cacheSetTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error(`CACHE ERROR | ${error.message}`);
      return { Success: false, Tool: cacheSetTool, Credits: 0 };
    }
  }
}

export default cache_set_node;
