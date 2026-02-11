import BaseNode from "../../core/BaseNode/node.js";
import { sendMail } from "./auth.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Generate OTP (Passwordless)",
  category: "auth",
  type: "passwordless_otp_generate",
  icon: {},
  desc: "Initiates passwordless sign-in by sending an OTP to the provided email.",
  credit: 5,
  inputs: [
    { name: "Flow", type: "Flow", desc: "The flow of the workflow" },
    { name: "Email", type: "Text", desc: "User's email address" },
    {
      name: "CompanyName",
      type: "Text",
      desc: "Company name for the email template (Default: Acme Inc)",
    },
  ],
  outputs: [
    { name: "Flow", type: "Flow", desc: "The Flow to trigger" },
    { name: "Success", type: "Boolean", desc: "True if OTP was sent" },
    { name: "Tool", type: "Tool", desc: "LLM Tool" },
  ],
  fields: [
    { name: "Email", type: "Text", desc: "User's email address" },
    {
      name: "CompanyName",
      type: "Text",
      desc: "Company Name",
      value: "Acme Inc",
    },
  ],
  difficulty: "easy",
  tags: ["auth", "otp", "login"],
};

class passwordless_otp_generate extends BaseNode {
  constructor() {
    super(config);
  }

  async run(inputs, contents, webconsole, serverData) {
    const getValue = (name, def) => {
      const i = inputs.find((x) => x.name === name);
      if (i?.value) return i.value;
      const c = contents.find((x) => x.name === name);
      return c?.value || def;
    };

    const email = getValue("Email");
    const companyName = getValue("CompanyName", "Acme Inc");

    const generateOtpTool = tool(
      async ({ email, companyName }) => {
        try {
          await sendMail(email, companyName || "Acme Inc");

          return [
            JSON.stringify({ success: true, message: "OTP Sent" }),
            this.getCredit(),
          ];
        } catch (e) {
          return [
            JSON.stringify({ success: false, error: e.message }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "generate_otp",
        description: "Send a passwordless sign-in OTP to an email.",
        schema: z.object({
          email: z.string().email(),
          companyName: z.string().optional().default("Acme Inc"),
        }),
      },
    );

    if (!email) {
      webconsole.warning("OTP NODE | No email provided");
      return { Success: false, Tool: generateOtpTool };
    }

    try {
      webconsole.info(
        `GENERATING OTP | For: ${email} | Company: ${companyName}`,
      );

      await sendMail(email, companyName);

      webconsole.success("OTP Sent Successfully");
      return {
        Success: true,
        Tool: generateOtpTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error(`OTP ERROR: ${error.message}`);
      return {
        Success: false,
        Tool: generateOtpTool,
        Credits: this.getCredit(),
      };
    }
  }
}

export default passwordless_otp_generate;
