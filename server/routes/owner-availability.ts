import type { RequestHandler } from "express";
import { databaseReady, pool } from "../db";
import { requireOwnerSalon } from "../middleware/auth";
import { availabilitySchema } from "../validators/availability";

export const handleOwnerAvailability: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const result = await pool.query(
      `SELECT day_of_week, start_time, end_time, is_available
       FROM availability WHERE salon_id = $1 ORDER BY day_of_week, start_time`,
      [owner.salonId],
    );
    res.json({
      availability: result.rows.map((row) => ({
        dayOfWeek: Number(row.day_of_week),
        startTime: String(row.start_time).slice(0, 5),
        endTime: String(row.end_time).slice(0, 5),
        isAvailable: row.is_available !== false,
      })),
    });
  } catch (error: unknown) {
    console.error(
      "Owner availability query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "زمان‌بندی سالن در دسترس نیست" });
  }
};

export const handleOwnerSaveAvailability: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = availabilitySchema.safeParse({
    ...req.body,
    dayOfWeek: Number(req.body?.dayOfWeek),
  });
  if (!parsed.success) {
    res.status(400).json({ message: "اطلاعات زمان‌بندی معتبر نیست" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM availability WHERE salon_id = $1 AND day_of_week = $2",
        [owner.salonId, parsed.data.dayOfWeek],
      );
      for (const slot of parsed.data.slots) {
        await client.query(
          `INSERT INTO availability (salon_id, day_of_week, start_time, end_time, is_available)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            owner.salonId,
            parsed.data.dayOfWeek,
            slot.startTime,
            slot.endTime,
            slot.isAvailable,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    res.json({ dayOfWeek: parsed.data.dayOfWeek, slots: parsed.data.slots });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(400).json({ message: "زمان‌های تکراری قابل ذخیره نیستند" });
      return;
    }
    console.error(
      "Owner availability update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "ذخیره زمان‌بندی انجام نشد" });
  }
};
