import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dayOf, lastSeen, rollUp } from "@hifth/core";
import {
  RETENTION_DAYS,
  expiredDays,
  forgetRecord,
  readRecord,
  recordLook,
  revisionStoreSupported,
} from "./revision-store.js";

/*
 * The store is the half of this feature that can lose a hafiz's history, so it
 * is tested against a real IndexedDB implementation (fake-indexeddb runs the
 * actual spec, not a Map with a promise on it) rather than behind a hand-rolled
 * double that would only prove the double works.
 *
 * Both entry points take `now`, and every test here passes it. Not for
 * convenience — a suite that let the ambient clock decide the retention window
 * would pass today and start deleting its own fixtures in 2027, which is the
 * worst possible failure shape for a test about deleting data.
 */

const KEY = "quran/hafs-kfqc/2:48";
const at = (iso: string) => Date.parse(iso);

/** "Now" for every test that does not care what day it is. */
const NOW = at("2026-03-20T12:00:00Z");
const read = (now: number = NOW) => readRecord(now);

beforeEach(async () => {
  await forgetRecord();
});

describe("recordLook", () => {
  it("writes a look that survives being read back", async () => {
    await recordLook({ key: KEY, page: 7 }, at("2026-03-09T12:00:00Z"));
    const record = await read();
    expect(record.events).toHaveLength(1);
    expect(record.events[0]).toMatchObject({ key: KEY, page: 7, at: at("2026-03-09T12:00:00Z") });
  });

  it("stamps the reader's own UTC offset, so the day survives a move or a DST change", async () => {
    // The offset is captured at record time and never recomputed. This asserts
    // it is captured *at all* — a missing `tz` defaults to 0 and silently
    // re-files every evening session recorded east of Greenwich.
    await recordLook({ key: KEY, page: 7 }, at("2026-03-09T12:00:00Z"));
    const [event] = (await read()).events;
    expect(event!.tz).toBe(-new Date(at("2026-03-09T12:00:00Z")).getTimezoneOffset());
  });

  it("records a passage as one look with both ends, not as one look per ayah", async () => {
    await recordLook(
      { key: "quran/hafs-kfqc/2:141", endKey: "quran/hafs-kfqc/2:142", page: 7 },
      at("2026-03-09T12:00:00Z"),
    );
    const { events } = await read();
    expect(events).toHaveLength(1);
    expect(events[0]!.endKey).toBe("quran/hafs-kfqc/2:142");
    // …and core spends that one event across both juz it actually covered.
    expect([...rollUp(events, "juz").get(dayOf(events[0]!))!.keys()].sort()).toEqual([1, 2]);
  });

  it("does not store an endKey that is the same ayah", async () => {
    // A one-ayah marquee is a tap. Writing `endKey === key` would put a field in
    // every row that means nothing, and invite a reader of the data to think a
    // passage was selected.
    await recordLook({ key: KEY, endKey: KEY, page: 7 }, at("2026-03-09T12:00:00Z"));
    expect((await read()).events[0]!.endKey).toBeUndefined();
  });

  it("keeps every look on a day, in the order they happened", async () => {
    // One record per day, rewritten as the day fills — so the risk is that a
    // later write clobbers the array rather than appending to it.
    await recordLook({ key: KEY, page: 7 }, at("2026-03-09T09:00:00Z"));
    await recordLook({ key: KEY, page: 9 }, at("2026-03-09T10:00:00Z"));
    await recordLook({ key: KEY, page: 19 }, at("2026-03-09T11:00:00Z"));
    const { events } = await read();
    expect(events.map((e) => e.page)).toEqual([7, 9, 19]);
  });

  it("keeps days apart and returns them oldest first", async () => {
    await recordLook({ key: KEY, page: 19 }, at("2026-03-11T12:00:00Z"));
    await recordLook({ key: KEY, page: 7 }, at("2026-03-09T12:00:00Z"));
    const { events } = await read();
    expect(events.map((e) => e.page)).toEqual([7, 19]);
    expect([...rollUp(events, "page").keys()].sort()).toEqual(["2026-03-09", "2026-03-11"]);
  });

  it("is durable per tap — nothing is buffered waiting for a flush", async () => {
    // On a phone the app is killed mid-session most of the time. A batched
    // writer loses exactly the taps made just before that, which is most of
    // them. Reading immediately after one write is the assertion.
    await recordLook({ key: KEY, page: 7 }, at("2026-03-09T12:00:00Z"));
    expect((await read()).events).toHaveLength(1);
  });
});

