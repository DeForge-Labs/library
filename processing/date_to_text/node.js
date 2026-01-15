import BaseNode from "../../core/BaseNode/node.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Date to Text (Formatted)",
  category: "processing",
  type: "date_to_text",
  icon: {},
  desc: "Converts a date object or string into a localized text string.",
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
    {
      desc: "The locale for the date (like en-US, de-DE, fr-FR)",
      name: "Locale",
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
      desc: "The text representation of the date",
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
      desc: "Date to convert",
      name: "Date",
      type: "Date",
      value: "Enter date here...",
    },
    {
      desc: "The locale for the date (like en-US, de-DE, fr-FR)",
      name: "Locale",
      type: "Text",
      value: "en-US",
    },
  ],
  difficulty: "easy",
  tags: ["date", "text", "format", "locale"],
};

class date_to_text extends BaseNode {
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
   * 3. Core function to handle date to text conversion logic
   */
  executeDateToText(Datedata, Locale, webconsole) {
    if (!Datedata) {
      throw new Error("No date provided");
    }

    let dateObject;

    // Handle the node's custom Date object format
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
    // Handle standard Date object or ISO string (expected from tool/input)
    else if (Datedata instanceof Date) {
      dateObject = Datedata;
    } else if (typeof Datedata === "string") {
      dateObject = new Date(Datedata);
    } else {
      throw new Error(
        "Date is in an unsupported format. Expected a Date object, ISO string, or structured object."
      );
    }

    if (isNaN(dateObject.getTime())) {
      throw new Error("The provided date is invalid.");
    }

    const localeToUse = Locale && Locale.trim() ? Locale.trim() : "en-US";
    let formattedText;

    try {
      // Use toLocaleString with locale and a standard set of options
      formattedText = dateObject.toLocaleString(localeToUse, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false, // Ensure 24hr format by default for consistency
      });
      webconsole.success(
        `DATE TO TEXT NODE | Successfully converted date using locale: ${localeToUse}`
      );
    } catch (error) {
      if (error instanceof RangeError) {
        // Fallback logic
        formattedText = dateObject.toLocaleString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        webconsole.warn(
          `DATE TO TEXT NODE | Locale '${localeToUse}' failed, fell back to 'en-US'`
        );
      } else {
        throw error;
      }
    }
    return formattedText;
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("DATE TO TEXT NODE | Executing logic");

    const Datedata = this.getValue(inputs, contents, "Date", null);
    const Locale = this.getValue(inputs, contents, "Locale", "en-US");

    // 4. Create the Tool
    const dateToTextTool = tool(
      async ({ dateString, locale }, toolConfig) => {
        webconsole.info("DATE TO TEXT TOOL | Invoking tool");

        try {
          // The tool expects a standard date string (ISO format is best)
          const formattedText = this.executeDateToText(
            dateString,
            locale,
            webconsole
          );

          return [
            JSON.stringify({ formattedText: formattedText }),
            this.getCredit(),
          ];
        } catch (error) {
          webconsole.error(`DATE TO TEXT TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              error: error.message,
              formattedText: null,
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "dateToTextFormatter",
        description:
          "Converts a specific date and time into a localized, human-readable text string. The input date should be an ISO 8601 string, and you can specify a locale (e.g., 'fr-FR', 'ja-JP') for formatting.",
        schema: z.object({
          dateString: z
            .string()
            .describe(
              "The full date and time to convert, preferably in ISO 8601 format (e.g., 2024-12-31T23:59:59.000Z)."
            ),
          locale: z
            .string()
            .default("en-US")
            .describe(
              "The locale code to use for formatting (e.g., 'en-US' for English, 'de-DE' for German)."
            ),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // 5. Check for required fields for direct execution
    if (!Datedata) {
      webconsole.info(
        "DATE TO TEXT NODE | No date provided, returning tool only"
      );
      this.setCredit(0);
      return {
        Text: null,
        Tool: dateToTextTool,
      };
    }

    // 6. Execute the conversion logic
    try {
      const data = this.executeDateToText(Datedata, Locale, webconsole);

      return {
        Text: data,
        Credits: this.getCredit(),
        Tool: dateToTextTool,
      };
    } catch (error) {
      const errorMsg =
        error instanceof RangeError
          ? "Invalid locale or date, operation failed."
          : error.message;
      webconsole.error("DATE TO TEXT NODE | Some error occured: " + errorMsg);

      // Return null or the Tool, but ensure the output format matches the node's expectation if execution fails.
      return {
        Text: null,
        Credits: this.getCredit(),
        Tool: dateToTextTool,
      };
    }
  }
}

export default date_to_text;
