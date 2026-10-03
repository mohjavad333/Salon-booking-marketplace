import type { RequestHandler } from "express";
import { databaseReady, pool } from "../db";
import { requireOwnerSalon } from "../middleware/auth";
import { staffScheduleSchema as scheduleSchema } from "../validators/staff";

async function ownedStaff(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
) {
  const owner = await requireOwnerSalon(req, res);
  if (!owner || !pool) return null;
  const result = await pool.query(
    "SELECT id, name FROM staff WHERE id = $1 AND salon_id = $2",
    [req.params.staffId, owner.salonId],
  );
  if (!result.rowCount) {
    res.status(404).json({ message: "پرسنل این سالن پیدا نشد" });
    return null;
  }
  return { ...owner, staff: result.rows[0] };
}

function mapSlot(row: Record<string, unknown>) {
  return {
    dayOfWeek: Number(row.day_of_week),
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    isAvailable: row.is_available !== false,
  };
}

export const handleOwnerStaffAvailability: RequestHandler = async (
  req,
  res,
) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  try {
    const owner = await ownedStaff(req, res);
    if (!owner) return;
    await databaseReady;
    const [custom, base] = await Promise.all([
      pool.query(
        `SELECT day_of_week, start_time, end_time, is_available FROM staff_availability WHERE staff_id = $1 ORDER BY day_of_week, start_time`,
        [req.params.staffId],
      ),
      pool.query(
        `SELECT day_of_week, start_time, end_time, is_available FROM availability WHERE salon_id = $1 ORDER BY day_of_week, start_time`,
        [owner.salonId],
      ),
    ]);
    res.json({
      staff: { id: String(owner.staff.id), name: String(owner.staff.name) },
      availability: custom.rows.map(mapSlot),
      baseAvailability: base.rows.map(mapSlot),
    });
  } catch (error: unknown) {
    console.error(
      "Staff availability query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "تقویم پرسنل در دسترس نیست" });
  }
};

export const handleOwnerSaveStaffAvailability: RequestHandler = async (
  req,
  res,
) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "اطلاعات تقویم پرسنل معتبر نیست" });
    return;
  }
  try {
    const owner = await ownedStaff(req, res);
    if (!owner) return;
    await databaseReady;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM staff_availability WHERE staff_id = $1 AND day_of_week = $2",
        [req.params.staffId, parsed.data.dayOfWeek],
      );
      for (const slot of parsed.data.slots) {
        await client.query(
          `INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time, is_available) VALUES ($1, $2, $3, $4, $5)`,
          [
            req.params.staffId,
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
      "Staff availability update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "ذخیره تقویم پرسنل انجام نشد" });
  }
};
