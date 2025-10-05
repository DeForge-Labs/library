import BaseNode from "../../core/BaseNode/node.js";
import pg from "pg";

const config = {
  title: "PostgreSQL - Insert Row(s)",
  category: "database",
  type: "postgres_insert_node",
  icon: {},
  desc: "Inserts one or more rows into a PostgreSQL table.",
  credit: 10,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      name: "Table",
      type: "Text",
      desc: "Name of the table to insert into",
    },
    {
      name: "Data",
      type: "JSON[]",
      desc: "A JSON object or an array of JSON objects to insert",
    },
    {
      name: "Returning",
      type: "Text",
      desc: "Optional. Columns to return after insertion (e.g., 'id' or '*')",
    },
  ],
  outputs: [
    {
      name: "rows",
      type: "JSON",
      desc: "The data from the inserted rows, if 'Returning' is used",
    },
    {
      name: "rowCount",
      type: "Number",
      desc: "The number of rows that were successfully inserted",
    },
  ],
  fields: [
    {
      name: "Table",
      type: "Text",
      desc: "Name of the table to insert into",
      value: "logs",
    },
    {
      name: "Data",
      type: "JSON[]",
      value: '[{"level": "info", "message": "process started"}]',
      desc: "A JSON object or an array of JSON objects to insert",
    },
    {
      name: "Returning",
      type: "Text",
      value: "*",
      desc: "Optional. Columns to return after insertion (e.g., 'id' or '*')",
    },
    {
      desc: "Postgres connection string",
      name: "PG_CONNECTION_STRING",
      type: "env",
      defaultValue: "postgres://user:password@localhost:5432/dbname",
    },
  ],
  difficulty: "medium",
  tags: ["postgres", "database", "insert", "write"],
};

class postgres_insert_node extends BaseNode {
  constructor() {
    super(config);
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

    let client;

    try {
      webconsole.info("Postgres Insert Node | Begin execution...");

      const table = getValue("Table");
      const dataRaw = getValue("Data");
      const returning = getValue("Returning", "");
      const connectionString = serverData.envList?.PG_CONNECTION_STRING;

      if (!connectionString) {
        webconsole.error(
          "Postgres Insert Node | Environment variable PG_CONNECTION_STRING is not set."
        );
        return null;
      }
      if (!table) {
        webconsole.error(
          "Postgres Insert Node | 'Table' name is a required field."
        );
        return null;
      }
      if (!dataRaw) {
        webconsole.error("Postgres Insert Node | 'Data' is a required field.");
        return null;
      }

      let data = typeof dataRaw === "string" ? JSON.parse(dataRaw) : dataRaw;
      const dataArray = Array.isArray(data) ? data : [data];

      if (dataArray.length === 0) {
        webconsole.info(
          "Postgres Insert Node | Input data is empty. Nothing to insert."
        );
        return { rows: [], rowCount: 0 };
      }

      client = new pg.Client({ connectionString });
      await client.connect();

      // --- Securely build the INSERT query ---
      const firstRow = dataArray[0];
      const columns = Object.keys(firstRow);
      const safeTable = client.escapeIdentifier(table);
      const safeColumns = columns
        .map((col) => client.escapeIdentifier(col))
        .join(", ");

      const valuesPlaceholders = dataArray
        .map((_, rowIndex) => {
          const rowPlaceholders = columns.map(
            (_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`
          );
          return `(${rowPlaceholders.join(", ")})`;
        })
        .join(", ");

      const allValues = dataArray.flatMap((row) =>
        columns.map((col) => row[col])
      );

      let queryText = `INSERT INTO ${safeTable} (${safeColumns}) VALUES ${valuesPlaceholders}`;

      if (returning && returning.trim() !== "") {
        const safeReturning =
          returning === "*"
            ? "*"
            : returning
                .split(",")
                .map((col) => client.escapeIdentifier(col.trim()))
                .join(", ");
        queryText += ` RETURNING ${safeReturning}`;
      }

      webconsole.info(
        `Executing query to insert ${dataArray.length} row(s) into ${table}.`
      );

      const result = await client.query(queryText, allValues);
      webconsole.success(
        `Query successful, ${result.rowCount} row(s) inserted.`
      );

      return {
        rows: result.rows,
        rowCount: result.rowCount,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("Postgres Insert Node | Error: " + error.message);
      return null;
    } finally {
      if (client) {
        await client.end();
        webconsole.info("Connection to database closed.");
      }
    }
  }
}

export default postgres_insert_node;
