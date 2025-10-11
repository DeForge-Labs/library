import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "HubSpot - Create Contact",
  category: "management",
  type: "hubspot_create_contact_node",
  icon: {},
  desc: "Create a new contact in HubSpot CRM",
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
      desc: "Contact email address (required)",
    },
    {
      name: "FirstName",
      type: "Text",
      desc: "Contact first name",
    },
    {
      name: "LastName",
      type: "Text",
      desc: "Contact last name",
    },
    {
      name: "Phone",
      type: "Text",
      desc: "Contact phone number",
    },
    {
      name: "Company",
      type: "Text",
      desc: "Company name",
    },
    {
      name: "AdditionalProperties",
      type: "JSON",
      desc: "Additional contact properties as key-value pairs",
    },
  ],
  outputs: [
    {
      name: "success",
      type: "Boolean",
      desc: "Whether the contact was created successfully",
    },
    {
      name: "contactId",
      type: "Text",
      desc: "The HubSpot contact ID",
    },
    {
      name: "contact",
      type: "JSON",
      desc: "The created contact object",
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
      desc: "Contact email address (required)",
      value: "contact@example.com",
    },
    {
      name: "FirstName",
      type: "Text",
      value: "John",
      desc: "Contact first name",
    },
    {
      name: "LastName",
      type: "Text",
      value: "Doe",
      desc: "Contact last name",
    },
    {
      name: "Phone",
      type: "Text",
      value: "",
      desc: "Contact phone number",
    },
    {
      name: "Company",
      type: "Text",
      value: "",
      desc: "Company name",
    },
    {
      name: "AdditionalProperties",
      type: "Map",
      value: "",
      desc: "Additional contact properties as key-value pairs",
    },
    {
      desc: "HubSpot API Key or Private App Access Token",
      name: "HUBSPOT_API_KEY",
      type: "env",
      defaultValue: "your-hubspot-api-key",
    },
  ],
  difficulty: "medium",
  tags: ["hubspot", "crm", "contact", "create"],
};

class hubspot_create_contact_node extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  async executeCreateContact(
    email,
    firstName,
    lastName,
    phone,
    company,
    additionalProps,
    apiKey,
    webconsole
  ) {
    try {
      if (!email || email.trim() === "") {
        throw new Error("Email is required to create a contact");
      }

      // Build properties object
      const properties = {
        email: email,
      };

      if (firstName) properties.firstname = firstName;
      if (lastName) properties.lastname = lastName;
      if (phone) properties.phone = phone;
      if (company) properties.company = company;

      // Add additional properties
      if (additionalProps && typeof additionalProps === "object") {
        Object.assign(properties, additionalProps);
      }

      webconsole.info(`Creating HubSpot contact: ${email}`);

      const response = await axios.post(
        "https://api.hubapi.com/crm/v3/objects/contacts",
        { properties },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      webconsole.success(
        `Contact created successfully with ID: ${response.data.id}`
      );

      return {
        success: true,
        contactId: response.data.id,
        contact: response.data,
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      throw new Error(`Failed to create contact: ${errorMsg}`);
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
      webconsole.info("HubSpot Create Contact Node | Generating tool...");

      const apiKey = serverData.envList?.HUBSPOT_API_KEY;

      if (!apiKey) {
        webconsole.error(
          "HubSpot Create Contact Node | HUBSPOT_API_KEY not set"
        );
        return {
          success: false,
          contactId: null,
          contact: null,
          Tool: null,
        };
      }

      const hubspotCreateContactTool = tool(
        async (
          { email, firstName, lastName, phone, company, additionalProperties },
          toolConfig
        ) => {
          webconsole.info("HUBSPOT CREATE CONTACT TOOL | Invoking tool");

          try {
            const result = await this.executeCreateContact(
              email,
              firstName,
              lastName,
              phone,
              company,
              additionalProperties,
              apiKey,
              webconsole
            );

            this.setCredit(this.getCredit() + 5);

            return [JSON.stringify(result), this.getCredit()];
          } catch (error) {
            this.setCredit(this.getCredit() - 5);
            webconsole.error(
              `HUBSPOT CREATE CONTACT TOOL | Error: ${error.message}`
            );
            return [
              JSON.stringify({
                success: false,
                contactId: null,
                contact: null,
                error: error.message,
              }),
              this.getCredit(),
            ];
          }
        },
        {
          name: "hubspotCreateContactTool",
          description:
            "Create a new contact in HubSpot CRM with email, name, phone, company and additional custom properties",
          schema: z.object({
            email: z.string().describe("Contact email address (required)"),
            firstName: z.string().optional().describe("Contact first name"),
            lastName: z.string().optional().describe("Contact last name"),
            phone: z.string().optional().describe("Contact phone number"),
            company: z.string().optional().describe("Company name"),
            additionalProperties: z
              .record(z.any())
              .optional()
              .describe("Additional contact properties as key-value pairs"),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      const email = getValue("Email");
      const firstName = getValue("FirstName");
      const lastName = getValue("LastName");
      const phone = getValue("Phone");
      const company = getValue("Company");
      const additionalProps = getValue("AdditionalProperties");

      if (!email) {
        webconsole.info(
          "HubSpot Create Contact Node | No email provided, returning tool only"
        );
        this.setCredit(0);
        return {
          success: false,
          contactId: null,
          contact: null,
          Tool: hubspotCreateContactTool,
        };
      }

      const result = await this.executeCreateContact(
        email,
        firstName,
        lastName,
        phone,
        company,
        additionalProps,
        apiKey,
        webconsole
      );

      return {
        ...result,
        Tool: hubspotCreateContactTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("HubSpot Create Contact Node | Error: " + error.message);
      return {
        success: false,
        contactId: null,
        contact: null,
        Tool: null,
      };
    }
  }
}

export default hubspot_create_contact_node;
