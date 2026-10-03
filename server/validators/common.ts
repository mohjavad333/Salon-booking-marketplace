import { z } from "zod";

export const timeSlotSchema = z
  .object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    isAvailable: z.boolean(),
  })
  .refine((slot) => slot.startTime < slot.endTime);

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const bookingStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "cancelled", "completed", "no_show"]),
});

export const normalizeDigits = (value: unknown) =>
  String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
