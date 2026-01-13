import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "HubSpot - Create Deal",
  category: "management",
  type: "hubspot_create_deal_node",
  icon: {},
  desc: "Create a new deal in HubSpot CRM",
  credit: 5,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      name: "DealName",
      type: "Text",
      desc: "Deal name (required)",
    },
    {
      name: "Amount",
      type: "Number",
      desc: "Deal amount",
    },
    {
      name: "Pipeline",
      type: "Text",
      desc: "Pipeline ID",
    },
    {
      name: "Stage",
      type: "Text",
      desc: "Deal stage ID",
    },
    {
      name: "CloseDate",
      type: "Text",
      desc: "Expected close date (YYYY-MM-DD)",
    },
    {
      name: "AdditionalProperties",
      type: "JSON",
      desc: "Additional deal properties as key-value pairs",
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
      desc: "Whether the deal was created successfully",
    },
    {
      name: "dealId",
      type: "Text",
      desc: "The HubSpot deal ID",
    },
    {
      name: "deal",
      type: "JSON",
      desc: "The created deal object",
    },
    {
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      name: "DealName",
      type: "Text",
      desc: "Deal name (required)",
      value: "New Deal",
    },
    {
      name: "Amount",
      type: "Number",
      value: 10000,
      desc: "Deal amount",
    },
    {
      name: "Pipeline",
      type: "Text",
      value: "",
      desc: "Pipeline ID",
    },
    {
      name: "Stage",
      type: "Text",
      value: "",
      desc: "Deal stage ID",
    },
    {
      name: "CloseDate",
      type: "Text",
      value: "",
      desc: "Expected close date (YYYY-MM-DD)",
    },
    {
      name: "AdditionalProperties",
      type: "Map",
      value: "",
      desc: "Additional deal properties as key-value pairs",
    },
    {
      desc: "Connect to your HubSpot account",
      name: "HubSpot",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "medium",
  tags: ["hubspot", "crm", "deal", "create", "management"],
};

