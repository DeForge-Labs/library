import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Date to Number (Timestamp)",
  category: "processing",
  type: "date_to_number",
  icon: {},
  desc: "Converts a date object or string into a numeric Unix timestamp (milliseconds since epoch).",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Date to convert (e.g., Date object, ISO string)",
      name: "Date",
      type: "Date",
    },
  ],
  outputs: [
    {
        desc: "The Flow to trigger",
        name: "Flow",
        type: "Flow",
    },
    {
      desc: "The number of milliseconds since the Unix epoch (timestamp)",
      name: "Number",
      type: "Number",
    },
    {
      desc: "The tool version of this node, to be used by LLMs", // 2. Add Tool output
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "Date to convert",
      name: "Date",
      type: "Date",
      value: "Enter date here...",
    },
  ],
  difficulty: "easy",
  tags: ["date", "number", "timestamp"],
};

class date_to_number extends BaseNode {
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
   * 3. Core function to handle date to number conversion logic
   * It handles the node's custom Date object format and standard Date objects/strings.
   */
  executeDateToNumber(Datedata, webconsole) {
    if (!Datedata) {
      throw new Error("No date provided");
    }

    let dateObject;

    // Check if the input is the node's custom Date object format
    if (
      typeof Datedata === "object" &&
      Datedata !== null &&
      Datedata.year !== undefined &&
      Datedata.month !== undefined &&
      Datedata.day !== undefined &&
      Datedata.hour !== undefined &&
      Datedata.minute !== undefined
    ) {
      dateObject = new Date(
        Datedata.year,
        Datedata.month - 1, // JS months are 0-indexed
        Datedata.day,
        Datedata.hour,
        Datedata.minute,
        Datedata.second || 0,
        Datedata.millisecond || 0
      );
    }
    // Handle standard Date object or ISO string (expected from tool)
    else if (Datedata instanceof Date) {
      dateObject = Datedata;
    } else if (typeof Datedata === "string") {
      dateObject = new Date(Datedata);
    } else {
      throw new Error(
        "Date is in an unsupported format. Expected a Date object, ISO string, or structured object."
      );
    }

    // Check for "Invalid Date"
    if (isNaN(dateObject.getTime())) {
      throw new Error("The provided date is invalid.");
    }

    const timestamp = dateObject.getTime();
    webconsole.success(
      `DATE TO NUM NODE | Successfully converted date to timestamp: ${timestamp}`
    );
    return timestamp;
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("DATE TO NUM NODE | Executing logic");

    const Datedata = this.getValue(inputs, contents, "Date", null);

    // 4. Create the Tool
    const dateToNumberTool = tool(
      async ({ dateString }, toolConfig) => {
        webconsole.info("DATE TO NUMBER TOOL | Invoking tool");

        try {
          // The tool expects a standard date string (ISO format is best)
          const timestamp = this.executeDateToNumber(dateString, webconsole);

          return [JSON.stringify({ timestamp: timestamp }), this.getCredit()];
        } catch (error) {
          webconsole.error(`DATE TO NUMBER TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              error: error.message,
              timestamp: null,
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "dateToNumberConverter",
        description:
          "Converts a specified date and time into a numeric Unix timestamp (milliseconds since epoch). The input should be a precise date string.",
        schema: z.object({
          dateString: z
            .string()
            .describe(
              "The full date and time to convert, preferably in ISO 8601 format (e.g., 2024-12-31T23:59:59.000Z or 'December 31, 2024 11:59:59 PM')."
            ),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // 5. Check for required fields for direct execution
    if (!Datedata) {
      webconsole.error(
        "DATE TO NUM NODE | No date provided, returning tool only"
      );
      this.setCredit(0);
      return {
        Number: null,
        Tool: dateToNumberTool,
      };
    }

    // 6. Execute the conversion logic
    try {
      const data = this.executeDateToNumber(Datedata, webconsole);

      return {
        Number: data,
        Credits: this.getCredit(),
        Tool: dateToNumberTool,
      };
    } catch (error) {
      webconsole.error(
        "DATE TO NUM NODE | Some error occured: " + error.message
      );
      return {
        Number: null,
        Credits: this.getCredit(),
        Tool: dateToNumberTool,
      };
    }
  }
}

export default date_to_number;
