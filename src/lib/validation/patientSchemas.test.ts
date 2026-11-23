import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { patientFormSchema } from "./patientSchemas";

// Dates are validated against "today", so pin it — these tests must not rot as time passes.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-23T10:00:00Z"));
});
afterAll(() => vi.useRealTimers());

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

  describe("field rules (Phase 11)", () => {
    const issuesFor = (overrides: Record<string, unknown>) => {
      const r = patientFormSchema.safeParse(baseInput(overrides));
      return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    };

    it("accepts a fully-filled, coherent registration and normalises ID, phone and name", () => {
      const r = patientFormSchema.safeParse(
        baseInput({
          full_name: "  Chipo   Nyathi ",
          national_id: "63 123456 a 42",
          date_of_birth: "1998-05-10",
          phone: "+263 77 123 4567",
          emergency_contact_name: "Tendai Nyathi",
          emergency_contact_phone: "0712345678",
          gravida: "3",
          para: "2",
          lmp: "2026-06-01",
          edd: "2027-03-08",
        }),
      );
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.full_name).toBe("Chipo Nyathi");
        expect(r.data.national_id).toBe("63-123456A42");
        expect(r.data.phone).toBe("0771234567");
      }
    });

    it("rejects national IDs that aren't Zimbabwean-shaped", () => {
      for (const bad of ["5819590177", "63-12345A42", "ABC", "63-123456AB42"]) {
        expect(issuesFor({ national_id: bad }).join()).toMatch(/national_id: Enter a valid Zimbabwean national ID/);
      }
    });

    it("rejects malformed phone numbers on every phone field", () => {
      for (const field of ["phone", "alternative_phone", "emergency_contact_phone"]) {
        expect(issuesFor({ [field]: "12345" }).join()).toMatch(new RegExp(`${field}: Enter a valid Zimbabwean number`));
      }
    });

    it("rejects names with digits or symbols", () => {
      expect(issuesFor({ full_name: "Chipo123" }).join()).toMatch(/full_name/);
      expect(issuesFor({ full_name: "<b>x</b>" }).join()).toMatch(/full_name/);
    });

    it("rejects a future date of birth, an implausible age and a non-existent date", () => {
      expect(issuesFor({ date_of_birth: "2027-12-20" })).toContain("date_of_birth: Date of birth can't be in the future.");
      expect(issuesFor({ date_of_birth: "2026-11-19" }).join()).toMatch(/date_of_birth: That makes the patient 0/);
      expect(issuesFor({ date_of_birth: "1998-02-31" }).join()).toMatch(/date_of_birth: That isn't a real calendar date/);
    });

    it("rejects an LMP/EDD pair that doesn't fit a ~40 week pregnancy", () => {
      expect(issuesFor({ lmp: "2026-06-01", edd: "2026-12-01" }).join()).toMatch(/edd: The due date is normally about 40 weeks/);
      expect(issuesFor({ lmp: "2026-12-30", edd: "2027-09-01" }).join()).toMatch(/lmp: Last menstrual period can't be in the future/);
    });

    it("rejects para greater than gravida, and a gravida of zero", () => {
      expect(issuesFor({ gravida: "1", para: "3" }).join()).toMatch(/para: Para \(previous births\) can't be more than gravida/);
      expect(issuesFor({ gravida: "0" }).join()).toMatch(/gravida/);
    });
  });
});
