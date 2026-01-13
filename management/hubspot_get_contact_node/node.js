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
        desc: "The Flow to trigger",
        name: "Flow",
        type: "Flow",
    },
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
      desc: "Connect to your HubSpot account",
      name: "HubSpot",
      type: "social",
      defaultValue: "",
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
      webconsole.info("HubSpot Get Contact | Refreshing access token...");

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
      webconsole.success("HubSpot Get Contact | Token refreshed successfully");

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
        expires_at: Date.now() + tokens.expires_in * 1000,
      };
    } catch (error) {
      webconsole.error(
        `HubSpot Get Contact | Token refresh failed: ${
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
        "HubSpot Get Contact | Access token expired or expiring soon, refreshing..."
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

  async executeGetContact(email, contactId, accessToken, webconsole) {
    // Changed apiKey to accessToken
    try {
      let response;

      // The V3 CRM API for contacts can fetch by ID or by email using the 'idProperty' query parameter
      const propertiesQuery =
        "properties=email,firstname,lastname,phone,company,createdate,lastmodifieddate";

      if (contactId) {
        webconsole.info(`Retrieving HubSpot contact by ID: ${contactId}`);
        response = await axios.get(
          `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?${propertiesQuery}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`, // Use accessToken
            },
          }
        );
      } else if (email) {
        webconsole.info(`Retrieving HubSpot contact by email: ${email}`);
        response = await axios.get(
          `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(
            email
          )}?idProperty=email&${propertiesQuery}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`, // Use accessToken
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
      // Handle the case where the contact object is not found (404)
      if (error.response?.status === 404) {
        webconsole.info(`Contact not found: ${email || contactId}`);
        return {
          success: false,
          contact: null,
        };
      }
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
      webconsole.info("HubSpot Get Contact Node | Starting execution...");

      // OAuth 2.0 Logic Start
      const tokens = serverData.socialList;

      if (!tokens || !Object.keys(tokens).includes("hubspot")) {
        this.setCredit(0);
        webconsole.error(
          "HubSpot Get Contact Node | Please connect your HubSpot account"
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
          "HubSpot Get Contact Node | Invalid HubSpot tokens, please reconnect your account"
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
          "HubSpot Get Contact Node | Refresh token handler not available"
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

      const hubspotGetContactTool = tool(
        async ({ email, contactId }, toolConfig) => {
          webconsole.info("HUBSPOT GET CONTACT TOOL | Invoking tool");

          try {
            // Get fresh token for tool execution
            const toolAccessToken = await this.getValidAccessToken(
              hubspotTokens,
              refreshTokenHandler,
              webconsole
            );

            const result = await this.executeGetContact(
              email,
              contactId,
              toolAccessToken, // Pass accessToken
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
        accessToken, // Pass accessToken
        webconsole
      );

      return {
        ...result,
        Tool: hubspotGetContactTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
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
