import type { RequestHandler } from "express";
import { databaseReady, pool } from "../db";
import { requireOwnerSalon } from "../middleware/auth";
import {
  calendarDateSchema as dateSchema,
  calendarStatusSchema as statusSchema,
} from "../validators/misc";

function mapBooking(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    customerPhone: String(row.customer_phone),
    serviceTitle: String(row.service_title),
    staffId: row.staff_id ? String(row.staff_id) : null,
    staffName: row.staff_name ? String(row.staff_name) : null,
    price: Number(row.price),
    durationMinutes: Number(row.duration_minutes),
    appointmentDate: String(row.appointment_date),
    appointmentTime: String(row.appointment_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    status: String(row.status),
  };
}

export const handleOwnerCalendar: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  const staffId =
    typeof req.query.staffId === "string" ? req.query.staffId : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const parsedStatus = status ? statusSchema.safeParse(status) : null;
  if (
    !dateSchema.safeParse(from).success ||
    !dateSchema.safeParse(to).success ||
    (parsedStatus && !parsedStatus.success)
  ) {
    res.status(400).json({ message: "بازه یا فیلتر تقویم معتبر نیست" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const range = await pool.query(
      `SELECT ($2::date - $1::date) AS day_count`,
      [from, to],
    );
    if (
      Number(range.rows[0].day_count) < 0 ||
      Number(range.rows[0].day_count) > 31
    ) {
      res.status(400).json({ message: "بازه تقویم باید حداکثر ۳۱ روز باشد" });
      return;
    }
    if (staffId) {
      const staff = await pool.query(
        `SELECT 1 FROM staff WHERE id = $1 AND salon_id = $2`,
        [staffId, owner.salonId],
      );
      if (!staff.rowCount) {
        res.status(404).json({ message: "پرسنل سالن پیدا نشد" });
        return;
      }
    }
    const [bookings, capacity] = await Promise.all([
      pool.query(
        `SELECT b.id, b.customer_phone, v.title AS service_title,
                b.staff_id, st.name AS staff_name, v.price, v.duration_minutes,
                b.appointment_date, b.appointment_time,
                (b.appointment_time + (v.duration_minutes * INTERVAL '1 minute')) AS end_time,
                b.status
         FROM bookings b
         JOIN services v ON v.id = b.service_id
         LEFT JOIN staff st ON st.id = b.staff_id
         WHERE b.salon_id = $1
           AND b.appointment_date BETWEEN $2::date AND $3::date
           AND ($4::text = '' OR b.staff_id = $4)
           AND ($5::text = '' OR b.status = $5)
         ORDER BY b.appointment_date, b.appointment_time`,
        [owner.salonId, from, to, staffId, status],
      ),
      pool.query(
        `WITH days AS (
           SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS calendar_date
         ), active_staff AS (
           SELECT st.id, st.name
           FROM staff st
           WHERE st.salon_id = $3 AND st.is_active = TRUE
           UNION ALL
           SELECT NULL::text, 'کل سالن'
           WHERE NOT EXISTS (
             SELECT 1 FROM staff st WHERE st.salon_id = $3 AND st.is_active = TRUE
           )
         ), daily_capacity AS (
           SELECT d.calendar_date, st.id AS staff_id, st.name AS staff_name,
                  CASE
                    WHEN EXISTS (
                      SELECT 1 FROM availability_exceptions e
                      WHERE e.salon_id = $3 AND e.exception_date = d.calendar_date AND e.is_closed = TRUE
                    ) THEN 0
                    WHEN EXISTS (
                      SELECT 1 FROM availability_exceptions e
                      WHERE e.salon_id = $3 AND e.exception_date = d.calendar_date AND e.start_time IS NOT NULL
                    ) THEN COALESCE((
                      SELECT SUM(EXTRACT(EPOCH FROM (e.end_time - e.start_time)) / 60)
                      FROM availability_exceptions e
                      WHERE e.salon_id = $3 AND e.exception_date = d.calendar_date
                        AND e.start_time IS NOT NULL AND e.is_available = TRUE
                    ), 0)
                    WHEN EXISTS (
                      SELECT 1 FROM staff_availability_exceptions e
                      WHERE e.staff_id = st.id AND e.exception_date = d.calendar_date AND e.is_closed = TRUE
                    ) THEN 0
                    WHEN EXISTS (
                      SELECT 1 FROM staff_availability_exceptions e
                      WHERE e.staff_id = st.id AND e.exception_date = d.calendar_date AND e.start_time IS NOT NULL
                    ) THEN COALESCE((
                      SELECT SUM(EXTRACT(EPOCH FROM (e.end_time - e.start_time)) / 60)
                      FROM staff_availability_exceptions e
                      WHERE e.staff_id = st.id AND e.exception_date = d.calendar_date
                        AND e.start_time IS NOT NULL AND e.is_available = TRUE
                    ), 0)
                    WHEN EXISTS (
                      SELECT 1 FROM staff_availability sa
                      WHERE sa.staff_id = st.id
                        AND sa.day_of_week = ((EXTRACT(DOW FROM d.calendar_date)::int + 1) % 7)
                    ) THEN COALESCE((
                      SELECT SUM(EXTRACT(EPOCH FROM (sa.end_time - sa.start_time)) / 60)
                      FROM staff_availability sa
                      WHERE sa.staff_id = st.id
                        AND sa.day_of_week = ((EXTRACT(DOW FROM d.calendar_date)::int + 1) % 7)
                        AND sa.is_available = TRUE
                    ), 0)
                    ELSE COALESCE((
                      SELECT SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 60)
                      FROM availability a
                      WHERE a.salon_id = $3
                        AND a.day_of_week = ((EXTRACT(DOW FROM d.calendar_date)::int + 1) % 7)
                        AND a.is_available = TRUE
                    ), 0)
                  END AS capacity_minutes
           FROM days d CROSS JOIN active_staff st
         )
         SELECT calendar_date, staff_id, staff_name, capacity_minutes,
                COALESCE((
                  SELECT SUM(v.duration_minutes)
                  FROM bookings b JOIN services v ON v.id = b.service_id
                  WHERE b.salon_id = $3
                    AND (b.staff_id = daily_capacity.staff_id OR b.staff_id IS NULL)
                    AND b.appointment_date = daily_capacity.calendar_date
                    AND b.status IN ('pending', 'confirmed')
                ), 0) AS booked_minutes
         FROM daily_capacity
         ORDER BY calendar_date, staff_name`,
        [from, to, owner.salonId],
      ),
    ]);
    res.json({
      bookings: bookings.rows.map(mapBooking),
      capacity: capacity.rows.map((row) => ({
        date: String(row.calendar_date),
        staffId: row.staff_id ? String(row.staff_id) : null,
        staffName: String(row.staff_name),
        capacityMinutes: Number(row.capacity_minutes),
        bookedMinutes: Number(row.booked_minutes),
        availableMinutes: Math.max(
          0,
          Number(row.capacity_minutes) - Number(row.booked_minutes),
        ),
      })),
    });
  } catch (error: unknown) {
    console.error(
      "Owner calendar query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "تقویم سالن در دسترس نیست" });
  }
};
