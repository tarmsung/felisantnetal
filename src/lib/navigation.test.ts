import { describe, expect, it } from "vitest";
import { NAV_ITEMS, findNavItem } from "./navigation";

describe("navigation", () => {
  it("marks Users, Settings and Audit Logs as administrator-only", () => {
    const adminOnlyLabels = NAV_ITEMS.filter((item) => item.adminOnly).map(
      (item) => item.label,
    );
    expect(adminOnlyLabels.sort()).toEqual(
      ["Audit Logs", "Settings", "Users"].sort(),
    );
  });

  it("does not mark clinical modules as administrator-only", () => {
    const dashboard = NAV_ITEMS.find((item) => item.href === "/dashboard");
    expect(dashboard?.adminOnly).toBeFalsy();
  });

  it("finds the owning nav item for a nested route", () => {
    const item = findNavItem("/patients/123/profile");
    expect(item?.label).toBe("Patients");
  });

  it("returns undefined for an unknown route", () => {
    expect(findNavItem("/not-a-real-route")).toBeUndefined();
  });
});
