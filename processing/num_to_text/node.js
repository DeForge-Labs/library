import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Number to Text",
  category: "processing",
  type: "num_to_text",
  icon: {},
  desc: "Converts a number (integer or float) into its string representation.",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Number to convert",
      name: "Number",
      type: "Number",
    },
  ],
  outputs: [
    {
      desc: "The number in text format",
      name: "Text",
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
      desc: "Number to convert",
      name: "Number",
      type: "Number",
    },
  ],
  difficulty: "easy",
  tags: ["text", "num", "converter", "string"],
};

class num_to_text extends BaseNode {
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
   * 3. Core function to handle Number to Text conversion logic
   */
  executeNumToText(NumData, webconsole) {
    // Coerce to number for tool inputs which may come as strings
    const numberValue = Number(NumData);

    if (NumData === null || NumData === undefined || isNaN(numberValue)) {
      throw new Error("Input data is not a valid number.");
    }

    const text = numberValue.toString();
    webconsole.success("NUMBER TO TEXT NODE | Successfully converted Number");
    return text;
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("NUMBER TO TEXT NODE | Executing logic");

    const NumData = this.getValue(inputs, contents, "Number", null);

    // 4. Create the Tool
    const numToTextTool = tool(
      async ({ numberInput }, toolConfig) => {
        webconsole.info("NUMBER TO TEXT TOOL | Invoking tool");

        try {
          // Tool input is expected to be a number type as per Zod schema
          const text = this.executeNumToText(numberInput, webconsole);

          return [JSON.stringify({ text: text }), this.getCredit()];
        } catch (error) {
          webconsole.error(`NUMBER TO TEXT TOOL | Error: ${error.message}`);
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
        name: "numberToTextConverter",
        description:
          "Converts a numeric value (integer or decimal) into its equivalent text/string representation. This is useful for concatenating numbers with text.",
        schema: z.object({
          numberInput: z
            .number()
            .describe("The number to be converted to text (e.g., 123.45)."),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // 5. Check for required fields for direct execution
    // Check if NumData is present AND a finite number
    if (
      NumData === null ||
      NumData === undefined ||
      isNaN(NumData) ||
      typeof NumData !== "number"
    ) {
      webconsole.info(
        "NUMBER TO TEXT NODE | Missing or invalid number provided, returning tool only"
      );
      this.setCredit(0);
      return {
        Text: null,
        Tool: numToTextTool,
      };
    }

    // 6. Execute the conversion logic
    try {
      const text = this.executeNumToText(NumData, webconsole);

      return {
        Text: text,
        Credits: this.getCredit(),
        Tool: numToTextTool,
      };
    } catch (error) {
      webconsole.error(
        "NUMBER TO TEXT NODE | Some error occured: " + error.message
      );
      return {
        Text: null,
        Credits: this.getCredit(),
        Tool: numToTextTool,
      };
    }
  }
}

export default num_to_text;
