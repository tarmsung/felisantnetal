import { describe, expect, it } from "vitest";
import { formatPhoneForWhatsapp } from "./phone";

describe("formatPhoneForWhatsapp", () => {
  const cc = "263"; // Zimbabwe, this clinic's default

  it("returns null for an empty or non-numeric string", () => {
    expect(formatPhoneForWhatsapp("", cc)).toBeNull();
    expect(formatPhoneForWhatsapp("n/a", cc)).toBeNull();
  });

  it("converts a local trunk-prefix number to a WhatsApp JID", () => {
    expect(formatPhoneForWhatsapp("0771234567", cc)).toBe("263771234567@s.whatsapp.net");
  });

  it("leaves an already-international number alone (just adds the JID suffix)", () => {
    expect(formatPhoneForWhatsapp("263771234567", cc)).toBe("263771234567@s.whatsapp.net");
  });

  it("strips a leading + and any punctuation/spacing", () => {
    expect(formatPhoneForWhatsapp("+263 77 123 4567", cc)).toBe("263771234567@s.whatsapp.net");
    expect(formatPhoneForWhatsapp("077-123-4567", cc)).toBe("263771234567@s.whatsapp.net");
  });

  it("best-effort prepends the country code when there's no recognizable prefix", () => {
    expect(formatPhoneForWhatsapp("771234567", cc)).toBe("263771234567@s.whatsapp.net");
  });

  it("rejects a number that's too short to be real after normalization", () => {
    expect(formatPhoneForWhatsapp("12345", cc)).toBeNull();
  });

  it("rejects a number that's too long after normalization", () => {
    expect(formatPhoneForWhatsapp("0" + "1".repeat(20), cc)).toBeNull();
  });

  it("respects a different configured country code", () => {
    expect(formatPhoneForWhatsapp("0712345678", "27")).toBe("27712345678@s.whatsapp.net");
  });
});
