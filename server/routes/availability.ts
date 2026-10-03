import type { RequestHandler } from "express";
import { databaseReady, pool } from "../db";
import { getAvailableSlots, getServiceDuration } from "../booking-availability";

export const handleSalonAvailability: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const date =
    typeof req.query.date === "string"
      ? req.query.date
      : new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ message: "تاریخ معتبر نیست" });
    return;
  }
  try {
    await databaseReady;
    const salonId = String(req.params.id);
    const staffId =
      typeof req.query.staffId === "string" ? req.query.staffId : null;
    const serviceId =
      typeof req.query.serviceId === "string" ? req.query.serviceId : "";
    let durationMinutes = 60;
    if (serviceId) {
      const serviceDuration = await getServiceDuration(
        pool,
        salonId,
        serviceId,
      );
      if (serviceDuration === null) {
        res.status(404).json({ message: "خدمت سالن پیدا نشد" });
        return;
      }
      durationMinutes = serviceDuration;
    }
    if (staffId) {
      const staff = await pool.query(
        `SELECT 1 FROM staff st JOIN salons s ON s.id = st.salon_id
         WHERE st.id = $2 AND st.salon_id = $1 AND st.is_active = TRUE
           AND s.is_active = TRUE AND s.approval_status = 'approved'`,
        [salonId, staffId],
      );
      if (!staff.rowCount) {
        res.status(404).json({ message: "پرسنل سالن پیدا نشد" });
        return;
      }
    }
    const result = await getAvailableSlots(pool, {
      salonId,
      date,
      staffId,
      durationMinutes,
    });
    res.json({
      availability: result.rows.map((row) => ({
        dayOfWeek: Number(row.day_of_week),
        startTime: String(row.start_time).slice(0, 5),
        endTime: String(row.end_time).slice(0, 5),
        isAvailable: row.is_available !== false,
        isBooked: row.is_booked === true,
      })),
    });
  } catch (error: unknown) {
    console.error(
      "Public availability query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "زمان‌های خالی سالن در دسترس نیست" });
  }
};
