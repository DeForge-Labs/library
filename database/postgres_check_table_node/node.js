import BaseNode from "../../core/BaseNode/node.js";
import pg from "pg";

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
      name: "rowCount",
      type: "Number",
      desc: "Approximate number of rows in the table",
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
      webconsole.info("Postgres Check Table Node | Begin execution");

      const table = getValue("Table");
      const schema = getValue("Schema", "public");
      const connectionString = serverData.envList?.PG_CONNECTION_STRING;

      if (!connectionString) {
        webconsole.error(
          "Postgres Check Table Node | Environment variable PG_CONNECTION_STRING is not set."
        );
        return null;
      }
      if (!table) {
        webconsole.error(
          "Postgres Check Table Node | 'Table' name is a required field."
        );
        return null;
      }

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
          rowCount: 0,
          tableSize: "0 bytes",
          indexes: [],
          Credits: this.getCredit(),
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

      // Get row count (approximate for large tables)
      const rowCountQuery = `
        SELECT n_live_tup as approximate_row_count
        FROM pg_stat_user_tables
        WHERE schemaname = $1 AND relname = $2;
      `;
      const rowCountResult = await client.query(rowCountQuery, [schema, table]);
      const rowCount = rowCountResult.rows[0]?.approximate_row_count || 0;

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
        `Table metadata retrieved: ${columns.length} columns, ~${rowCount} rows, ${tableSize}`
      );

      return {
        exists: true,
        columns: columns,
        rowCount: rowCount,
        tableSize: tableSize,
        indexes: indexes,
        Credits: this.getCredit(),
      };
    } catch (error) {
      webconsole.error("Postgres Check Table Node | Error: " + error.message);
      return null;
    } finally {
      if (client) {
        await client.end();
        webconsole.info("Connection to database closed.");
      }
    }
  }
}

export default postgres_check_table_node;
