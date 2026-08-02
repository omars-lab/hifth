import { describe, expect, it } from "vitest";
import {
  comparableEvents,
  dayOf,
  daysBetween,
  editionOf,
  lastSeen,
  rollUp,
  scopesOf,
  type RevisionEvent,
} from "./revision.js";

const EDITION = "hafs-kfqc";
const key = (surah: number, ayah: number) => `quran/${EDITION}/${surah}:${ayah}`;

/** A look, with sensible defaults so each test states only what it is about. */
function look(over: Partial<RevisionEvent> = {}): RevisionEvent {
  return {
    key: key(2, 48),
    page: 7,
    at: Date.parse("2026-03-09T12:00:00Z"),
    tz: 0,
    ...over,
  };
}

describe("dayOf", () => {
  it("files a look under the day the reader was living in, not under UTC", () => {
    // 22:00 in Riyadh (+03) is already the next day in UTC. A record that
    // disagreed with the reader's own calendar would show a revision they made
    // last night as having happened today.
    const evening = look({ at: Date.parse("2026-03-09T19:00:00Z"), tz: 180 });
    expect(evening.at).toBe(Date.parse("2026-03-09T19:00:00Z"));
    expect(dayOf(evening)).toBe("2026-03-09");

    const later = look({ at: Date.parse("2026-03-09T21:30:00Z"), tz: 180 });
    expect(dayOf(later)).toBe("2026-03-10"); // 00:30 local
  });

  it("counts a late-night session and the small hours after it as two days", () => {
    // The case a hafiz will actually hit: 23:40 and 00:20 are forty minutes
    // apart and belong to different days, because that is how they count them.
    const before = look({ at: Date.parse("2026-03-10T04:40:00Z"), tz: -300 });
    const after = look({ at: Date.parse("2026-03-10T05:20:00Z"), tz: -300 });
    expect(dayOf(before)).toBe("2026-03-09");
    expect(dayOf(after)).toBe("2026-03-10");
  });

  it("uses the offset in force when the look happened, not the one in force now", () => {
    // This is why `tz` rides on the event. The same instant lands on either side
    // of midnight depending on which offset you apply, so a single offset read
    // at display time silently re-files every event from the other side of a DST
    // change — including, on the summer/winter seam, an entire evening.
    const at = Date.parse("2025-11-02T04:30:00Z");
    expect(dayOf(look({ at, tz: -300 }))).toBe("2025-11-01"); // 23:30, winter
    expect(dayOf(look({ at, tz: -240 }))).toBe("2025-11-02"); // 00:30, summer
  });

  it("pads a stamp so days sort as strings", () => {
    // `lastSeen` compares stamps with `>`. An unpadded "2026-3-9" would sort
    // after "2026-10-01" and quietly report a stale day as the most recent.
    expect(dayOf(look({ at: Date.parse("2026-03-09T12:00:00Z") }))).toBe("2026-03-09");
    expect(dayOf(look({ at: Date.parse("2026-10-01T12:00:00Z") }))).toBe("2026-10-01");
    expect("2026-03-09" < "2026-10-01").toBe(true);
  });
});

