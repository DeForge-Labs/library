import BaseNode from "../../core/BaseNode/node.js";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "HubSpot - Create Company",
  category: "management",
  type: "hubspot_create_company_node",
  icon: {},
  desc: "Create a new company in HubSpot CRM",
  credit: 5,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      name: "Name",
      type: "Text",
      desc: "Company name (required)",
    },
    {
      name: "Domain",
      type: "Text",
      desc: "Company domain/website",
    },
    {
      name: "Industry",
      type: "Text",
      desc: "Company industry",
    },
    {
      name: "Phone",
      type: "Text",
      desc: "Company phone number",
    },
    {
      name: "City",
      type: "Text",
      desc: "Company city",
    },
    {
      name: "AdditionalProperties",
      type: "JSON",
      desc: "Additional company properties as key-value pairs",
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
      desc: "Whether the company was created successfully",
    },
    {
      name: "companyId",
      type: "Text",
      desc: "The HubSpot company ID",
    },
    {
      name: "company",
      type: "JSON",
      desc: "The created company object",
    },
    {
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      name: "Name",
      type: "Text",
      desc: "Company name (required)",
      value: "Acme Corporation",
    },
    {
      name: "Domain",
      type: "Text",
      value: "acme.com",
      desc: "Company domain/website",
    },
    {
      name: "Industry",
      type: "Text",
      value: "",
      desc: "Company industry",
    },
    {
      name: "Phone",
      type: "Text",
      value: "",
      desc: "Company phone number",
    },
    {
      name: "City",
      type: "Text",
      value: "",
      desc: "Company city",
    },
    {
      name: "AdditionalProperties",
      type: "Map",
      value: "",
      desc: "Additional company properties as key-value pairs",
    },
    {
      desc: "Connect to your HubSpot account",
      name: "HubSpot",
      type: "social",
      defaultValue: "",
    },
  ],
  difficulty: "medium",
  tags: ["hubspot", "crm", "company", "create", "management"],
};

class hubspot_create_company_node extends BaseNode {
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
      webconsole.info("HubSpot Create Company | Refreshing access token...");

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
        "HubSpot Create Company | Token refreshed successfully"
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
        `HubSpot Create Company | Token refresh failed: ${
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
        "HubSpot Create Company | Access token expired or expiring soon, refreshing..."
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

  async executeCreateCompany(
    name,
    domain,
    industry,
    phone,
    city,
    additionalProps,
    accessToken,
    webconsole
  ) {
    try {
      if (!name || name.trim() === "") {
        throw new Error("Company name is required");
      }

      // Build properties object
      const properties = {
        name: name,
      };

      if (domain) properties.domain = domain;
      if (industry) properties.industry = industry;
      if (phone) properties.phone = phone;
      if (city) properties.city = city;

      // Add additional properties
      if (additionalProps && typeof additionalProps === "object") {
        Object.assign(properties, additionalProps);
      }

      webconsole.info(`Creating HubSpot company: ${name}`);

      const response = await axios.post(
        "https://api.hubapi.com/crm/v3/objects/companies",
        { properties },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      webconsole.success(
        `Company created successfully with ID: ${response.data.id}`
      );

      return {
        success: true,
        companyId: response.data.id,
        company: response.data,
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      throw new Error(`Failed to create company: ${errorMsg}`);
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
      webconsole.info("HubSpot Create Company Node | Starting execution...");

      // Get HubSpot OAuth tokens from socialList
      const tokens = serverData.socialList;

      if (!tokens || !Object.keys(tokens).includes("hubspot")) {
        this.setCredit(0);
        webconsole.error(
          "HubSpot Create Company Node | Please connect your HubSpot account"
        );
        return {
          success: false,
          companyId: null,
          company: null,
          Tool: null,
        };
      }

      const hubspotTokens = tokens["hubspot"];

      if (!hubspotTokens || !hubspotTokens.access_token) {
        this.setCredit(0);
        webconsole.error(
          "HubSpot Create Company Node | Invalid HubSpot tokens, please reconnect your account"
        );
        return {
          success: false,
          companyId: null,
          company: null,
          Tool: null,
        };
      }

      // Get refresh token handler from serverData
      const refreshTokenHandler = serverData.refreshUtil;

      if (!refreshTokenHandler) {
        this.setCredit(0);
        webconsole.error(
          "HubSpot Create Company Node | Refresh token handler not available"
        );
        return {
          success: false,
          companyId: null,
          company: null,
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
      const hubspotCreateCompanyTool = tool(
        async (
          { name, domain, industry, phone, city, additionalProperties },
          toolConfig
        ) => {
          webconsole.info("HUBSPOT CREATE COMPANY TOOL | Invoking tool");

          try {
            // Get fresh token for tool execution (important for long-running processes)
            const toolAccessToken = await this.getValidAccessToken(
              hubspotTokens,
              refreshTokenHandler,
              webconsole
            );

            const result = await this.executeCreateCompany(
              name,
              domain,
              industry,
              phone,
              city,
              additionalProperties,
              toolAccessToken,
              webconsole
            );

            this.setCredit(this.getCredit() + 5);

            return [JSON.stringify(result), this.getCredit()];
          } catch (error) {
            this.setCredit(this.getCredit() - 5);
            webconsole.error(
              `HUBSPOT CREATE COMPANY TOOL | Error: ${error.message}`
            );
            return [
              JSON.stringify({
                success: false,
                companyId: null,
                company: null,
                error: error.message,
              }),
              this.getCredit(),
            ];
          }
        },
        {
          name: "hubspotCreateCompanyTool",
          description:
            "Create a new company in HubSpot CRM with name, domain, industry, phone, city and additional properties",
          schema: z.object({
            name: z.string().describe("Company name (required)"),
            domain: z.string().optional().describe("Company domain/website"),
            industry: z.string().optional().describe("Company industry"),
            phone: z.string().optional().describe("Company phone number"),
            city: z.string().optional().describe("Company city"),
            additionalProperties: z
              .record(z.any())
              .optional()
              .describe("Additional company properties as key-value pairs"),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      // Get input values
      const name = getValue("Name");
      const domain = getValue("Domain");
      const industry = getValue("Industry");
      const phone = getValue("Phone");
      const city = getValue("City");
      const additionalProps = getValue("AdditionalProperties");

      if (!name) {
        webconsole.info(
          "HubSpot Create Company Node | No company name provided, returning tool only"
        );
        this.setCredit(0);
        return {
          success: false,
          companyId: null,
          company: null,
          Tool: hubspotCreateCompanyTool,
        };
      }

      // Execute the company creation
      const result = await this.executeCreateCompany(
        name,
        domain,
        industry,
        phone,
        city,
        additionalProps,
        accessToken,
        webconsole
      );

      return {
        ...result,
        Tool: hubspotCreateCompanyTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error("HubSpot Create Company Node | Error: " + error.message);
      return {
        success: false,
        companyId: null,
        company: null,
        Tool: null,
      };
    }
  }
}

export default hubspot_create_company_node;
