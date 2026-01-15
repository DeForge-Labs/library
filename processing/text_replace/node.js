import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Text Replace",
  category: "processing",
  type: "text_replace",
  icon: {},
  desc: "Replaces text in a string, with an option to replace all occurrences.",
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
      desc: "The text on which replacement will be done.",
    },
    {
      name: "Text to replace",
      type: "Text",
      desc: "The text/substring to search for and replace.",
    },
    {
      name: "Text to replace with",
      type: "Text",
      desc: "The text to insert as the replacement.",
    },
  ],
  outputs: [
    {
        desc: "The Flow to trigger",
        name: "Flow",
        type: "Flow",
    },
    {
      name: "Text",
      type: "Text",
      desc: "The result text after replacement.",
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
      desc: "The text on which replacement will be done.",
      value: "Enter text here...",
    },
    {
      name: "Text to replace",
      type: "Text",
      desc: "The text to search for.",
      value: "Enter text here...",
    },
    {
      name: "Text to replace with",
      type: "Text",
      desc: "The text to replace with.",
      value: "Enter text here...",
    },
    {
      desc: "Replace all occurrences of the text",
      name: "Replace All",
      type: "CheckBox",
      value: false,
    },
  ],
  difficulty: "easy",
  tags: ["text", "replace", "processing", "string"],
};

class text_replace extends BaseNode {
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
   * 3. Core function to handle text replacement logic
   */
  executeTextReplace(
    text,
    textToReplace,
    textToReplaceWith,
    replaceAll,
    webconsole
  ) {
    if (!text || !textToReplace) {
      throw new Error("Text or Text to replace cannot be empty.");
    }

    // Ensure inputs are strings
    const sourceText = String(text);
    const searchString = String(textToReplace);
    // Default replacement to empty string if null/undefined
    const replacementString = textToReplaceWith
      ? String(textToReplaceWith)
      : "";

    let replacedText;

    if (replaceAll) {
      // Use replaceAll for global replacement (requires Node.js 15+)
      if (typeof sourceText.replaceAll === "function") {
        replacedText = sourceText.replaceAll(searchString, replacementString);
      } else {
        // Fallback for older environments: use regex with the 'g' flag
        // Escape special regex characters in the search string
        const escapedSearch = searchString.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );
        const regex = new RegExp(escapedSearch, "g");
        replacedText = sourceText.replace(regex, replacementString);
      }
    } else {
      // Use replace for single replacement
      replacedText = sourceText.replace(searchString, replacementString);
    }

    webconsole.success(
      `TEXT REPLACE NODE | Replacement complete (All: ${replaceAll})`
    );
    return replacedText;
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
    webconsole.info("TEXT REPLACE NODE | Executing logic");

    const text = this.getValue(inputs, contents, "Text", "");
    const textToReplace = this.getValue(
      inputs,
      contents,
      "Text to replace",
      ""
    );
    const textToReplaceWith = this.getValue(
      inputs,
      contents,
      "Text to replace with",
      ""
    );
    const replaceAll = this.getValue(inputs, contents, "Replace All", false);

    // 4. Create the Tool
    const textReplaceTool = tool(
      async (
        { sourceText, searchString, replacementString, replaceAllOccurrences },
        toolConfig
      ) => {
        webconsole.info("TEXT REPLACE TOOL | Invoking tool");

        try {
          const replacedText = this.executeTextReplace(
            sourceText,
            searchString,
            replacementString,
            replaceAllOccurrences,
            webconsole
          );

          return [
            JSON.stringify({ replacedText: replacedText }),
            this.getCredit(),
          ];
        } catch (error) {
          webconsole.error(`TEXT REPLACE TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              error: error.message,
              replacedText: null,
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "textReplacer",
        description:
          "Replaces a specific substring within a larger text string. By default, it replaces only the first occurrence, but can be set to replace all occurrences globally.",
        schema: z.object({
          sourceText: z
            .string()
            .describe(
              "The original text containing the content to be replaced."
            ),
          searchString: z
            .string()
            .describe("The exact text or substring to be found and replaced."),
          replacementString: z
            .string()
            .describe(
              "The new text to substitute in place of the search string."
            ),
          replaceAllOccurrences: z
            .boolean()
            .default(false)
            .describe(
              "Set to true to replace all instances of the search string; false to replace only the first one."
            ),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // 5. Check for required fields for direct execution
    if (!text || !textToReplace) {
      webconsole.info(
        "TEXT REPLACE NODE | Missing required text inputs, returning tool only"
      );
      this.setCredit(0);
      return {
        Text: null,
        Tool: textReplaceTool,
      };
    }

    // 6. Execute the replacement logic
    try {
      const replacedText = this.executeTextReplace(
        text,
        textToReplace,
        textToReplaceWith,
        replaceAll,
        webconsole
      );

      return {
        Text: replacedText,
        Credits: this.getCredit(),
        Tool: textReplaceTool,
      };
    } catch (error) {
      webconsole.error(
        "TEXT REPLACE NODE | Some error occured: " + error.message
      );
      return {
        Text: null,
        Credits: this.getCredit(),
        Tool: textReplaceTool,
      };
    }
  }
}

export default text_replace;
