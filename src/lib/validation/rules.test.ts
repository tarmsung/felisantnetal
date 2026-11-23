import { describe, expect, it } from "vitest";
import {
  checkAppointmentDateTime,
  checkVisitDate,
  ageInYears,
  checkPatientDates,
  isRealDate,
  normalizeName,
  normalizeZimNationalId,
  normalizeZimPhone,
} from "./rules";

const TODAY = "2026-11-23";

describe("isRealDate", () => {
  it("accepts real dates, including a leap day", () => {
    expect(isRealDate("2026-11-23")).toBe(true);
    expect(isRealDate("2028-02-29")).toBe(true);
  });
  it("rejects dates that only LOOK like dates", () => {
    expect(isRealDate("2026-02-31")).toBe(false);
    expect(isRealDate("2026-13-01")).toBe(false);
    expect(isRealDate("2027-02-29")).toBe(false);
    expect(isRealDate("2026-00-10")).toBe(false);
    expect(isRealDate("26-11-23")).toBe(false);
  });
});

describe("ageInYears", () => {
  it("counts completed years only", () => {
    expect(ageInYears("2000-11-24", TODAY)).toBe(25);
    expect(ageInYears("2000-11-23", TODAY)).toBe(26);
  });
});

describe("normalizeZimNationalId", () => {
  it("accepts the common written forms and returns ONE canonical form", () => {
    for (const raw of ["63-123456A42", "63-123456 A 42", "63123456a42", "63 123456 A42", "63-123456-A-42"]) {
      expect(normalizeZimNationalId(raw)).toBe("63-123456A42");
    }
  });
  it("accepts 7-digit serials", () => {
    expect(normalizeZimNationalId("752061055S50")).toBe("75-2061055S50");
    expect(normalizeZimNationalId("75-2061055-S-50")).toBe("75-2061055S50");
  });
  it("rejects what isn't a Zimbabwean ID shape", () => {
    expect(normalizeZimNationalId("5819590177")).toBeNull(); // no letter
    expect(normalizeZimNationalId("63-12345A42")).toBeNull(); // serial too short
    expect(normalizeZimNationalId("63-12345678A42")).toBeNull(); // serial too long
    expect(normalizeZimNationalId("63-123456AB42")).toBeNull(); // two letters
    expect(normalizeZimNationalId("63-123456A4")).toBeNull(); // short tail
    expect(normalizeZimNationalId("00-123456A42")).toBeNull(); // no district 00
    expect(normalizeZimNationalId("63-123456A00")).toBeNull();
    expect(normalizeZimNationalId("not an id")).toBeNull();
    expect(normalizeZimNationalId("")).toBeNull();
  });
  it("is idempotent, so the server can re-normalise what the form already normalised", () => {
    const once = normalizeZimNationalId("63 123456 a 42")!;
    expect(normalizeZimNationalId(once)).toBe(once);
  });
});

describe("normalizeZimPhone", () => {
  it("accepts every common way of writing a mobile number", () => {
    for (const raw of ["0771234567", "077 123 4567", "077-123-4567", "+263771234567", "+263 77 123 4567", "263771234567", "771234567", "00263771234567"]) {
      expect(normalizeZimPhone(raw)).toBe("0771234567");
    }
  });
  it("accepts all four mobile operators", () => {
    for (const p of ["0712345678", "0732345678", "0772345678", "0782345678"]) expect(normalizeZimPhone(p)).toBe(p);
  });
  it("accepts a landline", () => {
    expect(normalizeZimPhone("0279 22 345")).toBe("027922345");
  });
  it("rejects wrong lengths, foreign prefixes and junk", () => {
    expect(normalizeZimPhone("07712345")).toBeNull(); // mobile too short
    expect(normalizeZimPhone("07712345678")).toBeNull(); // mobile too long
    expect(normalizeZimPhone("0751234567")).toBeNull(); // 75 isn't an operator prefix
    expect(normalizeZimPhone("0000000000")).toBeNull();
    expect(normalizeZimPhone("abcdefghij")).toBeNull();
    expect(normalizeZimPhone("")).toBeNull();
  });
});

describe("normalizeName", () => {
  it("accepts ordinary names and collapses spacing", () => {
    expect(normalizeName("  Chipo   Nyathi ")).toBe("Chipo Nyathi");
    expect(normalizeName("Tendai O'Brien-Moyo")).toBe("Tendai O'Brien-Moyo");
    expect(normalizeName("Zoë Ndlovu")).toBe("Zoë Ndlovu");
  });
  it("rejects digits, symbols and single characters", () => {
    expect(normalizeName("Chipo123")).toBeNull();
    expect(normalizeName("<script>")).toBeNull();
    expect(normalizeName("A")).toBeNull();
    expect(normalizeName("12345")).toBeNull();
  });
});

