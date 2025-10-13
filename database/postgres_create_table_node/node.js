import BaseNode from "../../core/BaseNode/node.js";
import pg from "pg";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const config = {
  title: "PostgreSQL - Create Table",
  category: "database",
  type: "postgres_create_table_node",
  icon: {},
  desc: "Create a new table in PostgreSQL database",
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
      desc: "Name of the table to create",
    },
    {
      name: "Schema",
      type: "Text",
      desc: "Schema name (optional, defaults to 'public')",
    },
    {
      name: "Columns",
      type: "JSON",
      desc: "Array of column definitions [{name, type, constraints}]",
    },
    {
      name: "IfNotExists",
      type: "Boolean",
      desc: "Add IF NOT EXISTS clause to prevent errors if table exists",
    },
  ],
  outputs: [
    {
      name: "success",
      type: "Boolean",
      desc: "Whether the table was created successfully",
    },
    {
      name: "tableName",
      type: "Text",
      desc: "The full name of the created table (schema.table)",
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
      name: "Table",
      type: "Text",
      desc: "Name of the table to create",
      value: "users",
    },
    {
      name: "Schema",
      type: "Text",
      value: "public",
      desc: "Schema name (optional, defaults to 'public')",
    },
    {
      name: "Columns",
      type: "Map",
      desc: "Array of column definitions [{name, type, constraints}]",
    },
    {
      name: "IfNotExists",
      type: "Boolean",
      value: true,
      desc: "Add IF NOT EXISTS clause to prevent errors if table exists",
    },
    {
      desc: "Postgres connection string",
      name: "PG_CONNECTION_STRING",
      type: "env",
      defaultValue: "postgres://user:password@localhost:5432/dbname",
    },
  ],
  difficulty: "hard",
  tags: ["postgres", "database", "create", "table", "ddl"],
};

class postgres_create_table_node extends BaseNode {
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
   * Parse columns from various input formats
   * @private
   */
  parseColumns(columnsRaw, webconsole) {
    let columns = [];

    if (Array.isArray(columnsRaw)) {
      columns = columnsRaw;
    } else if (typeof columnsRaw === "object" && columnsRaw !== null) {
      try {
        columns = [columnsRaw];
      } catch (e) {
        throw new Error(`Failed to parse Columns: ${e.message}`);
      }
    } else if (typeof columnsRaw === "string") {
      try {
        const parsed = JSON.parse(columnsRaw);
        columns = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        throw new Error(`Failed to parse Columns string: ${e.message}`);
      }
    }

    if (columns.length === 0) {
      throw new Error("At least one column is required.");
    }

    return columns.map((col) => ({
      name: Object.keys(col)[0],
      type: Object.values(col)[0],
    }));
  }

  /**
   * Execute create table operation
   * @private
   */
  async executeCreateTable(
    table,
    schema,
    columnsRaw,
    ifNotExists,
    connectionString,
    webconsole
  ) {
    let client;

    try {
      const columnFilter = this.parseColumns(columnsRaw, webconsole);

      client = new pg.Client({ connectionString });
      await client.connect();

      const safeSchema = client.escapeIdentifier(schema || "public");
      const safeTable = client.escapeIdentifier(table);
      const fullTableName = `${safeSchema}.${safeTable}`;

      // Build column definitions
      const columnDefs = columnFilter
        .map((col) => {
          const safeName = client.escapeIdentifier(col.name);
          return `${safeName} ${col.type}`;
        })
        .join(", ");

      // Build CREATE TABLE query
      const ifNotExistsClause = ifNotExists ? "IF NOT EXISTS " : "";
      const createQuery = `CREATE TABLE ${ifNotExistsClause}${fullTableName} (${columnDefs});`;

      webconsole.info(`Executing: ${createQuery}`);

      await client.query(createQuery);

      const successMessage = `Table '${
        schema || "public"
      }.${table}' created successfully with ${columnFilter.length} column(s).`;
      webconsole.success(successMessage);

      return {
        success: true,
        tableName: `${schema || "public"}.${table}`,
        message: successMessage,
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
      webconsole.info("Postgres Create Table Node | Generating tool...");

      const connectionString = serverData.envList?.PG_CONNECTION_STRING;

      if (!connectionString) {
        this.setCredit(0);
        webconsole.error(
          "Postgres Create Table Node | Environment variable PG_CONNECTION_STRING is not set."
        );
        return {
          success: false,
          tableName: null,
          message: "Database connection string not configured",
          Tool: null,
        };
      }

      // Create the tool
      const postgresCreateTableTool = tool(
        async ({ table, schema, columns, ifNotExists }, toolConfig) => {
          webconsole.info("POSTGRES CREATE TABLE TOOL | Invoking tool");

          try {
            const result = await this.executeCreateTable(
              table,
              schema || "public",
              columns,
              ifNotExists !== false, // Default to true
              connectionString,
              webconsole
            );

            this.setCredit(this.getCredit() + 5);

            return [
              JSON.stringify({
                success: result.success,
                tableName: result.tableName,
                message: result.message,
              }),
              this.getCredit(),
            ];
          } catch (error) {
            this.setCredit(this.getCredit() - 5);
            webconsole.error(
              `POSTGRES CREATE TABLE TOOL | Error: ${error.message}`
            );
            return [
              JSON.stringify({
                success: false,
                tableName: null,
                message: `Failed to create table: ${error.message}`,
              }),
              this.getCredit(),
            ];
          }
        },
        {
          name: "postgresCreateTableTool",
          description:
            "Create a new table in PostgreSQL database with specified columns. Each column should be an object with name as key and SQL type as value, e.g., {id: 'SERIAL PRIMARY KEY', name: 'VARCHAR(100) NOT NULL'}",
          schema: z.object({
            table: z.string().describe("Name of the table to create"),
            schema: z
              .string()
              .optional()
              .describe("Schema name (optional, defaults to 'public')"),
            columns: z
              .union([z.array(z.record(z.string())), z.string()])
              .describe(
                "Array of column definitions where each object has column name as key and SQL type as value, e.g., [{id: 'SERIAL PRIMARY KEY'}, {name: 'VARCHAR(100)'}]"
              ),
            ifNotExists: z
              .boolean()
              .optional()
              .describe(
                "Add IF NOT EXISTS clause to prevent errors if table exists (default: true)"
              ),
          }),
          responseFormat: "content_and_artifact",
        }
      );

      webconsole.info("Postgres Create Table Node | Begin execution");

      const table = getValue("Table");
      const schema = getValue("Schema", "public");
      const columnsRaw = getValue("Columns");
      const ifNotExists = getValue("IfNotExists", true);

      // If no table or columns provided, return only the tool
      if (!table || !columnsRaw) {
        webconsole.info(
          "Postgres Create Table Node | Missing table or columns, returning tool only"
        );
        this.setCredit(0);
        return {
          success: false,
          tableName: null,
          message: "No table or columns provided",
          Tool: postgresCreateTableTool,
        };
      }

      // Execute the create table operation directly
      const result = await this.executeCreateTable(
        table,
        schema,
        columnsRaw,
        ifNotExists !== false,
        connectionString,
        webconsole
      );

      return {
        success: result.success,
        tableName: result.tableName,
        message: result.message,
        Tool: postgresCreateTableTool,
        Credits: this.getCredit(),
      };
    } catch (error) {
      this.setCredit(0);
      const errorMessage = `Failed to create table: ${error.message}`;
      webconsole.error("Postgres Create Table Node | " + errorMessage);
      return {
        success: false,
        tableName: null,
        message: errorMessage,
        Tool: null,
      };
    }
  }
}

export default postgres_create_table_node;
