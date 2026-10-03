import type { Pool, PoolClient } from "pg";

export async function hasActiveStaff(
  pool: Pool,
  staffId: string,
  salonId: string,
) {
  const result = await pool.query(
    "SELECT 1 FROM staff WHERE id = $1 AND salon_id = $2 AND is_active = TRUE",
    [staffId, salonId],
  );
  return Boolean(result.rowCount);
}

export async function findBookableService(
  pool: Pool,
  serviceId: string,
  salonId: string,
  staffId: string | null,
) {
  const result = await pool.query(
    `SELECT v.id, v.price, v.duration_minutes, s.deposit_type, s.deposit_value,
            EXISTS (SELECT 1 FROM service_staff ss WHERE ss.service_id = v.id) AS assignment_configured,
            EXISTS (SELECT 1 FROM service_staff ss WHERE ss.service_id = v.id AND ss.staff_id = $3) AS staff_assigned
     FROM services v
     JOIN salons s ON s.id = v.salon_id
     WHERE v.id = $1 AND v.salon_id = $2 AND v.is_active = TRUE
       AND s.is_active = TRUE AND s.approval_status = 'approved'`,
    [serviceId, salonId, staffId ?? ""],
  );
  return result.rows[0] ?? null;
}

export async function insertBooking(
  client: PoolClient,
  input: {
    customerId: string | null;
    salonId: string;
    serviceId: string;
    staffId: string | null;
    customerPhone: string;
    appointmentDate: string;
    appointmentTime: string;
    totalAmount: number;
    depositAmount: number;
    paymentStatus: string;
  },
) {
  const result = await client.query(
    `INSERT INTO bookings (customer_id, salon_id, service_id, staff_id, customer_phone, appointment_date, appointment_time, total_amount, deposit_amount, payment_status, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed')
     RETURNING id, salon_id, service_id, staff_id, appointment_date, appointment_time, total_amount, deposit_amount, payment_status, status`,
    [
      input.customerId,
      input.salonId,
      input.serviceId,
      input.staffId,
      input.customerPhone,
      input.appointmentDate,
      input.appointmentTime,
      input.totalAmount,
      input.depositAmount,
      input.paymentStatus,
    ],
  );
  return result.rows[0] ?? null;
}

export async function findReschedulableBooking(
  pool: Pool,
  bookingId: string,
  customerId: string,
) {
  const result = await pool.query(
    `SELECT salon_id, service_id, staff_id FROM bookings
     WHERE id = $1 AND customer_id = $2 AND status IN ('pending', 'confirmed')`,
    [bookingId, customerId],
  );
  return result.rows[0] ?? null;
}

export async function findActiveServiceDuration(
  pool: Pool,
  serviceId: string,
  salonId: string,
) {
  const result = await pool.query(
    `SELECT duration_minutes FROM services
     WHERE id = $1 AND salon_id = $2 AND is_active = TRUE`,
    [serviceId, salonId],
  );
  return result.rowCount ? Number(result.rows[0].duration_minutes) : null;
}

export async function updateBookingSchedule(
  client: PoolClient,
  input: {
    bookingId: string;
    customerId: string;
    appointmentDate: string;
    appointmentTime: string;
  },
) {
  const result = await client.query(
    `UPDATE bookings
     SET appointment_date = $1, appointment_time = $2
     WHERE id = $3 AND customer_id = $4 AND status IN ('pending', 'confirmed')
     RETURNING id, appointment_date, appointment_time, status`,
    [
      input.appointmentDate,
      input.appointmentTime,
      input.bookingId,
      input.customerId,
    ],
  );
  return result.rows[0] ?? null;
}

export async function findCustomerCancellationEligibility(
  pool: Pool,
  bookingId: string,
  customerId: string,
) {
  const result = await pool.query(
    `SELECT b.id,
            (b.appointment_date + b.appointment_time) >= NOW() + (s.cancellation_window_hours * INTERVAL '1 hour') AS can_cancel
     FROM bookings b JOIN salons s ON s.id = b.salon_id
     WHERE b.id = $1 AND b.customer_id = $2 AND b.status IN ('pending', 'confirmed')`,
    [bookingId, customerId],
  );
  return result.rows[0] ?? null;
}

export async function cancelCustomerBooking(
  pool: Pool,
  bookingId: string,
  customerId: string,
) {
  const result = await pool.query(
    `UPDATE bookings SET status = 'cancelled'
     WHERE id = $1 AND customer_id = $2 AND status IN ('pending', 'confirmed')
     RETURNING id, status`,
    [bookingId, customerId],
  );
  return result.rows[0] ?? null;
}

export async function updateBookingStatus(
  pool: Pool,
  input: {
    bookingId: string;
    status: string;
    salonId?: string;
  },
) {
  const result = input.salonId
    ? await pool.query(
        `UPDATE bookings SET status = $1
         WHERE id = $2 AND salon_id = $3
         RETURNING id, status`,
        [input.status, input.bookingId, input.salonId],
      )
    : await pool.query(
        `UPDATE bookings SET status = $1
         WHERE id = $2
         RETURNING id, status`,
        [input.status, input.bookingId],
      );
  return result.rows[0] ?? null;
}

export async function findBookingNotificationDetails(
  pool: Pool,
  bookingId: string,
) {
  const result = await pool.query(
    `SELECT b.id, b.customer_id, b.appointment_date, b.appointment_time,
            s.name AS salon_name, u.id AS owner_id
     FROM bookings b JOIN salons s ON s.id = b.salon_id
     LEFT JOIN users u ON u.salon_id = b.salon_id AND u.role = 'salon'
     WHERE b.id = $1`,
    [bookingId],
  );
  return result.rows[0] ?? null;
}

export async function findOwnerBookingNotificationDetails(
  pool: Pool,
  bookingId: string,
) {
  const result = await pool.query(
    `SELECT b.id, b.customer_id, b.appointment_date, b.appointment_time,
            s.name AS salon_name
     FROM bookings b JOIN salons s ON s.id = b.salon_id
     WHERE b.id = $1`,
    [bookingId],
  );
  return result.rows[0] ?? null;
}
