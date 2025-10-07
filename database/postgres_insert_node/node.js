import BaseNode from "../../core/BaseNode/node.js";
import pg from "pg";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "PostgreSQL - Insert Row(s)",
  category: "database",
  type: "postgres_insert_node",
  icon: {},
  desc: "Inserts one or more rows into a PostgreSQL table.",
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
  difficulty: "hard",
  tags: ["postgres", "database", "insert", "write"],
};

class postgres_insert_node extends BaseNode {
  constructor() {
    super(config);
  }

  /**
   * Execute a PostgreSQL insert operation
   * @private
   */
  async executeInsert(table, dataRaw, returning, connectionString, webconsole) {
    let client;

    try {
      let data = typeof dataRaw === "string" ? JSON.parse(dataRaw) : dataRaw;
      const dataArray = Array.isArray(data) ? data : [data];

      if (dataArray.length === 0) {
        webconsole.info(
          "Postgres Insert | Input data is empty. Nothing to insert."
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
          returning === "*" || returning === ""
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
      webconsole.info("Postgres Insert Node | Generating tool...");

      const connectionString = serverData.envList?.PG_CONNECTION_STRING;

      if (!connectionString) {
        webconsole.error(
          "Postgres Insert Node | Environment variable PG_CONNECTION_STRING is not set."
        );
        return {
          rows: null,
          rowCount: 0,
          Tool: null,
        };
      }

      // Create the tool
      const postgresInsertTool = tool(
        async ({ table, data, returning }, toolConfig) => {
          webconsole.info("POSTGRES INSERT TOOL | Invoking tool");

          try {
            const result = await this.executeInsert(
              table,
              data,
              returning || "*",
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
            webconsole.error(`POSTGRES INSERT TOOL | Error: ${error.message}`);
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
          name: "postgresInsertTool",
          description:
            "Insert one or more rows into a PostgreSQL table. Data should be a JSON object or array of JSON objects.",
          schema: z.object({
            table: z.string().describe("Name of the table to insert into"),
            data: z
              .union([
                z.record(z.any()),
                z.array(z.record(z.any())),
                z.string(),
              ])
              .describe(
                "A JSON object or an array of JSON objects to insert (can also be a JSON string)"
              ),
            returning: z
              .string()
              .optional()
              .describe(
                "Optional. Columns to return after insertion (e.g., 'id' or '*')"
              ),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      webconsole.info("Postgres Insert Node | Begin execution...");

      const table = getValue("Table");
      const dataRaw = getValue("Data");
      const returning = getValue("Returning", "*");

      // If no table or data provided, return only the tool
      if (!table || !dataRaw) {
        webconsole.info(
          "Postgres Insert Node | Missing table or data, returning tool only"
        );
        this.setCredit(0);
        return {
          rows: null,
          rowCount: 0,
          Tool: postgresInsertTool,
        };
      }

      // Execute the insert directly
      const result = await this.executeInsert(
        table,
        dataRaw,
        returning,
        connectionString,
        webconsole
      );

      return {
        rows: result.rows,
        rowCount: result.rowCount,
        Tool: postgresInsertTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("Postgres Insert Node | Error: " + error.message);
      return {
        rows: null,
        rowCount: 0,
        Tool: null,
      };
    }
  }
}

export default postgres_insert_node;
