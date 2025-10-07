import BaseNode from "../../core/BaseNode/node.js";
import pg from "pg";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "PostgreSQL - Custom Query",
  category: "database",
  type: "postgres_custom_query_node",
  icon: {},
  desc: "Executes a custom SQL query with parameters. For advanced users.",
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
      desc: "The raw SQL query to execute, using $1, $2, etc. for placeholders",
    },
    {
      name: "Parameters",
      type: "Text[]",
      desc: "The values for the placeholders in the query",
    },
  ],
  outputs: [
    {
      name: "rows",
      type: "JSON",
      desc: "The array of rows returned by the query (if any)",
    },
    {
      name: "rowCount",
      type: "Number",
      desc: "The number of rows affected or returned",
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
      type: "TextArea",
      desc: "The raw SQL query to execute, using $1, $2, etc. for placeholders",
      value: "SELECT * FROM users WHERE status = $1 LIMIT 10;",
    },
    {
      name: "Parameters",
      type: "Text[]",
      value: "Enter values here...",
      desc: "The values for the placeholders in the query",
    },
    {
      desc: "Postgres connection string",
      name: "PG_CONNECTION_STRING",
      type: "env",
      defaultValue: "postgres://user:password@localhost:5432/dbname",
    },
  ],
  difficulty: "hard",
  tags: ["postgres", "database", "custom", "sql", "raw"],
};

class postgres_custom_query_node extends BaseNode {
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
   * Execute a custom PostgreSQL query
   * @private
   */
  async executeCustomQuery(
    queryText,
    queryParams,
    connectionString,
    webconsole
  ) {
    let client;

    try {
      client = new pg.Client({ connectionString });
      await client.connect();

      webconsole.info(
        `Executing query: ${queryText} with params: ${JSON.stringify(
          queryParams
        )}`
      );

      const result = await client.query(queryText, queryParams);
      webconsole.success(
        `Query successful, ${result.rowCount} row(s) affected or returned.`
      );

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
      webconsole.info("Postgres Custom Query | Generating tool...");

      const connectionString = serverData.envList?.PG_CONNECTION_STRING;

      if (!connectionString) {
        webconsole.error(
          "Postgres Custom Query | Environment variable PG_CONNECTION_STRING is not set."
        );
        return {
          rows: null,
          rowCount: 0,
          Tool: null,
        };
      }

      // Create the tool
      const postgresCustomQueryTool = tool(
        async ({ query, parameters }, toolConfig) => {
          webconsole.info("POSTGRES CUSTOM QUERY TOOL | Invoking tool");

          try {
            // Parse parameters
            let queryParams = [];
            if (Array.isArray(parameters)) {
              queryParams = parameters;
            } else if (
              typeof parameters === "string" &&
              parameters.trim() !== ""
            ) {
              try {
                queryParams = [parameters];
              } catch (e) {
                throw new Error(`Failed to parse parameters: ${e.message}`);
              }
            }

            const result = await this.executeCustomQuery(
              query,
              queryParams,
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
            webconsole.error(
              `POSTGRES CUSTOM QUERY TOOL | Error: ${error.message}`
            );
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
          name: "postgresCustomQueryTool",
          description:
            "Execute a custom SQL query on PostgreSQL database with parameterized values. Use $1, $2, etc. as placeholders in the query for the parameters array. This is for advanced SQL operations.",
          schema: z.object({
            query: z
              .string()
              .describe(
                "The raw SQL query to execute, using $1, $2, etc. for placeholders"
              ),
            parameters: z
              .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
              .optional()
              .describe("The values for the placeholders in the query"),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      webconsole.info("Postgres Custom Query | Begin execution...");

      const queryText = getValue("Query");
      const paramsRaw = getValue("Parameters", []);

      // If no query provided, return only the tool
      if (!queryText || queryText.trim() === "") {
        webconsole.info(
          "Postgres Custom Query | No query provided, returning tool only"
        );
        this.setCredit(0);
        return {
          rows: null,
          rowCount: 0,
          Tool: postgresCustomQueryTool,
        };
      }

      // Parse parameters
      let queryParams = [];
      if (Array.isArray(paramsRaw)) {
        queryParams = paramsRaw;
      } else if (typeof paramsRaw === "string" && paramsRaw.trim() !== "") {
        try {
          queryParams = [paramsRaw];
        } catch (e) {
          webconsole.error(
            `Postgres Custom Query | Failed to parse Parameters. Error: ${e.message}`
          );
          return {
            rows: null,
            rowCount: 0,
            Tool: postgresCustomQueryTool,
          };
        }
      }

      // Execute the query directly
      const result = await this.executeCustomQuery(
        queryText,
        queryParams,
        connectionString,
        webconsole
      );

      return {
        rows: result.rows,
        rowCount: result.rowCount,
        Tool: postgresCustomQueryTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("Postgres Custom Query | Error: " + error.message);
      return {
        rows: null,
        rowCount: 0,
        Tool: null,
      };
    }
  }
}

export default postgres_custom_query_node;
