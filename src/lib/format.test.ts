import { describe, expect, it } from "vitest";
import { formatDateTime, parseApiDate } from "./format";

describe("parseApiDate", () => {
  it("reads the API's UTC timestamps as the instant they name", () => {
    expect(parseApiDate("2026-10-04T12:00:00Z").toISOString()).toBe("2026-10-04T12:00:00.000Z");
  });

  it("honours an offset", () => {
    expect(parseApiDate("2026-10-04T14:00:00+02:00").toISOString()).toBe("2026-10-04T12:00:00.000Z");
  });

  it("round-trips through toISOString, which is what the frontend sends back", () => {
    const iso = "2026-10-03T18:18:02.000Z";
    expect(parseApiDate(iso).toISOString()).toBe(iso);
  });
});

describe("formatDateTime", () => {
  // The expected strings are built from the local clock, so the test holds in any timezone.
  const local = (iso: string) => parseApiDate(iso);

  it("writes osTicket's style: no zero padding, a 12-hour clock", () => {
    const d = local("2026-10-04T18:45:00Z");
    const h = d.getHours();
    expect(formatDateTime("2026-10-04T18:45:00Z")).toBe(`${d.getMonth() + 1}/${d.getDate()}/26 ${h % 12 || 12}:45 ${h < 12 ? "AM" : "PM"}`);
  });

  it("shows midnight and noon as 12", () => {
    expect(formatDateTime("2026-01-05T00:05:00Z")).toMatch(/ (12:05 AM|\d{1,2}:05 (AM|PM))$/);
    const noon = local("2026-01-05T12:00:00Z");
    expect(formatDateTime("2026-01-05T12:00:00Z").endsWith(`${noon.getHours() % 12 || 12}:00 ${noon.getHours() < 12 ? "AM" : "PM"}`)).toBe(true);
  });

  it("returns an empty string for a missing value", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime(undefined)).toBe("");
  });
});
