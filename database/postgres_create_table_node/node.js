import BaseNode from "../../core/BaseNode/node.js";
import pg from "pg";

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
      webconsole.info("Postgres Create Table Node | Begin execution");

      const table = getValue("Table");
      const schema = getValue("Schema", "public") || "public";
      const columnsRaw = getValue("Columns");
      const ifNotExists = getValue("IfNotExists", true) || true;
      const connectionString = serverData.envList?.PG_CONNECTION_STRING;

      if (!connectionString) {
        webconsole.error(
          "Postgres Create Table Node | Environment variable PG_CONNECTION_STRING is not set."
        );
        return null;
      }
      if (!table) {
        webconsole.error(
          "Postgres Create Table Node | 'Table' name is a required field."
        );
        return null;
      }

      // Parse columns
      let columns = [];
      if (Array.isArray(columnsRaw)) {
        columns = columnsRaw;
      } else if (typeof columnsRaw === "string") {
        try {
          columns = JSON.parse(columnsRaw);
          if (!Array.isArray(columns)) {
            throw new Error("Parsed JSON is not an array.");
          }
        } catch (e) {
          webconsole.error(
            `Postgres Create Table Node | Failed to parse Columns. Please ensure it's a valid JSON array. Error: ${e.message}`
          );
          return null;
        }
      }

      if (columns.length === 0) {
        webconsole.error(
          "Postgres Create Table Node | At least one column is required."
        );
        return null;
      }

      // Validate column structure
      for (const col of columns) {
        if (!col.name || !col.type) {
          webconsole.error(
            `Postgres Create Table Node | Each column must have 'name' and 'type' properties. Invalid column: ${JSON.stringify(
              col
            )}`
          );
          return null;
        }
      }

      client = new pg.Client({ connectionString });
      await client.connect();

      const safeSchema = client.escapeIdentifier(schema);
      const safeTable = client.escapeIdentifier(table);
      const fullTableName = `${safeSchema}.${safeTable}`;

      // Build column definitions
      const columnDefs = columns
        .map((col) => {
          const safeName = client.escapeIdentifier(col.name);
          const constraints = col.constraints ? ` ${col.constraints}` : "";
          return `${safeName} ${col.type}${constraints}`;
        })
        .join(", ");

      // Build CREATE TABLE query
      const ifNotExistsClause = ifNotExists ? "IF NOT EXISTS " : "";
      const createQuery = `CREATE TABLE ${ifNotExistsClause}${fullTableName} (${columnDefs});`;

      webconsole.info(`Executing: ${createQuery}`);

      await client.query(createQuery);

      const successMessage = `Table '${schema}.${table}' created successfully with ${columns.length} column(s).`;
      webconsole.success(successMessage);

      return {
        success: true,
        tableName: `${schema}.${table}`,
        message: successMessage,
        Credits: this.getCredit(),
      };
    } catch (error) {
      const errorMessage = `Failed to create table: ${error.message}`;
      webconsole.error("Postgres Create Table Node | " + errorMessage);
      return {
        success: false,
        tableName: null,
        message: errorMessage,
        Credits: this.getCredit(),
      };
    } finally {
      if (client) {
        await client.end();
        webconsole.info("Connection to database closed.");
      }
    }
  }
}

export default postgres_create_table_node;
