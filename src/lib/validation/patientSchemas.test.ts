import { describe, expect, it } from "vitest";
import { patientFormSchema } from "./patientSchemas";

const validCommunityHealthWorkerId = "11111111-1111-4111-8111-111111111111";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    full_name: "Jane Moyo",
    national_id: "",
    date_of_birth: "",
    phone: "",
    alternative_phone: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    community_health_worker_id: validCommunityHealthWorkerId,
    notes: "",
    gravida: "",
    para: "",
    lmp: "",
    edd: "2026-12-01",
    gestational_information: "",
    ...overrides,
  };
}

describe("patientFormSchema", () => {
  it("accepts the minimum required fields with everything else blank", () => {
    const result = patientFormSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.national_id).toBeUndefined();
      expect(result.data.gravida).toBeUndefined();
    }
  });

  it("rejects a missing full name", () => {
    const result = patientFormSchema.safeParse(baseInput({ full_name: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a missing EDD", () => {
    const result = patientFormSchema.safeParse(baseInput({ edd: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a missing community health worker", () => {
    const result = patientFormSchema.safeParse(
      baseInput({ community_health_worker_id: "" }),
    );
    expect(result.success).toBe(false);
  });

  it("coerces gravida/para strings to numbers", () => {
    const result = patientFormSchema.safeParse(baseInput({ gravida: "2", para: "1" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gravida).toBe(2);
      expect(result.data.para).toBe(1);
    }
  });

  it("rejects a negative gravida", () => {
    const result = patientFormSchema.safeParse(baseInput({ gravida: "-1" }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric gravida", () => {
    const result = patientFormSchema.safeParse(baseInput({ gravida: "two" }));
    expect(result.success).toBe(false);
  });

  it("treats blank optional fields as undefined, not empty strings", () => {
    const result = patientFormSchema.safeParse(baseInput({ phone: "" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeUndefined();
    }
  });
});
