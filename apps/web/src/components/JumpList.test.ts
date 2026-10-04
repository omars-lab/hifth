import { describe, expect, it } from "vitest";
import { stringsFor } from "../i18n";
import { lastWhen, listPlace } from "./JumpList";

describe("lastWhen: when a jump last happened, in words", () => {
  const t = stringsFor("en");
  // A Wednesday afternoon, local time.
  const now = new Date(2026, 9, 7, 15, 0).getTime();
  const at = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h).getTime();

  it("says today for earlier the same day, even just after midnight", () => {
    expect(lastWhen(at(2026, 9, 7, 0), now, "en", t)).toBe("today");
  });
  it("says yesterday for the day before, even late at night", () => {
    expect(lastWhen(at(2026, 9, 6, 23), now, "en", t)).toBe("yesterday");
  });
  it("names the weekday within the last week", () => {
    expect(lastWhen(at(2026, 9, 2), now, "en", t)).toBe("on Friday");
  });
  it("gives the date once it is a week or more ago", () => {
    expect(lastWhen(at(2026, 8, 30), now, "en", t)).toBe("on 30 Sept");
  });
});

describe("listPlace: where the list stands", () => {
  const screen = 800;
  it("opens below a mark high on the screen", () => {
    expect(listPlace({ top: 200, bottom: 220 }, 100, screen)).toEqual({ top: 228 });
  });
  it("opens above the whole verse when the mark is low, so the verse's arrow stays in sight", () => {
    expect(listPlace({ top: 600, bottom: 620 }, 400, screen)).toEqual({ bottom: 408, maxBlockSize: 380 });
  });
  it("opens below the mark after all when the verse starts at the top of the screen", () => {
    expect(listPlace({ top: 440, bottom: 460 }, 150, screen)).toEqual({ top: 468, maxBlockSize: 320 });
  });
  it("stands by the mark when neither side has room", () => {
    expect(listPlace({ top: 600, bottom: 620 }, 150, screen)).toEqual({ bottom: 208 });
  });
  it("stands by the mark when the verse is not on the screen", () => {
    expect(listPlace({ top: 600, bottom: 620 }, null, screen)).toEqual({ bottom: 208, maxBlockSize: 580 });
  });
});
