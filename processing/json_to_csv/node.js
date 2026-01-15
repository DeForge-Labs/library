import BaseNode from "../../core/BaseNode/node.js";
import Papa from "papaparse";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "JSON to CSV",
  category: "processing",
  type: "json_to_csv",
  icon: {},
  desc: "Converts JSON data (array of objects) to CSV text format.",
  credit: 0,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "JSON data (should be an array of objects) to convert",
      name: "JSON",
      type: "JSON",
    },
  ],
  outputs: [
    {
        desc: "The Flow to trigger",
        name: "Flow",
        type: "Flow",
    },
    {
      desc: "The CSV text parsed from JSON",
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
      desc: "JSON data (array of objects) to convert",
      name: "JSON",
      type: "Map", // Although inputs is JSON, Map is used for field configuration
    },
  ],
  difficulty: "easy",
  tags: ["csv", "json", "parser", "data"],
};

class json_to_csv extends BaseNode {
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
   * 3. Core function to handle JSON to CSV conversion logic
   */
  executeJsonToCsv(JSONdata, webconsole) {
    if (JSONdata === null || JSONdata === undefined) {
      throw new Error("Input data is null or undefined");
    }

    if (typeof JSONdata === "string") {
      try {
        JSONdata = JSON.parse(JSONdata);
      } catch (e) {
        throw new Error("Input is a string but not valid JSON.");
      }
    }

    if (
      typeof JSONdata !== "object" ||
      (Array.isArray(JSONdata) && JSONdata.length === 0)
    ) {
      throw new Error(
        "Input data must be a non-empty array of objects or a single object."
      );
    }

    // Papa.unparse works best with an array of objects for a clean CSV,
    // but can handle a single object by treating its keys as columns and values as the first row.
    const csv = Papa.unparse(JSONdata);

    webconsole.success("JSON TO CSV NODE | Successfully converted JSON");
    return csv;
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("JSON TO CSV NODE | Executing logic");

    const JSONdata = this.getValue(inputs, contents, "JSON", {});

    // 4. Create the Tool
    const jsonToCsvTool = tool(
      async ({ jsonInput }, toolConfig) => {
        webconsole.info("JSON TO CSV TOOL | Invoking tool");

        try {
          // The tool input might be a JSON string, which is handled in executeJsonToCsv
          const csvText = this.executeJsonToCsv(jsonInput, webconsole);

          return [JSON.stringify({ csv: csvText }), this.getCredit()];
        } catch (error) {
          webconsole.error(`JSON TO CSV TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              error: error.message,
              csv: null,
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "jsonToCsvConverter",
        description:
          "Converts a structured JSON object or array of objects into a standard CSV (Comma Separated Values) text string. The input should primarily be an array of homogeneous objects (e.g., [{a: 1, b: 2}, {a: 3, b: 4}]).",
        schema: z.object({
          jsonInput: z
            .union([z.array(z.record(z.any())), z.record(z.any()), z.string()])
            .describe(
              "The JSON data (object or array of objects) to be converted to CSV. Can be a string if it's a JSON string."
            ),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // 5. Check for required fields for direct execution
    // Check if JSONdata is a non-empty array or a non-empty object
    const isDataPresent = Array.isArray(JSONdata)
      ? JSONdata.length > 0
      : typeof JSONdata === "object" &&
        JSONdata !== null &&
        Object.keys(JSONdata).length > 0;

    if (!isDataPresent) {
      webconsole.info(
        "JSON TO CSV NODE | No JSON data provided, returning tool only"
      );
      this.setCredit(0);
      return {
        Text: null,
        Tool: jsonToCsvTool,
      };
    }

    // 6. Execute the conversion logic
    try {
      const csv = this.executeJsonToCsv(JSONdata, webconsole);

      return {
        Text: csv,
        Credits: this.getCredit(),
        Tool: jsonToCsvTool,
      };
    } catch (error) {
      webconsole.error(
        "JSON TO CSV NODE | Some error occured: " + error.message
      );
      return {
        Text: null,
        Credits: this.getCredit(),
        Tool: jsonToCsvTool,
      };
    }
  }
}

export default json_to_csv;
