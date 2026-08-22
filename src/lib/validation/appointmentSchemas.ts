import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

/** Matches <input type="datetime-local"> — see lib/dates.ts for the clinic-timezone conversion this feeds into. */
const localDateTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time.");

export const createAppointmentSchema = z.object({
  patient_id: z.string().uuid(),
  pregnancy_id: z.string().uuid(),
  visit_number: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? Number(v) : undefined)),
  appointment_type: z.string().trim().min(1, "Appointment type is required.").max(100),
  scheduled_date_local: localDateTime,
  notes: optionalText(1000),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type CreateAppointmentValues = z.input<typeof createAppointmentSchema>;

export const rescheduleAppointmentSchema = z.object({
  new_scheduled_date_local: localDateTime,
  reason: z.string().trim().min(1, "A reason helps explain the change later.").max(500),
});

export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;

export const cancelAppointmentSchema = z.object({
  reason: z.string().trim().min(1, "A cancellation reason is required.").max(500),
});

export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const addAppointmentNoteSchema = z.object({
  note: z.string().trim().min(1, "Note can't be empty.").max(1000),
});

export type AddAppointmentNoteInput = z.infer<typeof addAppointmentNoteSchema>;
