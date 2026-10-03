import { databaseReady, pool } from "../db";
import {
  cancelCustomerBooking,
  findBookingNotificationDetails,
  findCustomerCancellationEligibility,
  updateBookingStatus as updateBookingStatusRecord,
} from "../repositories/booking-repository";

export type BookingLifecycleErrorCode =
  "booking_not_found" | "cancellation_window_expired" | "status_update_failed";

export class BookingLifecycleError extends Error {
  constructor(public readonly code: BookingLifecycleErrorCode) {
    super(code);
    this.name = "BookingLifecycleError";
  }
}

export async function cancelBooking(input: {
  bookingId: string;
  customerId: string;
}) {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  await databaseReady;

  const eligibility = await findCustomerCancellationEligibility(
    pool,
    input.bookingId,
    input.customerId,
  );
  if (!eligibility) {
    throw new BookingLifecycleError("booking_not_found");
  }
  if (eligibility.can_cancel !== true) {
    throw new BookingLifecycleError("cancellation_window_expired");
  }

  const booking = await cancelCustomerBooking(
    pool,
    input.bookingId,
    input.customerId,
  );
  if (!booking) throw new BookingLifecycleError("booking_not_found");

  const details = await findBookingNotificationDetails(pool, input.bookingId);
  return { booking, details };
}

export async function updateBookingStatus(input: {
  bookingId: string;
  status: string;
  salonId?: string;
}) {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  await databaseReady;

  const booking = await updateBookingStatusRecord(pool, input);
  if (!booking) throw new BookingLifecycleError("status_update_failed");

  const details = await findBookingNotificationDetails(pool, input.bookingId);
  return { booking, details };
}
