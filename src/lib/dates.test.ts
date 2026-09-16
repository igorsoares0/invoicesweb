import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatDate,
  formatLongDate,
  formatShortDate,
  formatTimestamp,
  isValidIsoDate,
  todayIn,
} from "./dates";

describe("todayIn", () => {
  it("uses the business's time zone, not the server's", () => {
    const lateEveningUtc = new Date("2026-09-12T23:30:00Z");
    expect(todayIn("UTC", lateEveningUtc)).toBe("2026-09-12");
    expect(todayIn("Europe/Lisbon", lateEveningUtc)).toBe("2026-09-13");
    expect(todayIn("America/Los_Angeles", lateEveningUtc)).toBe("2026-09-12");
  });
});

describe("date arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-09-12", 14)).toBe("2026-09-26");
    expect(addDays("2026-12-25", 14)).toBe("2027-01-08");
  });

  it("counts days between calendar dates", () => {
    expect(daysBetween("2026-09-12", "2026-09-26")).toBe(14);
    expect(daysBetween("2026-09-12", "2026-09-05")).toBe(-7);
    // DST change in Europe doesn't matter for calendar days.
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("validates real calendar dates only", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("12/09/2026")).toBe(false);
  });
});

describe("formatting", () => {
  it("formats calendar dates without shifting them", () => {
    expect(formatDate("2026-09-01")).toBe("Sep 1, 2026");
    expect(formatLongDate("2026-09-26")).toBe("September 26, 2026");
    expect(formatShortDate("2026-08-31")).toBe("Aug 31");
  });

  it("formats timestamps in a given zone", () => {
    expect(formatTimestamp("2026-08-28T09:14:00Z", "Europe/Lisbon")).toBe("Aug 28, 10:14");
  });
});
