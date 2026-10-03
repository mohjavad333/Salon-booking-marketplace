import type { RequestHandler } from "express";
import { pool } from "../db";
import { requireOwnerSalon } from "../middleware/auth";
import { getOwnerReport } from "../services/owner-report-service";
import { reportRangeSchema as rangeSchema } from "../validators/misc";

export const handleOwnerReports: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = rangeSchema.safeParse(req.query.days ?? 30);
  if (!parsed.success) {
    res.status(400).json({ message: "بازه گزارش معتبر نیست" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    res.json(await getOwnerReport(owner.salonId, parsed.data));
  } catch (error: unknown) {
    console.error(
      "Owner reports query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "گزارش‌های سالن در دسترس نیست" });
  }
};
