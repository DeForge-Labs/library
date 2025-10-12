import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools"; // 1. Import tool
import { z } from "zod"; // 2. Import zod

const config = {
  title: "API Call",
  category: "processing",
  type: "api_node",
  icon: {},
  desc: "Call external API",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The endpoint of the API",
      name: "endpoint",
      type: "Text",
    },
    {
      desc: "The body of the API",
      name: "body",
      type: "JSON",
    },
    {
      desc: "The headers of the API",
      name: "headers",
      type: "JSON",
    },
  ],
  outputs: [
    {
      desc: "The response of the API",
      name: "output",
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
      desc: "The method of the API",
      name: "method",
      type: "select",
      value: "GET",
      options: ["GET", "POST", "PUT", "DELETE"],
    },
    {
      desc: "The endpoint of the API",
      name: "endpoint",
      type: "Text",
      value: "endpoint...",
    },
    {
      desc: "The body of the API",
      name: "body",
      type: "Map",
      value: "Enter body here...",
    },
    {
      desc: "The headers of the API",
      name: "headers",
      type: "Map",
      value: "Enter headers here...",
    },
  ],
  difficulty: "medium",
  tags: ["api", "http", "external"],
};

class api_node extends BaseNode {
  constructor() {
    super(config);
  }

  /**
   * Helper function to perform the actual API call
   */
  async executeApiCall(method, endpoint, body, headers, webconsole) {
    if (!endpoint || !endpoint.trim()) {
      throw new Error("No endpoint found");
    }

    // Ensure body and headers are objects if they are null/undefined
    const actualBody = body ?? {};
    const actualHeaders = headers ?? {};

    const requestConfig = {
      method: method,
      maxBodyLength: Infinity,
      url: endpoint,
      ...(Object.keys(actualHeaders).length > 0 && { headers: actualHeaders }),
      data: JSON.stringify(actualBody),
    };

    webconsole.info(`API NODE | Sending ${method} request to ${endpoint}`);
    try {
      const response = await axios.request(requestConfig);
      webconsole.success("API NODE | Response received");
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message || error.message || String(error);
      webconsole.error(`API NODE | Error: ${errorMsg}`);
      throw new Error(`API call failed: ${errorMsg}`);
    }
  }

  /**
   * @override
   * @inheritdoc
   * * @param {import("../../core/BaseNode/node.js").Inputs[]} inputs
   * @param {import("../../core/BaseNode/node.js").Contents[]} contents
   * @param {import("../../core/BaseNode/node.js").IWebConsole} webconsole
   * @param {import("../../core/BaseNode/node.js").IServerData} serverData
   */
  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("API NODE | Begin execution, parsing inputs");

    const getValue = (name, defaultValue = null) => {
      const input = inputs.find((i) => i.name === name);
      if (input?.value !== undefined) return input.value;
      const content = contents.find((c) => c.name === name);
      if (content?.value !== undefined) return content.value;
      return defaultValue;
    };

    const method = getValue("method", "GET");
    const endpoint = getValue("endpoint", "");
    const body = getValue("body", {});
    const headers = getValue("headers", {});

    // 4. Create the Tool
    const apiCallTool = tool(
      async (
        {
          method: toolMethod,
          endpoint: toolEndpoint,
          body: toolBody,
          headers: toolHeaders,
        },
        toolConfig
      ) => {
        webconsole.info("API CALL TOOL | Invoking tool");

        try {
          const result = await this.executeApiCall(
            toolMethod,
            toolEndpoint,
            toolBody,
            toolHeaders,
            webconsole
          );

          return [JSON.stringify(result), this.getCredit()];
        } catch (error) {
          webconsole.error(`API CALL TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              error: error.message,
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "apiCallTool",
        description:
          "Make an external HTTP API call using GET, POST, PUT, or DELETE method. Provide the full endpoint URL, method, body (for POST/PUT), and headers.",
        schema: z.object({
          method: z
            .enum(["GET", "POST", "PUT", "DELETE"])
            .default("GET")
            .describe("HTTP method to use (GET, POST, PUT, DELETE)"),
          endpoint: z.string().describe("The full endpoint URL of the API"),
          body: z
            .record(z.any())
            .optional()
            .describe("The JSON body of the request (required for POST/PUT)"),
          headers: z
            .record(z.string())
            .optional()
            .describe("JSON object for request headers as key-value pairs"),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    if (!endpoint || !endpoint.trim()) {
      webconsole.info("API NODE | Endpoint missing, returning tool only");
      this.setCredit(0);
      return {
        output: null,
        Tool: apiCallTool,
      };
    }

    // 5. Execute the API call with node inputs/fields
    try {
      const apiResponse = await this.executeApiCall(
        method,
        endpoint,
        body,
        headers,
        webconsole
      );

      return {
        output: apiResponse,
        Tool: apiCallTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      // executeApiCall throws an Error with a descriptive message
      return {
        output: { error: error.message },
        Tool: apiCallTool,
        Credits: this.getCredit(),
      };
    }
  }
}

export default api_node;
