import BaseNode from "../../core/BaseNode/node.js";
import { MongoClient } from "mongodb";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "MongoDB - Check Collection",
  category: "database",
  type: "mongodb_check_collection_node",
  icon: {},
  desc: "Check if a collection exists and get its metadata",
  credit: 3,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      name: "Collection",
      type: "Text",
      desc: "Name of the collection to check",
    },
  ],
  outputs: [
    {
      desc: "The Flow to trigger",
      name: "Flow",
      type: "Flow",
    },
    {
      name: "exists",
      type: "Boolean",
      desc: "Whether the collection exists",
    },
    {
      name: "documentCount",
      type: "Number",
      desc: "Number of documents in the collection",
    },
    {
      name: "collectionSize",
      type: "Number",
      desc: "Size of the collection in bytes",
    },
    {
      name: "indexes",
      type: "JSON",
      desc: "Array of indexes on the collection",
    },
    {
      name: "options",
      type: "JSON",
      desc: "Collection options (capped, size, etc.)",
    },
    {
      name: "sampleDocument",
      type: "JSON",
      desc: "A sample document showing the structure",
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
      desc: "Name of the collection to check",
      value: "users",
    },
    {
      desc: "MongoDB connection string",
      name: "MONGODB_CONNECTION_STRING",
      type: "env",
      defaultValue: "mongodb://localhost:27017/dbname",
    },
  ],
  difficulty: "medium",
  tags: ["mongodb", "database", "check", "metadata", "collection"],
};

class mongodb_check_collection_node extends BaseNode {
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
   * Format bytes to human-readable string
   * @private
   */
  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  /**
   * Execute collection check and metadata retrieval
   * @private
   */
  async executeCheckCollection(collectionName, connectionString, webconsole) {
    let client;

    try {
      client = new MongoClient(connectionString);
      await client.connect();
      webconsole.info("Connected to MongoDB");

      const dbName = new URL(connectionString).pathname.substring(1) || "test";
      const db = client.db(dbName);

      // Check if collection exists
      webconsole.info(`Checking if collection '${collectionName}' exists...`);
      const collections = await db
        .listCollections({ name: collectionName })
        .toArray();

      if (collections.length === 0) {
        webconsole.info(`Collection '${collectionName}' does not exist.`);
        return {
          exists: false,
          documentCount: 0,
          collectionSize: 0,
          collectionSizeFormatted: "0 Bytes",
          indexes: [],
          options: {},
          sampleDocument: null,
        };
      }

      webconsole.info(
        `Collection '${collectionName}' exists. Fetching metadata...`
      );

      const collection = db.collection(collectionName);
      const collectionInfo = collections[0];

      // Get document count
      const documentCount = await collection.countDocuments();

      // Get collection stats
      const stats = await db.command({ collStats: collectionName });
      const collectionSize = stats.size || 0;

      // Get indexes
      const indexesRaw = await collection.indexes();
      const indexes = indexesRaw.map((idx) => ({
        name: idx.name,
        keys: idx.key,
        unique: idx.unique || false,
        sparse: idx.sparse || false,
        background: idx.background || false,
        ...(idx.expireAfterSeconds !== undefined && {
          ttl: idx.expireAfterSeconds,
        }),
      }));

      // Get collection options
      const options = collectionInfo.options || {};

      // Get a sample document to show structure
      let sampleDocument = null;
      if (documentCount > 0) {
        const sample = await collection.findOne();
        sampleDocument = sample;
      }

      webconsole.success(
        `Collection metadata retrieved: ${documentCount} documents, ${this.formatBytes(
          collectionSize
        )}, ${indexes.length} index(es)`
      );

      return {
        exists: true,
        documentCount: documentCount,
        collectionSize: collectionSize,
        collectionSizeFormatted: this.formatBytes(collectionSize),
        indexes: indexes,
        options: options,
        sampleDocument: sampleDocument,
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error(`MongoDB Check Collection Error: ${error.message}`);
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
      webconsole.info("MongoDB Check Collection Node | Generating tool...");

      const connectionString = serverData.envList?.MONGODB_CONNECTION_STRING;

      if (!connectionString) {
        this.setCredit(0);
        webconsole.error(
          "MongoDB Check Collection Node | Environment variable MONGODB_CONNECTION_STRING is not set."
        );
        return {
          exists: false,
          documentCount: 0,
          collectionSize: 0,
          indexes: null,
          options: null,
          sampleDocument: null,
          Tool: null,
        };
      }

      // Create the tool
      const mongodbCheckCollectionTool = tool(
        async ({ collection }, toolConfig) => {
          webconsole.info("MONGODB CHECK COLLECTION TOOL | Invoking tool");

          try {
            const result = await this.executeCheckCollection(
              collection,
              connectionString,
              webconsole
            );

            this.setCredit(this.getCredit() + 3);

            return [
              JSON.stringify({
                exists: result.exists,
                documentCount: result.documentCount,
                collectionSize: result.collectionSize,
                collectionSizeFormatted: result.collectionSizeFormatted,
                indexes: result.indexes,
                options: result.options,
                sampleDocument: result.sampleDocument,
              }),
              this.getCredit(),
            ];
          } catch (error) {
            this.setCredit(this.getCredit() - 3);
            webconsole.error(
              `MONGODB CHECK COLLECTION TOOL | Error: ${error.message}`
            );
            return [
              JSON.stringify({
                exists: false,
                documentCount: 0,
                collectionSize: 0,
                collectionSizeFormatted: "0 Bytes",
                indexes: [],
                options: {},
                sampleDocument: null,
                error: error.message,
              }),
              this.getCredit(),
            ];
          }
        },
        {
          name: "mongodbCheckCollectionTool",
          description:
            "Check if a MongoDB collection exists and retrieve its metadata including document count, collection size, indexes (with their keys and options like unique/sparse), collection options (capped, size, max, validator), and a sample document showing the structure. Useful for understanding collection schema and configuration.",
          schema: z.object({
            collection: z.string().describe("Name of the collection to check"),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      webconsole.info("MongoDB Check Collection Node | Begin execution");

      const collection = getValue("Collection");

      // If no collection provided, return only the tool
      if (!collection) {
        webconsole.info(
          "MongoDB Check Collection Node | No collection provided, returning tool only"
        );
        this.setCredit(0);
        return {
          exists: false,
          documentCount: 0,
          collectionSize: 0,
          indexes: null,
          options: null,
          sampleDocument: null,
          Tool: mongodbCheckCollectionTool,
        };
      }

      // Execute the check collection operation directly
      const result = await this.executeCheckCollection(
        collection,
        connectionString,
        webconsole
      );

      return {
        exists: result.exists,
        documentCount: result.documentCount,
        collectionSize: result.collectionSize,
        collectionSizeFormatted: result.collectionSizeFormatted,
        indexes: result.indexes,
        options: result.options,
        sampleDocument: result.sampleDocument,
        Tool: mongodbCheckCollectionTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error(
        "MongoDB Check Collection Node | Error: " + error.message
      );
      return {
        exists: false,
        documentCount: 0,
        collectionSize: 0,
        indexes: null,
        options: null,
        sampleDocument: null,
        Tool: null,
      };
    }
  }
}

export default mongodb_check_collection_node;
