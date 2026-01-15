import BaseNode from "../../core/BaseNode/node.js";
import { MongoClient } from "mongodb";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "MongoDB - Query Documents",
  category: "database",
  type: "mongodb_query_node",
  icon: {},
  desc: "Query MongoDB database",
  credit: 5,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      name: "Collection",
      type: "Text",
      desc: "Name of the collection to query",
    },
    {
      name: "Filter",
      type: "JSON",
      desc: "MongoDB filter query object (e.g., {status: 'active'})",
    },
    {
      name: "Projection",
      type: "JSON",
      desc: "Fields to include/exclude (e.g., {name: 1, email: 1, _id: 0})",
    },
    {
      name: "Sort",
      type: "JSON",
      desc: "Sort order (e.g., {createdAt: -1})",
    },
    {
      name: "Limit",
      type: "Number",
      desc: "The maximum number of documents to return",
    },
    {
      name: "Skip",
      type: "Number",
      desc: "Number of documents to skip",
    },
  ],
  outputs: [
    {
        desc: "The Flow to trigger",
        name: "Flow",
        type: "Flow",
    },
    {
      name: "documents",
      type: "JSON",
      desc: "The array of documents returned by the query",
    },
    {
      name: "documentCount",
      type: "Number",
      desc: "The number of documents returned",
    },
    {
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      name: "Collection",
      type: "Text",
      desc: "Name of the collection to query",
      value: "users",
    },
    {
      name: "Filter",
      type: "JSON",
      value: "{}",
      desc: "MongoDB filter query object (e.g., {status: 'active'})",
    },
    {
      name: "Projection",
      type: "JSON",
      value: "{}",
      desc: "Fields to include/exclude (e.g., {name: 1, email: 1, _id: 0})",
    },
    {
      name: "Sort",
      type: "JSON",
      value: "{}",
      desc: "Sort order (e.g., {createdAt: -1})",
    },
    {
      name: "Limit",
      type: "Number",
      value: 10,
      desc: "The maximum number of documents to return",
    },
    {
      name: "Skip",
      type: "Number",
      value: 0,
      desc: "Number of documents to skip",
    },
    {
      desc: "MongoDB connection string",
      name: "MONGODB_CONNECTION_STRING",
      type: "env",
      defaultValue: "mongodb://localhost:27017/dbname",
    },
  ],
  difficulty: "hard",
  tags: ["mongodb", "database", "query", "nosql"],
};

class mongodb_query_node extends BaseNode {
  constructor() {
    super(config);
  }

  /**
   * @override
   * @inheritDoc
   * @param {import('../../core/BaseNode/node.js').Inputs[]} inputs
   * @param {import('../../core/BaseNode/node.js').Contents[]} contents
   * @param {import('../../core/BaseNode/node.js').IServerData} serverData
   */
  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  /**
   * Execute a MongoDB query
   * @private
   */
  async executeQuery(
    collection,
    filter,
    projection,
    sort,
    limit,
    skip,
    connectionString,
    webconsole
  ) {
    let client;

    try {
      client = new MongoClient(connectionString);
      await client.connect();
      webconsole.info("Connected to MongoDB");

      // Extract database name from connection string
      const dbName = new URL(connectionString).pathname.substring(1) || "test";
      const db = client.db(dbName);
      const col = db.collection(collection);

      // Parse JSON inputs
      const filterObj = this.parseJSON(filter, {}, webconsole, "Filter");
      const projectionObj = this.parseJSON(
        projection,
        null,
        webconsole,
        "Projection"
      );
      const sortObj = this.parseJSON(sort, null, webconsole, "Sort");

      webconsole.info(
        `Executing query on collection: ${collection} with filter: ${JSON.stringify(
          filterObj
        )}`
      );

      // Build query
      let query = col.find(filterObj);

      if (projectionObj && Object.keys(projectionObj).length > 0) {
        query = query.project(projectionObj);
      }

      if (sortObj && Object.keys(sortObj).length > 0) {
        query = query.sort(sortObj);
      }

      if (skip && Number(skip) > 0) {
        query = query.skip(Number(skip));
      }

      if (limit && Number(limit) > 0) {
        query = query.limit(Number(limit));
      }

      const documents = await query.toArray();
      webconsole.success(
        `Query successful, returned ${documents.length} documents.`
      );

      return {
        documents,
        documentCount: documents.length,
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error(`MongoDB Query Error: ${error.message}`);
      throw error;
    } finally {
      if (client) {
        await client.close();
        webconsole.info("Connection to MongoDB closed.");
      }
    }
  }

  /**
   * Parse JSON string or return default value
   * @private
   */
  parseJSON(value, defaultValue, webconsole, fieldName) {
    if (!value || value === "") {
      return defaultValue;
    }

    if (typeof value === "object") {
      return value;
    }

    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch (e) {
        webconsole.warn(
          `Failed to parse ${fieldName} as JSON: ${e.message}. Using default.`
        );
        return defaultValue;
      }
    }

    return defaultValue;
  }

