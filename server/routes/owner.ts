import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { requireOwnerSalon } from "../middleware/auth";
import {
  BookingLifecycleError,
  updateBookingStatus,
} from "../services/booking-lifecycle-service";
import { databaseReady, pool } from "../db";
import { createNotification } from "../services/notification-service";
import {
  bookingStaffSchema,
  bookingStatusSchema,
  salonStatusSchema,
  salonUpdateSchema,
  serviceSchema,
  serviceUpdateSchema,
} from "../validators/owner";

function mapOwnerBooking(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    customerPhone: String(row.customer_phone),
    serviceTitle: String(row.service_title),
    staffId: row.staff_id ? String(row.staff_id) : null,
    staffName: row.staff_name ? String(row.staff_name) : null,
    price: Number(row.price),
    appointmentDate: String(row.appointment_date),
    appointmentTime: String(row.appointment_time).slice(0, 5),
    status: String(row.status),
  };
}

function mapOwnerService(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title),
    durationMinutes: Number(row.duration_minutes),
    price: Number(row.price),
    isActive: row.is_active !== false,
  };
}

export const handleOwnerOverview: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const [salon, stats, bookings, services] = await Promise.all([
      pool.query(
        `SELECT id, name, city, area, category, rating, review_count, starting_price, image, description, address, phone, instagram, gallery_images, is_active, approval_status FROM salons WHERE id = $1`,
        [owner.salonId],
      ),
      pool.query(
        `
        SELECT COUNT(*) FILTER (WHERE appointment_date = CURRENT_DATE)::int AS today_bookings,
               COUNT(*) FILTER (WHERE status IN ('pending', 'confirmed'))::int AS pending_bookings,
               COALESCE(SUM(v.price) FILTER (WHERE status IN ('confirmed', 'completed') AND appointment_date >= DATE_TRUNC('month', CURRENT_DATE)), 0)::int AS month_revenue,
               COUNT(DISTINCT customer_phone)::int AS customers
        FROM bookings b JOIN services v ON v.id = b.service_id WHERE b.salon_id = $1
      `,
        [owner.salonId],
      ),
      pool.query(
        `
        SELECT b.id, b.customer_phone, v.title AS service_title, b.staff_id, st.name AS staff_name, v.price,
               b.appointment_date, b.appointment_time, b.status
        FROM bookings b JOIN services v ON v.id = b.service_id
        LEFT JOIN staff st ON st.id = b.staff_id
        WHERE b.salon_id = $1
        ORDER BY b.appointment_date DESC, b.appointment_time DESC
        LIMIT 50
      `,
        [owner.salonId],
      ),
      pool.query(
        `SELECT id, title, duration_minutes, price, is_active FROM services WHERE salon_id = $1 ORDER BY created_at DESC`,
        [owner.salonId],
      ),
    ]);
    if (!salon.rowCount) {
      res.status(404).json({ message: "سالن پیدا نشد" });
      return;
    }
    res.json({
      owner: { id: owner.user.id, phone: owner.user.phone },
      salon: {
        id: String(salon.rows[0].id),
        name: String(salon.rows[0].name),
        city: String(salon.rows[0].city),
        area: String(salon.rows[0].area),
        category: String(salon.rows[0].category),
        rating: Number(salon.rows[0].rating),
        reviewCount: Number(salon.rows[0].review_count),
        startingPrice: Number(salon.rows[0].starting_price),
        image: String(salon.rows[0].image),
        description: String(salon.rows[0].description ?? ""),
        address: String(salon.rows[0].address ?? ""),
        phone: salon.rows[0].phone ? String(salon.rows[0].phone) : null,
        instagram: salon.rows[0].instagram
          ? String(salon.rows[0].instagram)
          : null,
        galleryImages: Array.isArray(salon.rows[0].gallery_images)
          ? salon.rows[0].gallery_images.map(String)
          : [],
        isActive: salon.rows[0].is_active !== false,
        approvalStatus: String(salon.rows[0].approval_status),
      },
      stats: {
        todayBookings: Number(stats.rows[0].today_bookings),
        pendingBookings: Number(stats.rows[0].pending_bookings),
        monthRevenue: Number(stats.rows[0].month_revenue),
        customers: Number(stats.rows[0].customers),
      },
      bookings: bookings.rows.map(mapOwnerBooking),
      services: services.rows.map(mapOwnerService),
    });
  } catch (error: unknown) {
    console.error(
      "Owner overview query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "اطلاعات داشبورد سالن در دسترس نیست" });
  }
};

