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
      desc: "HubSpot Legacy App API Key",
      name: "HUBSPOT_LEGACY_API_KEY",
      type: "env",
      defaultValue: "your-hubspot-api-key",
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

  async executeAssociateObjects(
    fromObjectType,
    fromObjectId,
    toObjectType,
    toObjectId,
    associationType,
    apiKey,
    webconsole
  ) {
    try {
      if (!fromObjectType || !fromObjectId || !toObjectType || !toObjectId) {
        throw new Error("All object types and IDs are required");
      }

      const url = `https://api.hubapi.com/crm/v3/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}/${toObjectId}/${
        associationType || "default"
      }`;

      webconsole.info(
        `Associating ${fromObjectType}:${fromObjectId} with ${toObjectType}:${toObjectId}`
      );

      await axios.put(
        url,
        {},
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
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
      webconsole.info("HubSpot Associate Objects Node | Generating tool...");

      const apiKey = serverData.envList?.HUBSPOT_LEGACY_API_KEY;

      if (!apiKey) {
        webconsole.error(
          "HubSpot Associate Objects Node | HUBSPOT_LEGACY_API_KEY not set"
        );
        return {
          success: false,
          message: "API key not configured",
          Tool: null,
        };
      }

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
            const result = await this.executeAssociateObjects(
              fromObjectType,
              fromObjectId,
              toObjectType,
              toObjectId,
              associationType,
              apiKey,
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
        apiKey,
        webconsole
      );

      return {
        ...result,
        Tool: hubspotAssociateObjectsTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
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
