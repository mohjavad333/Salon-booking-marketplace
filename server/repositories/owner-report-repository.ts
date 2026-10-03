import type { Pool } from "pg";

export async function findOwnerReportData(
  pool: Pool,
  salonId: string,
  days: number,
) {
  const [summary, services, staff, daily, transactions] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total_bookings,
              COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed_bookings,
              COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_bookings,
              COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_bookings,
              COUNT(*) FILTER (WHERE status = 'no_show')::int AS no_show_bookings,
              COALESCE(SUM(COALESCE(NULLIF(b.total_amount, 0), v.price)) FILTER (WHERE b.status IN ('confirmed', 'completed')), 0)::int AS gross_revenue,
              COALESCE(AVG(COALESCE(NULLIF(b.total_amount, 0), v.price)) FILTER (WHERE b.status IN ('confirmed', 'completed')), 0)::int AS average_ticket,
              COALESCE(SUM(b.deposit_amount) FILTER (WHERE b.status IN ('confirmed', 'completed')), 0)::int AS deposit_expected,
              COALESCE((SELECT SUM(p.amount) FROM payments p JOIN bookings pb ON pb.id = p.booking_id
                        WHERE pb.salon_id = $1 AND p.status = 'paid' AND p.payment_type IN ('deposit', 'full')
                          AND p.created_at >= NOW() - ($2 * INTERVAL '1 day')), 0)::int AS paid_amount,
              COALESCE((SELECT SUM(p.amount) FROM payments p JOIN bookings pb ON pb.id = p.booking_id
                        WHERE pb.salon_id = $1 AND p.status = 'pending'
                          AND p.payment_type IN ('deposit', 'full')
                          AND p.created_at >= NOW() - ($2 * INTERVAL '1 day')), 0)::int AS pending_amount,
              COALESCE((SELECT SUM(p.amount) FROM payments p JOIN bookings pb ON pb.id = p.booking_id
                        WHERE pb.salon_id = $1 AND p.payment_type = 'refund' AND p.status IN ('paid', 'refunded')
                          AND p.created_at >= NOW() - ($2 * INTERVAL '1 day')), 0)::int AS refunded_amount,
              COALESCE((SELECT COUNT(*) FROM payments p JOIN bookings pb ON pb.id = p.booking_id
                        WHERE pb.salon_id = $1 AND p.created_at >= NOW() - ($2 * INTERVAL '1 day')), 0)::int AS payment_count,
              COUNT(DISTINCT b.customer_id)::int AS unique_customers
       FROM bookings b JOIN services v ON v.id = b.service_id
       WHERE b.salon_id = $1 AND b.appointment_date >= CURRENT_DATE - ($2 * INTERVAL '1 day')`,
      [salonId, days],
    ),
    pool.query(
      `SELECT v.title, COUNT(b.id)::int AS bookings,
              COALESCE(SUM(v.price) FILTER (WHERE b.status IN ('confirmed', 'completed')), 0)::int AS revenue
       FROM services v LEFT JOIN bookings b ON b.service_id = v.id
         AND b.salon_id = $1 AND b.appointment_date >= CURRENT_DATE - ($2 * INTERVAL '1 day')
       WHERE v.salon_id = $1
       GROUP BY v.id, v.title
       ORDER BY bookings DESC, revenue DESC
       LIMIT 8`,
      [salonId, days],
    ),
    pool.query(
      `SELECT COALESCE(st.name, 'بدون پرسنل') AS name,
              COUNT(b.id)::int AS bookings,
              COUNT(b.id) FILTER (WHERE b.status = 'completed')::int AS completed_bookings,
              COALESCE(SUM(v.price) FILTER (WHERE b.status IN ('confirmed', 'completed')), 0)::int AS revenue
       FROM bookings b
       JOIN services v ON v.id = b.service_id
       LEFT JOIN staff st ON st.id = b.staff_id
       WHERE b.salon_id = $1 AND b.appointment_date >= CURRENT_DATE - ($2 * INTERVAL '1 day')
       GROUP BY st.id, st.name
       ORDER BY bookings DESC, revenue DESC
       LIMIT 8`,
      [salonId, days],
    ),
    pool.query(
      `SELECT b.appointment_date::text AS date,
              COUNT(*)::int AS bookings,
              COALESCE(SUM(COALESCE(NULLIF(b.total_amount, 0), v.price)) FILTER (WHERE b.status IN ('confirmed', 'completed')), 0)::int AS revenue,
              COALESCE(SUM(b.deposit_amount) FILTER (WHERE b.status IN ('confirmed', 'completed')), 0)::int AS deposit_expected
       FROM bookings b JOIN services v ON v.id = b.service_id
       WHERE b.salon_id = $1 AND b.appointment_date >= CURRENT_DATE - ($2 * INTERVAL '1 day')
       GROUP BY b.appointment_date
       ORDER BY b.appointment_date ASC`,
      [salonId, days],
    ),
    pool.query(
      `SELECT p.id, p.booking_id, p.provider, p.amount, p.payment_type, p.status, p.created_at,
              b.customer_phone, v.title AS service_title
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       JOIN services v ON v.id = b.service_id
       WHERE b.salon_id = $1 AND p.created_at >= NOW() - ($2 * INTERVAL '1 day')
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [salonId, days],
    ),
  ]);

  return {
    summary: summary.rows[0],
    services: services.rows,
    staff: staff.rows,
    daily: daily.rows,
    transactions: transactions.rows,
  };
}
