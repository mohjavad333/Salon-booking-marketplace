import { z } from "zod";
import { bookingStatusSchema, dateSchema } from "./common";

export { bookingStatusSchema };

export const assignmentSchema = z.object({
  staffIds: z.array(z.string().min(1)).max(100),
});

export const reviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.preprocess(
    (value) => Number(value),
    z.number().int().min(1).max(5),
  ),
  comment: z.string().trim().max(500).default(""),
});

export const notificationPreferencesSchema = z.object({
  remindersEnabled: z.boolean(),
});

export const settingsSchema = z
  .object({
    cancellationWindowHours: z.coerce.number().int().min(0).max(168),
    cancellationPolicy: z.string().trim().min(10).max(500),
    depositType: z.enum(["none", "fixed", "percentage"]),
    depositValue: z.coerce.number().int().min(0).max(1000000000),
  })
  .refine(
    (value) => value.depositType !== "percentage" || value.depositValue <= 100,
    { message: "درصد بیعانه معتبر نیست" },
  );

export const reportRangeSchema = z.coerce
  .number()
  .int()
  .min(7)
  .max(365)
  .default(30);
export const calendarDateSchema = dateSchema;
export const calendarStatusSchema = z.enum([
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);