describe("since — how the record proves it is young", () => {
  it("knows its own age before a single look is recorded", async () => {
    // The whole defence against iOS's seven-day wipe. A record that has existed
    // for a month and holds nothing means the reader did not tap; one that has
    // existed since this morning and holds nothing means we lost it. Deriving
    // `since` from the oldest surviving event collapses the two.
    const record = await read();
    expect(record.events).toHaveLength(0);
    expect(record.since).toBe(dayOf({ key: "", page: 0, at: NOW, tz: -new Date(NOW).getTimezoneOffset() }));
  });

  it("does not move forward as the record fills", async () => {
    const first = (await read()).since;
    await recordLook({ key: KEY, page: 7 }, at("2026-03-09T12:00:00Z"));
    await recordLook({ key: KEY, page: 9 }, at("2026-03-19T12:00:00Z"));
    expect((await read()).since).toBe(first);
  });

  it("is reset by forgetting, because a kept `since` would tell the wipe's lie", async () => {
    await recordLook({ key: KEY, page: 7 }, at("2026-03-09T12:00:00Z"));
    await forgetRecord();
    const record = await read();
    expect(record.events).toHaveLength(0);
    expect(record.since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("expiredDays", () => {
  const asOf = "2026-03-09";

  it("keeps a day right up to the edge of the window and drops it after", () => {
    const edge = "2025-02-02"; // exactly RETENTION_DAYS before asOf
    expect(RETENTION_DAYS).toBe(400);
    expect(expiredDays([edge], asOf)).toEqual([edge]);
    expect(expiredDays(["2025-02-03"], asOf)).toEqual([]);
    expect(expiredDays(["2026-03-09"], asOf)).toEqual([]);
  });

  it("does not treat a stamp it cannot read as old", () => {
    // Deleting on a parse failure costs someone their record; keeping costs a
    // few bytes. The asymmetry decides it.
    expect(expiredDays(["not-a-day"], asOf)).toEqual([]);
  });

  it("never drops a day in the future", () => {
    // A device whose clock was wrong, then corrected. The rows are still real.
    expect(expiredDays(["2027-01-01"], asOf)).toEqual([]);
  });
});

describe("pruning", () => {
  it("drops what has fallen out of the window and moves `since` to match", async () => {
    await recordLook({ key: KEY, page: 7 }, at("2025-01-01T12:00:00Z"));
    expect((await readRecord(at("2025-01-01T12:00:00Z"))).since).toBe("2025-01-01");

    const later = at("2026-06-01T12:00:00Z"); // 516 days on
    await recordLook({ key: KEY, page: 9 }, later);
    const after = await readRecord(later);
    expect(after.events.map((e) => e.page)).toEqual([9]);
    expect(after.since).toBe("2026-06-01");
  });

  it("prunes for a reader who only looks, without tapping anything", async () => {
    // A read-only session is the common one — open the app, look at the page,
    // close it. Pruning only on write would hand the picture rows the store had
    // already promised to have forgotten.
    await recordLook({ key: KEY, page: 7 }, at("2025-01-01T12:00:00Z"));
    const after = await readRecord(at("2026-06-01T12:00:00Z"));
    expect(after.events).toHaveLength(0);
    expect(after.since).toBe("2026-06-01");
  });

  it("leaves a record alone while it still fits in the window", async () => {
    await recordLook({ key: KEY, page: 7 }, at("2026-01-01T12:00:00Z"));
    await recordLook({ key: KEY, page: 9 }, at("2026-06-01T12:00:00Z"));
    expect((await readRecord(at("2026-06-01T12:00:00Z"))).events.map((e) => e.page)).toEqual([7, 9]);
  });

  it("clears out a look written under a badly wrong clock, and keeps the real ones", async () => {
    // A device whose clock was six years behind writes a look dated 2020. The
    // row is junk, but the rows around it are not — so the window has to remove
    // the one without taking the others, which is the property that would break
    // if the window's origin were ever taken from an event instead of the clock.
    await recordLook({ key: KEY, page: 7 }, at("2026-03-09T12:00:00Z"));
    await recordLook({ key: KEY, page: 9 }, at("2020-01-01T12:00:00Z"));
    const { events } = await readRecord(at("2026-03-10T12:00:00Z"));
    expect(events.map((e) => e.page)).toEqual([7]);
  });
});

describe("the record read back through core", () => {
  it("answers what has not been opened lately", async () => {
    // The question the feature exists for, end to end: two pages opened eleven
    // days apart, and the record says which one has gone cold.
    await recordLook({ key: "quran/hafs-kfqc/2:48", page: 7 }, at("2026-03-09T12:00:00Z"));
    await recordLook({ key: "quran/hafs-kfqc/2:150", page: 9 }, at("2026-03-20T12:00:00Z"));
    const seen = lastSeen((await read()).events, "page");
    expect(seen.get(7)).toBe("2026-03-09");
    expect(seen.get(9)).toBe("2026-03-20");
    expect(seen.has(19)).toBe(false); // never opened — absent, not ancient
  });
});

describe("when there is no storage at all", () => {
  it("reports itself unsupported and neither throws nor invents a record", async () => {
    vi.stubGlobal("indexedDB", undefined);
    try {
      expect(revisionStoreSupported()).toBe(false);
      await expect(recordLook({ key: KEY, page: 7 })).resolves.toBeUndefined();
      expect(await read()).toEqual({ events: [], since: null });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("a `since` of null means we cannot know, and must not read as 'brand new'", async () => {
    // The one case where the age is genuinely unknown. A caller that renders
    // null as today would tell a reader on a locked-down browser that their
    // record was just wiped, every single time they open the app.
    vi.stubGlobal("indexedDB", undefined);
    try {
      expect((await read()).since).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
