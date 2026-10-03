import { z } from "zod";
import { normalizePhone } from "../auth";

export const authSchema = z.object({
  phone: z.preprocess(
    normalizePhone,
    z.string().regex(/^09\d{9}$/, "Invalid phone number"),
  ),
  password: z.string().min(6),
});

export const loginSchema = authSchema.extend({
  role: z.enum(["customer", "salon"]).optional(),
});

export const registerSchema = authSchema.extend({
  role: z.enum(["customer", "salon"]),
  salonName: z.string().trim().min(2).max(120).nullable().optional(),
});