  /**
   * @override
   * @inheritDoc
   * @param {import('../../core/BaseNode/node.js').Inputs[]} inputs
   * @param {import('../../core/BaseNode/node.js').Contents[]} contents
   * @param {import('../../core/BaseNode/node.js').IWebConsole} webconsole
   * @param {import('../../core/BaseNode/node.js').IServerData} serverData
   */
  async run(inputs, contents, webconsole, serverData) {
    // Helper function to prioritize dynamic inputs over static field values
    const getValue = (name, defaultValue = null) => {
      const input = inputs.find((i) => i.name === name);
      if (input !== undefined && input.value !== undefined) {
        return input.value;
      }
      const content = contents.find((c) => c.name === name);
      if (content !== undefined && content.value !== undefined) {
        return content.value;
      }
      return defaultValue;
    };

    try {
      webconsole.info("MongoDB Query Node | Generating tool...");

      const connectionString = serverData.envList?.MONGODB_CONNECTION_STRING;

      if (!connectionString) {
        this.setCredit(0);
        webconsole.error(
          "MongoDB Query Node | Environment variable MONGODB_CONNECTION_STRING is not set."
        );
        return {
          documents: null,
          documentCount: 0,
          Tool: null,
        };
      }

      const mongodbTool = tool(
        async (
          { collection, filter, projection, sort, limit, skip },
          toolConfig
        ) => {
          webconsole.info("MONGODB TOOL | Invoking tool");

          try {
            const result = await this.executeQuery(
              collection,
              filter || {},
              projection || null,
              sort || null,
              limit || null,
              skip || 0,
              connectionString,
              webconsole
            );

            this.setCredit(this.getCredit() + 5);

            return [
              JSON.stringify({
                success: true,
                documentCount: result.documentCount,
                documents: result.documents,
              }),
              this.getCredit(),
            ];
          } catch (error) {
            this.setCredit(this.getCredit() - 5);
            webconsole.error(`MONGODB TOOL | Error: ${error.message}`);
            return [
              JSON.stringify({
                success: false,
                error: error.message,
              }),
              this.getCredit(),
            ];
          }
        },
        {
          name: "mongodbTool",
          description:
            "Query a MongoDB database with collection name, filter, projection, sort, limit, and skip options",
          schema: z.object({
            collection: z.string().describe("Name of the collection to query"),
            filter: z
              .record(z.any())
              .optional()
              .describe(
                "MongoDB filter query object (e.g., {status: 'active'})"
              ),
            projection: z
              .record(z.number())
              .optional()
              .describe(
                "Fields to include/exclude (e.g., {name: 1, email: 1, _id: 0})"
              ),
            sort: z
              .record(z.number())
              .optional()
              .describe("Sort order (e.g., {createdAt: -1})"),
            limit: z
              .number()
              .optional()
              .describe("The maximum number of documents to return"),
            skip: z.number().optional().describe("Number of documents to skip"),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      webconsole.info("MongoDB Query Node | Begin execution, parsing inputs");

      const collection = getValue("Collection");
      const filter = getValue("Filter", {});
      const projection = getValue("Projection", null);
      const sort = getValue("Sort", null);
      const limit = getValue("Limit");
      const skip = getValue("Skip", 0);

      // If no collection provided, return only the tool
      if (!collection) {
        webconsole.info(
          "MongoDB Query Node | No collection provided, returning tool only"
        );
        this.setCredit(0);
        return {
          documents: null,
          documentCount: 0,
          Tool: mongodbTool,
        };
      }

      // Execute the query directly
      const result = await this.executeQuery(
        collection,
        filter,
        projection,
        sort,
        limit,
        skip,
        connectionString,
        webconsole
      );

      return {
        documents: result.documents,
        documentCount: result.documentCount,
        Tool: mongodbTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error("MongoDB Query Node | Error: " + error.message);
      return {
        documents: null,
        documentCount: 0,
        Tool: null,
      };
    }
  }
}

export default mongodb_query_node;
