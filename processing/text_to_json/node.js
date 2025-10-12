import BaseNode from "../../core/BaseNode/node.js";
import { repairJson } from "@toolsycc/json-repair";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Text to JSON (Parser)",
  category: "processing",
  type: "text_to_json",
  icon: {},
  desc: "Converts a text string, including non-standard or malformed JSON, into a structured JSON object. It uses JSON repair technology.",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Text to convert (e.g., malformed JSON string)",
      name: "Text",
      type: "Text",
    },
  ],
  outputs: [
    {
      desc: "The parsed JSON object",
      name: "JSON",
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
      desc: "Text to convert",
      name: "Text",
      type: "Text",
      value: "Enter text here...",
    },
  ],
  difficulty: "easy",
  tags: ["text", "json", "parser", "repair"],
};

class text_to_json extends BaseNode {
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
   * 3. Core function to handle Text to JSON conversion logic
   */
  executeTextToJson(Textdata, webconsole) {
    if (Textdata === null || Textdata === undefined) {
      throw new Error("Input data is null or undefined.");
    }

    if (typeof Textdata !== "string") {
      throw new Error("Input data is not a string.");
    }

    // Use a regex to extract content that looks like a JSON object, ignoring surrounding text/newlines.
    // The original regex is good: /^\s*({.*})/ms
    const regex = /^\s*({.*})/ms;
    const match = Textdata.match(regex);

    if (match) {
      // repairJson handles parsing and fixing common JSON errors (missing quotes, trailing commas, etc.)
      const data = repairJson(match[1], {
        returnObject: true, // Request the parsed object directly
      });

      if (data === null || data === undefined) {
        throw new Error(
          "JSON repair was successful but returned null/undefined."
        );
      }

      webconsole.success(
        "TEXT TO JSON NODE | Successfully converted and repaired text to JSON"
      );
      return data;
    }

    // Fallback: If no match, try repairing the whole string, as some LLMs output only the JSON.
    try {
      const data = repairJson(Textdata, {
        returnObject: true,
      });
      webconsole.success(
        "TEXT TO JSON NODE | Successfully repaired whole input string to JSON"
      );
      return data;
    } catch (e) {
      throw new Error(
        "Could not find or parse valid JSON within the input text."
      );
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
    webconsole.info("TEXT TO JSON NODE | Executing logic");

    const Textdata = this.getValue(inputs, contents, "Text", null);

    // 4. Create the Tool
    const textToJsonTool = tool(
      async ({ textInput }, toolConfig) => {
        webconsole.info("TEXT TO JSON TOOL | Invoking tool");

        try {
          const parsedJson = this.executeTextToJson(textInput, webconsole);

          // Return the stringified JSON object
          return [JSON.stringify(parsedJson), this.getCredit()];
        } catch (error) {
          webconsole.error(`TEXT TO JSON TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              error: error.message,
              json: null,
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "textToJsonParser",
        description:
          "Converts a text string, which may contain surrounding text or slightly malformed JSON, into a valid structured JSON object. This is essential for robustly extracting data outputted by other LLMs or APIs.",
        schema: z.object({
          textInput: z
            .string()
            .describe(
              "The text string containing the JSON data to be parsed and repaired."
            ),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // 5. Check for required fields for direct execution
    if (!Textdata || typeof Textdata !== "string" || !Textdata.trim()) {
      webconsole.info(
        "TEXT TO JSON NODE | Missing or invalid text input, returning tool only"
      );
      this.setCredit(0);
      return {
        JSON: null,
        Tool: textToJsonTool,
      };
    }

    // 6. Execute the conversion logic
    try {
      const data = this.executeTextToJson(Textdata, webconsole);

      return {
        JSON: data,
        Credits: this.getCredit(),
        Tool: textToJsonTool,
      };
    } catch (error) {
      webconsole.error(
        "TEXT TO JSON NODE | Some error occured: " + error.message
      );
      return {
        JSON: null,
        Credits: this.getCredit(),
        Tool: textToJsonTool,
      };
    }
  }
}

export default text_to_json;
