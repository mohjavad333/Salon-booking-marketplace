import { z } from "zod";
import { timeSlotSchema } from "./common";

export const staffSchema = z.object({
  name: z.string().trim().min(2).max(100),
  roleTitle: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^09\d{9}$/)
    .nullable()
    .optional(),
  image: z.string().url().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const staffUpdateSchema = staffSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export const staffScheduleSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  slots: z.array(timeSlotSchema).max(50),
});
