import BaseNode from "../../core/BaseNode/node.js";
import pg from "pg";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "PostgreSQL - Query Rows",
  category: "database",
  type: "postgres_query_node",
  icon: {},
  desc: "Query postgres database",
  credit: 5,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      name: "Table",
      type: "Text",
      desc: "Name of the table to query",
    },
    {
      name: "Columns",
      type: "Text",
      desc: "Comma-separated columns to select (or * for all)",
    },
    {
      name: "WhereClause",
      type: "Text",
      desc: "The WHERE clause with placeholders ($1, $2, etc.)",
    },
    {
      name: "WhereValues",
      type: "Text[]",
      desc: "Array of values for the WHERE clause (e.g., [123, 'active'])",
    },
    {
      name: "Limit",
      type: "Number",
      desc: "The maximum number of rows to return",
    },
  ],
  outputs: [
    {
      name: "rows",
      type: "JSON",
      desc: "The array of rows returned by the query",
    },
    {
      name: "rowCount",
      type: "Number",
      desc: "The number of rows returned",
    },
    {
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      name: "Table",
      type: "Text",
      desc: "Name of the table to query",
      value: "users",
    },
    {
      name: "Columns",
      type: "Text",
      value: "*",
      desc: "Comma-separated columns to select (or * for all)",
    },
    {
      name: "WhereClause",
      type: "Text",
      value: "id = $1",
      desc: "The WHERE clause with placeholders ($1, $2, etc.)",
    },
    {
      name: "WhereValues",
      type: "Text[]",
      value: "Enter values here...",
      desc: "Array of values for the WHERE clause (e.g., [123, 'active'])",
    },
    {
      name: "Limit",
      type: "Number",
      value: 10,
      desc: "The maximum number of rows to return",
    },
    {
      desc: "Postgres connection string",
      name: "PG_CONNECTION_STRING",
      type: "env",
      defaultValue: "postgres://user:password@localhost:5432/dbname",
    },
  ],
  difficulty: "hard",
  tags: ["postgres", "database", "query"],
};

class postgres_query_node extends BaseNode {
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
   * Execute a PostgreSQL query
   * @private
   */
  async executeQuery(
    table,
    columns,
    whereClause,
    whereValues,
    limit,
    connectionString,
    webconsole
  ) {
    let client;

    try {
      client = new pg.Client({ connectionString });
      await client.connect();

      const safeTable = client.escapeIdentifier(table);
      const safeColumns =
        columns === "*" || columns === ""
          ? "*"
          : columns
              .split(",")
              .map((col) => client.escapeIdentifier(col.trim()))
              .join(", ");

      let queryText = `SELECT ${safeColumns} FROM ${safeTable}`;
      let queryParams = [];

      // Handle whereValues
      if (Array.isArray(whereValues)) {
        queryParams = [...whereValues];
      } else if (typeof whereValues === "string" && whereValues.trim() !== "") {
        try {
          queryParams = [whereValues];
        } catch (e) {
          throw new Error(`Failed to parse WhereValues: ${e.message}`);
        }
      }

      if (whereClause && whereClause.trim() !== "") {
        queryText += ` WHERE ${whereClause}`;
      }

      if (limit && Number(limit) > 0) {
        queryText += ` LIMIT $${queryParams.length + 1}`;
        queryParams.push(Number(limit));
      }

      webconsole.info(
        `Executing query: ${queryText} with params: ${JSON.stringify(
          queryParams
        )}`
      );

      const result = await client.query(queryText, queryParams);
      webconsole.success(`Query successful, returned ${result.rowCount} rows.`);

      return {
        rows: result.rows,
        rowCount: result.rowCount,
      };
    } finally {
      if (client) {
        await client.end();
        webconsole.info("Connection to database closed.");
      }
    }
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
      webconsole.info("Postgres Query Node | Generating tool...");

      const connectionString = serverData.envList?.PG_CONNECTION_STRING;

      if (!connectionString) {
        this.setCredit(0);
        webconsole.error(
          "Postgres Query Node | Environment variable PG_CONNECTION_STRING is not set."
        );
        return {
          rows: null,
          rowCount: 0,
          Tool: null,
        };
      }

      // Create the tool
      const postgresTool = tool(
        async (
          { table, columns, whereClause, whereValues, limit },
          toolConfig
        ) => {
          webconsole.info("POSTGRES TOOL | Invoking tool");

          try {
            const result = await this.executeQuery(
              table,
              columns || "*",
              whereClause || "",
              whereValues || [],
              limit || null,
              connectionString,
              webconsole
            );

            this.setCredit(this.getCredit() + 5);

            return [
              JSON.stringify({
                success: true,
                rowCount: result.rowCount,
                rows: result.rows,
              }),
              this.getCredit(),
            ];
          } catch (error) {
            this.setCredit(this.getCredit() - 5);
            webconsole.error(`POSTGRES TOOL | Error: ${error.message}`);
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
          name: "postgresTool",
          description:
            "Query a PostgreSQL database with table name, columns, WHERE clause, and limit",
          schema: z.object({
            table: z.string().describe("Name of the table to query"),
            columns: z
              .string()
              .optional()
              .describe("Comma-separated columns to select (or * for all)"),
            whereClause: z
              .string()
              .optional()
              .describe("The WHERE clause with placeholders ($1, $2, etc.)"),
            whereValues: z
              .array(z.union([z.string(), z.number()]))
              .optional()
              .describe("Array of values for the WHERE clause"),
            limit: z
              .number()
              .optional()
              .describe("The maximum number of rows to return"),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      webconsole.info("Postgres Query Node | Begin execution, parsing inputs");

      const table = getValue("Table");
      const columns = getValue("Columns", "*");
      const whereClause = getValue("WhereClause");
      const whereValuesRaw = getValue("WhereValues", []);
      const limit = getValue("Limit");

      // If no table provided, return only the tool
      if (!table) {
        webconsole.info(
          "Postgres Query Node | No table provided, returning tool only"
        );
        this.setCredit(0);
        return {
          rows: null,
          rowCount: 0,
          Tool: postgresTool,
        };
      }

      // Parse whereValues
      let whereValues = [];
      if (Array.isArray(whereValuesRaw)) {
        whereValues = whereValuesRaw;
      } else if (
        typeof whereValuesRaw === "string" &&
        whereValuesRaw.trim() !== ""
      ) {
        try {
          whereValues = [whereValuesRaw];
        } catch (e) {
          this.setCredit(0);
          webconsole.error(
            `Postgres Query Node | Failed to parse WhereValues. Error: ${e.message}`
          );
          return {
            rows: null,
            rowCount: 0,
            Tool: postgresTool,
          };
        }
      }

      // Execute the query directly
      const result = await this.executeQuery(
        table,
        columns,
        whereClause,
        whereValues,
        limit,
        connectionString,
        webconsole
      );

      return {
        rows: result.rows,
        rowCount: result.rowCount,
        Tool: postgresTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      webconsole.error("Postgres Query Node | Error: " + error.message);
      return {
        rows: null,
        rowCount: 0,
        Tool: null,
      };
    }
  }
}

export default postgres_query_node;
