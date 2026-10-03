import { z } from "zod";
import { normalizeDigits } from "./common";

export const startPaymentSchema = z.object({
  bookingId: z.string().min(1),
  customerPhone: z.preprocess(normalizeDigits, z.string().regex(/^09\d{9}$/)),
});
