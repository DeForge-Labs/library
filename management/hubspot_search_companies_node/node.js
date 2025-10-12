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
      desc: "HubSpot Legacy App API Key",
      name: "HUBSPOT_LEGACY_API_KEY",
      type: "env",
      defaultValue: "your-hubspot-api-key",
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

  async executeSearchCompanies(query, filters, limit, apiKey, webconsole) {
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

      webconsole.info(
        `Searching HubSpot companies with limit: ${searchPayload.limit}`
      );

      const response = await axios.post(
        "https://api.hubapi.com/crm/v3/objects/companies/search",
        searchPayload,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
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
      webconsole.info("HubSpot Search Companies Node | Generating tool...");

      const apiKey = serverData.envList?.HUBSPOT_LEGACY_API_KEY;

      if (!apiKey) {
        webconsole.error(
          "HubSpot Search Companies Node | HUBSPOT_LEGACY_API_KEY not set"
        );
        return {
          success: false,
          companies: null,
          total: 0,
          Tool: null,
        };
      }

      const hubspotSearchCompaniesTool = tool(
        async ({ query, filters, limit }, toolConfig) => {
          webconsole.info("HUBSPOT SEARCH COMPANIES TOOL | Invoking tool");

          try {
            const result = await this.executeSearchCompanies(
              query,
              filters,
              limit,
              apiKey,
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

      // Always execute with provided parameters (or defaults)
      const result = await this.executeSearchCompanies(
        query,
        filters,
        limit,
        apiKey,
        webconsole
      );

      return {
        ...result,
        Tool: hubspotSearchCompaniesTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
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
