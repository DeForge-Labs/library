import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import { google } from "googleapis";
import { type } from "os";

dotenv.config();

const config = {
    title: "Gmail Trigger",
    category: "trigger",
    type: "gmail_trigger",
    icon: {},
    desc: "Triggers the flow when a mail is recieved on Gmail",
    credit: 0,
    inputs: [],
    outputs: [
        {
            desc: "The Flow to trigger",
            name: "Flow",
            type: "Flow",
        },
        {
            desc: "All email data (if multiple)",
            name: "All Email",
            type: "JSON"
        },
        {
            desc: "The email subject (if only one email found)",
            name: "Subject",
            type: "Text"
        },
        {
            desc: "The email body (if only one email found)",
            name: "Body",
            type: "Text"
        },
    ],
    fields: [
        {
            desc: "Connect to your Gmail account",
            name: "Gmail_Trigger",
            type: "social",
            defaultValue: "",
        },
    ],
    difficulty: "easy",
    tags: ["trigger", "gmail", "email"],
}

class gmail_trigger extends BaseNode {
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
            webconsole.info("GMAIL TRIGGER NODE | Started execution");

            const tokens = serverData.socialList;
            if (!Object.keys(tokens).includes("gmail_trigger")) {
                webconsole.error("GMAIL TRIGGER NODE | Please connect your gmail account");
                return null;
            }

            const gmail_token = tokens["gmail_trigger"];
            if (!gmail_token) {
                webconsole.error("GMAIL TRIGGER NODE | Some error occured, please reconnect your gmail account");
                return null;
            }

            const oauth2Client = new google.auth.OAuth2(
                process.env.GCP_CLIENT_ID,
                process.env.GCP_CLIENT_SECRET,
                process.env.GCP_REDIRECT_URL
            );

            oauth2Client.setCredentials(gmail_token);

            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            const oldHistory = serverData.oldHistoryId;
            const newHistory = serverData.newHistoryId;

            const historyResponse = await gmail.users.history.list({
                userId: 'me',
                startHistoryId: oldHistory,
            });

            if (!historyResponse.data.history) {
                webconsole.error("GMAIL TRIGGER NODE | No new emails found");
                return null;
            }

            webconsole.info("GMAIL TRIGGER NODE | New emails found, processing...");
            let allEmailData = {emails: []};
            for (const historyItem of historyResponse.data.history) {
                for (const messageItem of historyItem.messagesAdded) {
                    const messageId = messageItem.message.id;

                    const emailData = await this.processEmail(gmail, messageId);
                    webconsole.info(`GMAIL TRIGGER NODE | Processed email: ${emailData.subject}`);

                    allEmailData.emails.push(emailData);
                }
            }

            return {
                "Flow": true,
                "All Email": allEmailData,
                "Subject": allEmailData.emails.length === 1 ? allEmailData.emails[0].subject : "Multiple or no emails found",
                "Body": allEmailData.emails.length === 1 ? allEmailData.emails[0].body : "Multiple or no emails found",
            };

        } catch (error) {
            webconsole.error("GMAIL TRIGGER NODE | Some error occured: ", error);
            return null;
        }
    }
}

export default gmail_trigger;