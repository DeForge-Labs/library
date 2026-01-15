import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "HubSpot - Associate Objects",
  category: "management",
  type: "hubspot_associate_objects_node",
  icon: {},
  desc: "Associate two objects in HubSpot CRM (e.g., contact to company, deal to contact)",
  credit: 3,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      name: "FromObjectType",
      type: "Text",
      desc: "Type of the first object (contact, company, deal, etc.)",
    },
    {
      name: "FromObjectId",
      type: "Text",
      desc: "ID of the first object",
    },
    {
      name: "ToObjectType",
      type: "Text",
      desc: "Type of the second object (contact, company, deal, etc.)",
    },
    {
      name: "ToObjectId",
      type: "Text",
      desc: "ID of the second object",
    },
    {
      name: "AssociationType",
      type: "Text",
      desc: "Association type ID (optional, uses default if not provided)",
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
      desc: "Whether the association was created successfully",
    },
    {
      name: "message",
      type: "Text",
      desc: "Success or error message",
    },
    {
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      name: "FromObjectType",
      type: "Text",
      desc: "Type of the first object (contact, company, deal, etc.)",
      value: "contact",
    },
    {
      name: "FromObjectId",
      type: "Text",
      value: "",
      desc: "ID of the first object",
    },
    {
      name: "ToObjectType",
      type: "Text",
      desc: "Type of the second object (contact, company, deal, etc.)",
      value: "company",
    },
    {
      name: "ToObjectId",
      type: "Text",
      value: "",
      desc: "ID of the second object",
    },
    {
      name: "AssociationType",
      type: "Text",
      value: "",
      desc: "Association type ID (optional, uses default if not provided)",
    },
    {
      desc: "Connect to your HubSpot account",
      name: "HubSpot",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "medium",
  tags: ["hubspot", "crm", "associate", "management"],
};

class hubspot_associate_objects_node extends BaseNode {
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
      webconsole.info("HubSpot Associate Objects | Refreshing access token...");

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
        "HubSpot Associate Objects | Token refreshed successfully"
      );

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
        expires_at: Date.now() + tokens.expires_in * 1000,
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error(
        `HubSpot Associate Objects | Token refresh failed: ${
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
        "HubSpot Associate Objects | Access token expired or expiring soon, refreshing..."
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

  async executeAssociateObjects(
    fromObjectType,
    fromObjectId,
    toObjectType,
    toObjectId,
    associationType,
    accessToken, // Changed from apiKey
    webconsole
  ) {
    try {
      if (!fromObjectType || !fromObjectId || !toObjectType || !toObjectId) {
        throw new Error("All object types and IDs are required");
      }

      // V3 API association URL
      const url = `https://api.hubapi.com/crm/v3/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}/${toObjectId}/${
        associationType || "default"
      }`;

      webconsole.info(
        `Associating ${fromObjectType}:${fromObjectId} with ${toObjectType}:${toObjectId}`
      );

      // HubSpot V3 Associations API uses a PUT request without a body for simple associations
      await axios.put(
        url,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`, // Use accessToken
            "Content-Type": "application/json",
          },
        }
      );

      const successMessage = `Successfully associated ${fromObjectType} ${fromObjectId} with ${toObjectType} ${toObjectId}`;
      webconsole.success(successMessage);

      return {
        success: true,
        message: successMessage,
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      throw new Error(`Failed to associate objects: ${errorMsg}`);
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
      webconsole.info("HubSpot Associate Objects Node | Starting execution...");

      // OAuth 2.0 Logic Start
      const tokens = serverData.socialList;

      if (!tokens || !Object.keys(tokens).includes("hubspot")) {
        this.setCredit(0);
        webconsole.error(
          "HubSpot Associate Objects Node | Please connect your HubSpot account"
        );
        return {
          success: false,
          message: "HubSpot account not connected",
          Tool: null,
        };
      }

      const hubspotTokens = tokens["hubspot"];

      if (!hubspotTokens || !hubspotTokens.access_token) {
        this.setCredit(0);
        webconsole.error(
          "HubSpot Associate Objects Node | Invalid HubSpot tokens, please reconnect your account"
        );
        return {
          success: false,
          message: "Invalid HubSpot tokens",
          Tool: null,
        };
      }

      const refreshTokenHandler = serverData.refreshUtil;

      if (!refreshTokenHandler) {
        this.setCredit(0);
        webconsole.error(
          "HubSpot Associate Objects Node | Refresh token handler not available"
        );
        return {
          success: false,
          message: "Refresh token handler not available",
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

      // Create the tool
      const hubspotAssociateObjectsTool = tool(
        async (
          {
            fromObjectType,
            fromObjectId,
            toObjectType,
            toObjectId,
            associationType,
          },
          toolConfig
        ) => {
          webconsole.info("HUBSPOT ASSOCIATE OBJECTS TOOL | Invoking tool");

          try {
            // Get fresh token for tool execution
            const toolAccessToken = await this.getValidAccessToken(
              hubspotTokens,
              refreshTokenHandler,
              webconsole
            );

            const result = await this.executeAssociateObjects(
              fromObjectType,
              fromObjectId,
              toObjectType,
              toObjectId,
              associationType,
              toolAccessToken, // Pass accessToken
              webconsole
            );

            this.setCredit(this.getCredit() + 3);

            return [JSON.stringify(result), this.getCredit()];
          } catch (error) {
            this.setCredit(this.getCredit() - 3);
            webconsole.error(
              `HUBSPOT ASSOCIATE OBJECTS TOOL | Error: ${error.message}`
            );
            return [
              JSON.stringify({
                success: false,
                message: error.message,
              }),
              this.getCredit(),
            ];
          }
        },
        {
          name: "hubspotAssociateObjectsTool",
          description:
            "Associate two objects in HubSpot CRM (e.g., link a contact to a company, associate a deal with a contact). Common object types: contact, company, deal, ticket. Use default association type if unsure.",
          schema: z.object({
            fromObjectType: z
              .string()
              .describe(
                "Type of the first object (contact, company, deal, ticket)"
              ),
            fromObjectId: z.string().describe("ID of the first object"),
            toObjectType: z
              .string()
              .describe(
                "Type of the second object (contact, company, deal, ticket)"
              ),
            toObjectId: z.string().describe("ID of the second object"),
            associationType: z
              .string()
              .optional()
              .describe(
                "Association type ID (optional, uses default if not provided)"
              ),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      const fromObjectType = getValue("FromObjectType");
      const fromObjectId = getValue("FromObjectId");
      const toObjectType = getValue("ToObjectType");
      const toObjectId = getValue("ToObjectId");
      const associationType = getValue("AssociationType");

      if (!fromObjectType || !fromObjectId || !toObjectType || !toObjectId) {
        webconsole.info(
          "HubSpot Associate Objects Node | Missing required fields, returning tool only"
        );
        this.setCredit(0);
        return {
          success: false,
          message: "Missing required fields",
          Tool: hubspotAssociateObjectsTool,
        };
      }

      const result = await this.executeAssociateObjects(
        fromObjectType,
        fromObjectId,
        toObjectType,
        toObjectId,
        associationType,
        accessToken, // Pass accessToken
        webconsole
      );

      return {
        ...result,
        Tool: hubspotAssociateObjectsTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error(
        "HubSpot Associate Objects Node | Error: " + error.message
      );
      return {
        success: false,
        message: error.message,
        Tool: null,
      };
    }
  }
}

export default hubspot_associate_objects_node;