describe("scopesOf", () => {
  it("gives a page exactly one id, however long the passage", () => {
    // A marquee is drawn on one page's stage, so a passage cannot straddle two.
    const passage = look({ key: key(2, 40), endKey: key(2, 48), page: 7 });
    expect(scopesOf(passage, "page")).toEqual([7]);
  });

  it("credits both juz when a passage crosses the boundary between them", () => {
    // Juz 2 begins at 2:142, and a page can sit across that line. The reader
    // looked at both, so both are coloured — crediting only the anchor would
    // leave a juz permanently cold that was in fact read this morning.
    const across = look({ key: key(2, 141), endKey: key(2, 142) });
    expect(scopesOf(across, "juz")).toEqual([1, 2]);
    expect(scopesOf(look({ key: key(2, 48) }), "juz")).toEqual([1]);
    expect(scopesOf(look({ key: key(78, 1) }), "juz")).toEqual([30]);
  });

  it("credits both hizb when a passage crosses the boundary between them", () => {
    // Same rule one division finer. Hizb 2 begins at 2:75, so a page sitting
    // across that line colours both — twice as many boundaries as juz means a
    // passage straddles more often, not less.
    const across = look({ key: key(2, 74), endKey: key(2, 75) });
    expect(scopesOf(across, "hizb")).toEqual([1, 2]);
    expect(scopesOf(look({ key: key(2, 48) }), "hizb")).toEqual([1]);
    expect(scopesOf(look({ key: key(87, 1) }), "hizb")).toEqual([60]);
  });

  it("does not put a hizb boundary at its juz's midpoint", () => {
    // The one derivation that must never be used. Juz 2 runs 2:142 → 2:252; its
    // arithmetic midpoint is 2:197, and halving would open hizb 4 there. The real
    // division opens it at 2:203, six ayahs later — so an event at 2:197 belongs
    // to hizb 3, and a record built on the shortcut would file it under 4.
    expect(scopesOf(look({ key: key(2, 197) }), "juz")).toEqual([2]);
    expect(scopesOf(look({ key: key(2, 197) }), "hizb")).toEqual([3]);
    expect(scopesOf(look({ key: key(2, 203) }), "hizb")).toEqual([4]);
  });

  it("orders the ids ascending even if the passage was dragged backwards", () => {
    const backwards = look({ key: key(2, 142), endKey: key(2, 141) });
    expect(scopesOf(backwards, "juz")).toEqual([1, 2]);
  });

  it("leaves a gap rather than guessing when the record is corrupt", () => {
    // A wrong square in a heatmap is unrecoverable — nobody can tell it from a
    // real one. A missing square is visibly missing.
    expect(scopesOf(look({ key: "not-an-ayah-key" }), "juz")).toEqual([]);
    expect(scopesOf(look({ key: key(2, 9999) }), "juz")).toEqual([]);
    expect(scopesOf(look({ page: 0 }), "page")).toEqual([]);
    expect(scopesOf(look({ page: 1.5 }), "page")).toEqual([]);
  });
});

describe("rollUp", () => {
  it("counts one gesture once, not once per ayah it covered", () => {
    // The whole reason a passage is one event: twelve ayahs dragged over in one
    // second would otherwise outweigh a page read carefully for ten minutes.
    const day = rollUp([look({ key: key(2, 40), endKey: key(2, 48) })], "page");
    expect(day.get("2026-03-09")?.get(7)).toBe(1);
  });

  it("adds up separate looks at the same scope on the same day", () => {
    const events = [look(), look({ at: Date.parse("2026-03-09T15:00:00Z") })];
    expect(rollUp(events, "page").get("2026-03-09")?.get(7)).toBe(2);
  });

  it("keeps days apart", () => {
    const events = [look(), look({ at: Date.parse("2026-03-11T12:00:00Z") })];
    const byDay = rollUp(events, "page");
    expect([...byDay.keys()].sort()).toEqual(["2026-03-09", "2026-03-11"]);
  });

  it("drops what it cannot place instead of bucketing it somewhere", () => {
    const byDay = rollUp([look({ key: "quran/x" }), look()], "juz");
    expect(byDay.get("2026-03-09")?.size).toBe(1);
  });

  it("is a function of its input alone — no clock, no order dependence", () => {
    // Clocklessness is what makes a day-boundary test arithmetic rather than a
    // mocked global, and it is the reason this module can be trusted in a test
    // that runs at any hour on any machine.
    const events = [look({ at: Date.parse("2026-03-11T12:00:00Z") }), look()];
    const forward = rollUp(events, "page");
    const backward = rollUp([...events].reverse(), "page");
    expect([...forward].map(([d, c]) => [d, [...c]]).sort()).toEqual(
      [...backward].map(([d, c]) => [d, [...c]]).sort(),
    );
  });
});

