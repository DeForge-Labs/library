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
      desc: "HubSpot Legacy App API Key",
      name: "HUBSPOT_LEGACY_API_KEY",
      type: "env",
      defaultValue: "your-hubspot-api-key",
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

  async executeSearchDeals(query, filters, limit, sorts, apiKey, webconsole) {
    try {
      const searchPayload = {
        limit: Math.min(limit || 10, 100),
      };

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
            Authorization: `Bearer ${apiKey}`,
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
      webconsole.info("HubSpot Search Deals Node | Generating tool...");

      const apiKey = serverData.envList?.HUBSPOT_LEGACY_API_KEY;

      if (!apiKey) {
        webconsole.error(
          "HubSpot Search Deals Node | HUBSPOT_LEGACY_API_KEY not set"
        );
        return {
          success: false,
          deals: null,
          total: 0,
          Tool: null,
        };
      }

      const hubspotSearchDealsTool = tool(
        async ({ query, filters, limit, sorts }, toolConfig) => {
          webconsole.info("HUBSPOT SEARCH DEALS TOOL | Invoking tool");

          try {
            const result = await this.executeSearchDeals(
              query,
              filters,
              limit,
              sorts,
              apiKey,
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

      // Always execute with provided parameters (or defaults)
      const result = await this.executeSearchDeals(
        query,
        filters,
        limit,
        sorts,
        apiKey,
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
