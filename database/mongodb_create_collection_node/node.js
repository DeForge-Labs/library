import BaseNode from "../../core/BaseNode/node.js";
import { MongoClient } from "mongodb";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "MongoDB - Create Collection",
  category: "database",
  type: "mongodb_create_collection_node",
  icon: {},
  desc: "Create a new collection in MongoDB database",
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
      desc: "Name of the collection to create",
    },
    {
      name: "Options",
      type: "JSON",
      desc: "Collection options (capped, size, max, validator, etc.)",
    },
    {
      name: "Indexes",
      type: "JSON[]",
      desc: "Array of indexes to create [{keys: {field: 1}, options: {unique: true}}]",
    },
  ],
  outputs: [
    {
      name: "success",
      type: "Boolean",
      desc: "Whether the collection was created successfully",
    },
    {
      name: "collectionName",
      type: "Text",
      desc: "The name of the created collection",
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
      name: "Collection",
      type: "Text",
      desc: "Name of the collection to create",
      value: "users",
    },
    {
      name: "Options",
      type: "Map",
      value: "{}",
      desc: "Collection options (capped, size, max, validator, etc.)",
    },
    {
      name: "Indexes",
      type: "JSON[]",
      value: "[]",
      desc: "Array of indexes to create [{keys: {field: 1}, options: {unique: true}}]",
    },
    {
      desc: "MongoDB connection string",
      name: "MONGODB_CONNECTION_STRING",
      type: "env",
      defaultValue: "mongodb://localhost:27017/dbname",
    },
  ],
  difficulty: "hard",
  tags: ["mongodb", "database", "create", "collection"],
};

class mongodb_create_collection_node extends BaseNode {
  constructor() {
    super(config);
  }

  /**
   * @override
   * @inheritDoc
   */
  estimateUsage(inputs, contents, serverData) {
    return this.getCredit();
  }

  /**
   * Parse JSON input
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
   * Execute create collection operation
   * @private
   */
  async executeCreateCollection(
    collectionName,
    optionsRaw,
    indexesRaw,
    connectionString,
    webconsole
  ) {
    let client;

    try {
      client = new MongoClient(connectionString);
      await client.connect();
      webconsole.info("Connected to MongoDB");

      const dbName = new URL(connectionString).pathname.substring(1) || "test";
      const db = client.db(dbName);

      // Parse options
      const options = this.parseJSON(optionsRaw, {}, webconsole, "Options");

      // Check if collection already exists
      const collections = await db
        .listCollections({ name: collectionName })
        .toArray();

      if (collections.length > 0) {
        const message = `Collection '${collectionName}' already exists.`;
        webconsole.info(message);
        return {
          success: true,
          collectionName: collectionName,
          message: message,
        };
      }

      // Create collection
      webconsole.info(`Creating collection: ${collectionName}`);
      await db.createCollection(collectionName, options);

      // Create indexes if provided
      const indexes = this.parseJSON(indexesRaw, [], webconsole, "Indexes");

      if (Array.isArray(indexes) && indexes.length > 0) {
        webconsole.info(`Creating ${indexes.length} index(es)...`);
        const collection = db.collection(collectionName);

        for (const index of indexes) {
          const keys = index.keys || {};
          const indexOptions = index.options || {};
          await collection.createIndex(keys, indexOptions);
          webconsole.info(`Index created: ${JSON.stringify(keys)}`);
        }
      }

      const successMessage = `Collection '${collectionName}' created successfully${
        indexes.length > 0 ? ` with ${indexes.length} index(es)` : ""
      }.`;
      webconsole.success(successMessage);

      return {
        success: true,
        collectionName: collectionName,
        message: successMessage,
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error(`MongoDB Create Collection Error: ${error.message}`);
      throw error;
    } finally {
      if (client) {
        await client.close();
        webconsole.info("Connection to MongoDB closed.");
      }
    }
  }

  /**
   * @override
   * @inheritDoc
   */
  async run(inputs, contents, webconsole, serverData) {
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
      webconsole.info("MongoDB Create Collection Node | Generating tool...");

      const connectionString = serverData.envList?.MONGODB_CONNECTION_STRING;

      if (!connectionString) {
        this.setCredit(0);
        webconsole.error(
          "MongoDB Create Collection Node | Environment variable MONGODB_CONNECTION_STRING is not set."
        );
        return {
          success: false,
          collectionName: null,
          message: "Database connection string not configured",
          Tool: null,
        };
      }

      // Create the tool
      const mongodbCreateCollectionTool = tool(
        async ({ collection, options, indexes }, toolConfig) => {
          webconsole.info("MONGODB CREATE COLLECTION TOOL | Invoking tool");

          try {
            const result = await this.executeCreateCollection(
              collection,
              options || {},
              indexes || [],
              connectionString,
              webconsole
            );

            this.setCredit(this.getCredit() + 5);

            return [
              JSON.stringify({
                success: result.success,
                collectionName: result.collectionName,
                message: result.message,
              }),
              this.getCredit(),
            ];
          } catch (error) {
            this.setCredit(this.getCredit() - 5);
            webconsole.error(
              `MONGODB CREATE COLLECTION TOOL | Error: ${error.message}`
            );
            return [
              JSON.stringify({
                success: false,
                collectionName: null,
                message: `Failed to create collection: ${error.message}`,
              }),
              this.getCredit(),
            ];
          }
        },
        {
          name: "mongodbCreateCollectionTool",
          description:
            "Create a new collection in MongoDB database with optional configuration and indexes. Options can include: capped (boolean), size (number), max (number), validator (object). Indexes should be an array of objects with 'keys' and 'options' properties.",
          schema: z.object({
            collection: z.string().describe("Name of the collection to create"),
            options: z
              .record(z.any())
              .optional()
              .describe(
                "Collection options like {capped: true, size: 10000, max: 100} or validator schemas"
              ),
            indexes: z
              .array(
                z.object({
                  keys: z
                    .record(z.number())
                    .describe("Index keys, e.g., {email: 1, name: -1}"),
                  options: z
                    .record(z.any())
                    .optional()
                    .describe(
                      "Index options like {unique: true, sparse: true}"
                    ),
                })
              )
              .optional()
              .describe("Array of indexes to create on the collection"),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      webconsole.info("MongoDB Create Collection Node | Begin execution");

      const collection = getValue("Collection");
      const options = getValue("Options", {});
      const indexes = getValue("Indexes", []);

      // If no collection provided, return only the tool
      if (!collection) {
        webconsole.info(
          "MongoDB Create Collection Node | Missing collection name, returning tool only"
        );
        this.setCredit(0);
        return {
          success: false,
          collectionName: null,
          message: "No collection name provided",
          Tool: mongodbCreateCollectionTool,
        };
      }

      // Execute the create collection operation directly
      const result = await this.executeCreateCollection(
        collection,
        options,
        indexes,
        connectionString,
        webconsole
      );

      return {
        success: result.success,
        collectionName: result.collectionName,
        message: result.message,
        Tool: mongodbCreateCollectionTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      const errorMessage = `Failed to create collection: ${error.message}`;
      webconsole.error("MongoDB Create Collection Node | " + errorMessage);
      return {
        success: false,
        collectionName: null,
        message: errorMessage,
        Tool: null,
      };
    }
  }
}

export default mongodb_create_collection_node;
