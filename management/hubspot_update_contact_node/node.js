import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "HubSpot - Update Contact",
  category: "management",
  type: "hubspot_update_contact_node",
  icon: {},
  desc: "Update an existing contact in HubSpot CRM",
  credit: 5,
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
    {
      name: "Properties",
      type: "JSON",
      desc: "Properties to update as key-value pairs",
    },
  ],
  outputs: [
    {
      name: "success",
      type: "Boolean",
      desc: "Whether the contact was updated successfully",
    },
    {
      name: "contact",
      type: "JSON",
      desc: "The updated contact object",
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
      name: "Properties",
      type: "Map",
      value: "",
      desc: "Properties to update as key-value pairs",
    },
    {
      desc: "HubSpot Legacy App API Key",
      name: "HUBSPOT_LEGACY_API_KEY",
      type: "env",
      defaultValue: "your-hubspot-api-key",
    },
  ],
  difficulty: "medium",
  tags: ["hubspot", "crm", "contact", "update", "management"],
};

class hubspot_update_contact_node extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  async executeUpdateContact(email, contactId, properties, apiKey, webconsole) {
    try {
      if (!properties || Object.keys(properties).length === 0) {
        throw new Error("Properties to update are required");
      }

      let url;
      if (contactId) {
        webconsole.info(`Updating HubSpot contact by ID: ${contactId}`);
        url = `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`;
      } else if (email) {
        webconsole.info(`Updating HubSpot contact by email: ${email}`);
        url = `https://api.hubapi.com/crm/v3/objects/contacts/${email}?idProperty=email`;
      } else {
        throw new Error("Either email or contactId is required");
      }

      const response = await axios.patch(
        url,
        { properties },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      webconsole.success(`Contact updated successfully`);

      return {
        success: true,
        contact: response.data,
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      throw new Error(`Failed to update contact: ${errorMsg}`);
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
      webconsole.info("HubSpot Update Contact Node | Generating tool...");

      const apiKey = serverData.envList?.HUBSPOT_LEGACY_API_KEY;

      if (!apiKey) {
        webconsole.error(
          "HubSpot Update Contact Node | HUBSPOT_LEGACY_API_KEY not set"
        );
        return {
          success: false,
          contact: null,
          Tool: null,
        };
      }

      const hubspotUpdateContactTool = tool(
        async ({ email, contactId, properties }, toolConfig) => {
          webconsole.info("HUBSPOT UPDATE CONTACT TOOL | Invoking tool");

          try {
            const result = await this.executeUpdateContact(
              email,
              contactId,
              properties,
              apiKey,
              webconsole
            );

            this.setCredit(this.getCredit() + 5);

            return [JSON.stringify(result), this.getCredit()];
          } catch (error) {
            this.setCredit(this.getCredit() - 5);
            webconsole.error(
              `HUBSPOT UPDATE CONTACT TOOL | Error: ${error.message}`
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
          name: "hubspotUpdateContactTool",
          description:
            "Update an existing contact in HubSpot CRM by email or contact ID. Provide properties to update as key-value pairs (e.g., {firstname: 'John', phone: '1234567890'})",
          schema: z.object({
            email: z.string().optional().describe("Contact email address"),
            contactId: z
              .string()
              .optional()
              .describe("HubSpot contact ID (alternative to email)"),
            properties: z
              .record(z.any())
              .describe("Properties to update as key-value pairs"),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      const email = getValue("Email");
      const contactId = getValue("ContactId");
      const properties = getValue("Properties");

      if ((!email && !contactId) || !properties) {
        webconsole.info(
          "HubSpot Update Contact Node | Missing required fields, returning tool only"
        );
        this.setCredit(0);
        return {
          success: false,
          contact: null,
          Tool: hubspotUpdateContactTool,
        };
      }

      const result = await this.executeUpdateContact(
        email,
        contactId,
        properties,
        apiKey,
        webconsole
      );

      return {
        ...result,
        Tool: hubspotUpdateContactTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("HubSpot Update Contact Node | Error: " + error.message);
      return {
        success: false,
        contact: null,
        Tool: null,
      };
    }
  }
}

export default hubspot_update_contact_node;
