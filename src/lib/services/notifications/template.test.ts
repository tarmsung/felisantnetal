import { describe, expect, it } from "vitest";
import { renderTemplate } from "./template";

describe("renderTemplate", () => {
  it("substitutes every provided token", () => {
    expect(
      renderTemplate("Hello {{patient_name}}, your visit is {{appointment_date}}.", {
        patient_name: "Chipo Nyathi",
        appointment_date: "23 Aug 2026, 14:00",
      }),
    ).toBe("Hello Chipo Nyathi, your visit is 23 Aug 2026, 14:00.");
  });

  it("leaves an unrecognized token untouched rather than substituting empty string", () => {
    expect(renderTemplate("Hello {{patient_name}}, {{unknown_token}}", { patient_name: "Chipo" })).toBe(
      "Hello Chipo, {{unknown_token}}",
    );
  });

  it("is a no-op on a template with no tokens", () => {
    expect(renderTemplate("Plain text, no placeholders.", { patient_name: "Chipo" })).toBe(
      "Plain text, no placeholders.",
    );
  });

  it("substitutes the same token every time it repeats", () => {
    expect(renderTemplate("{{patient_name}} {{patient_name}}", { patient_name: "Chipo" })).toBe(
      "Chipo Chipo",
    );
  });
});
