import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import { google } from "googleapis";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

dotenv.config();

const config = {
  title: "Get Gmail Email",
  category: "social",
  type: "gmail_get",
  icon: {},
  desc: "Retrieve email from your connected gmail account using a search query (requires Gmail_Read connection).",
  credit: 5,
  inputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Search query for email (same as gmail search bar, e.g., 'is:unread from:amazon')",
      name: "Search Query",
      type: "Text",
    },
    {
      desc: "Number of email to retrieve",
      name: "Count",
      type: "Number",
    },
  ],
  outputs: [
    {
        desc: "The Flow to trigger",
        name: "Flow",
        type: "Flow",
    },
    {
      desc: "All email data (JSON array of {subject, body})",
      name: "All Email",
      type: "JSON",
    },
    {
      desc: "The email subject (if only one email selected)",
      name: "Subject",
      type: "Text",
    },
    {
      desc: "The email body (if only one email selected)",
      name: "Body",
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
      desc: "Search query for email (same as gmail search bar)",
      name: "Search Query",
      type: "Text",
      value: "search query here ...",
    },
    {
      desc: "Number of email to retrieve",
      name: "Count",
      type: "Slider",
      value: 5,
      min: 1,
      max: 50,
      step: 1,
    },
    {
      desc: "Connect to your Gmail account",
      name: "Gmail_Read",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "easy",
  tags: ["get", "gmail", "email", "inbox", "search"],
};

class gmail_get extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  findTextPart(parts) {
    let plainPart = parts.find((p) => p.mimeType === "text/plain");
    if (plainPart) return plainPart;

    let htmlPart = parts.find((p) => p.mimeType === "text/html");
    if (htmlPart) return htmlPart;

    for (const part of parts) {
      if (part.parts) {
        const found = this.findTextPart(part.parts);
        if (found) return found;
      }
    }

    return null;
  }

  getEmailBody(payload) {
    let body = "";
    if (payload.body.size > 0 && payload.body.data) {
      body = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload.parts) {
      const part = this.findTextPart(payload.parts);
      if (part && part.body.data) {
        body = Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
    return body;
  }

  async processEmail(gmailClient, messageId) {
    const msgResponse = await gmailClient.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const email = msgResponse.data;
    const subject =
      email.payload.headers.find((header) => header.name === "Subject")
        ?.value || "No Subject";
    const bodyText = this.getEmailBody(email.payload) || "No Body";

    return {
      subject,
      body: bodyText,
    };
  }

  getValue(inputs, contents, name, defaultValue = null) {
    const input = inputs.find((i) => i.name === name);
    if (input?.value !== undefined) return input.value;
    const content = contents.find((c) => c.name === name);
    if (content?.value !== undefined) return content.value;
    return defaultValue;
  }

  async executeGmailApi(searchQuery, maxCount, gmail_token, webconsole) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GCP_CLIENT_ID,
        process.env.GCP_CLIENT_SECRET,
        process.env.GCP_REDIRECT_URL
      );

      oauth2Client.setCredentials(gmail_token);

      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      const emailList = await gmail.users.messages.list({
        userId: "me",
        labelIds: ["INBOX"],
        maxResults: maxCount,
        ...(searchQuery && { q: searchQuery }),
      });

      const messageIds = emailList.data.messages || [];

      webconsole.info(
        `GMAIL GET NODE | Found ${messageIds.length} email(s), processing...`
      );

      let allEmailData = { emails: [] };

      for (const message of messageIds) {
        const messageId = message.id;
        const emailData = await this.processEmail(gmail, messageId);
        allEmailData.emails.push(emailData);
      }

      webconsole.success("GMAIL GET NODE | All emails processed successfully");

      return {
        "All Email": allEmailData,
        Subject:
          allEmailData.emails.length === 1
            ? allEmailData.emails[0].subject
            : "Multiple or no emails",
        Body:
          allEmailData.emails.length === 1
            ? allEmailData.emails[0].body
            : "Multiple or no emails",
      };
    } catch (error) {
      if (
        error.code === 401 ||
        (error.message && error.message.includes("Token has been expired"))
      ) {
        webconsole.error(
          "GMAIL GET NODE | Authorization failed. Please re-connect your Gmail account."
        );
        throw new Error("Gmail Authorization failed/expired.");
      }
      webconsole.error("GMAIL GET NODE | API execution error: ", error);
      throw new Error(`Gmail API error: ${error.message}`);
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("GMAIL GET NODE | Executing logic");

    const SearchQuery = this.getValue(inputs, contents, "Search Query", "");
    const Count = this.getValue(inputs, contents, "Count", 5);

    const tokens = serverData.socialList;
    const gmail_token = tokens["gmail_read"];

    if (!gmail_token) {
      this.setCredit(0);
      webconsole.error(
        "GMAIL GET NODE | Gmail token missing. Cannot execute node or tool."
      );
    }

    const gmailGetTool = tool(
      async ({ searchQuery, maxCount }, toolConfig) => {
        webconsole.info("GMAIL EMAIL RETRIEVER TOOL | Invoking tool");

        if (!gmail_token) {
          webconsole.error("GMAIL TOOL | Token missing. Cannot execute.");
          return [
            JSON.stringify({
              error: "Gmail token is not connected or available.",
              emails: [],
            }),
            this.getCredit(),
          ];
        }

        try {
          const result = await this.executeGmailApi(
            searchQuery,
            maxCount,
            gmail_token,
            webconsole
          );

          this.setCredit(this.getCredit() + 5);

          const toolOutput = {
            summary: `Successfully retrieved ${result["All Email"].emails.length} email(s) matching query: "${searchQuery}".`,
            emails: result["All Email"].emails.map((e) => ({
              subject: e.subject,
              snippet: e.body.substring(0, 150) + "...",
            })),
          };

          return [JSON.stringify(toolOutput), this.getCredit()];
        } catch (error) {
          this.setCredit(this.getCredit() - 5);
          webconsole.error(`GMAIL TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              error: `Failed to retrieve emails: ${error.message}`,
              emails: [],
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "gmailEmailRetriever",
        description:
          "Retrieves the most recent emails from the connected Gmail inbox. Use standard Gmail search operators for filtering (e.g., 'is:unread from:amazon before:2024/01/01').",
        schema: z.object({
          searchQuery: z
            .string()
            .describe(
              "The Gmail search query string (e.g., 'is:unread from:boss@work.com')."
            ),
          maxCount: z
            .number()
            .int()
            .min(1)
            .max(50)
            .default(5)
            .describe(
              "The maximum number of emails to retrieve, between 1 and 50."
            ),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    if (!gmail_token) {
      return {
        "All Email": null,
        Subject: null,
        Body: null,
        Tool: gmailGetTool,
        Credits: this.getCredit(),
      };
    }

    if (!SearchQuery) {
      this.setCredit(0);
      webconsole.warn(
        "GMAIL GET NODE | No Search Query provided in node inputs. Returning tool only."
      );
      return {
        "All Email": null,
        Subject: null,
        Body: null,
        Tool: gmailGetTool,
        Credits: this.getCredit(),
      };
    }

    try {
      const result = await this.executeGmailApi(
        SearchQuery,
        Count,
        gmail_token,
        webconsole
      );

      return {
        ...result,
        Credits: this.getCredit(),
        Tool: gmailGetTool,
      };
    } catch (error) {
      this.setCredit(0); // Set credit to 0 on final node execution error
      webconsole.error(
        "GMAIL GET NODE | Error during direct execution: " + error.message
      );

      return {
        "All Email": null,
        Subject: null,
        Body: null,
        Credits: this.getCredit(),
        Tool: gmailGetTool,
      };
    }
  }
}

export default gmail_get;
