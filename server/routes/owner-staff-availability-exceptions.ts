import type { RequestHandler } from "express";
import { databaseReady, pool } from "../db";
import { requireOwnerSalon } from "../middleware/auth";
import { exceptionSchema } from "../validators/availability";

function mapExceptions(rows: Array<Record<string, unknown>>) {
  const exceptions: Record<
    string,
    {
      date: string;
      isClosed: boolean;
      slots: Array<{
        startTime: string;
        endTime: string;
        isAvailable: boolean;
      }>;
    }
  > = {};
  for (const row of rows) {
    const date = String(row.exception_date);
    const current = exceptions[date] ?? {
      date,
      isClosed: row.is_closed === true,
      slots: [],
    };
    if (row.is_closed === true) current.isClosed = true;
    if (row.start_time !== null) {
      current.slots.push({
        startTime: String(row.start_time).slice(0, 5),
        endTime: String(row.end_time).slice(0, 5),
        isAvailable: row.is_available !== false,
      });
    }
    exceptions[date] = current;
  }
  return Object.values(exceptions).sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

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
  return owner;
}

export const handleOwnerStaffAvailabilityExceptions: RequestHandler = async (
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
    const result = await pool.query(
      `SELECT exception_date, is_closed, start_time, end_time, is_available
       FROM staff_availability_exceptions
       WHERE staff_id = $1
       ORDER BY exception_date, start_time NULLS FIRST`,
      [req.params.staffId],
    );
    res.json({ exceptions: mapExceptions(result.rows) });
  } catch (error: unknown) {
    console.error(
      "Staff availability exceptions query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "استثناهای تقویم پرسنل در دسترس نیستند" });
  }
};

export const handleOwnerSaveStaffAvailabilityException: RequestHandler = async (
  req,
  res,
) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = exceptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "اطلاعات استثنای تقویم پرسنل معتبر نیست" });
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
        "DELETE FROM staff_availability_exceptions WHERE staff_id = $1 AND exception_date = $2",
        [req.params.staffId, parsed.data.date],
      );
      if (parsed.data.isClosed) {
        await client.query(
          `INSERT INTO staff_availability_exceptions (staff_id, exception_date, is_closed)
           VALUES ($1, $2, TRUE)`,
          [req.params.staffId, parsed.data.date],
        );
      } else {
        for (const slot of parsed.data.slots) {
          await client.query(
            `INSERT INTO staff_availability_exceptions
             (staff_id, exception_date, is_closed, start_time, end_time, is_available)
             VALUES ($1, $2, FALSE, $3, $4, $5)`,
            [
              req.params.staffId,
              parsed.data.date,
              slot.startTime,
              slot.endTime,
              slot.isAvailable,
            ],
          );
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    res.json({ exception: parsed.data });
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
      "Staff availability exception update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "ذخیره استثنای تقویم پرسنل انجام نشد" });
  }
};
