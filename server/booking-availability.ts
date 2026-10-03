import type { QueryResult } from "pg";

interface Queryable {
  query: (text: string, values?: unknown[]) => Promise<QueryResult<Record<string, unknown>>>;
}

export interface AvailabilityQuery {
  salonId: string;
  date: string;
  staffId?: string | null;
  durationMinutes?: number;
  excludeBookingId?: string;
}

export async function getAvailableSlots(db: Queryable, options: AvailabilityQuery) {
  const { salonId, date, staffId = null, durationMinutes = 60, excludeBookingId = "" } = options;
  return db.query(
    `WITH exceptions AS (
       SELECT is_closed, start_time, end_time, is_available
       FROM availability_exceptions
       WHERE salon_id = $1 AND exception_date = $2::date
     ), staff_exceptions AS (
       SELECT is_closed, start_time, end_time, is_available
       FROM staff_availability_exceptions
       WHERE $3::text <> '' AND staff_id = $3 AND exception_date = $2::date
     ), base_slots AS (
       SELECT sa.start_time, sa.end_time, sa.is_available
       FROM staff_availability sa
       WHERE $3::text <> ''
         AND sa.staff_id = $3
         AND sa.day_of_week = ((EXTRACT(DOW FROM $2::date)::int + 1) % 7)
         AND NOT EXISTS (SELECT 1 FROM exceptions)
         AND NOT EXISTS (SELECT 1 FROM staff_exceptions)
       UNION ALL
       SELECT a.start_time, a.end_time, a.is_available
       FROM availability a
       WHERE a.salon_id = $1
         AND a.day_of_week = ((EXTRACT(DOW FROM $2::date)::int + 1) % 7)
         AND NOT EXISTS (
           SELECT 1
           FROM staff_availability sa
           WHERE $3::text <> '' AND sa.staff_id = $3 AND sa.day_of_week = a.day_of_week
         )
         AND NOT EXISTS (SELECT 1 FROM exceptions)
         AND NOT EXISTS (SELECT 1 FROM staff_exceptions)
       UNION ALL
       SELECT e.start_time, e.end_time, e.is_available
       FROM exceptions e
       WHERE e.is_closed = FALSE AND e.start_time IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM staff_exceptions)
       UNION ALL
       SELECT e.start_time, e.end_time, e.is_available
       FROM staff_exceptions e
       WHERE e.is_closed = FALSE AND e.start_time IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM exceptions)
     ), appointment_slots AS (
       SELECT generated.start_at::time AS start_time,
              (generated.start_at + ($4::int * INTERVAL '1 minute'))::time AS end_time,
              base.is_available,
              generated.start_at AS booking_start,
              generated.start_at + ($4::int * INTERVAL '1 minute') AS booking_end
       FROM base_slots base
       CROSS JOIN LATERAL generate_series(
         $2::date + base.start_time,
         $2::date + base.end_time - ($4::int * INTERVAL '1 minute'),
         INTERVAL '30 minutes'
       ) AS generated(start_at)
       WHERE $4::int > 0
       UNION ALL
       SELECT base.start_time, base.end_time, base.is_available,
              $2::date + base.start_time,
              $2::date + base.start_time + INTERVAL '1 minute'
       FROM base_slots base
       WHERE $4::int = 0
     )
     SELECT ((EXTRACT(DOW FROM $2::date)::int + 1) % 7) AS day_of_week,
            appointment_slots.start_time, appointment_slots.end_time, appointment_slots.is_available,
            EXISTS (
              SELECT 1
              FROM bookings b
              JOIN services booked_service ON booked_service.id = b.service_id
              WHERE b.salon_id = $1
                AND b.appointment_date = $2::date
                AND b.status IN ('pending', 'confirmed')
                AND ($3::text = '' OR b.staff_id IS NULL OR b.staff_id = $3)
                AND ($5::text = '' OR b.id::text <> $5)
                AND ($2::date + b.appointment_time) < appointment_slots.booking_end
                AND ($2::date + b.appointment_time + (booked_service.duration_minutes * INTERVAL '1 minute')) > appointment_slots.booking_start
            ) AS is_booked
     FROM appointment_slots
     ORDER BY appointment_slots.start_time`,
    [salonId, date, staffId ?? "", Math.max(0, Math.trunc(durationMinutes)), excludeBookingId],
  );
}

export async function getServiceDuration(db: Queryable, salonId: string, serviceId: string) {
  const result = await db.query(
    `SELECT duration_minutes
     FROM services
     WHERE id = $1 AND salon_id = $2 AND is_active = TRUE`,
    [serviceId, salonId],
  );
  return result.rowCount ? Number(result.rows[0].duration_minutes) : null;
}
