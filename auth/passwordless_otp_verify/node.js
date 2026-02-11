import BaseNode from "../../core/BaseNode/node.js";
import { auth } from "./auth.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Verify OTP (Passwordless)",
  category: "auth",
  type: "passwordless_otp_verify",
  icon: {},
  desc: "Verifies the OTP and logs the user in.",
  credit: 0,
  inputs: [
    { name: "Flow", type: "Flow", desc: "The flow of the workflow" },
    { name: "Email", type: "Text", desc: "User's email" },
    { name: "OTP", type: "Text", desc: "The 6-digit code" },
  ],
  outputs: [
    { name: "Flow", type: "Flow", desc: "The Flow to trigger" },
    { name: "Token", type: "Text", desc: "The session token (Bearer)" },
    { name: "User", type: "JSON", desc: "User profile data" },
    { name: "Tool", type: "Tool", desc: "LLM Tool" },
  ],
  fields: [
    { name: "Email", type: "Text", desc: "User's email" },
    { name: "OTP", type: "Text", desc: "One Time Password" },
  ],
  difficulty: "medium",
  tags: ["auth", "verify", "login"],
};

class passwordless_otp_verify extends BaseNode {
  constructor() {
    super(config);
  }

  async run(inputs, contents, webconsole, serverData) {
    const getValue = (name) => {
      const i = inputs.find((x) => x.name === name);
      if (i?.value) return i.value;
      const c = contents.find((x) => x.name === name);
      return c?.value;
    };

    const email = getValue("Email");
    const otp = getValue("OTP");

    const verifyOtpTool = tool(
      async ({ email, otp }) => {
        try {
          const res = await auth.api.signInEmailOTP({
            body: { email, otp },
          });
          return [JSON.stringify(res), this.getCredit()];
        } catch (e) {
          return [JSON.stringify({ error: e.message }), this.getCredit()];
        }
      },
      {
        name: "verify_otp",
        description: "Verify the OTP code to log in.",
        schema: z.object({
          email: z.string().email(),
          otp: z.string(),
        }),
      },
    );

    if (!email || !otp) {
      return { Token: null, User: null, Tool: verifyOtpTool };
    }

    try {
      webconsole.info(`VERIFYING OTP | ${email}`);
      const response = await auth.api.signInEmailOTP({
        body: { email, otp },
      });

      webconsole.success("OTP Verified | User Logged In");

      const token = response?.token || response?.session?.token;

      return {
        Token: token,
        User: response.user,
        Credits: this.getCredit(),
        Tool: verifyOtpTool,
      };
    } catch (error) {
      webconsole.error(`VERIFY ERROR: ${error.message}`);
      return {
        Token: null,
        User: null,
        Tool: verifyOtpTool,
        Credits: this.getCredit(),
      };
    }
  }
}

export default passwordless_otp_verify;
