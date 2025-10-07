import BaseNode from "../../core/BaseNode/node.js";
import pg from "pg";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "PostgreSQL - Check Table",
  category: "database",
  type: "postgres_check_table_node",
  icon: {},
  desc: "Check if a table exists and get its metadata",
  credit: 3,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      name: "Table",
      type: "Text",
      desc: "Name of the table to check",
    },
    {
      name: "Schema",
      type: "Text",
      desc: "Schema name (optional, defaults to 'public')",
    },
  ],
  outputs: [
    {
      name: "exists",
      type: "Boolean",
      desc: "Whether the table exists",
    },
    {
      name: "columns",
      type: "JSON",
      desc: "Array of column metadata (name, type, nullable, default)",
    },
    {
      name: "tableSize",
      type: "Text",
      desc: "Human-readable size of the table",
    },
    {
      name: "indexes",
      type: "JSON",
      desc: "Array of indexes on the table",
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
      desc: "Name of the table to check",
      value: "users",
    },
    {
      name: "Schema",
      type: "Text",
      value: "public",
      desc: "Schema name (optional, defaults to 'public')",
    },
    {
      desc: "Postgres connection string",
      name: "PG_CONNECTION_STRING",
      type: "env",
      defaultValue: "postgres://user:password@localhost:5432/dbname",
    },
  ],
  difficulty: "medium",
  tags: ["postgres", "database", "check", "metadata", "table"],
};

class postgres_check_table_node extends BaseNode {
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
   * Execute table check and metadata retrieval
   * @private
   */
  async executeCheckTable(table, schema, connectionString, webconsole) {
    let client;

    try {
      client = new pg.Client({ connectionString });
      await client.connect();

      // Check if table exists
      webconsole.info(`Checking if table '${schema}.${table}' exists...`);
      const existsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 
          AND table_name = $2
        );
      `;
      const existsResult = await client.query(existsQuery, [schema, table]);
      const exists = existsResult.rows[0].exists;

      if (!exists) {
        webconsole.info(`Table '${schema}.${table}' does not exist.`);
        return {
          exists: false,
          columns: [],
          tableSize: "0 bytes",
          indexes: [],
        };
      }

      webconsole.info(
        `Table '${schema}.${table}' exists. Fetching metadata...`
      );

      // Get column information
      const columnsQuery = `
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = $1 
        AND table_name = $2
        ORDER BY ordinal_position;
      `;
      const columnsResult = await client.query(columnsQuery, [schema, table]);
      const columns = columnsResult.rows.map((col) => ({
        name: col.column_name,
        type: col.character_maximum_length
          ? `${col.data_type}(${col.character_maximum_length})`
          : col.data_type,
        nullable: col.is_nullable === "YES",
        default: col.column_default,
      }));

      // Get table size
      const sizeQuery = `
        SELECT pg_size_pretty(pg_total_relation_size($1::regclass)) as size;
      `;
      const sizeResult = await client.query(sizeQuery, [`${schema}.${table}`]);
      const tableSize = sizeResult.rows[0].size;

      // Get indexes
      const indexesQuery = `
        SELECT
          i.relname as index_name,
          a.attname as column_name,
          ix.indisunique as is_unique,
          ix.indisprimary as is_primary
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = $1 AND t.relname = $2
        ORDER BY i.relname, a.attnum;
      `;
      const indexesResult = await client.query(indexesQuery, [schema, table]);

      // Group indexes by name
      const indexesMap = {};
      indexesResult.rows.forEach((row) => {
        if (!indexesMap[row.index_name]) {
          indexesMap[row.index_name] = {
            name: row.index_name,
            columns: [],
            unique: row.is_unique,
            primary: row.is_primary,
          };
        }
        indexesMap[row.index_name].columns.push(row.column_name);
      });
      const indexes = Object.values(indexesMap);

      webconsole.success(
        `Table metadata retrieved: ${columns.length} columns, ${tableSize}`
      );

      return {
        exists: true,
        columns: columns,
        tableSize: tableSize,
        indexes: indexes,
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
      webconsole.info("Postgres Check Table Node | Generating tool...");

      const connectionString = serverData.envList?.PG_CONNECTION_STRING;

      if (!connectionString) {
        webconsole.error(
          "Postgres Check Table Node | Environment variable PG_CONNECTION_STRING is not set."
        );
        return {
          exists: false,
          columns: null,
          tableSize: null,
          indexes: null,
          Tool: null,
        };
      }

      // Create the tool
      const postgresCheckTableTool = tool(
        async ({ table, schema }, toolConfig) => {
          webconsole.info("POSTGRES CHECK TABLE TOOL | Invoking tool");

          try {
            const result = await this.executeCheckTable(
              table,
              schema || "public",
              connectionString,
              webconsole
            );

            this.setCredit(this.getCredit() + 3);

            return [
              JSON.stringify({
                exists: result.exists,
                columns: result.columns,
                tableSize: result.tableSize,
                indexes: result.indexes,
              }),
              this.getCredit(),
            ];
          } catch (error) {
            this.setCredit(this.getCredit() - 3);
            webconsole.error(
              `POSTGRES CHECK TABLE TOOL | Error: ${error.message}`
            );
            return [
              JSON.stringify({
                exists: false,
                columns: [],
                tableSize: "0 bytes",
                indexes: [],
                error: error.message,
              }),
              this.getCredit(),
            ];
          }
        },
        {
          name: "postgresCheckTableTool",
          description:
            "Check if a PostgreSQL table exists and retrieve its metadata including columns (with types, nullable status, defaults), table size, and indexes. Returns detailed information about the table structure.",
          schema: z.object({
            table: z.string().describe("Name of the table to check"),
            schema: z
              .string()
              .optional()
              .describe("Schema name (optional, defaults to 'public')"),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      webconsole.info("Postgres Check Table Node | Begin execution");

      const table = getValue("Table");
      const schema = getValue("Schema", "public");

      // If no table provided, return only the tool
      if (!table) {
        webconsole.info(
          "Postgres Check Table Node | No table provided, returning tool only"
        );
        this.setCredit(0);
        return {
          exists: false,
          columns: null,
          tableSize: null,
          indexes: null,
          Tool: postgresCheckTableTool,
        };
      }

      // Execute the check table operation directly
      const result = await this.executeCheckTable(
        table,
        schema || "public",
        connectionString,
        webconsole
      );

      return {
        exists: result.exists,
        columns: result.columns,
        tableSize: result.tableSize,
        indexes: result.indexes,
        Tool: postgresCheckTableTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("Postgres Check Table Node | Error: " + error.message);
      return {
        exists: false,
        columns: null,
        tableSize: null,
        indexes: null,
        Tool: null,
      };
    }
  }
}

export default postgres_check_table_node;
