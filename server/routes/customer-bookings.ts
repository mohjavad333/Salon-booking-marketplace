import type { RequestHandler } from "express";
import { requireUser } from "../middleware/auth";
import { databaseReady, pool } from "../db";
import {
  BookingServiceError,
  rescheduleBooking,
} from "../services/booking-service";
import {
  BookingLifecycleError,
  cancelBooking,
} from "../services/booking-lifecycle-service";
import { createNotification } from "../services/notification-service";
import { rescheduleSchema } from "../validators/bookings";

function mapBooking(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    salonId: String(row.salon_id),
    salonName: String(row.salon_name),
    salonCity: String(row.salon_city),
    salonArea: String(row.salon_area),
    salonImage: String(row.salon_image),
    serviceId: String(row.service_id),
    serviceTitle: String(row.service_title),
    staffName: row.staff_name ? String(row.staff_name) : null,
    price: Number(row.price),
    totalAmount: Number(row.total_amount),
    depositAmount: Number(row.deposit_amount),
    paymentStatus: String(row.payment_status),
    durationMinutes: Number(row.duration_minutes),
    customerPhone: String(row.customer_phone),
    appointmentDate: String(row.appointment_date),
    appointmentTime: String(row.appointment_time).slice(0, 5),
    status: String(row.status),
    hasReview: row.review_id !== null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

const bookingQuery = `
  SELECT b.id, b.salon_id, s.name AS salon_name, s.city AS salon_city,
         s.area AS salon_area, s.image AS salon_image, b.service_id,
         v.title AS service_title, st.name AS staff_name, v.price, v.duration_minutes,
         b.total_amount, b.deposit_amount, b.payment_status,
         b.customer_phone, b.appointment_date, b.appointment_time,
         b.status, b.created_at, r.id AS review_id
  FROM bookings b
  JOIN salons s ON s.id = b.salon_id
  JOIN services v ON v.id = b.service_id
  LEFT JOIN staff st ON st.id = b.staff_id
  LEFT JOIN reviews r ON r.booking_id = b.id
`;

export const handleMyBookings: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  try {
    const user = await requireUser(
      req,
      res,
      "برای مشاهده رزروها وارد حساب کاربری شوید",
    );
    if (!user) return;
    await databaseReady;
    const result = await pool.query(
      `${bookingQuery} WHERE b.customer_id = $1 ORDER BY b.appointment_date DESC, b.appointment_time DESC`,
      [user.id],
    );
    res.json({ bookings: result.rows.map(mapBooking) });
  } catch (error: unknown) {
    console.error(
      "Customer bookings query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "رزروهای شما در دسترس نیست" });
  }
};

export const handleCancelBooking: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  try {
    const user = await requireUser(
      req,
      res,
      "برای مشاهده رزروها وارد حساب کاربری شوید",
    );
    if (!user) return;
    const result = await cancelBooking({
      bookingId: String(req.params.id),
      customerId: user.id,
    });
    const booking = result.details;
    if (booking) {
      const appointmentLabel = `${String(booking.appointment_date)} ساعت ${String(booking.appointment_time).slice(0, 5)}`;
      if (booking.owner_id) {
        await createNotification({
          userId: String(booking.owner_id),
          bookingId: String(booking.id),
          type: "booking_cancelled_owner",
          title: "لغو رزرو",
          message: `رزرو ${appointmentLabel} در ${String(booking.salon_name)} توسط مشتری لغو شد.`,
        });
      }
      await createNotification({
        userId: user.id,
        bookingId: String(booking.id),
        type: "booking_cancelled_customer",
        title: "رزرو لغو شد",
        message: `رزرو شما برای ${appointmentLabel} لغو شد.`,
      });
    }
    res.json({ booking: result.booking });
  } catch (error: unknown) {
    if (error instanceof BookingLifecycleError) {
      if (error.code === "cancellation_window_expired") {
        res.status(409).json({
          message: "مهلت لغو این رزرو طبق قوانین سالن به پایان رسیده است",
        });
        return;
      }
      res.status(404).json({ message: "رزرو قابل لغو پیدا نشد" });
      return;
    }
    console.error(
      "Booking cancellation failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "لغو رزرو انجام نشد" });
  }
};

export const handleRescheduleBooking: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  const parsed = rescheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "تاریخ یا زمان جدید معتبر نیست" });
    return;
  }

  try {
    const user = await requireUser(
      req,
      res,
      "برای مشاهده رزروها وارد حساب کاربری شوید",
    );
    if (!user) return;
    const result = await rescheduleBooking({
      bookingId: String(req.params.id),
      customerId: user.id,
      appointmentDate: parsed.data.appointmentDate,
      appointmentTime: parsed.data.appointmentTime,
    });
    const details = await pool.query(
      `SELECT b.id, b.appointment_date, b.appointment_time,
              s.name AS salon_name, u.id AS owner_id
       FROM bookings b JOIN salons s ON s.id = b.salon_id
       LEFT JOIN users u ON u.salon_id = b.salon_id AND u.role = 'salon'
       WHERE b.id = $1`,
      [req.params.id],
    );
    const booking = details.rows[0];
    const appointmentLabel = `${String(booking.appointment_date)} ساعت ${String(booking.appointment_time).slice(0, 5)}`;
    if (booking.owner_id) {
      await createNotification({
        userId: String(booking.owner_id),
        bookingId: String(booking.id),
        type: "booking_rescheduled_owner",
        title: "تغییر زمان رزرو",
        message: `زمان رزرو ${String(booking.salon_name)} به ${appointmentLabel} تغییر کرد.`,
      });
    }
    await createNotification({
      userId: user.id,
      bookingId: String(booking.id),
      type: "booking_rescheduled_customer",
      title: "زمان رزرو تغییر کرد",
      message: `زمان رزرو شما به ${appointmentLabel} تغییر کرد.`,
    });
    res.json({ booking: result });
  } catch (error: unknown) {
    if (error instanceof BookingServiceError) {
      const messages: Record<BookingServiceError["code"], string> = {
        invalid_staff: "پرسنل انتخاب‌شده برای این سالن قابل رزرو نیست",
        service_unavailable: "خدمت این رزرو دیگر قابل رزرو نیست",
        staff_not_assigned: "این پرسنل این خدمت را ارائه نمی‌دهد",
        slot_unavailable: "این زمان برای تقویم سالن یا پرسنل قابل رزرو نیست",
        booking_not_found: "رزرو قابل تغییر پیدا نشد",
      };
      res
        .status(error.code === "booking_not_found" ? 404 : 400)
        .json({ message: messages[error.code] });
      return;
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ message: "این زمان قبلاً رزرو شده است" });
      return;
    }
    console.error(
      "Booking rescheduling failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "تغییر زمان رزرو انجام نشد" });
  }
};
