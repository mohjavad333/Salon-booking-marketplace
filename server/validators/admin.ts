import { z } from "zod";

export const userStatusSchema = z.object({ isActive: z.boolean() });

export const salonStatusSchema = z.object({
  approvalStatus: z.enum(["pending", "approved", "rejected"]),
  isActive: z.boolean().optional(),
});

export const salonUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    city: z.string().trim().min(2).max(80).optional(),
    area: z.string().trim().min(2).max(80).optional(),
    category: z.string().trim().min(2).max(120).optional(),
    startingPrice: z.number().int().min(0).max(1000000000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);
