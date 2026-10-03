import type { RequestHandler } from "express";
import { databaseReady, pool } from "../db";
import { requireOwnerSalon } from "../middleware/auth";
import { settingsSchema } from "../validators/misc";

export const handleOwnerSettings: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const result = await pool.query(
      `SELECT cancellation_window_hours, cancellation_policy, deposit_type, deposit_value
       FROM salons WHERE id = $1`,
      [owner.salonId],
    );
    if (!result.rowCount) {
      res.status(404).json({ message: "سالن پیدا نشد" });
      return;
    }
    res.json({
      cancellationWindowHours: Number(result.rows[0].cancellation_window_hours),
      cancellationPolicy: String(result.rows[0].cancellation_policy),
      depositType: String(result.rows[0].deposit_type),
      depositValue: Number(result.rows[0].deposit_value),
    });
  } catch (error: unknown) {
    console.error(
      "Owner settings query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "تنظیمات سالن در دسترس نیست" });
  }
};

export const handleOwnerUpdateSettings: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "قوانین لغو معتبر نیستند" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const result = await pool.query(
      `UPDATE salons SET cancellation_window_hours = $1, cancellation_policy = $2,
                         deposit_type = $3, deposit_value = $4
       WHERE id = $5
       RETURNING cancellation_window_hours, cancellation_policy, deposit_type, deposit_value`,
      [
        parsed.data.cancellationWindowHours,
        parsed.data.cancellationPolicy,
        parsed.data.depositType,
        parsed.data.depositValue,
        owner.salonId,
      ],
    );
    if (!result.rowCount) {
      res.status(404).json({ message: "سالن پیدا نشد" });
      return;
    }
    res.json({
      cancellationWindowHours: Number(result.rows[0].cancellation_window_hours),
      cancellationPolicy: String(result.rows[0].cancellation_policy),
      depositType: String(result.rows[0].deposit_type),
      depositValue: Number(result.rows[0].deposit_value),
    });
  } catch (error: unknown) {
    console.error(
      "Owner settings update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "ذخیره قوانین لغو انجام نشد" });
  }
};
