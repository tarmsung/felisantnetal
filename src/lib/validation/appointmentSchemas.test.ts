import { describe, expect, it } from "vitest";
import {
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  cancelAppointmentSchema,
  addAppointmentNoteSchema,
} from "./appointmentSchemas";

const validUuid = "11111111-1111-4111-8111-111111111111";

describe("createAppointmentSchema", () => {
  const base = {
    patient_id: validUuid,
    pregnancy_id: validUuid,
    visit_number: "3",
    appointment_type: "ANC Visit",
    scheduled_date_local: "2026-09-01T09:00",
    notes: "",
  };

  it("accepts a well-formed appointment", () => {
    expect(createAppointmentSchema.safeParse(base).success).toBe(true);
  });

  it("coerces visit_number to a number and allows it to be blank", () => {
    const result = createAppointmentSchema.safeParse(base);
    expect(result.success && result.data.visit_number).toBe(3);

    const blank = createAppointmentSchema.safeParse({ ...base, visit_number: "" });
    expect(blank.success && blank.data.visit_number).toBeUndefined();
  });

  it("rejects a malformed datetime-local value", () => {
    const result = createAppointmentSchema.safeParse({
      ...base,
      scheduled_date_local: "2026-09-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing appointment type", () => {
    const result = createAppointmentSchema.safeParse({ ...base, appointment_type: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid patient id", () => {
    const result = createAppointmentSchema.safeParse({ ...base, patient_id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

describe("rescheduleAppointmentSchema", () => {
  it("requires both a new date and a reason", () => {
    expect(
      rescheduleAppointmentSchema.safeParse({
        new_scheduled_date_local: "2026-09-01T09:00",
        reason: "Patient requested a later slot",
      }).success,
    ).toBe(true);

    expect(
      rescheduleAppointmentSchema.safeParse({
        new_scheduled_date_local: "2026-09-01T09:00",
        reason: "",
      }).success,
    ).toBe(false);
  });
});

describe("cancelAppointmentSchema", () => {
  it("requires a non-empty reason", () => {
    expect(cancelAppointmentSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(cancelAppointmentSchema.safeParse({ reason: "No longer needed" }).success).toBe(true);
  });
});

describe("addAppointmentNoteSchema", () => {
  it("requires a non-empty note", () => {
    expect(addAppointmentNoteSchema.safeParse({ note: "" }).success).toBe(false);
    expect(addAppointmentNoteSchema.safeParse({ note: "Called patient" }).success).toBe(true);
  });
});
