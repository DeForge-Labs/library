import BaseNode from "../../core/BaseNode/node.js";
import pg from "pg";

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

    let client;

    try {
      webconsole.info("Postgres Custom Query | Begin execution...");

      const queryText = getValue("Query");
      const paramsRaw = getValue("Parameters", []);
      const connectionString = serverData.envList?.PG_CONNECTION_STRING;

      if (!connectionString) {
        webconsole.error(
          "Postgres Custom Query | Environment variable PG_CONNECTION_STRING is not set."
        );
        return null;
      }
      if (!queryText || queryText.trim() === "") {
        webconsole.error(
          "Postgres Custom Query | 'Query' field cannot be empty."
        );
        return null;
      }

      let queryParams = [];
      if (Array.isArray(paramsRaw)) {
        queryParams = paramsRaw; // It's already an array, use it directly
      } else if (typeof paramsRaw === "string") {
        try {
          queryParams = [paramsRaw];
        } catch (e) {
          webconsole.error(
            `Postgres Custom Query | Failed to parse Parameters. Please ensure it's a valid JSON array string (e.g., [123, "text"]). Error: ${e.message}`
          );
          return null;
        }
      }

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
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("Postgres Custom Query | Error: " + error.message);
      return null;
    } finally {
      if (client) {
        await client.end();
        webconsole.info("Connection to database closed.");
      }
    }
  }
}

export default postgres_custom_query_node;
