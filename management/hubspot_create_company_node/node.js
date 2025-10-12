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
      desc: "HubSpot Legacy App API Key",
      name: "HUBSPOT_LEGACY_API_KEY",
      type: "env",
      defaultValue: "your-hubspot-api-key",
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

  async executeCreateCompany(
    name,
    domain,
    industry,
    phone,
    city,
    additionalProps,
    apiKey,
    webconsole
  ) {
    try {
      if (!name || name.trim() === "") {
        throw new Error("Company name is required");
      }

      const properties = {
        name: name,
      };

      if (domain) properties.domain = domain;
      if (industry) properties.industry = industry;
      if (phone) properties.phone = phone;
      if (city) properties.city = city;

      if (additionalProps && typeof additionalProps === "object") {
        Object.assign(properties, additionalProps);
      }

      webconsole.info(`Creating HubSpot company: ${name}`);

      const response = await axios.post(
        "https://api.hubapi.com/crm/v3/objects/companies",
        { properties },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
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
      webconsole.info("HubSpot Create Company Node | Generating tool...");

      const apiKey = serverData.envList?.HUBSPOT_LEGACY_API_KEY;

      if (!apiKey) {
        webconsole.error(
          "HubSpot Create Company Node | HUBSPOT_LEGACY_API_KEY not set"
        );
        return {
          success: false,
          companyId: null,
          company: null,
          Tool: null,
        };
      }

      const hubspotCreateCompanyTool = tool(
        async (
          { name, domain, industry, phone, city, additionalProperties },
          toolConfig
        ) => {
          webconsole.info("HUBSPOT CREATE COMPANY TOOL | Invoking tool");

          try {
            const result = await this.executeCreateCompany(
              name,
              domain,
              industry,
              phone,
              city,
              additionalProperties,
              apiKey,
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

      const result = await this.executeCreateCompany(
        name,
        domain,
        industry,
        phone,
        city,
        additionalProps,
        apiKey,
        webconsole
      );

      return {
        ...result,
        Tool: hubspotCreateCompanyTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
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
