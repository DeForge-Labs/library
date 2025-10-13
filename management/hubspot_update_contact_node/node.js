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
      desc: "Connect to your HubSpot account", // Updated description
      name: "HubSpot", // Changed to social connection name
      type: "social", // Changed type to social
      defaultValue: "",
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

  /**
   * Check if HubSpot access token is expired
   */
  isAccessTokenExpired(hubspotTokens) {
    if (!hubspotTokens || !hubspotTokens.expires_at) {
      return true;
    }

    const now = Date.now();
    const expiresAt = hubspotTokens.expires_at;

    // Consider expired if less than 5 minutes remaining (300000ms)
    return expiresAt - now < 300000;
  }

  /**
   * Refresh HubSpot access token
   */
  async refreshHubSpotToken(refreshToken, webconsole) {
    try {
      webconsole.info("HubSpot Update Contact | Refreshing access token...");

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
        "HubSpot Update Contact | Token refreshed successfully"
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
        `HubSpot Update Contact | Token refresh failed: ${
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
        "HubSpot Update Contact | Access token expired or expiring soon, refreshing..."
      );

      const newTokens = await this.refreshHubSpotToken(
        hubspotTokens.refresh_token,
        webconsole
      );

      // Save refreshed tokens to database using refreshTokenHandler
      await refreshTokenHandler.handleHubSpotToken(newTokens);

      return newTokens.access_token;
    }

    return hubspotTokens.access_token;
  }

  async executeUpdateContact(
    email,
    contactId,
    properties,
    accessToken, // Changed from apiKey
    webconsole
  ) {
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
        // HubSpot V3 requires URL encoding for email when using idProperty
        url = `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(
          email
        )}?idProperty=email`;
      } else {
        throw new Error("Either email or contactId is required");
      }

      // V3 CRM API uses PATCH for updates
      const response = await axios.patch(
        url,
        { properties },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`, // Use accessToken
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
      webconsole.info("HubSpot Update Contact Node | Starting execution...");

      // OAuth 2.0 Logic Start
      const tokens = serverData.socialList;

      if (!tokens || !Object.keys(tokens).includes("hubspot")) {
        this.setCredit(0);
        webconsole.error(
          "HubSpot Update Contact Node | Please connect your HubSpot account"
        );
        return {
          success: false,
          contact: null,
          Tool: null,
        };
      }

      const hubspotTokens = tokens["hubspot"];

      if (!hubspotTokens || !hubspotTokens.access_token) {
        this.setCredit(0);
        webconsole.error(
          "HubSpot Update Contact Node | Invalid HubSpot tokens, please reconnect your account"
        );
        return {
          success: false,
          contact: null,
          Tool: null,
        };
      }

      const refreshTokenHandler = serverData.refreshUtil;

      if (!refreshTokenHandler) {
        this.setCredit(0);
        webconsole.error(
          "HubSpot Update Contact Node | Refresh token handler not available"
        );
        return {
          success: false,
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
      // OAuth 2.0 Logic End

      const hubspotUpdateContactTool = tool(
        async ({ email, contactId, properties }, toolConfig) => {
          webconsole.info("HUBSPOT UPDATE CONTACT TOOL | Invoking tool");

          try {
            // Get fresh token for tool execution
            const toolAccessToken = await this.getValidAccessToken(
              hubspotTokens,
              refreshTokenHandler,
              webconsole
            );

            const result = await this.executeUpdateContact(
              email,
              contactId,
              properties,
              toolAccessToken, // Pass accessToken
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
        accessToken, // Pass accessToken
        webconsole
      );

      return {
        ...result,
        Tool: hubspotUpdateContactTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
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
