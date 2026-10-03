import type { Pool, PoolClient } from "pg";
import {
  name as initialSchemaName,
  up as initialSchemaUp,
  version as initialSchemaVersion,
} from "./001_initial_schema";

type Migration = {
  version: string;
  name: string;
  up: (client: PoolClient) => Promise<void>;
};

const migrations: Migration[] = [
  {
    version: initialSchemaVersion,
    name: initialSchemaName,
    up: initialSchemaUp,
  },
];

export async function runMigrations(pool: Pool) {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    for (const migration of migrations) {
      await client.query("BEGIN");

      try {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          "nobato:schema-migrations",
        ]);
        const applied = await client.query(
          "SELECT 1 FROM schema_migrations WHERE version = $1",
          [migration.version],
        );

        if (!applied.rowCount) {
          await migration.up(client);
          await client.query(
            "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
            [migration.version, migration.name],
          );
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }
}
