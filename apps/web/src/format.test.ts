import { describe, expect, it } from "vitest";
import { longDay } from "./format";

// `longDay` turns the day-stamp the record is opened with into the line the map
// shows — «Active since …». It parses the stamp by hand rather than through
// `new Date()`, because a bare "YYYY-MM-DD" is read as UTC midnight and would
// slip a day west of Greenwich. These pin the shape a reader sees, not the clock.
describe("longDay", () => {
  it("writes an English stamp as a month name, an ordinal day, and a year", () => {
    expect(longDay("2026-09-01", "en")).toBe("Sept 1st, 2026");
  });

  it("writes an Arabic stamp as day, Arabic month name, year, in Arabic digits", () => {
    expect(longDay("2026-03-18", "ar")).toBe("١٨ مارس ٢٠٢٦");
  });

  it("gets the English ordinal right across the awkward cases", () => {
    expect(longDay("2026-01-02", "en")).toBe("Jan 2nd, 2026");
    expect(longDay("2026-01-03", "en")).toBe("Jan 3rd, 2026");
    expect(longDay("2026-01-11", "en")).toBe("Jan 11th, 2026");
    expect(longDay("2026-01-12", "en")).toBe("Jan 12th, 2026");
    expect(longDay("2026-01-13", "en")).toBe("Jan 13th, 2026");
    expect(longDay("2026-01-21", "en")).toBe("Jan 21st, 2026");
    expect(longDay("2026-01-22", "en")).toBe("Jan 22nd, 2026");
    expect(longDay("2026-01-23", "en")).toBe("Jan 23rd, 2026");
  });

  it("does not shift the day at a timezone boundary", () => {
    // A "YYYY-MM-DD" fed to `new Date()` is UTC midnight; rendered in a western
    // zone it reads as the evening before. Parsing the fields by hand keeps the
    // first of the month the first of the month.
    expect(longDay("2026-09-01", "en")).toBe("Sept 1st, 2026");
    expect(longDay("2026-09-01", "ar")).toBe("١ سبتمبر ٢٠٢٦");
  });

  it("leaves a stamp it cannot parse alone, only localising its digits", () => {
    expect(longDay("not-a-date", "en")).toBe("not-a-date");
    expect(longDay("2026-13-01", "en")).toBe("2026-13-01");
    expect(longDay("2026-13-01", "ar")).toBe("٢٠٢٦-١٣-٠١");
  });
});
