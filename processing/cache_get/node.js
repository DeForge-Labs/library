import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Cache: Get",
  category: "processing",
  type: "cache_get",
  icon: {},
  desc: "Retrieve temporary data stored in the workflow cache.",
  credit: 5,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The unique key of the cache entry",
      name: "Key",
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
      desc: "The retrieved data payload",
      name: "Payload",
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
      name: "Key",
      type: "Text",
      value: "",
      desc: "The unique key for the cache entry",
    },
  ],
  difficulty: "easy",
  tags: ["cache", "storage", "memory", "temporary"],
};

class cache_get_node extends BaseNode {
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

    const workflowId = serverData.workflowId;
    const cacheUtil = serverData.cacheUtil;

    if (!cacheUtil || !cacheUtil.cacheGet) {
      this.setCredit(0);
      webconsole.error(
        "CACHE GET NODE | Cache utility not found in serverData.",
      );
      return { Payload: null, Tool: null, Credits: 0 };
    }

    if (!workflowId) {
      this.setCredit(0);
      webconsole.error("CACHE GET NODE | Workflow ID not found.");
      return { Payload: null, Tool: null, Credits: 0 };
    }

    const cacheGetTool = tool(
      async ({ key: tKey }) => {
        try {
          const payload = await cacheUtil.cacheGet(workflowId, tKey || key);
          this.setCredit(this.getCredit() + 1);

          if (payload) {
            return [payload, this.getCredit()];
          } else {
            return [
              `Cache miss: No data found for key '${tKey || key}'`,
              this.getCredit(),
            ];
          }
        } catch (err) {
          this.setCredit(0);
          return [`Error retrieving cache: ${err.message}`, this.getCredit()];
        }
      },
      {
        name: "cache_get_data",
        description:
          "Retrieve temporary data (like intermediate results or state) from the workflow cache using its unique key.",
        schema: z.object({
          key: z.string().describe("The unique identifier for the cached data"),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    if (!key) {
      return { Payload: null, Tool: cacheGetTool, Credits: 0 };
    }

    try {
      webconsole.info(`CACHE GET NODE | Retrieving key: ${key}`);
      const payload = await cacheUtil.cacheGet(workflowId, key);

      if (payload) {
        webconsole.success(
          `CACHE GET NODE | Successfully retrieved key: ${key}`,
        );
      } else {
        webconsole.warn(`CACHE GET NODE | Cache miss for key: ${key}`);
      }

      this.setCredit(1);
      return {
        Payload: payload,
        Tool: cacheGetTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error(`CACHE ERROR | ${error.message}`);
      return { Payload: null, Tool: cacheGetTool, Credits: 0 };
    }
  }
}

export default cache_get_node;
