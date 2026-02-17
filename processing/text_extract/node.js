import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Text Extract",
  category: "processing",
  type: "text_extract",
  icon: {},
  desc: "Extracts specific text from a string using a Regular Expression (Regex).",
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
      desc: "The source text to extract from.",
    },
    {
      name: "Regex Pattern",
      type: "Text",
      desc: "The regular expression pattern used for extraction.",
    },
    {
      name: "Match All",
      type: "Boolean",
      desc: "Extract all occurrences matching the pattern",
    },
  ],
  outputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
    {
      name: "Extracted Text",
      type: "Text",
      desc: "The extracted text. Returns a JSON stringified array if 'Match All' is true, or a single string if false.",
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
      type: "TextArea",
      desc: "The source text to extract from.",
      value: "Enter text here...",
    },
    {
      name: "Regex Pattern",
      type: "Text",
      desc: "The regular expression pattern (e.g., \\d+ for numbers).",
      value: "Enter regex here...",
    },
    {
      desc: "Extract all occurrences matching the pattern",
      name: "Match All",
      type: "CheckBox",
      value: false,
    },
  ],
  difficulty: "medium",
  tags: ["text", "extract", "regex", "processing", "string"],
};

class text_extract extends BaseNode {
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
   * Core function to handle regex text extraction logic
   */
  executeTextExtract(text, regexPattern, matchAll, webconsole) {
    if (!text || !regexPattern) {
      throw new Error("Text or Regex Pattern cannot be empty.");
    }

    const sourceText = String(text);
    const patternString = String(regexPattern);

    let regex;
    try {
      regex = new RegExp(patternString, matchAll ? "g" : "");
    } catch (error) {
      throw new Error(`Invalid Regular Expression: ${error.message}`);
    }

    const matches = sourceText.match(regex);

    if (!matches) {
      webconsole.info("TEXT EXTRACT NODE | No matches found.");
      return "";
    }

    webconsole.success(
      `TEXT EXTRACT NODE | Extraction complete (Matches found: ${matches.length})`,
    );

    return matchAll ? JSON.stringify(matches) : matches[0];
  }

  /**
   * @override
   * @inheritDoc
   */
  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("TEXT EXTRACT NODE | Executing logic");

    const text = this.getValue(inputs, contents, "Text", "");
    const regexPattern = this.getValue(inputs, contents, "Regex Pattern", "");
    const matchAll = this.getValue(inputs, contents, "Match All", false);

    // Create the Tool for LLMs
    const textExtractTool = tool(
      async ({ sourceText, pattern, matchAllOccurrences }, toolConfig) => {
        webconsole.info("TEXT EXTRACT TOOL | Invoking tool");

        try {
          const extractedText = this.executeTextExtract(
            sourceText,
            pattern,
            matchAllOccurrences,
            webconsole,
          );

          return [
            JSON.stringify({ extractedText: extractedText }),
            this.getCredit(),
          ];
        } catch (error) {
          webconsole.error(`TEXT EXTRACT TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              error: error.message,
              extractedText: null,
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "textExtractor",
        description:
          "Extracts specific text from a larger string using a Regular Expression (Regex) pattern. Highly useful for isolating structured data like emails, numbers, or tags.",
        schema: z.object({
          sourceText: z
            .string()
            .describe("The original text to extract content from."),
          pattern: z
            .string()
            .describe(
              "The exact Regular Expression pattern used to find the text.",
            ),
          matchAllOccurrences: z
            .boolean()
            .default(false)
            .describe(
              "Set to true to extract an array of all matches; false to extract only the first match.",
            ),
        }),
        responseFormat: "content_and_artifact",
      },
    );

    if (!text || !regexPattern) {
      webconsole.info(
        "TEXT EXTRACT NODE | Missing required inputs, returning tool only",
      );
      this.setCredit(0);
      return {
        "Extracted Text": null,
        Tool: textExtractTool,
      };
    }

    try {
      const extractedText = this.executeTextExtract(
        text,
        regexPattern,
        matchAll,
        webconsole,
      );

      return {
        "Extracted Text": extractedText,
        Credits: this.getCredit(),
        Tool: textExtractTool,
      };
    } catch (error) {
      webconsole.error("TEXT EXTRACT NODE | Error occurred: " + error.message);
      return {
        "Extracted Text": null,
        Credits: this.getCredit(),
        Tool: textExtractTool,
      };
    }
  }
}

export default text_extract;
