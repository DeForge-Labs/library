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
      desc: "Connect to your HubSpot account",
      name: "HubSpot",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "medium",
  tags: ["hubspot", "crm", "contact", "create", "management"],
};

class hubspot_create_contact_node extends BaseNode {
  constructor() {
    super(config);
  }

  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  /**
   * Check if HubSpot access token is expired
   */
  isAccessTokenExpired(hubspotTokens) {
    if (!hubspotTokens || !hubspotTokens.expires_at) {
      return true;
    }

    const now = Date.now();
    const expiresAt = hubspotTokens.expires_at;

    // Consider expired if less than 5 minutes remaining
    return expiresAt - now < 300000;
  }

  /**
   * Refresh HubSpot access token
   */
  async refreshHubSpotToken(refreshToken, webconsole) {
    try {
      webconsole.info("HubSpot Create Contact | Refreshing access token...");

      const response = await axios.post(
        "https://api.hubapi.com/oauth/v1/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          client_id: process.env.HUBSPOT_CLIENT_ID,
          client_secret: process.env.HUBSPOT_CLIENT_SECRET,
          refresh_token: refreshToken,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const tokens = response.data;
      webconsole.success(
        "HubSpot Create Contact | Token refreshed successfully"
      );

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
        expires_at: Date.now() + tokens.expires_in * 1000,
      };
    } catch (error) {
      webconsole.error(
        `HubSpot Create Contact | Token refresh failed: ${
          error.response?.data?.message || error.message
        }`
      );
      throw new Error("Failed to refresh HubSpot access token");
    }
  }

  /**
   * Get valid HubSpot access token with auto-refresh and persistence
   */
  async getValidAccessToken(hubspotTokens, refreshTokenHandler, webconsole) {
    if (!hubspotTokens) {
      throw new Error("HubSpot account not connected");
    }

    // Check if token is expired or about to expire
    if (this.isAccessTokenExpired(hubspotTokens)) {
      webconsole.info(
        "HubSpot Create Contact | Access token expired or expiring soon, refreshing..."
      );

      const newTokens = await this.refreshHubSpotToken(
        hubspotTokens.refresh_token
      );

      // Save refreshed tokens to database using refreshTokenHandler
      await refreshTokenHandler.handleHubSpotToken(newTokens);

      return newTokens.access_token;
    }

    return hubspotTokens.access_token;
  }

  async executeCreateContact(
    email,
    firstName,
    lastName,
    phone,
    company,
    additionalProps,
    accessToken,
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
            Authorization: `Bearer ${accessToken}`,
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
      webconsole.info("HubSpot Create Contact Node | Starting execution...");

      // Get HubSpot OAuth tokens from socialList
      const tokens = serverData.socialList;

      if (!tokens || !Object.keys(tokens).includes("hubspot")) {
        webconsole.error(
          "HubSpot Create Contact Node | Please connect your HubSpot account"
        );
        return {
          success: false,
          contactId: null,
          contact: null,
          Tool: null,
        };
      }

      const hubspotTokens = tokens["hubspot"];

      if (!hubspotTokens || !hubspotTokens.access_token) {
        webconsole.error(
          "HubSpot Create Contact Node | Invalid HubSpot tokens, please reconnect your account"
        );
        return {
          success: false,
          contactId: null,
          contact: null,
          Tool: null,
        };
      }

      // Get refresh token handler from serverData
      const refreshTokenHandler = serverData.refreshUtil;

      if (!refreshTokenHandler) {
        webconsole.error(
          "HubSpot Create Contact Node | Refresh token handler not available"
        );
        return {
          success: false,
          contactId: null,
          contact: null,
          Tool: null,
        };
      }

      // Get valid access token (with auto-refresh if needed)
      const accessToken = await this.getValidAccessToken(
        hubspotTokens,
        refreshTokenHandler,
        webconsole
      );

      // Create the tool
      const hubspotCreateContactTool = tool(
        async (
          { email, firstName, lastName, phone, company, additionalProperties },
          toolConfig
        ) => {
          webconsole.info("HUBSPOT CREATE CONTACT TOOL | Invoking tool");

          try {
            // Get fresh token for tool execution
            const toolAccessToken = await this.getValidAccessToken(
              hubspotTokens,
              refreshTokenHandler,
              webconsole
            );

            const result = await this.executeCreateContact(
              email,
              firstName,
              lastName,
              phone,
              company,
              additionalProperties,
              toolAccessToken,
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

      // Get input values
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

      // Execute the contact creation
      const result = await this.executeCreateContact(
        email,
        firstName,
        lastName,
        phone,
        company,
        additionalProps,
        accessToken,
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
