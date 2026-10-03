import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAvailableSlots } from "./booking-availability";
import { runMigrations } from "./migrations";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const databaseSuite = describe.skipIf(!hasDatabase);

databaseSuite("PostgreSQL migrations and booking transactions", () => {
  const schema = `test_${randomBytes(6).toString("hex")}`;
  let adminPool: Pool;
  let testPool: Pool;
  let concurrentPool: Pool;

  beforeAll(async () => {
    adminPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      allowExitOnIdle: true,
    });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);

    testPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      allowExitOnIdle: true,
    });
    concurrentPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      allowExitOnIdle: true,
    });
    await testPool.query(`SET search_path TO "${schema}", public`);
    await concurrentPool.query(`SET search_path TO "${schema}", public`);
  });

  afterAll(async () => {
    await testPool.end();
    await concurrentPool.end();
    await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await adminPool.end();
  }, 30_000);

  it("applies migrations concurrently and remains idempotent", async () => {
    await Promise.all([runMigrations(testPool), runMigrations(concurrentPool)]);

    const migrationResult = await testPool.query(
      "SELECT version, name FROM schema_migrations ORDER BY version",
    );
    expect(migrationResult.rows).toEqual([
      { version: "001", name: "initial_schema" },
    ]);

    const tables = await testPool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    const tableNames = tables.rows.map((row) => row.table_name);
    expect(tableNames).toHaveLength(17);
    expect(tableNames).toEqual(
      expect.arrayContaining([
        "availability",
        "availability_exceptions",
        "bookings",
        "favorites",
        "notifications",
        "notification_preferences",
        "payments",
        "reviews",
        "schema_migrations",
        "service_staff",
        "services",
        "sessions",
        "staff",
        "staff_availability",
        "staff_availability_exceptions",
        "salons",
        "users",
      ]),
    );

    await runMigrations(testPool);
    const repeatedMigrationResult = await testPool.query(
      "SELECT COUNT(*)::int AS count FROM schema_migrations",
    );
    expect(repeatedMigrationResult.rows[0].count).toBe(1);
  }, 30_000);

  it("allows only one overlapping booking through the transaction lock", async () => {
    await testPool.query("TRUNCATE TABLE salons CASCADE");
    await testPool.query(
      `INSERT INTO salons (id, name, city, area, category, image)
       VALUES ('concurrency-salon', 'Concurrency Salon', 'تهران', 'ونک', 'تست', 'test')`,
    );
    await testPool.query(
      `INSERT INTO services (id, salon_id, title, duration_minutes, price)
       VALUES ('concurrency-service', 'concurrency-salon', 'Test service', 60, 100)`,
    );
    await testPool.query(
      `INSERT INTO availability (salon_id, day_of_week, start_time, end_time)
       VALUES ('concurrency-salon', 1, '09:00', '10:00')`,
    );

    const date = "2026-04-05";
    const bookingAttempts = [testPool, concurrentPool].map((pool) =>
      createLockedBooking(pool, date),
    );
    const results = await Promise.all(bookingAttempts);

    expect(results.sort()).toEqual([false, true]);

    const bookings = await testPool.query(
      `SELECT COUNT(*)::int AS count
       FROM bookings
       WHERE salon_id = 'concurrency-salon' AND appointment_date = $1`,
      [date],
    );
    expect(bookings.rows[0].count).toBe(1);
  }, 30_000);
});

async function createLockedBooking(pool: Pool, date: string) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      ["concurrency-salon", date],
    );

    const availability = await getAvailableSlots(client, {
      salonId: "concurrency-salon",
      date,
      durationMinutes: 60,
    });
    const slot = availability.rows.find(
      (row) =>
        String(row.start_time).slice(0, 5) === "09:00" &&
        row.is_available === true &&
        row.is_booked === false,
    );

    if (!slot) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(
      `INSERT INTO bookings
        (salon_id, service_id, customer_phone, appointment_date, appointment_time, status)
       VALUES ($1, $2, $3, $4, $5, 'confirmed')`,
      [
        "concurrency-salon",
        "concurrency-service",
        "09120000000",
        date,
        "09:00",
      ],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
