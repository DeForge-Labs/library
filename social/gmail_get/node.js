import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const config = {
    title: "Get Gmail Email",
    category: "social",
    type: "gmail_get",
    icon: {},
    desc: "Retrieve email from your connected gmail account",
    credit: 0,
    inputs: [
        {
            desc: "The Flow to trigger",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "Search query for email (same as gmail search bar)",
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
            desc: "All email data",
            name: "All Email",
            type: "JSON"
        },
        {
            desc: "The email subject (if only one email selected)",
            name: "Subject",
            type: "Text"
        },
        {
            desc: "The email body (if only one email selected)",
            name: "Body",
            type: "Text"
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
    tags: ["get", "gmail", "email"],
}

class gmail_get extends BaseNode {
    constructor() {
        super(config);
    }

    findTextPart(parts) {
        let plainPart = parts.find(p => p.mimeType === "text/plain");
        if (plainPart) return plainPart;

        let htmlPart = parts.find(p => p.mimeType === "text/html");
        if (htmlPart) return htmlPart;

        // If multipart
        for (const part of parts) {
            if (part.parts) {
                const found = findTextPart(part.parts);
                if (found) return found;
            }
        }

        return null;
    }

    getEmailBody(payload) {
        let body = "";
        if (payload.body.size > 0) {
            body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload.parts) {
            const part = this.findTextPart(payload.parts);
            if (part && part.body.data) {
                body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
        }
        return body;
    }

    async processEmail(gmailClient, messageId) {

        const msgResponse = await gmailClient.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full'
        });

        const email = msgResponse.data;
        const subject = email.payload.headers.find(header => header.name === 'Subject')?.value || "No Subject";
        const bodyText = this.getEmailBody(email.payload) || "No Body";

        return {
            subject,
            body: bodyText
        };
    }

    async run(inputs, contents, webconsole, serverData) {
        try {
            webconsole.info("GMAIL GET NODE | Started execution");

            const QueryFilter = inputs.find((e) => e.name === "Search Query");
            const SearchQuery = QueryFilter?.value || contents.find((e) => e.name === "Search Query")?.value || "";

            const CountFilter = inputs.find((e) => e.name === "Count");
            const Count = CountFilter?.value || contents.find((e) => e.name === "Count")?.value || 5;

            const tokens = serverData.socialList;
            if (!Object.keys(tokens).includes("gmail_read")) {
                webconsole.error("GMAIL GET NODE | Please connect your gmail account");
                return null;
            }

            const gmail_token = tokens["gmail_read"];
            if (!gmail_token) {
                webconsole.error("GMAIL GET NODE | Some error occured, please reconnect your gmail account");
                return null;
            }

            const oauth2Client = new google.auth.OAuth2(
                process.env.GCP_CLIENT_ID,
                process.env.GCP_CLIENT_SECRET,
                process.env.GCP_REDIRECT_URL
            );

            oauth2Client.setCredentials(gmail_token);

            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            const emailList = await gmail.users.messages.list({
                userId: 'me',
                labelIds: ['INBOX'],
                maxResults: Count,
                ...(SearchQuery && { q: SearchQuery })
            });

            webconsole.info("GMAIL GET NODE | New emails found, processing...");
            let allEmailData = {emails: []};
            for (const message of emailList.data.messages) {
                const messageId = message.id;

                const emailData = await this.processEmail(gmail, messageId);
                webconsole.info(`GMAIL GET NODE | Processed email: ${emailData.subject}`);

                allEmailData.emails.push(emailData);
            }

            webconsole.success("GMAIL GET NODE | All emails processed successfully");

            return {
                "All Email": allEmailData,
                "Subject": allEmailData.emails.length === 1 ? allEmailData.emails[0].subject : "Multiple or no emails",
                "Body": allEmailData.emails.length === 1 ? allEmailData.emails[0].body : "Multiple or no emails",
            };

        } catch (error) {
            webconsole.error("GMAIL GET NODE | Some error occured: ", error);
            return null;
        }
    }
}

export default gmail_get;