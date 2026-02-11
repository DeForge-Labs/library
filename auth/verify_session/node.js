import BaseNode from "../../core/BaseNode/node.js";
import { auth } from "./auth.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "Verify Session",
  category: "auth",
  type: "verify_session",
  icon: {},
  desc: "Validates a Bearer token and returns session details.",
  credit: 0,
  inputs: [
    { name: "Flow", type: "Flow", desc: "The flow of the workflow" },
    { name: "Token", type: "Text", desc: "Bearer Token" },
  ],
  outputs: [
    { name: "Flow", type: "Flow", desc: "The Flow to trigger" },
    { name: "IsValid", type: "Boolean", desc: "Is session valid?" },
    { name: "Session", type: "JSON", desc: "Session object" },
    { name: "User", type: "JSON", desc: "User object" },
    { name: "Tool", type: "Tool", desc: "LLM Tool" },
  ],
  fields: [{ name: "Token", type: "Text", desc: "Bearer Token" }],
  difficulty: "easy",
  tags: ["auth", "session", "validate"],
};

class verify_session extends BaseNode {
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

    const token = getValue("Token");

    const verifySessionTool = tool(
      async ({ token }) => {
        try {
          const session = await auth.api.getSession({
            headers: { authorization: `Bearer ${token}` },
          });
          if (!session)
            return [JSON.stringify({ valid: false }), this.getCredit()];
          return [
            JSON.stringify({ valid: true, ...session }),
            this.getCredit(),
          ];
        } catch (e) {
          return [
            JSON.stringify({ valid: false, error: e.message }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "verify_session",
        description: "Check if an auth token is valid.",
        schema: z.object({
          token: z.string(),
        }),
      },
    );

    if (!token) {
      webconsole.warning("VERIFY SESSION | No token provided");
      return {
        IsValid: false,
        Session: null,
        User: null,
        Tool: verifySessionTool,
      };
    }

    try {
      webconsole.info("VERIFY SESSION | Validating token...");

      const sessionData = await auth.api.getSession({
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      if (!sessionData) {
        webconsole.warning("VERIFY SESSION | Invalid or expired token");
        return {
          IsValid: false,
          Session: null,
          User: null,
          Tool: verifySessionTool,
          Credits: this.getCredit(),
        };
      }

      webconsole.success("VERIFY SESSION | Valid");
      return {
        IsValid: true,
        Session: sessionData.session,
        User: sessionData.user,
        Tool: verifySessionTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error(`SESSION ERROR: ${error.message}`);
      return {
        IsValid: false,
        Session: null,
        User: null,
        Tool: verifySessionTool,
        Credits: this.getCredit(),
      };
    }
  }
}

export default verify_session;
