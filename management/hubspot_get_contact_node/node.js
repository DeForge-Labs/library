import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "HubSpot - Get Contact",
  category: "management",
  type: "hubspot_get_contact_node",
  icon: {},
  desc: "Retrieve a contact from HubSpot CRM by email or ID",
  credit: 3,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      name: "Email",
      type: "Text",
      desc: "Contact email address",
    },
    {
      name: "ContactId",
      type: "Text",
      desc: "HubSpot contact ID (alternative to email)",
    },
  ],
  outputs: [
    {
      name: "success",
      type: "Boolean",
      desc: "Whether the contact was found",
    },
    {
      name: "contact",
      type: "JSON",
      desc: "The contact object with all properties",
    },
    {
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      name: "Email",
      type: "Text",
      desc: "Contact email address",
      value: "contact@example.com",
    },
    {
      name: "ContactId",
      type: "Text",
      value: "",
      desc: "HubSpot contact ID (alternative to email)",
    },
    {
      desc: "HubSpot Legacy App API Key",
      name: "HUBSPOT_LEGACY_API_KEY",
      type: "env",
      defaultValue: "your-hubspot-api-key",
    },
  ],
  difficulty: "easy",
  tags: ["hubspot", "crm", "contact", "get", "management"],
};

class hubspot_get_contact_node extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  async executeGetContact(email, contactId, apiKey, webconsole) {
    try {
      let response;

      if (contactId) {
        webconsole.info(`Retrieving HubSpot contact by ID: ${contactId}`);
        response = await axios.get(
          `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );
      } else if (email) {
        webconsole.info(`Retrieving HubSpot contact by email: ${email}`);
        response = await axios.get(
          `https://api.hubapi.com/crm/v3/objects/contacts/${email}?idProperty=email`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );
      } else {
        throw new Error("Either email or contactId is required");
      }

      webconsole.success(`Contact retrieved successfully`);

      return {
        success: true,
        contact: response.data,
      };
    } catch (error) {
      if (error.response?.status === 404) {
        webconsole.info("Contact not found");
        return {
          success: false,
          contact: null,
        };
      }
      const errorMsg = error.response?.data?.message || error.message;
      throw new Error(`Failed to get contact: ${errorMsg}`);
    }
  }

  async run(inputs, contents, webconsole, serverData) {
    const getValue = (name, defaultValue = null) => {
      const input = inputs.find((i) => i.name === name);
      if (input?.value !== undefined) return input.value;
      const content = contents.find((c) => c.name === name);
      if (content?.value !== undefined) return content.value;
      return defaultValue;
    };

    try {
      webconsole.info("HubSpot Get Contact Node | Generating tool...");

      const apiKey = serverData.envList?.HUBSPOT_LEGACY_API_KEY;

      if (!apiKey) {
        webconsole.error(
          "HubSpot Get Contact Node | HUBSPOT_LEGACY_API_KEY not set"
        );
        return {
          success: false,
          contact: null,
          Tool: null,
        };
      }

      const hubspotGetContactTool = tool(
        async ({ email, contactId }, toolConfig) => {
          webconsole.info("HUBSPOT GET CONTACT TOOL | Invoking tool");

          try {
            const result = await this.executeGetContact(
              email,
              contactId,
              apiKey,
              webconsole
            );

            this.setCredit(this.getCredit() + 3);

            return [JSON.stringify(result), this.getCredit()];
          } catch (error) {
            this.setCredit(this.getCredit() - 3);
            webconsole.error(
              `HUBSPOT GET CONTACT TOOL | Error: ${error.message}`
            );
            return [
              JSON.stringify({
                success: false,
                contact: null,
                error: error.message,
              }),
              this.getCredit(),
            ];
          }
        },
        {
          name: "hubspotGetContactTool",
          description:
            "Retrieve a contact from HubSpot CRM by email address or contact ID. Returns all contact properties.",
          schema: z.object({
            email: z.string().optional().describe("Contact email address"),
            contactId: z
              .string()
              .optional()
              .describe("HubSpot contact ID (alternative to email)"),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      const email = getValue("Email");
      const contactId = getValue("ContactId");

      if (!email && !contactId) {
        webconsole.info(
          "HubSpot Get Contact Node | No identifier provided, returning tool only"
        );
        this.setCredit(0);
        return {
          success: false,
          contact: null,
          Tool: hubspotGetContactTool,
        };
      }

      const result = await this.executeGetContact(
        email,
        contactId,
        apiKey,
        webconsole
      );

      return {
        ...result,
        Tool: hubspotGetContactTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("HubSpot Get Contact Node | Error: " + error.message);
      return {
        success: false,
        contact: null,
        Tool: null,
      };
    }
  }
}

export default hubspot_get_contact_node;
