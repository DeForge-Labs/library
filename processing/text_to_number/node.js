import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Text to Number",
  category: "processing",
  type: "text_to_number",
  icon: {},
  desc: "Converts a text string representing a number (integer or float) into a numeric value.",
  credit: 0,
  inputs: [
    {
      name: "Flow",
      type: "Flow",
      desc: "The flow of the workflow",
    },
    {
      name: "Text",
      type: "Text",
      desc: "The text to convert to number (e.g., '123.45')",
    },
  ],
  outputs: [
    {
      name: "Number",
      type: "Number",
      desc: "The number converted from text",
    },
    {
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      name: "Text",
      type: "Text",
      desc: "The text to convert to number",
      value: "Enter text here...",
    },
  ],
  difficulty: "easy",
  tags: ["text", "number", "processing", "converter"],
};

class text_to_number extends BaseNode {
  constructor() {
    super(config);
  }

  /**
   * Helper function to get value from inputs or contents
   */
  getValue(inputs, contents, name, defaultValue = null) {
    const input = inputs.find((e) => e.name === name);
    if (input?.value !== undefined) return input.value;
    const content = contents.find((e) => e.name === name);
    if (content?.value !== undefined) return content.value;
    return defaultValue;
  }

  /**
   * 3. Core function to handle Text to Number conversion logic
   */
  executeTextToNumber(text, webconsole) {
    if (
      text === null ||
      text === undefined ||
      typeof text !== "string" ||
      text.trim() === ""
    ) {
      throw new Error("Input text is empty or invalid.");
    }

    // Use Number() to perform the conversion
    const number = Number(text);

    if (isNaN(number)) {
      throw new Error("Text is not a valid number.");
    }

    webconsole.success("TEXT TO NUMBER NODE | Converted text to number");
    return number;
  }

  /**
   * @override
   * @inheritDoc
   * @param {import('../../core/BaseNode/node.js').Inputs[]} inputs
   * @param {import('../../core/BaseNode/node.js').Contents[]} contents
   * @param {import('../../core/BaseNode/node.js').IWebConsole} webconsole
   * @param {import('../../core/BaseNode/node.js').IServerData} serverData
   */
  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("TEXT TO NUMBER NODE | Executing logic");

    const text = this.getValue(inputs, contents, "Text", "");

    // 4. Create the Tool
    const textToNumberTool = tool(
      async ({ textInput }, toolConfig) => {
        webconsole.info("TEXT TO NUMBER TOOL | Invoking tool");

        try {
          const number = this.executeTextToNumber(textInput, webconsole);

          return [JSON.stringify({ number: number }), this.getCredit()];
        } catch (error) {
          webconsole.error(`TEXT TO NUMBER TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              error: error.message,
              number: null,
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "textToNumberConverter",
        description:
          "Converts a text string (e.g., '123' or '45.67') into a numeric data type. Use this when you need to perform calculations on a number that is currently formatted as text.",
        schema: z.object({
          textInput: z
            .string()
            .describe("The text string containing the numeric value."),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // 5. Check for required fields for direct execution
    if (!text || typeof text !== "string" || text.trim() === "") {
      webconsole.info(
        "TEXT TO NUMBER NODE | Missing input text, returning tool only"
      );
      this.setCredit(0);
      return {
        Number: null,
        Tool: textToNumberTool,
      };
    }

    // 6. Execute the conversion logic
    try {
      const number = this.executeTextToNumber(text, webconsole);

      return {
        Number: number,
        Credits: this.getCredit(),
        Tool: textToNumberTool,
      };
    } catch (error) {
      webconsole.error(
        "TEXT TO NUMBER NODE | Some error occured: " + error.message
      );
      return {
        Number: null,
        Credits: this.getCredit(),
        Tool: textToNumberTool,
      };
    }
  }
}

export default text_to_number;
