import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import { google } from "googleapis";
import axios from "axios";

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
            desc: "The URL of the newly created Google Sheet",
            name: "Sheet URL",
            type: "Text"
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
        }
    ],
    difficulty: "easy",
    tags: ["create", "sheets", "google", "csv"],
}

class google_sheets extends BaseNode {
    constructor() {
        super(config);
    }

    parseCsvTo2dArray(csvString) {
        if (!csvString) return [];
        return csvString.trim().split("\n").map(row => row.split(","));
    }

    async run(inputs, contents, webconsole, serverData) {
        try {
            webconsole.info("GOOGLE SHEETS CREATE NODE | Started execution");

            const TitleFilter = inputs.find((e) => e.name === "Title");
            const Title = TitleFilter?.value || contents.find((e) => e.name === "Title")?.value || "New Sheet";

            const CsvRawFilter = inputs.find((e) => e.name === "CSV Raw");
            const CsvRaw = CsvRawFilter?.value || contents.find((e) => e.name === "CSV Raw")?.value || "";

            const CsvLinkFilter = inputs.find((e) => e.name === "CSV Link");
            const CsvLink = CsvLinkFilter?.value || contents.find((e) => e.name === "CSV Link")?.value || "";

            if (!CsvRaw && !CsvLink) {
                webconsole.error("GOOGLE SHEETS CREATE NODE | Please provide either CSV Raw data or a CSV Link");
                return null;
            }

            let csvData = CsvRaw;
            if (CsvLink) {
                webconsole.info("GOOGLE SHEETS CREATE NODE | Fetching CSV data from link");
                const response = await axios.get(CsvLink);
                csvData = response.data;
            }

            if (!csvData) {
                webconsole.error("GOOGLE SHEETS CREATE NODE | No CSV data provided");
                return null;
            }

            const tokens = serverData.socialList;
            if (!Object.keys(tokens).includes("google_sheets")) {
                webconsole.error("GOOGLE SHEETS CREATE NODE | Please connect your gmail account");
                return null;
            }

            const google_sheets_token = tokens["google_sheets"];
            if (!google_sheets_token) {
                webconsole.error("GOOGLE SHEETS CREATE NODE | Some error occured, please reconnect your google account");
                return null;
            }

            const oauth2Client = new google.auth.OAuth2(
                process.env.GCP_CLIENT_ID,
                process.env.GCP_CLIENT_SECRET,
                process.env.GCP_REDIRECT_URL
            );

            oauth2Client.setCredentials(google_sheets_token);

            const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

            // Create a blank google sheet
            webconsole.info("GOOGLE SHEETS CREATE NODE | Creating a new sheet with the title: ", Title);
            const createResponse = await sheets.spreadsheets.create({
                requestBody: {
                    properties: {
                        title: Title,
                    },
                },
                fields: 'spreadsheetId,spreadsheetUrl',
            });

            const spreadsheetId = createResponse.data.spreadsheetId;
            const spreadsheetUrl = createResponse.data.spreadsheetUrl;

            webconsole.success("GOOGLE SHEETS CREATE NODE | Successfully created a new sheet with ID: ", spreadsheetId);

            const values = this.parseCsvTo2dArray(csvData);
            if (values.length > 0) {
                webconsole.info("GOOGLE SHEETS CREATE NODE | Writing data to the newly created sheet");
                await sheets.spreadsheets.values.update({
                    spreadsheetId: spreadsheetId,
                    range: 'A1',
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: values,
                    }
                });

                webconsole.success("GOOGLE SHEETS CREATE NODE | Successfully wrote data to the sheet");
            }

            return {
                "Sheet URL": spreadsheetUrl,
            };

        } catch (error) {
            webconsole.error("GOOGLE SHEETS CREATE NODE | Some error occured: ", error);
            return null;
        }
    }
}

export default google_sheets;