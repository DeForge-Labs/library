import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "JSON to Text (Stringify)",
  category: "processing",
  type: "json_to_text",
  icon: {},
  desc: "Converts a JSON object or array into a standard JSON string.",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "JSON object or array to convert",
      name: "JSON",
      type: "JSON",
    },
  ],
  outputs: [
    {
        desc: "The Flow to trigger",
        name: "Flow",
        type: "Flow",
    },
    {
      desc: "The text/string representation of the JSON data",
      name: "Text",
      type: "Text",
    },
    {
      desc: "The tool version of this node, to be used by LLMs", // 2. Add Tool output
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "JSON object or array to convert",
      name: "JSON",
      type: "Map", // Field type for configuration UI
    },
  ],
  difficulty: "easy",
  tags: ["text", "json", "stringify", "converter"],
};

class json_to_text extends BaseNode {
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
   * 3. Core function to handle JSON to Text conversion logic
   */
  executeJsonToText(JSONdata, webconsole) {
    if (JSONdata === null || JSONdata === undefined) {
      throw new Error("Input data is null or undefined");
    }

    let dataToConvert = JSONdata;

    // If the input is a string, attempt to parse it first, assuming it might be a JSON string
    if (typeof JSONdata === "string") {
      try {
        dataToConvert = JSON.parse(JSONdata);
      } catch (e) {
        // If it's just a regular string that's not JSON, we can't stringify it as an object.
        // But the node's intent is JSON to text, so we'll throw if it wasn't a parsable object/array
        // or if it wasn't an object/array to begin with.
        throw new Error(
          "Input data is a string but not valid JSON. Cannot convert non-JSON to JSON string."
        );
      }
    }

    if (typeof dataToConvert !== "object" || dataToConvert === null) {
      throw new Error("Input data must be a JSON object or array.");
    }

    const text = JSON.stringify(dataToConvert);
    webconsole.success(
      "JSON TO TEXT NODE | Successfully converted JSON to string"
    );
    return text;
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("JSON TO TEXT NODE | Executing logic");

    const JSONdata = this.getValue(inputs, contents, "JSON", {});

    // 4. Create the Tool
    const jsonToTextTool = tool(
      async ({ jsonInput }, toolConfig) => {
        webconsole.info("JSON TO TEXT TOOL | Invoking tool");

        try {
          // The tool input allows for string or object/array
          const text = this.executeJsonToText(jsonInput, webconsole);

          return [JSON.stringify({ text: text }), this.getCredit()];
        } catch (error) {
          webconsole.error(`JSON TO TEXT TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              error: error.message,
              text: null,
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "jsonToStringConverter",
        description:
          "Converts a structured JSON object or array into a single, compact JSON text string. Useful for preparing JSON to be sent in an API body or stored as text.",
        schema: z.object({
          jsonInput: z
            .union([z.record(z.any()), z.array(z.any()), z.string()])
            .describe(
              "The JSON data (object, array, or JSON string) to be converted to a string."
            ),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // 5. Check for required fields for direct execution
    const isDataPresent =
      typeof JSONdata === "object" &&
      JSONdata !== null &&
      Object.keys(JSONdata).length > 0;

    if (!isDataPresent) {
      webconsole.info(
        "JSON TO TEXT NODE | No JSON data provided, returning tool only"
      );
      this.setCredit(0);
      return {
        Text: null,
        Tool: jsonToTextTool,
      };
    }

    // 6. Execute the conversion logic
    try {
      const text = this.executeJsonToText(JSONdata, webconsole);

      return {
        Text: text,
        Credits: this.getCredit(),
        Tool: jsonToTextTool,
      };
    } catch (error) {
      webconsole.error(
        "JSON TO TEXT NODE | Some error occured: " + error.message
      );
      return {
        Text: null,
        Credits: this.getCredit(),
        Tool: jsonToTextTool,
      };
    }
  }
}

export default json_to_text;
