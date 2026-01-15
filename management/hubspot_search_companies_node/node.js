import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "HubSpot - Search Companies",
  category: "management",
  type: "hubspot_search_companies_node",
  icon: {},
  desc: "Search for companies in HubSpot CRM with filters",
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
      desc: "Whether the search was successful",
    },
    {
      name: "companies",
      type: "JSON",
      desc: "Array of matching companies",
    },
    {
      name: "total",
      type: "Number",
      desc: "Total number of matching companies",
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
      desc: "Connect to your HubSpot account",
      name: "HubSpot",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "medium",
  tags: ["hubspot", "crm", "company", "search", "management"],
};

class hubspot_search_companies_node extends BaseNode {
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
      webconsole.info("HubSpot Search Companies | Refreshing access token...");

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
        "HubSpot Search Companies | Token refreshed successfully"
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
        `HubSpot Search Companies | Token refresh failed: ${
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
        "HubSpot Search Companies | Access token expired or expiring soon, refreshing..."
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

  async executeSearchCompanies(query, filters, limit, accessToken, webconsole) {
    // Changed apiKey to accessToken
    try {
      const searchPayload = {
        limit: Math.min(limit || 10, 100),
      };

      // Add query if provided
      if (query && query.trim() !== "") {
        searchPayload.query = query;
      }

      // Add properties to return (recommended for search endpoints)
      searchPayload.properties = [
        "name",
        "domain",
        "phone",
        "city",
        "industry",
      ];

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

      webconsole.info(
        `Searching HubSpot companies with limit: ${searchPayload.limit}`
      );

      const response = await axios.post(
        "https://api.hubapi.com/crm/v3/objects/companies/search",
        searchPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`, // Use accessToken
            "Content-Type": "application/json",
          },
        }
      );

      webconsole.success(`Found ${response.data.total} companies`);

      return {
        success: true,
        companies: response.data.results,
        total: response.data.total,
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      throw new Error(`Failed to search companies: ${errorMsg}`);
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
      webconsole.info("HubSpot Search Companies Node | Starting execution...");

      // OAuth 2.0 Logic Start
      const tokens = serverData.socialList;

      if (!tokens || !Object.keys(tokens).includes("hubspot")) {
        this.setCredit(0);
        webconsole.error(
          "HubSpot Search Companies Node | Please connect your HubSpot account"
        );
        return {
          success: false,
          companies: null,
          total: 0,
          Tool: null,
        };
      }

      const hubspotTokens = tokens["hubspot"];

      if (!hubspotTokens || !hubspotTokens.access_token) {
        this.setCredit(0);
        webconsole.error(
          "HubSpot Search Companies Node | Invalid HubSpot tokens, please reconnect your account"
        );
        return {
          success: false,
          companies: null,
          total: 0,
          Tool: null,
        };
      }

      const refreshTokenHandler = serverData.refreshUtil;

      if (!refreshTokenHandler) {
        this.setCredit(0);
        webconsole.error(
          "HubSpot Search Companies Node | Refresh token handler not available"
        );
        return {
          success: false,
          companies: null,
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

      const hubspotSearchCompaniesTool = tool(
        async ({ query, filters, limit }, toolConfig) => {
          webconsole.info("HUBSPOT SEARCH COMPANIES TOOL | Invoking tool");

          try {
            // Get fresh token for tool execution
            const toolAccessToken = await this.getValidAccessToken(
              hubspotTokens,
              refreshTokenHandler,
              webconsole
            );

            const result = await this.executeSearchCompanies(
              query,
              filters,
              limit,
              toolAccessToken, // Pass accessToken
              webconsole
            );

            this.setCredit(this.getCredit() + 5);

            return [JSON.stringify(result), this.getCredit()];
          } catch (error) {
            this.setCredit(this.getCredit() - 5);
            webconsole.error(
              `HUBSPOT SEARCH COMPANIES TOOL | Error: ${error.message}`
            );
            return [
              JSON.stringify({
                success: false,
                companies: [],
                total: 0,
                error: error.message,
              }),
              this.getCredit(),
            ];
          }
        },
        {
          name: "hubspotSearchCompaniesTool",
          description:
            "Search for companies in HubSpot CRM using query string and/or filters. Filters should be array of objects with propertyName, operator (EQ, NEQ, LT, GT, CONTAINS, etc.), and value. Example: [{propertyName: 'domain', operator: 'CONTAINS', value: '.com'}, {propertyName: 'city', operator: 'EQ', value: 'Boston'}]",
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
          }),
          responseFormat: "content_and_artifact",
        }
      );

      const query = getValue("Query");
      const filters = getValue("Filters");
      const limit = getValue("Limit", 10);

      // Execute with provided parameters (or defaults)
      const result = await this.executeSearchCompanies(
        query,
        filters,
        limit,
        accessToken, // Pass accessToken
        webconsole
      );

      return {
        ...result,
        Tool: hubspotSearchCompaniesTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error(
        "HubSpot Search Companies Node | Error: " + error.message
      );
      return {
        success: false,
        companies: null,
        total: 0,
        Tool: null,
      };
    }
  }
}

export default hubspot_search_companies_node;
