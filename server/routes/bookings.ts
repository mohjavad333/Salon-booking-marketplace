import type { RequestHandler } from "express";
import { getUserFromRequest } from "../auth";
import { pool } from "../db";
import {
  BookingServiceError,
  createBooking,
} from "../services/booking-service";
import { createNotification } from "../services/notification-service";
import { bookingSchema } from "../validators/bookings";

export const handleCreateBooking: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "اطلاعات رزرو معتبر نیست" });
    return;
  }

  try {
    const user = await getUserFromRequest(req);
    const booking = await createBooking({
      customerId: user?.id ?? null,
      salonId: parsed.data.salonId,
      serviceId: parsed.data.serviceId,
      customerPhone: parsed.data.customerPhone,
      appointmentDate: parsed.data.appointmentDate,
      appointmentTime: parsed.data.appointmentTime,
      staffId: parsed.data.staffId ?? null,
    });
    const owners = await pool.query(
      `SELECT s.name AS salon_name, u.id AS owner_id
       FROM salons s LEFT JOIN users u ON u.salon_id = s.id AND u.role = 'salon'
       WHERE s.id = $1`,
      [parsed.data.salonId],
    );
    const appointmentLabel = `${parsed.data.appointmentDate} ساعت ${parsed.data.appointmentTime}`;
    for (const owner of owners.rows) {
      if (owner.owner_id) {
        await createNotification({
          userId: String(owner.owner_id),
          bookingId: String(booking.id),
          type: "booking_created_owner",
          title: "رزرو جدید",
          message: `یک رزرو جدید برای ${appointmentLabel} در ${String(owner.salon_name)} ثبت شد.`,
        });
      }
    }
    if (user) {
      await createNotification({
        userId: user.id,
        bookingId: String(booking.id),
        type: "booking_created_customer",
        title: "رزرو شما ثبت شد",
        message: `رزرو شما برای ${appointmentLabel} با موفقیت ثبت شد.`,
      });
    }

    res.status(201).json({ booking });
  } catch (error: unknown) {
    if (error instanceof BookingServiceError) {
      const messages: Record<BookingServiceError["code"], string> = {
        invalid_staff: "پرسنل انتخاب‌شده برای این سالن قابل رزرو نیست",
        service_unavailable: "سالن یا خدمت انتخاب‌شده قابل رزرو نیست",
        staff_not_assigned: "این پرسنل این خدمت را ارائه نمی‌دهد",
        slot_unavailable:
          "این زمان برای سالن قابل رزرو نیست یا با رزرو دیگری هم‌پوشانی دارد",
        booking_not_found: "رزرو قابل تغییر پیدا نشد",
      };
      res.status(400).json({ message: messages[error.code] });
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
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23503"
    ) {
      res.status(400).json({ message: "سالن یا خدمت انتخاب‌شده وجود ندارد" });
      return;
    }
    console.error(
      "Booking creation failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "ثبت رزرو انجام نشد" });
  }
};