describe("lastSeen", () => {
  it("answers with the most recent day, whatever order the log is in", () => {
    // The record is appended per day and read back as one array; nothing
    // promises it arrives sorted, and a max computed by "last one wins" would
    // be wrong exactly when a day was written out of order.
    const events = [
      look({ at: Date.parse("2026-03-20T12:00:00Z") }),
      look({ at: Date.parse("2026-03-09T12:00:00Z") }),
    ];
    expect(lastSeen(events, "page").get(7)).toBe("2026-03-20");
    expect(lastSeen([...events].reverse(), "page").get(7)).toBe("2026-03-20");
  });

  it("says nothing at all about a scope never opened", () => {
    // Not day zero, not "never" as a string — absent. A caller that renders a
    // missing entry as an ancient date invents a revision that never happened.
    expect(lastSeen([look()], "page").has(19)).toBe(false);
  });

  it("does not care how many times, only when", () => {
    const many = [look(), look(), look()];
    expect(lastSeen(many, "juz").get(1)).toBe("2026-03-09");
  });
});

describe("daysBetween", () => {
  it("counts calendar days the way a reader counts them", () => {
    // Yesterday evening to this morning is one day, not the twelve hours that
    // actually elapsed. "You have not opened this in 3 weeks" is a statement
    // about the calendar.
    expect(daysBetween("2026-03-09", "2026-03-30")).toBe(21);
    expect(daysBetween("2026-03-09", "2026-03-09")).toBe(0);
  });

  it("crosses months and leap days without arithmetic of its own", () => {
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2); // 2024 is a leap year
    expect(daysBetween("2025-02-28", "2025-03-01")).toBe(1);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });

  it("goes negative rather than pretending order does not matter", () => {
    expect(daysBetween("2026-03-30", "2026-03-09")).toBe(-21);
  });

  it("is NaN on a stamp it cannot read", () => {
    expect(daysBetween("yesterday", "2026-03-09")).toBeNaN();
  });
});

describe("editionOf", () => {
  it("names the edition, because page ids only mean anything inside one", () => {
    // Page 7 of the Madani print is not page 7 of anything else. A caller
    // holding two editions' events has to partition before rolling up by page.
    expect(editionOf(look())).toBe(EDITION);
    expect(editionOf(look({ key: "quran/other/2:48" }))).toBe("other");
    expect(editionOf(look({ key: "nonsense" }))).toBeNull();
  });
});

describe("comparableEvents", () => {
  // A record outlives the build that wrote it. These are the looks a reader
  // would hold after a second edition were vendored: the same page number, in
  // two prints, over ayahs that are not the same ayahs.
  const mine = look({ key: key(2, 48), page: 7 });
  const theirs = look({ key: "quran/hafs-indopak/9:20", page: 7 });

  it("drops another print's looks at page scope", () => {
    expect(comparableEvents([mine, theirs], "page", EDITION)).toEqual([mine]);
    expect(comparableEvents([mine, theirs], "page", "hafs-indopak")).toEqual([theirs]);
  });

  it("keeps them at juz and hizb scope, which is the half that is easy to get wrong", () => {
    // Not an oversight and not laziness: a juz is a division of the *text*, so
    // juz 5 is juz 5 in every print on earth. Filtering here would throw away
    // looks that genuinely land on the square being drawn — showing a hafiz
    // less revision than they did, which is the quieter and worse failure.
    expect(comparableEvents([mine, theirs], "juz", EDITION)).toEqual([mine, theirs]);
    expect(comparableEvents([mine, theirs], "hizb", EDITION)).toEqual([mine, theirs]);
  });

  it("drops an unparseable key at page scope rather than guessing which print it was", () => {
    // Same rule `scopesOf` follows: a gap in the picture is recoverable, a
    // wrong square is not.
    expect(comparableEvents([look({ key: "nonsense" })], "page", EDITION)).toEqual([]);
  });

  it("keeps the whole record out of the answer when nothing matches", () => {
    // The empty-not-everything case. A filter that fell back to "return all" on
    // no match would be invisible until the day two editions existed.
    expect(comparableEvents([theirs], "page", EDITION)).toEqual([]);
  });

  it("is what makes lastSeen honest at page scope", () => {
    // The end-to-end statement of the bug: without the partition, one look at
    // another print's page 7 colours *this* print's page 7.
    const day = lastSeen(comparableEvents([theirs], "page", EDITION), "page");
    expect(day.get(7)).toBeUndefined();
    expect(lastSeen([theirs], "page").get(7)).toBe("2026-03-09");
  });
});
