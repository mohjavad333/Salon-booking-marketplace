import { z } from "zod";
import { dateSchema, normalizeDigits } from "./common";

export const bookingSchema = z.object({
  salonId: z.string().min(1),
  serviceId: z.string().min(1),
  customerPhone: z.preprocess(
    normalizeDigits,
    z.string().regex(/^09\d{9}$/, "Invalid phone number"),
  ),
  appointmentDate: dateSchema,
  appointmentTime: z.string().regex(/^\d{2}:\d{2}$/),
  staffId: z.string().min(1).nullable().optional(),
});

export const rescheduleSchema = z.object({
  appointmentDate: dateSchema,
  appointmentTime: z.string().regex(/^\d{2}:\d{2}$/),
});
