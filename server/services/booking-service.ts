import type { PoolClient } from "pg";
import { databaseReady, pool } from "../db";
import { getAvailableSlots } from "../booking-availability";
import {
  findActiveServiceDuration,
  findBookableService,
  findReschedulableBooking,
  hasActiveStaff,
  insertBooking,
  updateBookingSchedule,
} from "../repositories/booking-repository";

export type BookingServiceErrorCode =
  | "invalid_staff"
  | "service_unavailable"
  | "staff_not_assigned"
  | "slot_unavailable"
  | "booking_not_found";

export class BookingServiceError extends Error {
  constructor(public readonly code: BookingServiceErrorCode) {
    super(code);
    this.name = "BookingServiceError";
  }
}

export interface CreateBookingInput {
  customerId: string | null;
  salonId: string;
  serviceId: string;
  customerPhone: string;
  appointmentDate: string;
  appointmentTime: string;
  staffId: string | null;
}

export interface RescheduleBookingInput {
  bookingId: string;
  customerId: string;
  appointmentDate: string;
  appointmentTime: string;
}

export async function createBooking(input: CreateBookingInput) {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  await databaseReady;

  if (
    input.staffId &&
    !(await hasActiveStaff(pool, input.staffId, input.salonId))
  ) {
    throw new BookingServiceError("invalid_staff");
  }

  const service = await findBookableService(
    pool,
    input.serviceId,
    input.salonId,
    input.staffId,
  );
  if (!service) throw new BookingServiceError("service_unavailable");
  if (
    input.staffId &&
    service.assignment_configured &&
    !service.staff_assigned
  ) {
    throw new BookingServiceError("staff_not_assigned");
  }

  const totalAmount = Number(service.price);
  const depositType = String(service.deposit_type);
  const configuredDeposit = Number(service.deposit_value);
  const depositAmount = calculateDeposit(
    totalAmount,
    depositType,
    configuredDeposit,
  );
  const paymentStatus = depositAmount > 0 ? "pending" : "not_required";
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await lockBookingDate(client, input.salonId, input.appointmentDate);
    await ensureRequestedSlot(client, {
      salonId: input.salonId,
      date: input.appointmentDate,
      time: input.appointmentTime,
      staffId: input.staffId,
      durationMinutes: Number(service.duration_minutes),
      unavailableCode: "slot_unavailable",
    });

    const booking = await insertBooking(client, {
      customerId: input.customerId,
      salonId: input.salonId,
      serviceId: input.serviceId,
      staffId: input.staffId,
      customerPhone: input.customerPhone,
      appointmentDate: input.appointmentDate,
      appointmentTime: input.appointmentTime,
      totalAmount,
      depositAmount,
      paymentStatus,
    });
    if (!booking) throw new BookingServiceError("slot_unavailable");

    await client.query("COMMIT");
    return booking;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function rescheduleBooking(input: RescheduleBookingInput) {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  await databaseReady;

  const currentBooking = await findReschedulableBooking(
    pool,
    input.bookingId,
    input.customerId,
  );
  if (!currentBooking) throw new BookingServiceError("booking_not_found");

  const salonId = String(currentBooking.salon_id);
  const serviceId = String(currentBooking.service_id);
  const staffId = currentBooking.staff_id
    ? String(currentBooking.staff_id)
    : null;
  const durationMinutes = await findActiveServiceDuration(
    pool,
    serviceId,
    salonId,
  );
  if (durationMinutes === null) {
    throw new BookingServiceError("service_unavailable");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockBookingDate(client, salonId, input.appointmentDate);
    await ensureRequestedSlot(client, {
      salonId,
      date: input.appointmentDate,
      time: input.appointmentTime,
      staffId,
      durationMinutes,
      excludeBookingId: input.bookingId,
      unavailableCode: "slot_unavailable",
    });

    const booking = await updateBookingSchedule(client, input);
    if (!booking) throw new BookingServiceError("booking_not_found");

    await client.query("COMMIT");
    return booking;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function calculateDeposit(
  totalAmount: number,
  depositType: string,
  configuredDeposit: number,
) {
  if (depositType === "fixed") return Math.min(totalAmount, configuredDeposit);
  if (depositType === "percentage") {
    return Math.min(
      totalAmount,
      Math.floor((totalAmount * configuredDeposit) / 100),
    );
  }
  return 0;
}

async function lockBookingDate(
  client: PoolClient,
  salonId: string,
  appointmentDate: string,
) {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
    [salonId, appointmentDate],
  );
}

async function ensureRequestedSlot(
  client: PoolClient,
  input: {
    salonId: string;
    date: string;
    time: string;
    staffId: string | null;
    durationMinutes: number;
    excludeBookingId?: string;
    unavailableCode: BookingServiceErrorCode;
  },
) {
  const availability = await getAvailableSlots(client, {
    salonId: input.salonId,
    date: input.date,
    staffId: input.staffId,
    durationMinutes: input.durationMinutes,
    excludeBookingId: input.excludeBookingId,
  });
  const requestedSlot = availability.rows.find(
    (row) =>
      String(row.start_time).slice(0, 5) === input.time &&
      row.is_available === true &&
      row.is_booked === false,
  );
  if (!requestedSlot) {
    throw new BookingServiceError(input.unavailableCode);
  }
}
