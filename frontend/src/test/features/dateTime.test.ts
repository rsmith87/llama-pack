import { describe, expect, it } from "vitest";
import { formatDateTime, normalizeDisplayTimeZone } from "../../features/dateTime/dateTime";

describe("dateTime formatting", () => {
  it("formats timestamps in the configured timezone", () => {
    const result = formatDateTime("2026-06-18T12:05:00Z", "America/Chicago");

    expect(result.label).toContain("Jun");
    expect(result.label).toContain("2026");
    expect(result.label).toContain("7:05");
    expect(result.title).toBe("2026-06-18T12:05:00.000Z");
  });

  it("returns invalid timestamp text unchanged", () => {
    expect(formatDateTime("not-a-date", "UTC")).toEqual({ label: "not-a-date", title: "not-a-date" });
  });

  it("rejects invalid timezone identifiers", () => {
    expect(() => normalizeDisplayTimeZone("Central")).toThrow(RangeError);
  });
});
