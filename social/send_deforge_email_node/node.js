import BaseNode from "../../core/BaseNode/node.js";
import nodemailer from "nodemailer";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Send Deforge Email",
  category: "social",
  type: "send_deforge_email_node",
  icon: {},
  desc: "Send an email using the system's default Deforge mailer.",
  credit: 15,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      name: "To",
      type: "Text",
      desc: "Recipient email address (comma-separated for multiple)",
    },
    {
      name: "Subject",
      type: "Text",
      desc: "Email subject line",
    },
    {
      name: "Body",
      type: "Text",
      desc: "Email body content",
    },
    {
      name: "CC",
      type: "Text",
      desc: "CC email addresses (comma-separated, optional)",
    },
    {
      name: "BCC",
      type: "Text",
      desc: "BCC email addresses (comma-separated, optional)",
    },
    {
      name: "HTML",
      type: "Boolean",
      desc: "Whether the body is HTML (default: false for plain text)",
    },
  ],
  outputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
    {
      name: "success",
      type: "Boolean",
      desc: "Whether the email was sent successfully",
    },
    {
      name: "messageId",
      type: "Text",
      desc: "The message ID from the email server",
    },
    {
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      name: "To",
      type: "Text",
      desc: "Recipient email address (comma-separated for multiple)",
      value: "",
    },
    {
      name: "Subject",
      type: "Text",
      value: "",
      desc: "Email subject line",
    },
    {
      name: "Body",
      type: "TextArea",
      value: "",
      desc: "Email body content",
    },
    {
      name: "CC",
      type: "Text",
      value: "",
      desc: "CC email addresses (comma-separated, optional)",
    },
    {
      name: "BCC",
      type: "Text",
      value: "",
      desc: "BCC email addresses (comma-separated, optional)",
    },
    {
      name: "HTML",
      type: "CheckBox",
      value: false,
      desc: "Whether the body is HTML (default: false for plain text)",
    },
  ],
  difficulty: "easy", // Easier difficulty since no config is needed
  tags: ["email", "communication", "notification", "system"],
};

class send_deforge_email_node extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  parseEmailAddresses(emailString) {
    if (!emailString || typeof emailString !== "string") {
      return [];
    }
    return emailString
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email.length > 0);
  }

  async executeSendEmail(to, subject, body, cc, bcc, isHTML, webconsole) {
    // 1. Load System Credentials from process.env
    const smtpConfig = {
      host: process.env.DEFORGE_SMTP_HOST,
      port: process.env.DEFORGE_SMTP_PORT,
      user: process.env.DEFORGE_SMTP_USER,
      pass: process.env.DEFORGE_SMTP_PASSWORD,
      secure: process.env.DEFORGE_SMTP_SECURE === "true",
    };

    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      throw new Error("System SMTP configuration is missing on the server.");
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: parseInt(smtpConfig.port || "587"),
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass,
        },
      });

      const toAddresses = this.parseEmailAddresses(to);
      const ccAddresses = this.parseEmailAddresses(cc);
      const bccAddresses = this.parseEmailAddresses(bcc);

      if (toAddresses.length === 0) {
        throw new Error("No valid recipient addresses found.");
      }

      const mailOptions = {
        from: `"Deforge System" <${smtpConfig.user}>`, // Nice sender name
        to: toAddresses.join(", "),
        subject: subject,
      };

      if (ccAddresses.length > 0) mailOptions.cc = ccAddresses.join(", ");
      if (bccAddresses.length > 0) mailOptions.bcc = bccAddresses.join(", ");

      if (isHTML) {
        mailOptions.html = body;
      } else {
        mailOptions.text = body;
      }

      webconsole.info(`Sending system email to: ${toAddresses[0]}...`);
      const info = await transporter.sendMail(mailOptions);
      webconsole.success("Email sent successfully.");

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      throw error;
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    const getValue = (name, defaultValue = null) => {
      const input = inputs.find((i) => i.name === name);
      if (input?.value !== undefined && input.value !== "") return input.value;
      const content = contents.find((c) => c.name === name);
      if (content?.value !== undefined) return content.value;
      return defaultValue;
    };

    // Define the tool for LLM usage
    const sendEmailTool = tool(
      async ({ to, subject, body, cc, bcc, html }) => {
        try {
          const result = await this.executeSendEmail(
            to,
            subject,
            body,
            cc,
            bcc,
            html,
            webconsole,
          );
          this.setCredit(this.getCredit() + 5);
          return [
            JSON.stringify({ success: true, id: result.messageId }),
            this.getCredit(),
          ];
        } catch (error) {
          return [`Error sending email: ${error.message}`, this.getCredit()];
        }
      },
      {
        name: "send_deforge_email",
        description: "Send an email using the Deforge system mailer.",
        schema: z.object({
          to: z.string().describe("Recipient email(s)"),
          subject: z.string().describe("Subject line"),
          body: z.string().describe("Email body"),
          cc: z.string().optional(),
          bcc: z.string().optional(),
          html: z.boolean().optional(),
        }),
      },
    );

    const to = getValue("To");
    const subject = getValue("Subject");
    const body = getValue("Body");
    const cc = getValue("CC", "");
    const bcc = getValue("BCC", "");
    const isHTML = getValue("HTML", false);

    // If required fields missing, return tool only
    if (!to || !subject || !body) {
      return {
        success: false,
        messageId: null,
        Tool: sendEmailTool,
        Credits: 0,
      };
    }

    try {
      const result = await this.executeSendEmail(
        to,
        subject,
        body,
        cc,
        bcc,
        isHTML,
        webconsole,
      );
      this.setCredit(5);

      return {
        success: true,
        messageId: result.messageId,
        Tool: sendEmailTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error(`EMAIL ERROR | ${error.message}`);
      this.setCredit(0);
      return {
        success: false,
        messageId: null,
        Tool: sendEmailTool,
        Credits: 0,
      };
    }
  }
}

export default send_deforge_email_node;
