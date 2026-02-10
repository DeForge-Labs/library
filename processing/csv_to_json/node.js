import BaseNode from "../../core/BaseNode/node.js";
import Papa from "papaparse";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "CSV to JSON",
  category: "processing",
  type: "csv_to_json",
  icon: {},
  desc: "Converts CSV text into a JSON array of objects.",
  credit: 0,
  inputs: [
    {
        desc: "The flow of the workflow",
        name: "Flow",
        type: "Flow",
    },
    {
        desc: "CSV text to convert",
        name: "CSV",
        type: "TextArea",
    },
  ],
  outputs: [
    {
        desc: "The Flow to trigger",
        name: "Flow",
        type: "Flow",
    },
    {
        desc: "The JSON data parsed from CSV",
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
        desc: "CSV text to convert",
        name: "CSV",
        type: "TextArea",
    },
  ],
  difficulty: "easy",
  tags: ["json", "csv", "parser", "data"],
};

class csv_to_json extends BaseNode {
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
   * 3. Core function to handle CSV to JSON conversion logic
   */
  executeCsvToJson(csvData, webconsole) {
    if (csvData === null || csvData === undefined) {
      throw new Error("Input data is null or undefined");
    }

    if (typeof csvData !== "string") {
       throw new Error("Input must be a string in CSV format.");
    }

    // Papa.parse with header: true converts CSV rows into objects using the first row as keys
    const results = Papa.parse(csvData.trim(), {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true, // Optional: converts numbers and booleans automatically
    });

    if (results.errors && results.errors.length > 0) {
      // Log errors but return what data was parsed, or throw if critical
      webconsole.error("CSV TO JSON NODE | Parse warnings/errors: " + JSON.stringify(results.errors));
      if (!results.data || results.data.length === 0) {
        throw new Error("Failed to parse CSV: " + results.errors[0].message);
      }
    }

    webconsole.success("CSV TO JSON NODE | Successfully converted CSV");
    return results.data;
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("CSV TO JSON NODE | Executing logic");

    const csvData = this.getValue(inputs, contents, "CSV", "");

    // 4. Create the Tool
    const csvToJsonTool = tool(
      async ({ csvInput }, toolConfig) => {
        webconsole.info("CSV TO JSON TOOL | Invoking tool");

        try {
          const jsonData = this.executeCsvToJson(csvInput, webconsole);

          return [JSON.stringify({ json: jsonData }), this.getCredit()];
        } catch (error) {
          webconsole.error(`CSV TO JSON TOOL | Error: ${error.message}`);
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
        name: "csvToJsonConverter",
        description:
          "Converts a CSV (Comma Separated Values) text string into a structured JSON array of objects. The first row of the CSV is treated as the header (keys).",
        schema: z.object({
          csvInput: z
            .string()
            .describe(
              "The CSV text string to be converted to JSON."
            ),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // 5. Check for required fields for direct execution
    const isDataPresent = typeof csvData === "string" && csvData.trim().length > 0;

    if (!isDataPresent) {
      webconsole.info(
        "CSV TO JSON NODE | No CSV data provided, returning tool only"
      );
      this.setCredit(0);
      return {
        JSON: null,
        Tool: csvToJsonTool,
      };
    }

    // 6. Execute the conversion logic
    try {
      const jsonData = this.executeCsvToJson(csvData, webconsole);

      return {
        JSON: jsonData,
        Credits: this.getCredit(),
        Tool: csvToJsonTool,
      };
    } catch (error) {
      webconsole.error(
        "CSV TO JSON NODE | Some error occured: " + error.message
      );
      return {
        JSON: null,
        Credits: this.getCredit(),
        Tool: csvToJsonTool,
      };
    }
  }
}

export default csv_to_json;