class hubspot_create_deal_node extends BaseNode {
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
      webconsole.info("HubSpot Create Deal | Refreshing access token...");

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
      webconsole.success("HubSpot Create Deal | Token refreshed successfully");

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
        expires_at: Date.now() + tokens.expires_in * 1000,
      };
    } catch (error) {
      webconsole.error(
        `HubSpot Create Deal | Token refresh failed: ${
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
        "HubSpot Create Deal | Access token expired or expiring soon, refreshing..."
      );

      const newTokens = await this.refreshHubSpotToken(
        hubspotTokens.refresh_token,
        webconsole
      );

      // Save refreshed tokens to database using refreshTokenHandler
      // This assumes refreshTokenHandler.handleHubSpotToken exists
      await refreshTokenHandler.handleHubSpotToken(newTokens);

      return newTokens.access_token;
    }

    return hubspotTokens.access_token;
  }

  async executeCreateDeal(
    dealName,
    amount,
    pipeline,
    stage,
    closeDate,
    additionalProps,
    accessToken, // Changed from apiKey
    webconsole
  ) {
    try {
      if (!dealName || dealName.trim() === "") {
        throw new Error("Deal name is required");
      }

      const properties = {
        dealname: dealName,
      };

      if (amount !== null && amount !== undefined)
        properties.amount = amount.toString();
      if (pipeline) properties.pipeline = pipeline;
      if (stage) properties.dealstage = stage;
      if (closeDate) {
        // Convert YYYY-MM-DD to timestamp (milliseconds)
        const timestamp = new Date(closeDate).getTime();
        properties.closedate = timestamp.toString();
      }

      if (additionalProps && typeof additionalProps === "object") {
        Object.assign(properties, additionalProps);
      }

      webconsole.info(`Creating HubSpot deal: ${dealName}`);

      const response = await axios.post(
        "https://api.hubapi.com/crm/v3/objects/deals",
        { properties },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`, // Use accessToken
            "Content-Type": "application/json",
          },
        }
      );

      webconsole.success(
        `Deal created successfully with ID: ${response.data.id}`
      );

      return {
        success: true,
        dealId: response.data.id,
        deal: response.data,
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      throw new Error(`Failed to create deal: ${errorMsg}`);
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
      webconsole.info("HubSpot Create Deal Node | Starting execution...");

      // OAuth 2.0 Logic Start
      const tokens = serverData.socialList;

      if (!tokens || !Object.keys(tokens).includes("hubspot")) {
        this.setCredit(0);
        webconsole.error(
          "HubSpot Create Deal Node | Please connect your HubSpot account"
        );
        return {
          success: false,
          dealId: null,
          deal: null,
          Tool: null,
        };
      }

      const hubspotTokens = tokens["hubspot"];

      if (!hubspotTokens || !hubspotTokens.access_token) {
        this.setCredit(0);
        webconsole.error(
          "HubSpot Create Deal Node | Invalid HubSpot tokens, please reconnect your account"
        );
        return {
          success: false,
          dealId: null,
          deal: null,
          Tool: null,
        };
      }

      const refreshTokenHandler = serverData.refreshUtil;

      if (!refreshTokenHandler) {
        this.setCredit(0);
        webconsole.error(
          "HubSpot Create Deal Node | Refresh token handler not available"
        );
        return {
          success: false,
          dealId: null,
          deal: null,
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
      const hubspotCreateDealTool = tool(
        async (
          {
            dealName,
            amount,
            pipeline,
            stage,
            closeDate,
            additionalProperties,
          },
          toolConfig
        ) => {
          webconsole.info("HUBSPOT CREATE DEAL TOOL | Invoking tool");

          try {
            // Get fresh token for tool execution
            const toolAccessToken = await this.getValidAccessToken(
              hubspotTokens,
              refreshTokenHandler,
              webconsole
            );

            const result = await this.executeCreateDeal(
              dealName,
              amount,
              pipeline,
              stage,
              closeDate,
              additionalProperties,
              toolAccessToken, // Pass accessToken
              webconsole
            );

            this.setCredit(this.getCredit() + 5);

            return [JSON.stringify(result), this.getCredit()];
          } catch (error) {
            this.setCredit(this.getCredit() - 5);
            webconsole.error(
              `HUBSPOT CREATE DEAL TOOL | Error: ${error.message}`
            );
            return [
              JSON.stringify({
                success: false,
                dealId: null,
                deal: null,
                error: error.message,
              }),
              this.getCredit(),
            ];
          }
        },
        {
          name: "hubspotCreateDealTool",
          description:
            "Create a new deal in HubSpot CRM with name, amount, pipeline, stage, close date and additional properties",
          schema: z.object({
            dealName: z.string().describe("Deal name (required)"),
            amount: z.number().optional().describe("Deal amount"),
            pipeline: z.string().optional().describe("Pipeline ID"),
            stage: z.string().optional().describe("Deal stage ID"),
            closeDate: z
              .string()
              .optional()
              .describe("Expected close date (YYYY-MM-DD format)"),
            additionalProperties: z
              .record(z.any())
              .optional()
              .describe("Additional deal properties as key-value pairs"),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      const dealName = getValue("DealName");
      const amount = getValue("Amount");
      const pipeline = getValue("Pipeline");
      const stage = getValue("Stage");
      const closeDate = getValue("CloseDate");
      const additionalProps = getValue("AdditionalProperties");

      if (!dealName) {
        webconsole.info(
          "HubSpot Create Deal Node | No deal name provided, returning tool only"
        );
        this.setCredit(0);
        return {
          success: false,
          dealId: null,
          deal: null,
          Tool: hubspotCreateDealTool,
        };
      }

      const result = await this.executeCreateDeal(
        dealName,
        amount,
        pipeline,
        stage,
        closeDate,
        additionalProps,
        accessToken, // Pass accessToken
        webconsole
      );

      return {
        ...result,
        Tool: hubspotCreateDealTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error("HubSpot Create Deal Node | Error: " + error.message);
      return {
        success: false,
        dealId: null,
        deal: null,
        Tool: null,
      };
    }
  }
}

export default hubspot_create_deal_node;
