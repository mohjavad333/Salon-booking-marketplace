import { z } from "zod";
import { dateSchema, timeSlotSchema } from "./common";

export const availabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  slots: z.array(timeSlotSchema).max(50),
});

export const exceptionSchema = z.object({
  date: dateSchema,
  isClosed: z.boolean(),
  slots: z.array(timeSlotSchema).max(50),
});
