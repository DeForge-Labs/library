import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import { google } from "googleapis";
import axios from "axios";
import Papa from "papaparse";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

dotenv.config();

const config = {
  title: "Create Google Sheet",
  category: "office",
  type: "google_sheets",
  icon: {},
  desc: "Create a sheet in google sheets",
  credit: 0,
  inputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "The title for the new spreadsheet",
      name: "Title",
      type: "Text",
    },
    {
      desc: "Raw CSV data as string",
      name: "CSV Raw",
      type: "Text",
    },
    {
      desc: "Link to a CSV file",
      name: "CSV Link",
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
      desc: "The URL of the newly created Google Sheet",
      name: "Sheet URL",
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
      desc: "The title for the new spreadsheet",
      name: "Title",
      type: "Text",
      value: "New Sheet",
    },
    {
      desc: "Raw CSV data as string",
      name: "CSV Raw",
      type: "TextArea",
      value: "CSV here ...",
    },
    {
      desc: "Link to a CSV file",
      name: "CSV Link",
      type: "Text",
      value: "Link to CSV here ...",
    },
    {
      desc: "Connect your google account",
      name: "Google_Sheets",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["create", "sheets", "google", "csv"],
};

class google_sheets extends BaseNode {
  constructor() {
    super(config);
  }

  getValue(inputs, contents, name, defaultValue = null) {
    const input = inputs.find((i) => i.name === name);
    if (input?.value !== undefined) return input.value;
    const content = contents.find((c) => c.name === name);
    if (content?.value !== undefined) return content.value;
    return defaultValue;
  }

  parseCsvTo2dArray(csvString) {
    // Papa Parse handles trimming and parsing reliably
    const result = Papa.parse(csvString.trim(), { header: false });
    if (result.errors.length > 0) {
      throw new Error(`CSV Parsing Error: ${result.errors[0].message}`);
    }
    return result.data;
  }

  /**
   * Executes the main logic for creating the sheet and uploading data.
   * @param {string} Title - The title of the new spreadsheet.
   * @param {string} CsvRaw - Raw CSV data string.
   * @param {string} CsvLink - Link to a CSV file.
   * @param {import("../../core/BaseNode/node.js").IWebConsole} webconsole
   * @param {import("../../core/BaseNode/node.js").IServerData} serverData
   * @returns {Promise<{ "Sheet URL": string }>}
   */
  async executeCreateSheet({ Title, CsvRaw, CsvLink }, webconsole, serverData) {
    if (!CsvRaw && !CsvLink) {
      throw new Error("Please provide either raw CSV data or a CSV Link.");
    }

    const tokens = serverData.socialList;
    if (
      !Object.keys(tokens).includes("google_sheets") ||
      !tokens["google_sheets"]
    ) {
      throw new Error(
        "Google Sheets account is not connected. Please connect your Google account."
      );
    }

    let csvData = CsvRaw;
    if (CsvLink) {
      webconsole.info(
        "GOOGLE SHEETS CREATE NODE | Fetching CSV data from link"
      );
      try {
        const response = await axios.get(CsvLink);
        csvData = response.data;
      } catch (e) {
        throw new Error(`Failed to fetch CSV data from link: ${e.message}`);
      }
    }

    if (!csvData) {
      throw new Error("No CSV data available for processing.");
    }

    const google_sheets_token = tokens["google_sheets"];

    const oauth2Client = new google.auth.OAuth2(
      process.env.GCP_CLIENT_ID,
      process.env.GCP_CLIENT_SECRET,
      process.env.GCP_REDIRECT_URL
    );

    oauth2Client.setCredentials(google_sheets_token);

    const sheets = google.sheets({ version: "v4", auth: oauth2Client });

    // Create a blank google sheet
    webconsole.info(
      `GOOGLE SHEETS CREATE NODE | Creating a new sheet with the title: ${Title}`
    );
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: Title,
        },
      },
      fields: "spreadsheetId,spreadsheetUrl",
    });

    const spreadsheetId = createResponse.data.spreadsheetId;
    const spreadsheetUrl = createResponse.data.spreadsheetUrl;

    webconsole.success(
      `GOOGLE SHEETS CREATE NODE | Successfully created a new sheet with ID: ${spreadsheetId}`
    );

    const values = this.parseCsvTo2dArray(csvData);
    if (values.length > 0) {
      webconsole.info(
        "GOOGLE SHEETS CREATE NODE | Writing data to the newly created sheet"
      );
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: "A1",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: values,
        },
      });

      webconsole.success(
        "GOOGLE SHEETS CREATE NODE | Successfully wrote data to the sheet"
      );
    }

    return {
      "Sheet URL": spreadsheetUrl,
    };
  }

  /**
   * @override
   * @inheritdoc
   */
  async run(inputs, contents, webconsole, serverData) {
    const Title = this.getValue(inputs, contents, "Title", "New Sheet");
    const CsvRaw = this.getValue(inputs, contents, "CSV Raw", "");
    const CsvLink = this.getValue(inputs, contents, "CSV Link", "");

    // 1. Define the Tool
    const createSheetTool = tool(
      async ({ title, csvRaw, csvLink }, toolConfig) => {
        webconsole.info("GOOGLE SHEETS CREATE TOOL | Invoking tool");

        // Check for required social connection
        if (!serverData.socialList["google_sheets"]) {
          return [
            JSON.stringify({
              "Sheet URL": null,
              error: "Google Sheets account not connected.",
            }),
            this.getCredit(),
          ];
        }

        try {
          const result = await this.executeCreateSheet(
            { Title: title, CsvRaw: csvRaw, CsvLink: csvLink },
            webconsole,
            serverData
          );

          this.setCredit(this.getCredit()); // Maintain credits (which is 0)
          return [JSON.stringify(result), this.getCredit()];
        } catch (error) {
          webconsole.error(
            `GOOGLE SHEETS CREATE TOOL | Error: ${error.message}`
          );
          return [
            JSON.stringify({ "Sheet URL": null, error: error.message }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "googleSheetCreator",
        description:
          "Creates a new spreadsheet in Google Sheets with an optional title and imports data from raw CSV text or a CSV file link into the first sheet.",
        schema: z.object({
          title: z
            .string()
            .optional()
            .default("New Sheet")
            .describe("The desired title for the new Google Spreadsheet."),
          csvRaw: z
            .string()
            .optional()
            .describe(
              "The raw CSV data as a string to be imported into the sheet's cells. Use this or csvLink, but not both."
            ),
          csvLink: z
            .string()
            .optional()
            .describe(
              "A publicly accessible URL pointing to a CSV file to be imported into the sheet. Use this or csvRaw, but not both."
            ),
        }),
      }
    );

    // 2. Direct Execution
    try {
      webconsole.info("GOOGLE SHEETS CREATE NODE | Started direct execution");

      // The credit is 0, so no explicit setCredit call is strictly necessary for deduction,
      // but we ensure it's set for output consistency.
      this.setCredit(config.credit);

      const result = await this.executeCreateSheet(
        { Title, CsvRaw, CsvLink },
        webconsole,
        serverData
      );

      return {
        ...result,
        Credits: this.getCredit(),
        Tool: createSheetTool,
      };
    } catch (error) {
      webconsole.error(
        `GOOGLE SHEETS CREATE NODE | An error occurred: ${error.message}`
      );

      return {
        "Sheet URL": null,
        Credits: this.getCredit(), // Still 0
        Tool: createSheetTool,
      };
    }
  }
}

export default google_sheets;
