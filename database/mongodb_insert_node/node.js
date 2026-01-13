import BaseNode from "../../core/BaseNode/node.js";
import { MongoClient } from "mongodb";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "MongoDB - Insert Document(s)",
  category: "database",
  type: "mongodb_insert_node",
  icon: {},
  desc: "Insert one or more documents into a MongoDB collection",
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
      desc: "Name of the collection to insert into",
    },
    {
      name: "Documents",
      type: "JSON[]",
      desc: "A document object or an array of document objects to insert",
    },
    {
      name: "Options",
      type: "JSON",
      desc: "Insert options (ordered, writeConcern, etc.)",
    },
  ],
  outputs: [
    {
        desc: "The Flow to trigger",
        name: "Flow",
        type: "Flow",
    },
    {
      name: "insertedIds",
      type: "JSON",
      desc: "The IDs of the inserted documents",
    },
    {
      name: "insertedCount",
      type: "Number",
      desc: "The number of documents that were successfully inserted",
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
      desc: "Name of the collection to insert into",
      value: "logs",
    },
    {
      name: "Documents",
      type: "JSON[]",
      value: '[{"level": "info", "message": "process started"}]',
      desc: "A document object or an array of document objects to insert",
    },
    {
      name: "Options",
      type: "Map",
      value: "{}",
      desc: "Insert options (ordered, writeConcern, etc.)",
    },
    {
      desc: "MongoDB connection string",
      name: "MONGODB_CONNECTION_STRING",
      type: "env",
      defaultValue: "mongodb://localhost:27017/dbname",
    },
  ],
  difficulty: "hard",
  tags: ["mongodb", "database", "insert", "write"],
};

class mongodb_insert_node extends BaseNode {
  constructor() {
    super(config);
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
   * Execute a MongoDB insert operation
   * @private
   */
  async executeInsert(
    collectionName,
    documentsRaw,
    optionsRaw,
    connectionString,
    webconsole
  ) {
    let client;

    try {
      // Parse documents
      let documents =
        typeof documentsRaw === "string"
          ? JSON.parse(documentsRaw)
          : documentsRaw;
      const documentsArray = Array.isArray(documents) ? documents : [documents];

      if (documentsArray.length === 0) {
        webconsole.info(
          "MongoDB Insert | Input documents are empty. Nothing to insert."
        );
        return { insertedIds: [], insertedCount: 0 };
      }

      client = new MongoClient(connectionString);
      await client.connect();
      webconsole.info("Connected to MongoDB");

      const dbName = new URL(connectionString).pathname.substring(1) || "test";
      const db = client.db(dbName);
      const collection = db.collection(collectionName);

      // Parse options
      const options = this.parseJSON(optionsRaw, {}, webconsole, "Options");

      webconsole.info(
        `Inserting ${documentsArray.length} document(s) into ${collectionName}...`
      );

      let result;
      if (documentsArray.length === 1) {
        // Use insertOne for single document
        result = await collection.insertOne(documentsArray[0], options);
        webconsole.success(
          `Document inserted successfully with ID: ${result.insertedId}`
        );
        return {
          insertedIds: [result.insertedId],
          insertedCount: 1,
        };
      } else {
        // Use insertMany for multiple documents
        result = await collection.insertMany(documentsArray, options);
        webconsole.success(
          `${result.insertedCount} document(s) inserted successfully.`
        );
        return {
          insertedIds: Object.values(result.insertedIds),
          insertedCount: result.insertedCount,
        };
      }
    } catch (error) {
      this.setCredit(0);
      webconsole.error(`MongoDB Insert Error: ${error.message}`);
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
      if (input?.value !== undefined) return input.value;
      const content = contents.find((c) => c.name === name);
      if (content?.value !== undefined) return content.value;
      return defaultValue;
    };

    try {
      webconsole.info("MongoDB Insert Node | Generating tool...");

      const connectionString = serverData.envList?.MONGODB_CONNECTION_STRING;

      if (!connectionString) {
        this.setCredit(0);
        webconsole.error(
          "MongoDB Insert Node | Environment variable MONGODB_CONNECTION_STRING is not set."
        );
        return {
          insertedIds: null,
          insertedCount: 0,
          Tool: null,
        };
      }

      const mongodbInsertTool = tool(
        async ({ collection, documents, options }, toolConfig) => {
          webconsole.info("MONGODB INSERT TOOL | Invoking tool");

          try {
            const result = await this.executeInsert(
              collection,
              documents,
              options || {},
              connectionString,
              webconsole
            );

            this.setCredit(this.getCredit() + 5);

            return [
              JSON.stringify({
                success: true,
                insertedCount: result.insertedCount,
                insertedIds: result.insertedIds,
              }),
              this.getCredit(),
            ];
          } catch (error) {
            this.setCredit(this.getCredit() - 5);
            webconsole.error(`MONGODB INSERT TOOL | Error: ${error.message}`);
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
          name: "mongodbInsertTool",
          description:
            "Insert one or more documents into a MongoDB collection. Documents should be a JSON object or array of JSON objects. Automatically uses insertOne or insertMany based on input.",
          schema: z.object({
            collection: z
              .string()
              .describe("Name of the collection to insert into"),
            documents: z
              .union([
                z.record(z.any()),
                z.array(z.record(z.any())),
                z.string(),
              ])
              .describe(
                "A document object or an array of document objects to insert (can also be a JSON string)"
              ),
            options: z
              .record(z.any())
              .optional()
              .describe(
                "Insert options like {ordered: true, writeConcern: {w: 1}}"
              ),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      webconsole.info("MongoDB Insert Node | Begin execution...");

      const collection = getValue("Collection");
      const documentsRaw = getValue("Documents");
      const options = getValue("Options", {});

      // If no collection or documents provided, return only the tool
      if (!collection || !documentsRaw) {
        webconsole.info(
          "MongoDB Insert Node | Missing collection or documents, returning tool only"
        );
        this.setCredit(0);
        return {
          insertedIds: null,
          insertedCount: 0,
          Tool: mongodbInsertTool,
        };
      }

      // Execute the insert directly
      const result = await this.executeInsert(
        collection,
        documentsRaw,
        options,
        connectionString,
        webconsole
      );

      return {
        insertedIds: result.insertedIds,
        insertedCount: result.insertedCount,
        Tool: mongodbInsertTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error("MongoDB Insert Node | Error: " + error.message);
      return {
        insertedIds: null,
        insertedCount: 0,
        Tool: null,
      };
    }
  }
}

export default mongodb_insert_node;
