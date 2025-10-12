import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Text Join",
  category: "processing",
  type: "text_join",
  icon: {},
  desc: "Joins multiple text strings into a single string using a specified separator.",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Array of text strings to join",
      name: "Text",
      type: "Text[]",
    },
  ],
  outputs: [
    {
      desc: "The joined text",
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
      desc: "Text to join",
      name: "Text",
      type: "Text[]",
      value: "Enter text here...",
    },
    {
      desc: "Separator",
      name: "Separator",
      type: "Text",
      value: ",",
    },
  ],
  difficulty: "easy",
  tags: ["text", "join", "concatenate"],
};

class text_join extends BaseNode {
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
   * 3. Core function to handle text joining logic
   */
  executeTextJoin(inputTexts, separator, webconsole) {
    if (!inputTexts || !Array.isArray(inputTexts)) {
      // Handle case where input is a single non-array value (e.g., from a tool or direct link)
      if (typeof inputTexts === "string") {
        inputTexts = [inputTexts];
      } else {
        throw new Error("Input 'Text' must be an array of strings.");
      }
    }

    const validTexts = inputTexts
      .filter((t) => t !== null && t !== undefined)
      .map(String);

    const res = validTexts.join(separator);

    webconsole.success("TEXT JOIN NODE | Joined texts");
    return res;
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
    webconsole.info("TEXT JOIN NODE | Executing logic");

    let inputTexts = this.getValue(inputs, contents, "Text", null);
    const separator = this.getValue(inputs, contents, "Separator", ",");

    // Ensure inputTexts is an array if present, as the node expects Text[]
    if (inputTexts && !Array.isArray(inputTexts)) {
      inputTexts = [inputTexts];
    }

    // 4. Create the Tool
    const textJoinTool = tool(
      async ({ texts, separator: toolSeparator }, toolConfig) => {
        webconsole.info("TEXT JOIN TOOL | Invoking tool");

        try {
          const joinedText = this.executeTextJoin(
            texts,
            toolSeparator,
            webconsole
          );

          return [JSON.stringify({ joinedText: joinedText }), this.getCredit()];
        } catch (error) {
          webconsole.error(`TEXT JOIN TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              error: error.message,
              joinedText: null,
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "textJoiner",
        description:
          "Concatenates an array of text strings into a single string using a specified separator.",
        schema: z.object({
          texts: z
            .array(z.string())
            .describe(
              "An array of strings to be joined (e.g., ['Hello', 'world', '!'])."
            ),
          separator: z
            .string()
            .default(",")
            .describe(
              "The string to insert between elements (e.g., ' ' for space, ',' for comma, or '\\n' for new line)."
            ),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // 5. Check for required fields for direct execution
    if (!inputTexts || !Array.isArray(inputTexts) || inputTexts.length === 0) {
      webconsole.info(
        "TEXT JOIN NODE | Missing input text array, returning tool only"
      );
      this.setCredit(0);
      return {
        Text: null,
        Tool: textJoinTool,
      };
    }

    // 6. Execute the joining logic
    try {
      const res = this.executeTextJoin(inputTexts, separator, webconsole);

      return {
        Text: res,
        Credits: this.getCredit(),
        Tool: textJoinTool,
      };
    } catch (error) {
      webconsole.error("TEXT JOIN NODE | Some error occured: " + error.message);
      return {
        Text: null,
        Credits: this.getCredit(),
        Tool: textJoinTool,
      };
    }
  }
}

export default text_join;
