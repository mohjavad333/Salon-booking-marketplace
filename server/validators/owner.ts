import { z } from "zod";
import { bookingStatusSchema } from "./common";

export { bookingStatusSchema };

export const serviceSchema = z.object({
  title: z.string().trim().min(2).max(120),
  durationMinutes: z.coerce.number().int().min(5).max(720),
  price: z.coerce.number().int().min(0).max(1000000000),
  isActive: z.boolean().optional(),
});

export const serviceUpdateSchema = serviceSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export const bookingStaffSchema = z.object({
  staffId: z.string().min(1).nullable(),
});
export const salonStatusSchema = z.object({ isActive: z.boolean() });

export const salonUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(80),
  area: z.string().trim().min(2).max(80),
  category: z.string().trim().min(2).max(120),
  startingPrice: z.coerce.number().int().min(0).max(1000000000),
  image: z.string().url().max(500).optional(),
  description: z.string().trim().max(2000).optional(),
  address: z.string().trim().max(300).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^09\d{9}$/)
    .nullable()
    .optional(),
  instagram: z.string().trim().max(200).nullable().optional(),
  galleryImages: z.array(z.string().url().max(500)).max(12).optional(),
});
