import { describe, expect, it } from "vitest";
import { loginSchema } from "./authSchemas";

describe("loginSchema", () => {
  it("accepts a valid email and non-empty password", () => {
    const result = loginSchema.safeParse({
      email: "nurse@felisclinic.org",
      password: "correct-password",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "correct-password",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "nurse@felisclinic.org",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing email field entirely", () => {
    const result = loginSchema.safeParse({ password: "correct-password" });
    expect(result.success).toBe(false);
  });
});
