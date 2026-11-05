import { afterEach, describe, expect, it, vi } from "vitest";
import { dayKeyOf, formatTime, zonedParts, zonedTimeToUtc } from "./dates";

const DHAKA = "Asia/Dhaka";
// 2026-11-05 22:50 UTC is 2026-11-06 04:50 in Dhaka (UTC+6).
const INSTANT = new Date("2026-11-05T22:50:00.000Z");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("zonedParts", () => {
  it("reads wall-clock parts in Dhaka", () => {
    expect(zonedParts(INSTANT, DHAKA)).toEqual({ year: 2026, month: 11, day: 6, hour: 4, minute: 50 });
    expect(dayKeyOf(INSTANT, DHAKA)).toBe("2026-11-06");
  });

  it("gives the same answer when Intl cannot format time zone parts", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts").mockImplementation(() => {
      throw new RangeError("formatToParts is not supported");
    });
    expect(zonedParts(INSTANT, DHAKA)).toEqual({ year: 2026, month: 11, day: 6, hour: 4, minute: 50 });
    expect(zonedTimeToUtc("2026-11-06", 4, 50, DHAKA).toISOString()).toBe(INSTANT.toISOString());
  });

  it("refuses an unknown zone when Intl cannot help", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts").mockImplementation(() => {
      throw new RangeError("formatToParts is not supported");
    });
    expect(() => zonedParts(INSTANT, "Europe/London")).toThrow(/not supported/);
  });
});

describe("formatTime", () => {
  it("falls back to an en-US style clock", () => {
    // `format` is a getter that returns the bound formatting function, so the getter is replaced.
    const prototype = Intl.DateTimeFormat.prototype as unknown as { format: unknown };
    vi.spyOn(prototype, "format", "get").mockReturnValue(() => {
      throw new RangeError("time zones are not supported");
    });
    vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts").mockImplementation(() => {
      throw new RangeError("formatToParts is not supported");
    });
    expect(formatTime(INSTANT, DHAKA)).toBe("4:50 AM");
  });
});
