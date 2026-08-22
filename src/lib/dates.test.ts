import { describe, expect, it } from "vitest";
import {
  calculateAge,
  calculateEddCountdown,
  formatDisplayDate,
  clinicLocalDateTimeToIso,
  isoToClinicDateTimeLocal,
  formatClinicDateTime,
  formatClinicTime,
  clinicDateKey,
  addDaysToIsoDate,
} from "./dates";

describe("calculateAge", () => {
  const today = new Date(2026, 7, 22); // 22 Aug 2026

  it("returns null for no date of birth", () => {
    expect(calculateAge(null, today)).toBeNull();
  });

  it("computes age when birthday has already passed this year", () => {
    expect(calculateAge("2000-01-15", today)).toBe(26);
  });

  it("computes age when birthday hasn't happened yet this year", () => {
    expect(calculateAge("2000-12-15", today)).toBe(25);
  });

  it("handles a birthday that is today", () => {
    expect(calculateAge("2000-08-22", today)).toBe(26);
  });
});

describe("calculateEddCountdown", () => {
  const today = new Date(2026, 7, 22); // 22 Aug 2026

  it("returns null for no EDD", () => {
    expect(calculateEddCountdown(null, today)).toBeNull();
  });

  it("reports days to go for a future EDD", () => {
    const result = calculateEddCountdown("2026-09-05", today); // 14 days out
    expect(result?.isPast).toBe(false);
    expect(result?.days).toBe(14);
    expect(result?.label).toContain("to go");
  });

  it("reports overdue for a past EDD", () => {
    const result = calculateEddCountdown("2026-08-10", today); // 12 days ago
    expect(result?.isPast).toBe(true);
    expect(result?.days).toBe(-12);
    expect(result?.label).toContain("overdue");
  });

  it("reports due today", () => {
    const result = calculateEddCountdown("2026-08-22", today);
    expect(result?.days).toBe(0);
    expect(result?.label).toBe("Due today");
  });
});

describe("formatDisplayDate", () => {
  it("returns an em dash for null", () => {
    expect(formatDisplayDate(null)).toBe("—");
  });

  it("formats a valid date", () => {
    expect(formatDisplayDate("2026-08-22")).toMatch(/22 Aug 2026/);
  });

  it("returns an em dash for an invalid date string", () => {
    expect(formatDisplayDate("not-a-date")).toBe("—");
  });
});

describe("addDaysToIsoDate", () => {
  it("adds days within the same month", () => {
    expect(addDaysToIsoDate("2026-08-01", 10)).toBe("2026-08-11");
  });

  it("rolls over into the next month", () => {
    expect(addDaysToIsoDate("2026-08-25", 10)).toBe("2026-09-04");
  });

  it("rolls over into the next year", () => {
    expect(addDaysToIsoDate("2026-12-28", 10)).toBe("2027-01-07");
  });

  it("supports negative offsets", () => {
    expect(addDaysToIsoDate("2026-09-04", -10)).toBe("2026-08-25");
  });

  it("returns null for an unparseable date", () => {
    expect(addDaysToIsoDate("not-a-date", 7)).toBeNull();
  });
});

describe("clinic timezone conversions (Harare, fixed UTC+2, no DST)", () => {
  it("converts a datetime-local value to the correct UTC instant", () => {
    // 09:00 in Harare (UTC+2) is 07:00 UTC.
    expect(clinicLocalDateTimeToIso("2026-09-01T09:00")).toBe(
      "2026-09-01T07:00:00.000Z",
    );
  });

  it("returns null for an empty value", () => {
    expect(clinicLocalDateTimeToIso("")).toBeNull();
  });

  it("round-trips through isoToClinicDateTimeLocal back to the original wall-clock time", () => {
    const iso = clinicLocalDateTimeToIso("2026-09-01T09:00");
    expect(isoToClinicDateTimeLocal(iso)).toBe("2026-09-01T09:00");
  });

  it("formats a UTC instant back into Harare wall-clock time for display", () => {
    // 07:00 UTC is 09:00 in Harare.
    // en-GB abbreviates September as "Sept" in some ICU versions, "Sep" in others.
    expect(formatClinicDateTime("2026-09-01T07:00:00.000Z")).toMatch(
      /1 Sept? 2026, 09:00/,
    );
    expect(formatClinicTime("2026-09-01T07:00:00.000Z")).toBe("09:00");
  });

  it("groups a late-evening UTC timestamp under the correct Harare calendar day", () => {
    // 23:30 UTC on the 31st is 01:30 Harare time on the 1st — this is
    // exactly the kind of boundary a naive UTC date-slice would get wrong.
    expect(clinicDateKey("2026-08-31T23:30:00.000Z")).toBe("2026-09-01");
  });
});
