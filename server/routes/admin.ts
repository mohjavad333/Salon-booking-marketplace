import type { RequestHandler } from "express";
import { requireAdmin } from "../middleware/auth";
import {
  BookingLifecycleError,
  updateBookingStatus,
} from "../services/booking-lifecycle-service";
import { databaseReady, pool } from "../db";
import { createNotification } from "../services/notification-service";
import { bookingStatusSchema } from "../validators/common";

function queryString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function mapAdminUser(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    phone: String(row.phone),
    role: String(row.role),
    salonName: row.salon_name ? String(row.salon_name) : null,
    isActive: row.is_active !== false,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function mapAdminSalon(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    city: String(row.city),
    area: String(row.area),
    category: String(row.category),
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    startingPrice: Number(row.starting_price),
    isActive: row.is_active !== false,
    approvalStatus: String(row.approval_status),
    serviceCount: Number(row.service_count),
    bookingCount: Number(row.booking_count),
  };
}

function mapAdminBooking(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    salonName: String(row.salon_name),
    customerPhone: row.customer_phone ? String(row.customer_phone) : "مهمان",
    serviceTitle: String(row.service_title),
    price: Number(row.price),
    appointmentDate: String(row.appointment_date),
    appointmentTime: String(row.appointment_time).slice(0, 5),
    status: String(row.status),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export const handleAdminOverview: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  try {
    const admin = await requireAdmin(
      req,
      res,
      "برای مشاهده پنل مدیریت وارد حساب کاربری شوید",
      "دسترسی به پنل مدیریت مجاز نیست",
    );
    if (!admin) return;
    await databaseReady;

    const [users, salons, bookings, recentBookings, topSalons] =
      await Promise.all([
        pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE role = 'customer')::int AS customers,
               COUNT(*) FILTER (WHERE role = 'salon')::int AS salon_owners
        FROM users
      `),
        pool.query(`SELECT COUNT(*)::int AS total FROM salons`),
        pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status IN ('confirmed', 'completed'))::int AS active,
               COALESCE(SUM(v.price) FILTER (WHERE b.status IN ('confirmed', 'completed')), 0)::int AS revenue
        FROM bookings b
        JOIN services v ON v.id = b.service_id
      `),
        pool.query(`
        SELECT b.id, s.name AS salon_name, u.phone AS customer_phone,
               v.title AS service_title, v.price, b.appointment_date,
               b.appointment_time, b.status, b.created_at
        FROM bookings b
        JOIN salons s ON s.id = b.salon_id
        JOIN services v ON v.id = b.service_id
        LEFT JOIN users u ON u.id = b.customer_id
        ORDER BY b.created_at DESC
        LIMIT 8
      `),
        pool.query(`
        SELECT s.id, s.name, s.city, s.category, s.rating, s.review_count,
               COUNT(b.id)::int AS booking_count
        FROM salons s
        LEFT JOIN bookings b ON b.salon_id = s.id
        GROUP BY s.id
        ORDER BY booking_count DESC, s.rating DESC
        LIMIT 5
      `),
      ]);

    res.json({
      stats: {
        users: users.rows[0],
        salons: salons.rows[0],
        bookings: bookings.rows[0],
      },
      recentBookings: recentBookings.rows.map(mapAdminBooking),
      topSalons: topSalons.rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        city: String(row.city),
        category: String(row.category),
        rating: Number(row.rating),
        reviewCount: Number(row.review_count),
        bookingCount: Number(row.booking_count),
      })),
    });
  } catch (error: unknown) {
    console.error(
      "Admin overview query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "اطلاعات پنل مدیریت در دسترس نیست" });
  }
};