describe("checkPatientDates", () => {
  const ok = { date_of_birth: "1998-05-10", lmp: "2026-06-01", edd: "2027-03-08" };

  it("passes a coherent patient", () => {
    expect(checkPatientDates(ok, TODAY)).toEqual([]);
  });
  it("passes when only the required EDD is given", () => {
    expect(checkPatientDates({ edd: "2027-02-01" }, TODAY)).toEqual([]);
  });

  it("rejects a future date of birth (a real record in the live data had 2027-12-20)", () => {
    const r = checkPatientDates({ ...ok, date_of_birth: "2027-12-20" }, TODAY);
    expect(r).toEqual([{ path: "date_of_birth", message: "Date of birth can't be in the future." }]);
  });
  it("rejects an implausible age, young or old", () => {
    expect(checkPatientDates({ ...ok, date_of_birth: "2026-11-19" }, TODAY)[0].path).toBe("date_of_birth"); // a newborn
    expect(checkPatientDates({ ...ok, date_of_birth: "1850-01-01" }, TODAY)[0].message).toMatch(/check the year/);
    expect(checkPatientDates({ ...ok, date_of_birth: "2020-01-01" }, TODAY)[0].message).toMatch(/check the year/);
  });
  it("rejects a non-existent calendar date", () => {
    expect(checkPatientDates({ ...ok, date_of_birth: "1998-02-31" }, TODAY)[0].message).toMatch(/real calendar date/);
  });

  it("rejects an LMP in the future or absurdly old", () => {
    expect(checkPatientDates({ ...ok, lmp: "2026-12-30", edd: "2027-09-01" }, TODAY).some((i) => i.path === "lmp")).toBe(true);
    expect(checkPatientDates({ ...ok, lmp: "2025-01-01" }, TODAY).some((i) => i.path === "lmp")).toBe(true);
  });
  it("rejects an EDD in the distant past or far future", () => {
    expect(checkPatientDates({ edd: "2026-01-01" }, TODAY)[0].message).toMatch(/4 weeks in the past/);
    expect(checkPatientDates({ edd: "2028-06-01" }, TODAY)[0].message).toMatch(/42 weeks away/);
  });
  it("allows an EDD that is only a few days overdue", () => {
    expect(checkPatientDates({ edd: "2026-11-10" }, TODAY)).toEqual([]);
  });
  it("rejects an EDD that isn't ~40 weeks after the LMP", () => {
    const early = checkPatientDates({ lmp: "2026-06-01", edd: "2026-12-01" }, TODAY);
    expect(early[0].message).toMatch(/about 40 weeks after the LMP/);
    const before = checkPatientDates({ lmp: "2026-06-01", edd: "2026-05-01" }, TODAY);
    expect(before.some((i) => i.path === "edd")).toBe(true);
  });
});

describe("checkAppointmentDateTime", () => {
  const NOW = Date.parse("2026-11-23T10:00:00Z"); // 12:00 clinic time
  it("accepts a sensible future slot, and 'right now' within the grace window", () => {
    expect(checkAppointmentDateTime("2026-12-01T09:00", NOW)).toBeNull();
    expect(checkAppointmentDateTime("2026-11-23T11:55", NOW)).toBeNull();
  });
  it("rejects the past, impossible dates/times and the far future", () => {
    expect(checkAppointmentDateTime("2026-11-23T09:00", NOW)).toMatch(/already passed/);
    expect(checkAppointmentDateTime("2026-02-30T09:00", NOW)).toMatch(/real date/);
    expect(checkAppointmentDateTime("2026-12-01T24:30", NOW)).toMatch(/real date/);
    expect(checkAppointmentDateTime("2026-12-01T09:75", NOW)).toMatch(/real date/);
    expect(checkAppointmentDateTime("2028-01-01T09:00", NOW)).toMatch(/10 months/);
  });
});

describe("checkVisitDate", () => {
  it("accepts today and a recent past date", () => {
    expect(checkVisitDate("2026-11-23", TODAY)).toBeNull();
    expect(checkVisitDate("2026-10-01", TODAY)).toBeNull();
  });
  it("rejects the future, a non-existent date and a very old one", () => {
    expect(checkVisitDate("2026-11-24", TODAY)).toMatch(/future/);
    expect(checkVisitDate("2026-02-30", TODAY)).toMatch(/real calendar date/);
    expect(checkVisitDate("2025-01-01", TODAY)).toMatch(/11 months/);
  });
});

describe("checkPatientDates — edit mode", () => {
  const pastDue = { date_of_birth: "1995-03-21", lmp: "2026-01-01", edd: "2026-10-08" }; // due 6 weeks ago
  it("blocks registering a pregnancy whose due date is long past", () => {
    expect(checkPatientDates(pastDue, TODAY, "register").map((i) => i.path)).toEqual(["lmp", "edd"]);
  });
  it("still lets that mother's record be edited (e.g. a phone change)", () => {
    expect(checkPatientDates(pastDue, TODAY, "edit")).toEqual([]);
  });
  it("keeps the always-wrong rules on edit", () => {
    expect(checkPatientDates({ date_of_birth: "2027-12-20", edd: "2026-10-08" }, TODAY, "edit")[0].path).toBe("date_of_birth");
    expect(checkPatientDates({ lmp: "2026-11-19", edd: "2028-06-19" }, TODAY, "edit")[0].message).toMatch(/42 weeks away/);
    expect(checkPatientDates({ lmp: "2026-06-01", edd: "2026-12-01" }, TODAY, "edit")[0].message).toMatch(/about 40 weeks/);
  });
});
