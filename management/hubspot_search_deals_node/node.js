import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "HubSpot - Search Deals",
  category: "management",
  type: "hubspot_search_deals_node",
  icon: {},
  desc: "Search for deals in HubSpot CRM with filters",
  credit: 5,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      name: "Query",
      type: "Text",
      desc: "Search query string",
    },
    {
      name: "Filters",
      type: "JSON",
      desc: "Array of filter objects [{propertyName, operator, value}]",
    },
    {
      name: "Limit",
      type: "Number",
      desc: "Maximum number of results (default: 10, max: 100)",
    },
    {
      name: "Sorts",
      type: "JSON",
      desc: "Array of sort objects [{propertyName, direction}]",
    },
  ],
  outputs: [
    {
      name: "success",
      type: "Boolean",
      desc: "Whether the search was successful",
    },
    {
      name: "deals",
      type: "JSON",
      desc: "Array of matching deals",
    },
    {
      name: "total",
      type: "Number",
      desc: "Total number of matching deals",
    },
    {
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      name: "Query",
      type: "Text",
      desc: "Search query string",
      value: "",
    },
    {
      name: "Filters",
      type: "Map",
      value: "",
      desc: "Array of filter objects [{propertyName, operator, value}]",
    },
    {
      name: "Limit",
      type: "Number",
      value: 10,
      desc: "Maximum number of results (default: 10, max: 100)",
    },
    {
      name: "Sorts",
      type: "Map",
      value: "",
      desc: "Array of sort objects [{propertyName, direction}]",
    },
    {
      desc: "Connect to your HubSpot account",
      name: "HubSpot",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "medium",
  tags: ["hubspot", "crm", "deal", "search", "filter", "management"],
};

class hubspot_search_deals_node extends BaseNode {
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
      webconsole.info("HubSpot Search Deals | Refreshing access token...");

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
      webconsole.success("HubSpot Search Deals | Token refreshed successfully");

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
        expires_at: Date.now() + tokens.expires_in * 1000,
      };
    } catch (error) {
      webconsole.error(
        `HubSpot Search Deals | Token refresh failed: ${
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
        "HubSpot Search Deals | Access token expired or expiring soon, refreshing..."
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

  async executeSearchDeals(
    query,
    filters,
    limit,
    sorts,
    accessToken,
    webconsole
  ) {
    // Changed apiKey to accessToken
    try {
      const searchPayload = {
        limit: Math.min(limit || 10, 100),
      };

      // Add properties to return (recommended for search endpoints)
      searchPayload.properties = [
        "dealname",
        "amount",
        "dealstage",
        "pipeline",
        "closedate",
      ];

      // Add query if provided
      if (query && query.trim() !== "") {
        searchPayload.query = query;
      }

      // Add filters if provided
      if (filters && Array.isArray(filters) && filters.length > 0) {
        searchPayload.filterGroups = [
          {
            filters: filters.map((f) => ({
              propertyName: f.propertyName,
              operator: f.operator || "EQ",
              value: f.value,
            })),
          },
        ];
      }

      // Add sorts if provided
      if (sorts && Array.isArray(sorts) && sorts.length > 0) {
        searchPayload.sorts = sorts.map((s) => ({
          propertyName: s.propertyName,
          direction: s.direction || "DESCENDING",
        }));
      }

      webconsole.info(
        `Searching HubSpot deals with limit: ${searchPayload.limit}`
      );

      const response = await axios.post(
        "https://api.hubapi.com/crm/v3/objects/deals/search",
        searchPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`, // Use accessToken
            "Content-Type": "application/json",
          },
        }
      );

      webconsole.success(`Found ${response.data.total} deals`);

      return {
        success: true,
        deals: response.data.results,
        total: response.data.total,
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      throw new Error(`Failed to search deals: ${errorMsg}`);
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
      webconsole.info("HubSpot Search Deals Node | Starting execution...");

      // OAuth 2.0 Logic Start
      const tokens = serverData.socialList;

      if (!tokens || !Object.keys(tokens).includes("hubspot")) {
        webconsole.error(
          "HubSpot Search Deals Node | Please connect your HubSpot account"
        );
        return {
          success: false,
          deals: null,
          total: 0,
          Tool: null,
        };
      }

      const hubspotTokens = tokens["hubspot"];

      if (!hubspotTokens || !hubspotTokens.access_token) {
        webconsole.error(
          "HubSpot Search Deals Node | Invalid HubSpot tokens, please reconnect your account"
        );
        return {
          success: false,
          deals: null,
          total: 0,
          Tool: null,
        };
      }

      const refreshTokenHandler = serverData.refreshUtil;

      if (!refreshTokenHandler) {
        webconsole.error(
          "HubSpot Search Deals Node | Refresh token handler not available"
        );
        return {
          success: false,
          deals: null,
          total: 0,
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

      const hubspotSearchDealsTool = tool(
        async ({ query, filters, limit, sorts }, toolConfig) => {
          webconsole.info("HUBSPOT SEARCH DEALS TOOL | Invoking tool");

          try {
            // Get fresh token for tool execution
            const toolAccessToken = await this.getValidAccessToken(
              hubspotTokens,
              refreshTokenHandler,
              webconsole
            );

            const result = await this.executeSearchDeals(
              query,
              filters,
              limit,
              sorts,
              toolAccessToken, // Pass accessToken
              webconsole
            );

            this.setCredit(this.getCredit() + 5);

            return [JSON.stringify(result), this.getCredit()];
          } catch (error) {
            this.setCredit(this.getCredit() - 5);
            webconsole.error(
              `HUBSPOT SEARCH DEALS TOOL | Error: ${error.message}`
            );
            return [
              JSON.stringify({
                success: false,
                deals: [],
                total: 0,
                error: error.message,
              }),
              this.getCredit(),
            ];
          }
        },
        {
          name: "hubspotSearchDealsTool",
          description:
            "Search for deals in HubSpot CRM using query string and/or filters. Filters should be array of objects with propertyName, operator (EQ, NEQ, LT, GT, CONTAINS, etc.), and value. Sorts can specify ordering. Example filters: [{propertyName: 'dealstage', operator: 'EQ', value: 'closedwon'}, {propertyName: 'amount', operator: 'GT', value: 10000}]. Example sorts: [{propertyName: 'amount', direction: 'DESCENDING'}]",
          schema: z.object({
            query: z.string().optional().describe("Search query string"),
            filters: z
              .array(
                z.object({
                  propertyName: z.string(),
                  operator: z.string().optional(),
                  value: z.any(),
                })
              )
              .optional()
              .describe("Array of filter objects"),
            limit: z
              .number()
              .optional()
              .describe("Maximum number of results (default: 10, max: 100)"),
            sorts: z
              .array(
                z.object({
                  propertyName: z.string(),
                  direction: z.string().optional(),
                })
              )
              .optional()
              .describe(
                "Array of sort objects (direction: ASCENDING or DESCENDING)"
              ),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      const query = getValue("Query");
      const filters = getValue("Filters");
      const limit = getValue("Limit", 10);
      const sorts = getValue("Sorts");

      // Execute with provided parameters (or defaults)
      const result = await this.executeSearchDeals(
        query,
        filters,
        limit,
        sorts,
        accessToken, // Pass accessToken
        webconsole
      );

      return {
        ...result,
        Tool: hubspotSearchDealsTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("HubSpot Search Deals Node | Error: " + error.message);
      return {
        success: false,
        deals: null,
        total: 0,
        Tool: null,
      };
    }
  }
}

export default hubspot_search_deals_node;
