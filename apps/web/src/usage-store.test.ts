import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { countUse, forgetUse, readUse, USE_RETENTION_DAYS } from "./usage-store.js";

/*
 * Run against a real IndexedDB implementation, as the revision store's tests
 * are, and every call is handed its clock: a suite that let today's date
 * decide what is old would start deleting its own counts one day.
 */

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-11T12:00:00Z");

beforeEach(async () => {
  await forgetUse();
});

describe("the usage counts on the device", () => {
  it("adds one each time a feature is used, by the day it was used", async () => {
    await countUse("turn-page", NOW);
    await countUse("turn-page", NOW);
    await countUse("commentary", at("2026-10-10T12:00:00Z"));
    const got = await readUse(NOW);
    expect(got.days).toEqual([
      { day: "2026-10-10", counts: { commentary: 1 } },
      { day: "2026-10-11", counts: { "turn-page": 2 } },
    ]);
  });

  it("knows the day it started counting, even before anything is counted", async () => {
    const got = await readUse(NOW);
    expect(got.days).toEqual([]);
    expect(got.since).toBe("2026-10-11");
    expect(got.today).toBe("2026-10-11");
  });

  it("does not count a name it does not know", async () => {
    await countUse("made-up-feature" as never, NOW);
    expect((await readUse(NOW)).days).toEqual([]);
  });

  it("forgets a day once it is older than the window", async () => {
    const old = NOW - USE_RETENTION_DAYS * 86_400_000;
    await countUse("roots", old);
    await countUse("roots", NOW);
    const got = await readUse(NOW);
    expect(got.days.map((d) => d.day)).toEqual(["2026-10-11"]);
  });

  it("forgets everything when asked, and starts counting again from that day", async () => {
    await countUse("share", NOW);
    await forgetUse();
    const got = await readUse(NOW);
    expect(got.days).toEqual([]);
    expect(got.since).toBe("2026-10-11");
  });
});
