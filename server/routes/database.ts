import type { RequestHandler } from "express";
import { databaseReady, pool } from "../db";

export const handleDatabaseHealth: RequestHandler = async (_req, res) => {
  if (!pool) {
    res
      .status(503)
      .json({ connected: false, message: "DATABASE_URL is not configured" });
    return;
  }

  try {
    await databaseReady;
    await pool.query("SELECT 1");
    res.json({ connected: true, message: "PostgreSQL connection is healthy" });
  } catch (error) {
    console.error(
      "PostgreSQL health check failed:",
      error instanceof Error ? error.message : error,
    );
    res
      .status(503)
      .json({ connected: false, message: "PostgreSQL connection failed" });
  }
};
