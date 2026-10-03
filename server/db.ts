import pg from "pg";
import { runMigrations } from "./migrations";
import { seedDevelopmentData } from "./seed";

const { Pool } = pg;

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: true,
    })
  : null;

async function initializeDatabase() {
  if (!pool) return;

  await runMigrations(pool);

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.SEED_DEMO_DATA !== "false"
  ) {
    await seedDevelopmentData(pool);
  }
}

export const databaseReady = initializeDatabase().catch((error) => {
  console.error(
    "PostgreSQL initialization failed:",
    error instanceof Error ? error.message : error,
  );
  throw error;
});

void databaseReady.catch(() => undefined);