export const handleOwnerBookingStaff: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = bookingStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "پرسنل رزرو معتبر نیست" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const booking = await pool.query(
      `SELECT b.id, b.service_id, b.appointment_date, b.appointment_time, v.duration_minutes
       FROM bookings b JOIN services v ON v.id = b.service_id
       WHERE b.id = $1 AND b.salon_id = $2`,
      [req.params.id, owner.salonId],
    );
    if (!booking.rowCount) {
      res.status(404).json({ message: "رزرو این سالن پیدا نشد" });
      return;
    }
    const staffId = parsed.data.staffId;
    if (staffId) {
      const staff = await pool.query(
        `SELECT 1 FROM staff WHERE id = $1 AND salon_id = $2 AND is_active = TRUE`,
        [staffId, owner.salonId],
      );
      if (!staff.rowCount) {
        res
          .status(400)
          .json({ message: "پرسنل انتخاب‌شده فعال یا متعلق به این سالن نیست" });
        return;
      }
      const assignment = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM service_staff WHERE service_id = $1) AS configured,
                EXISTS (SELECT 1 FROM service_staff WHERE service_id = $1 AND staff_id = $2) AS assigned`,
        [booking.rows[0].service_id, staffId],
      );
      if (assignment.rows[0].configured && !assignment.rows[0].assigned) {
        res
          .status(400)
          .json({ message: "این پرسنل این خدمت را ارائه نمی‌دهد" });
        return;
      }
    }
    const client = await pool.connect();
    let result;
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        [owner.salonId, String(booking.rows[0].appointment_date)],
      );
      const conflicts = await client.query(
        `SELECT 1
         FROM bookings existing
         JOIN services existing_service ON existing_service.id = existing.service_id
         WHERE existing.salon_id = $2
           AND existing.appointment_date = $3::date
           AND existing.status IN ('pending', 'confirmed')
           AND existing.id <> $4
           AND ($1::text = '' OR existing.staff_id IS NULL OR existing.staff_id = $1)
           AND ($3::date + existing.appointment_time) < ($3::date + $5::time + ($6::int * INTERVAL '1 minute'))
           AND ($3::date + existing.appointment_time + (existing_service.duration_minutes * INTERVAL '1 minute')) > ($3::date + $5::time)`,
        [
          staffId ?? "",
          owner.salonId,
          booking.rows[0].appointment_date,
          req.params.id,
          booking.rows[0].appointment_time,
          Number(booking.rows[0].duration_minutes),
        ],
      );
      if (conflicts.rowCount) {
        await client.query("ROLLBACK");
        res
          .status(409)
          .json({ message: "این پرسنل در این بازه رزرو دیگری دارد" });
        return;
      }
      result = await client.query(
        `UPDATE bookings SET staff_id = $1
         WHERE id = $2 AND salon_id = $3
         RETURNING id, staff_id`,
        [staffId, req.params.id, owner.salonId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    if (!result.rowCount) {
      res.status(404).json({ message: "رزرو این سالن پیدا نشد" });
      return;
    }
    res.json({
      booking: {
        id: String(result.rows[0].id),
        staffId: result.rows[0].staff_id
          ? String(result.rows[0].staff_id)
          : null,
      },
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      res
        .status(409)
        .json({ message: "این پرسنل در این زمان رزرو دیگری دارد" });
      return;
    }
    console.error(
      "Owner booking staff update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "تغییر پرسنل رزرو انجام نشد" });
  }
};

export const handleOwnerBookingStatus: RequestHandler = async (req, res) => {
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
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    const result = await updateBookingStatus({
      bookingId: String(req.params.id),
      status: parsed.data.status,
      salonId: owner.salonId,
    });
    const booking = result.details;
    if (!booking) {
      res.status(404).json({ message: "رزرو این سالن پیدا نشد" });
      return;
    }
    if (booking.customer_id) {
      const statusLabels: Record<string, string> = {
        pending: "در انتظار تایید",
        confirmed: "تایید شده",
        cancelled: "لغو شده",
        completed: "تکمیل شده",
        no_show: "عدم حضور",
      };
      const appointmentLabel = `${String(booking.appointment_date)} ساعت ${String(booking.appointment_time).slice(0, 5)}`;
      await createNotification({
        userId: String(booking.customer_id),
        bookingId: String(booking.id),
        type: `booking_status_${parsed.data.status}`,
        title: "وضعیت رزرو تغییر کرد",
        message: `وضعیت رزرو شما در ${String(booking.salon_name)} برای ${appointmentLabel} به «${statusLabels[parsed.data.status]}» تغییر کرد.`,
      });
    }
    res.json({ booking: result.booking });
  } catch (error: unknown) {
    if (
      error instanceof BookingLifecycleError &&
      error.code === "status_update_failed"
    ) {
      res.status(404).json({ message: "رزرو این سالن پیدا نشد" });
      return;
    }
    console.error(
      "Owner booking status update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "تغییر وضعیت رزرو انجام نشد" });
  }
};

export const handleOwnerCreateService: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = serviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "اطلاعات خدمت معتبر نیست" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const result = await pool.query(
      `INSERT INTO services (id, salon_id, title, duration_minutes, price, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, duration_minutes, price, is_active`,
      [
        randomUUID(),
        owner.salonId,
        parsed.data.title,
        parsed.data.durationMinutes,
        parsed.data.price,
        parsed.data.isActive ?? true,
      ],
    );
    res.status(201).json({ service: mapOwnerService(result.rows[0]) });
  } catch (error: unknown) {
    console.error(
      "Owner service creation failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "افزودن خدمت انجام نشد" });
  }
};

export const handleOwnerUpdateService: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = serviceUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "اطلاعات ویرایش خدمت معتبر نیست" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const result = await pool.query(
      `UPDATE services SET title = COALESCE($1, title), duration_minutes = COALESCE($2, duration_minutes), price = COALESCE($3, price), is_active = COALESCE($4, is_active)
       WHERE id = $5 AND salon_id = $6 RETURNING id, title, duration_minutes, price, is_active`,
      [
        parsed.data.title ?? null,
        parsed.data.durationMinutes ?? null,
        parsed.data.price ?? null,
        parsed.data.isActive ?? null,
        req.params.id,
        owner.salonId,
      ],
    );
    if (!result.rowCount) {
      res.status(404).json({ message: "خدمت این سالن پیدا نشد" });
      return;
    }
    res.json({ service: mapOwnerService(result.rows[0]) });
  } catch (error: unknown) {
    console.error(
      "Owner service update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "ویرایش خدمت انجام نشد" });
  }
};

export const handleOwnerDeleteService: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const result = await pool.query(
      "DELETE FROM services WHERE id = $1 AND salon_id = $2 RETURNING id",
      [req.params.id, owner.salonId],
    );
    if (!result.rowCount) {
      res.status(404).json({ message: "خدمت این سالن پیدا نشد" });
      return;
    }
    res.status(204).end();
  } catch (error: unknown) {
    console.error(
      "Owner service deletion failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "حذف خدمت انجام نشد" });
  }
};

export const handleOwnerUpdateSalonStatus: RequestHandler = async (
  req,
  res,
) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = salonStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "وضعیت پذیرش معتبر نیست" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const result = await pool.query(
      `UPDATE salons SET is_active = $1 WHERE id = $2 RETURNING id, is_active`,
      [parsed.data.isActive, owner.salonId],
    );
    if (!result.rowCount) {
      res.status(404).json({ message: "سالن پیدا نشد" });
      return;
    }
    res.json({ salon: result.rows[0] });
  } catch (error: unknown) {
    console.error(
      "Owner salon status update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "تغییر وضعیت پذیرش انجام نشد" });
  }
};

export const handleOwnerUpdateSalon: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = salonUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "اطلاعات سالن معتبر نیست" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const result = await pool.query(
      `UPDATE salons
       SET name = $1, city = $2, area = $3, category = $4, starting_price = $5,
           image = COALESCE($6, image), description = COALESCE($7, description),
           address = COALESCE($8, address), phone = $9, instagram = $10,
           gallery_images = COALESCE($11, gallery_images)
       WHERE id = $12
       RETURNING id, name, city, area, category, starting_price, image, description, address,
                 phone, instagram, gallery_images, is_active, approval_status`,
      [
        parsed.data.name,
        parsed.data.city,
        parsed.data.area,
        parsed.data.category,
        parsed.data.startingPrice,
        parsed.data.image ?? null,
        parsed.data.description ?? null,
        parsed.data.address ?? null,
        parsed.data.phone ?? null,
        parsed.data.instagram ?? null,
        parsed.data.galleryImages ?? null,
        owner.salonId,
      ],
    );
    if (!result.rowCount) {
      res.status(404).json({ message: "سالن پیدا نشد" });
      return;
    }
    res.json({ salon: result.rows[0] });
  } catch (error: unknown) {
    console.error(
      "Owner salon update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "ویرایش اطلاعات سالن انجام نشد" });
  }
};