export const handleAdminUsers: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  try {
    const admin = await requireAdmin(
      req,
      res,
      "برای مشاهده پنل مدیریت وارد حساب کاربری شوید",
      "دسترسی به پنل مدیریت مجاز نیست",
    );
    if (!admin) return;
    await databaseReady;
    const search = queryString(req.query.q);
    const role = queryString(req.query.role);
    const values: string[] = [];
    const conditions: string[] = [];
    if (search) {
      values.push(`%${search}%`);
      conditions.push(
        `(phone ILIKE $${values.length} OR COALESCE(salon_name, '') ILIKE $${values.length})`,
      );
    }
    if (["customer", "salon", "admin"].includes(role)) {
      values.push(role);
      conditions.push(`role = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT id, phone, role, salon_name, is_active, created_at FROM users ${where} ORDER BY created_at DESC LIMIT 100`,
      values,
    );
    res.json({ users: result.rows.map(mapAdminUser) });
  } catch (error: unknown) {
    console.error(
      "Admin users query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "فهرست کاربران در دسترس نیست" });
  }
};

export const handleAdminSalons: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  try {
    const admin = await requireAdmin(
      req,
      res,
      "برای مشاهده پنل مدیریت وارد حساب کاربری شوید",
      "دسترسی به پنل مدیریت مجاز نیست",
    );
    if (!admin) return;
    await databaseReady;
    const search = queryString(req.query.q);
    const values = search ? [`%${search}%`] : [];
    const where = search
      ? "WHERE s.name ILIKE $1 OR s.city ILIKE $1 OR s.category ILIKE $1"
      : "";
    const result = await pool.query(
      `SELECT s.id, s.name, s.city, s.area, s.category, s.rating, s.review_count,
              s.starting_price, s.is_active, s.approval_status,
              COUNT(DISTINCT v.id)::int AS service_count,
              COUNT(DISTINCT b.id)::int AS booking_count
       FROM salons s
       LEFT JOIN services v ON v.salon_id = s.id
       LEFT JOIN bookings b ON b.salon_id = s.id
       ${where}
       GROUP BY s.id
       ORDER BY s.created_at DESC
       LIMIT 100`,
      values,
    );
    res.json({ salons: result.rows.map(mapAdminSalon) });
  } catch (error: unknown) {
    console.error(
      "Admin salons query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "فهرست سالن‌ها در دسترس نیست" });
  }
};

export const handleAdminBookings: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  try {
    const admin = await requireAdmin(
      req,
      res,
      "برای مشاهده پنل مدیریت وارد حساب کاربری شوید",
      "دسترسی به پنل مدیریت مجاز نیست",
    );
    if (!admin) return;
    await databaseReady;
    const status = queryString(req.query.status);
    const values: string[] = [];
    const where = ["1 = 1"];
    if (
      ["pending", "confirmed", "cancelled", "completed", "no_show"].includes(
        status,
      )
    ) {
      values.push(status);
      where.push(`b.status = $${values.length}`);
    }
    const result = await pool.query(
      `SELECT b.id, s.name AS salon_name, u.phone AS customer_phone,
              v.title AS service_title, v.price, b.appointment_date,
              b.appointment_time, b.status, b.created_at
       FROM bookings b
       JOIN salons s ON s.id = b.salon_id
       JOIN services v ON v.id = b.service_id
       LEFT JOIN users u ON u.id = b.customer_id
       WHERE ${where.join(" AND ")}
       ORDER BY b.appointment_date DESC, b.appointment_time DESC
       LIMIT 100`,
      values,
    );
    res.json({ bookings: result.rows.map(mapAdminBooking) });
  } catch (error: unknown) {
    console.error(
      "Admin bookings query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "فهرست رزروها در دسترس نیست" });
  }
};

export const handleAdminBookingStatus: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = bookingStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "وضعیت رزرو معتبر نیست" });
    return;
  }
  try {
    const admin = await requireAdmin(
      req,
      res,
      "برای مشاهده پنل مدیریت وارد حساب کاربری شوید",
      "دسترسی به پنل مدیریت مجاز نیست",
    );
    if (!admin) return;
    const result = await updateBookingStatus({
      bookingId: String(req.params.id),
      status: parsed.data.status,
    });
    const booking = result.details;
    if (!booking) {
      res.status(404).json({ message: "رزرو پیدا نشد" });
      return;
    }
    const statusLabels: Record<string, string> = {
      pending: "در انتظار تایید",
      confirmed: "تایید شده",
      cancelled: "لغو شده",
      completed: "تکمیل شده",
      no_show: "عدم حضور",
    };
    const appointmentLabel = `${String(booking.appointment_date)} ساعت ${String(booking.appointment_time).slice(0, 5)}`;
    if (booking.customer_id) {
      await createNotification({
        userId: String(booking.customer_id),
        bookingId: String(booking.id),
        type: `booking_status_${parsed.data.status}`,
        title: "وضعیت رزرو تغییر کرد",
        message: `وضعیت رزرو شما در ${String(booking.salon_name)} برای ${appointmentLabel} به «${statusLabels[parsed.data.status]}» تغییر کرد.`,
      });
    }
    if (booking.owner_id) {
      await createNotification({
        userId: String(booking.owner_id),
        bookingId: String(booking.id),
        type: `booking_status_admin_${parsed.data.status}`,
        title: "وضعیت رزرو به‌روزرسانی شد",
        message: `وضعیت رزرو ${appointmentLabel} توسط مدیریت به «${statusLabels[parsed.data.status]}» تغییر کرد.`,
      });
    }
    res.json({ booking: result.booking });
  } catch (error: unknown) {
    if (
      error instanceof BookingLifecycleError &&
      error.code === "status_update_failed"
    ) {
      res.status(404).json({ message: "رزرو پیدا نشد" });
      return;
    }
    console.error(
      "Admin booking status update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "تغییر وضعیت رزرو انجام نشد" });
  }
};
