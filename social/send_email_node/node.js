import BaseNode from "../../core/BaseNode/node.js";
import nodemailer from "nodemailer";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Send Email",
  category: "social",
  type: "send_email_node",
  icon: {},
  desc: "Send an email using SMTP",
  credit: 5,
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
      name: "response",
      type: "Text",
      desc: "Response message from the email server",
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
      value: "recipient@example.com",
    },
    {
      name: "Subject",
      type: "Text",
      value: "Hello from AI Agent Builder",
      desc: "Email subject line",
    },
    {
      name: "Body",
      type: "TextArea",
      value: "This is a test email sent from the AI Agent Builder.",
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
      type: "Checkbox",
      value: false,
      desc: "Whether the body is HTML (default: false for plain text)",
    },
    {
      desc: "SMTP host (e.g., smtp.gmail.com)",
      name: "SMTP_HOST",
      type: "env",
      defaultValue: "smtp.gmail.com",
    },
    {
      desc: "SMTP port (e.g., 587 for TLS, 465 for SSL)",
      name: "SMTP_PORT",
      type: "env",
      defaultValue: "587",
    },
    {
      desc: "SMTP username/email",
      name: "SMTP_USER",
      type: "env",
      defaultValue: "your-email@gmail.com",
    },
    {
      desc: "SMTP password or app password",
      name: "SMTP_PASSWORD",
      type: "env",
      defaultValue: "your-app-password",
    },
    {
      desc: "Use TLS (true/false)",
      name: "SMTP_SECURE",
      type: "env",
      defaultValue: "false",
    },
  ],
  difficulty: "medium",
  tags: ["email", "smtp", "communication", "send", "notification"],
};

class send_email_node extends BaseNode {
  constructor() {
    super(config);
  }

  /**
   * @override
   * @inheritDoc
   */
  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  /**
   * Parse comma-separated email addresses
   * @private
   */
  parseEmailAddresses(emailString) {
    if (!emailString || emailString.trim() === "") {
      return [];
    }
    return emailString
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email.length > 0);
  }

  /**
   * Execute email sending
   * @private
   */
  async executeSendEmail(
    to,
    subject,
    body,
    cc,
    bcc,
    isHTML,
    smtpConfig,
    webconsole
  ) {
    try {
      // Validate required fields
      if (!to || to.trim() === "") {
        throw new Error("Recipient email address (To) is required");
      }
      if (!subject || subject.trim() === "") {
        throw new Error("Email subject is required");
      }
      if (!body || body.trim() === "") {
        throw new Error("Email body is required");
      }

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: parseInt(smtpConfig.port),
        secure: smtpConfig.secure === "true" || smtpConfig.secure === true,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.password,
        },
      });

      // Verify transporter configuration
      webconsole.info("Verifying SMTP connection...");
      await transporter.verify();
      webconsole.success("SMTP connection verified successfully");

      // Parse email addresses
      const toAddresses = this.parseEmailAddresses(to);
      const ccAddresses = this.parseEmailAddresses(cc);
      const bccAddresses = this.parseEmailAddresses(bcc);

      // Prepare mail options
      const mailOptions = {
        from: smtpConfig.user,
        to: toAddresses.join(", "),
        subject: subject,
      };

      // Add CC if provided
      if (ccAddresses.length > 0) {
        mailOptions.cc = ccAddresses.join(", ");
      }

      // Add BCC if provided
      if (bccAddresses.length > 0) {
        mailOptions.bcc = bccAddresses.join(", ");
      }

      // Set body as HTML or plain text
      if (isHTML) {
        mailOptions.html = body;
      } else {
        mailOptions.text = body;
      }

      webconsole.info(`Sending email to ${toAddresses.join(", ")}...`);

      // Send email
      const info = await transporter.sendMail(mailOptions);

      webconsole.success(
        `Email sent successfully! Message ID: ${info.messageId}`
      );

      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * @override
   * @inheritDoc
   */
  async run(inputs, contents, webconsole, serverData) {
    const getValue = (name, defaultValue = null) => {
      const input = inputs.find((i) => i.name === name);
      if (input?.value !== undefined) return input.value;
      const content = contents.find((c) => c.name === name);
      if (content?.value !== undefined) return content.value;
      return defaultValue;
    };

    try {
      webconsole.info("Send Email Node | Generating tool...");

      // Get SMTP configuration from environment
      const smtpConfig = {
        host: serverData.envList?.SMTP_HOST,
        port: serverData.envList?.SMTP_PORT || "587",
        user: serverData.envList?.SMTP_USER,
        password: serverData.envList?.SMTP_PASSWORD,
        secure: serverData.envList?.SMTP_SECURE || "false",
      };

      // Validate SMTP configuration
      if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.password) {
        webconsole.error(
          "Send Email Node | SMTP configuration incomplete. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD environment variables."
        );
        return {
          success: false,
          messageId: null,
          response: "SMTP configuration incomplete",
          Tool: null,
        };
      }

      // Create the tool
      const sendEmailTool = tool(
        async ({ to, subject, body, cc, bcc, html }, toolConfig) => {
          webconsole.info("SEND EMAIL TOOL | Invoking tool");

          try {
            const result = await this.executeSendEmail(
              to,
              subject,
              body,
              cc || "",
              bcc || "",
              html || false,
              smtpConfig,
              webconsole
            );

            this.setCredit(this.getCredit() + 5);

            return [
              JSON.stringify({
                success: result.success,
                messageId: result.messageId,
                response: result.response,
              }),
              this.getCredit(),
            ];
          } catch (error) {
            this.setCredit(this.getCredit() - 5);
            webconsole.error(`SEND EMAIL TOOL | Error: ${error.message}`);
            return [
              JSON.stringify({
                success: false,
                messageId: null,
                response: error.message,
              }),
              this.getCredit(),
            ];
          }
        },
        {
          name: "sendEmailTool",
          description:
            "Send an email via SMTP. Supports plain text and HTML emails, with optional CC and BCC recipients. Use comma-separated email addresses for multiple recipients.",
          schema: z.object({
            to: z
              .string()
              .describe(
                "Recipient email address (comma-separated for multiple)"
              ),
            subject: z.string().describe("Email subject line"),
            body: z.string().describe("Email body content"),
            cc: z
              .string()
              .optional()
              .describe("CC email addresses (comma-separated, optional)"),
            bcc: z
              .string()
              .optional()
              .describe("BCC email addresses (comma-separated, optional)"),
            html: z
              .boolean()
              .optional()
              .describe(
                "Whether the body is HTML (default: false for plain text)"
              ),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      webconsole.info("Send Email Node | Begin execution");

      const to = getValue("To");
      const subject = getValue("Subject");
      const body = getValue("Body");
      const cc = getValue("CC", "");
      const bcc = getValue("BCC", "");
      const isHTML = getValue("HTML", false);

      // If required fields are missing, return only the tool
      if (!to || !subject || !body) {
        webconsole.info(
          "Send Email Node | Missing required fields (to/subject/body), returning tool only"
        );
        this.setCredit(0);
        return {
          success: false,
          messageId: null,
          response: "Missing required fields",
          Tool: sendEmailTool,
        };
      }

      // Execute email sending directly
      const result = await this.executeSendEmail(
        to,
        subject,
        body,
        cc,
        bcc,
        isHTML,
        smtpConfig,
        webconsole
      );

      return {
        success: result.success,
        messageId: result.messageId,
        response: result.response,
        Tool: sendEmailTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("Send Email Node | Error: " + error.message);
      return {
        success: false,
        messageId: null,
        response: error.message,
        Tool: null,
      };
    }
  }
}

export default send_email_node;
