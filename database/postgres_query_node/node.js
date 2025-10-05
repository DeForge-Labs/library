import BaseNode from "../../core/BaseNode/node.js";
import pg from "pg";

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
    { name: "rowCount", type: "Number", desc: "The number of rows returned" },
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

    let client;

    try {
      webconsole.info("Postgres Query Node | Begin execution, parsing inputs");

      const table = getValue("Table");
      const columns = getValue("Columns", "*");
      const whereClause = getValue("WhereClause");
      const whereValues = getValue("WhereValues", []);
      const limit = getValue("Limit");
      const connectionString = serverData.envList?.PG_CONNECTION_STRING;

      if (!connectionString) {
        webconsole.error(
          "Postgres Query Node | Environment variable PG_CONNECTION_STRING is not set."
        );
        return null;
      }
      if (!table) {
        webconsole.error(
          "Postgres Query Node | 'Table' name is a required field."
        );
        return null;
      }

      client = new pg.Client({ connectionString });
      await client.connect();
      const safeTable = client.escapeIdentifier(table);
      const safeColumns =
        columns === "*"
          ? "*"
          : columns
              .split(",")
              .map((col) => client.escapeIdentifier(col.trim()))
              .join(", ");

      let queryText = `SELECT ${safeColumns} FROM ${safeTable}`;
      let queryParams = [...whereValues];

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
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("Postgres Query Node | Error: " + error.message);
      return null;
    } finally {
      if (client) {
        await client.end();
        webconsole.info("Connection to database closed.");
      }
    }
  }
}

export default postgres_query_node;
