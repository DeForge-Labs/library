import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Extract JSON Value",
  category: "processing",
  type: "json_extract",
  icon: {},
  desc: "Gets the Value from JSON using a key (supports dot notation for nested objects).",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "JSON object to parse",
      name: "Object",
      type: "JSON",
    },
    {
      desc: "Key path to extract (e.g., 'user.address.city' or 'id')",
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
      desc: "The value of the key, converted to Text (JSON strings if nested object)",
      name: "Value",
      type: "Text",
    },
    {
      desc: "Raw value of the key (retains original type: string, number, boolean, object, array)",
      name: "Raw Value",
      type: "Any",
    },
    {
      desc: "The tool version of this node, to be used by LLMs", // 2. Add Tool output
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "JSON object to parse",
      name: "Object",
      type: "Map",
      value: "Enter JSON here...",
    },
    {
      desc: "Key path to extract (supports dot notation)",
      name: "Key",
      type: "Text",
      value: "key",
    },
  ],
  difficulty: "easy",
  tags: ["json", "extract", "parser"],
};

class json_extract extends BaseNode {
  constructor() {
    super(config);
  }

  /**
   * Helper function to get value from inputs or contents
   */
  getValue(inputs, contents, name, defaultValue = null) {
    const input = inputs.find((i) => i.name === name);
    if (input?.value !== undefined) return input.value;
    const content = contents.find((c) => c.name === name);
    if (content?.value !== undefined) return content.value;
    return defaultValue;
  }

  /**
   * 3. Core function to handle JSON value extraction (including dot notation)
   */
  executeJsonExtract(JSONdata, keyPath, webconsole) {
    if (typeof JSONdata !== "object" || JSONdata === null) {
      throw new Error("Input 'Object' is not a valid JSON object.");
    }

    if (!keyPath || typeof keyPath !== "string" || keyPath.trim() === "") {
      throw new Error("Input 'Key' is required.");
    }

    // Split the keyPath by dot to handle nested structure (e.g., 'user.address.city')
    const keys = keyPath.split(".");
    let currentValue = JSONdata;

    for (const key of keys) {
      // Check if currentValue is an object (or array) and the key exists
      if (
        typeof currentValue === "object" &&
        currentValue !== null &&
        key in currentValue
      ) {
        currentValue = currentValue[key];
      } else {
        webconsole.error(`JSON EXTRACT | Key not found at path: ${keyPath}`);
        throw new Error(`Key '${keyPath}' not found in the JSON object.`);
      }
    }

    webconsole.success(
      `JSON EXTRACT | Successfully extracted value for key: ${keyPath}`
    );
    return currentValue;
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("JSON EXTRACT | Executing node");

    const JSONdata = this.getValue(inputs, contents, "Object", {});
    const key = this.getValue(inputs, contents, "Key", "");

    // 4. Create the Tool
    const jsonExtractTool = tool(
      async ({ jsonObject, keyPath }, toolConfig) => {
        webconsole.info("JSON EXTRACT TOOL | Invoking tool");
        try {
          // LLMs typically output JSON strings for complex objects, so we parse them first.
          let parsedJson;
          if (typeof jsonObject === "string") {
            try {
              parsedJson = JSON.parse(jsonObject);
            } catch (e) {
              throw new Error(
                "Input 'jsonObject' is a string but not valid JSON."
              );
            }
          } else {
            parsedJson = jsonObject;
          }

          const rawValue = this.executeJsonExtract(
            parsedJson,
            keyPath,
            webconsole
          );

          const textValue =
            typeof rawValue === "object" && rawValue !== null
              ? JSON.stringify(rawValue)
              : String(rawValue);

          // The tool's output is optimized for LLM consumption
          return [
            JSON.stringify({ value: textValue, rawValue: rawValue }),
            this.getCredit(),
          ];
        } catch (error) {
          webconsole.error(`JSON EXTRACT TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              error: error.message,
              value: null,
              rawValue: null,
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "jsonExtractValue",
        description:
          "Extracts a specific value from a JSON object (or JSON string). Use dot notation (e.g., 'user.address.city') to access nested properties. Returns the value as text and its raw format.",
        schema: z.object({
          jsonObject: z
            .union([z.record(z.any()), z.string()])
            .describe("The JSON object or JSON string to be parsed."),
          keyPath: z
            .string()
            .describe(
              "The key or path to the value to extract, using dot notation for nested objects (e.g., 'data.customer.id')."
            ),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // 5. Check for required fields for direct execution
    // Check if JSONdata is a non-empty object and a key is provided
    if (Object.keys(JSONdata).length === 0 || !key) {
      webconsole.info(
        "JSON EXTRACT | Missing required fields for direct execution, returning tool only"
      );
      this.setCredit(0);
      return {
        Value: null,
        "Raw Value": null,
        Tool: jsonExtractTool,
      };
    }

    // 6. Execute the extraction logic
    try {
      const rawValue = this.executeJsonExtract(JSONdata, key, webconsole);

      const textValue =
        typeof rawValue === "object" && rawValue !== null
          ? JSON.stringify(rawValue)
          : String(rawValue);

      return {
        Value: textValue,
        "Raw Value": rawValue,
        Credits: this.getCredit(),
        Tool: jsonExtractTool,
      };
    } catch (error) {
      webconsole.error("JSON EXTRACT | Extraction failed: " + error.message);
      return {
        Value: null,
        "Raw Value": null,
        Credits: this.getCredit(),
        Tool: jsonExtractTool,
      };
    }
  }
}

export default json_extract;
