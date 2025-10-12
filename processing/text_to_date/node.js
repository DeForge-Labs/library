import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools"; // 1. Import tool
import { z } from "zod"; // 2. Import zod

const config = {
  title: "Text to Date",
  category: "processing",
  type: "text_to_date",
  icon: {},
  desc: "Converts a text string (preferably ISO Date String) to a structured Date object.",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Text to convert (e.g., ISO 8601 string)",
      name: "Text",
      type: "Text",
    },
  ],
  outputs: [
    {
      desc: "The structured date object of the text",
      name: "Date",
      type: "Date",
    },
    {
      desc: "The tool version of this node, to be used by LLMs", // 2. Add Tool output
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "Text to convert",
      name: "Text",
      type: "Text",
      value: "Enter ISO Date String here...",
    },
  ],
  difficulty: "easy",
  tags: ["text", "date", "converter", "parser"],
};

class text_to_date extends BaseNode {
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
   * 3. Core function to handle Text to Date conversion logic
   */
  executeTextToDate(Textdata, webconsole) {
    if (!Textdata || typeof Textdata !== "string" || !Textdata.trim()) {
      throw new Error("Input text is not a valid string or is empty.");
    }

    const dateObj = new Date(Textdata);

    // Check for "Invalid Date"
    if (isNaN(dateObj.getTime())) {
      throw new Error(
        `The provided text '${Textdata}' could not be parsed as a valid date.`
      );
    }

    // Convert to the node's expected structured format
    const date = {
      year: dateObj.getFullYear(),
      month: dateObj.getMonth() + 1, // JS months are 0-indexed, node expects 1-indexed
      day: dateObj.getDate(),
      hour: dateObj.getHours(),
      minute: dateObj.getMinutes(),
      second: dateObj.getSeconds(),
      millisecond: dateObj.getMilliseconds(),
    };

    webconsole.success(
      "TEXT TO DATE NODE | Successfully converted text to structured date"
    );
    return date;
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("TEXT TO DATE NODE | Executing logic");

    const Textdata = this.getValue(inputs, contents, "Text", null);

    // 4. Create the Tool
    const textToDateTool = tool(
      async ({ dateString }, toolConfig) => {
        webconsole.info("TEXT TO DATE TOOL | Invoking tool");

        try {
          const date = this.executeTextToDate(dateString, webconsole);

          // Return the structured date object
          return [JSON.stringify(date), this.getCredit()];
        } catch (error) {
          webconsole.error(`TEXT TO DATE TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              error: error.message,
              date: null,
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "textToDateConverter",
        description:
          "Converts a date and time string into a structured date object with separate properties for year, month, day, hour, etc. The input string should be in a standard format like ISO 8601 (e.g., 2024-12-31T23:59:59.000Z).",
        schema: z.object({
          dateString: z
            .string()
            .describe("The date and time string to convert."),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // 5. Check for required fields for direct execution
    if (!Textdata || typeof Textdata !== "string" || !Textdata.trim()) {
      webconsole.info(
        "TEXT TO DATE NODE | Missing input text, returning tool only"
      );
      this.setCredit(0);
      return {
        Date: null,
        Tool: textToDateTool,
      };
    }

    // 6. Execute the conversion logic
    try {
      const date = this.executeTextToDate(Textdata, webconsole);

      return {
        Date: date,
        Credits: this.getCredit(),
        Tool: textToDateTool,
      };
    } catch (error) {
      webconsole.error(
        "TEXT TO DATE NODE | Some error occured: " + error.message
      );
      return {
        Date: null,
        Credits: this.getCredit(),
        Tool: textToDateTool,
      };
    }
  }
}

export default text_to_date;
