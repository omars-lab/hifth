import { describe, expect, it } from "vitest";
import { dropBookmark, parseBookmarkFile, toBookmarkFile } from "@hifth/core";
import { copyState, dropCopy, keepCopy } from "./marks-copy";

/*
 * Sign-in step 21c: the button "Keep a copy of my marks on hifth.app". The app
 * is played by a stand-in that answers from a script and writes down every
 * question, as in account.test.ts. Every mark here is made up.
 */

type Reply = { value: unknown } | { error: string };
type Asked = { name: string; text: string | undefined; waitMs: number | undefined };

function app(replies: Record<string, Reply | Reply[]>) {
  const asked: Asked[] = [];
  const queues = new Map(Object.entries(replies).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]]));
  const ask = (name: string, { waitMs, text }: { waitMs?: number; text?: string } = {}): Promise<unknown> => {
    asked.push({ name, text, waitMs });
    const queue = queues.get(name) ?? [];
    const reply = queue.length > 1 ? queue.shift() : queue[0];
    if (!reply) return Promise.reject(new Error("not-in-app"));
    return "value" in reply ? Promise.resolve(reply.value) : Promise.reject(new Error(reply.error));
  };
  return { ask, asked };
}

const K = (v: string) => `quran/hafs-kfqc/${v}`;
const here = toBookmarkFile(dropBookmark([], { key: K("2:255"), page: 42, name: "here" }, 1_000), 1_500);
const there = toBookmarkFile(dropBookmark([], { key: K("3:1"), page: 50, name: "there" }, 2_000), 2_500);
const hereText = JSON.stringify(here);
/** hifth.app's reply to a fetch, as the app hands it over: the text it came in. */
const fetched = (marks: unknown, number: number, savedAt = 9_000) => ({ value: JSON.stringify({ marks, number, savedAt }) });
const kept = (number: number, savedAt = 10_000) => ({ value: JSON.stringify({ number, savedAt }) });
const sent = (a: Asked) => JSON.parse(a.text ?? "null") as { marks: unknown; after: number };
const names = (f: unknown) => (f as { bookmarks: { name: string }[] }).bookmarks.map((b) => b.name).sort();

describe("what the section says about the copy", () => {
  it("names the day the copy was kept", async () => {
    expect(await copyState(app({ "marks-fetch": fetched(there, 3, 7_000) }).ask)).toEqual({ kind: "kept", savedAt: 7_000 });
  });

  it.each([
    [{ error: "no-copy" }, { kind: "none" }],
    [{ error: "off" }, { kind: "off" }],
    [{ error: "signed-out" }, { kind: "off" }],
    [{ error: "sign-in-off" }, { kind: "off" }],
    [{ error: "not-in-app" }, { kind: "off" }],
    [{ error: "offline" }, { kind: "unknown" }],
    [{ error: "no-answer" }, { kind: "unknown" }],
    [{ value: "not json" }, { kind: "unknown" }],
    [{ value: JSON.stringify({ marks: { kind: "something-else" }, number: 1, savedAt: 1 }) }, { kind: "unknown" }],
  ] as const)("the app says %j, the section shows %j", async (reply, shown) => {
    expect(await copyState(app({ "marks-fetch": reply }).ask)).toEqual(shown);
  });
});

describe("keeping a copy", () => {
  it("with no copy yet, sends this device's marks as the first copy", async () => {
    const { ask, asked } = app({ "marks-fetch": { error: "no-copy" }, "marks-keep": kept(1) });
    const out = await keepCopy(hereText, ask, () => 3_000);
    expect(out).toMatchObject({ kind: "kept", savedAt: 10_000 });
    expect(asked.map((a) => a.name)).toEqual(["marks-fetch", "marks-keep"]);
    expect(sent(asked[1]!).after).toBe(0);
    expect(names(sent(asked[1]!).marks)).toEqual(["here"]);
  });

  it("puts this device's marks and the copy together, sends the result after the copy's number, and hands it back to load", async () => {
    const { ask, asked } = app({ "marks-fetch": fetched(there, 3), "marks-keep": kept(4) });
    const out = await keepCopy(hereText, ask, () => 3_000);
    expect(sent(asked[1]!).after).toBe(3);
    expect(names(sent(asked[1]!).marks)).toEqual(["here", "there"]);
    expect(out.kind).toBe("kept");
    if (out.kind !== "kept") return;
    expect(names(parseBookmarkFile(out.marks))).toEqual(["here", "there"]);
  });

  it("when another device kept a newer copy first, fetches again and puts that one in too", async () => {
    const later = toBookmarkFile(
      dropBookmark(there.bookmarks, { key: K("4:1"), page: 77, name: "later" }, 2_600),
      2_700,
    );
    const { ask, asked } = app({
      "marks-fetch": [fetched(there, 3), fetched(later, 4)],
      "marks-keep": [{ error: "newer-copy" }, kept(5)],
    });
    expect((await keepCopy(hereText, ask, () => 3_000)).kind).toBe("kept");
    expect(asked.map((a) => a.name)).toEqual(["marks-fetch", "marks-keep", "marks-fetch", "marks-keep"]);
    expect(sent(asked[3]!).after).toBe(4);
    expect(names(sent(asked[3]!).marks)).toEqual(["here", "later", "there"]);
  });

  it("gives up after three newer copies in a row, and says to try again", async () => {
    const { ask, asked } = app({ "marks-fetch": fetched(there, 3), "marks-keep": { error: "newer-copy" } });
    expect(await keepCopy(hereText, ask, () => 3_000)).toEqual({ kind: "busy" });
    expect(asked.filter((a) => a.name === "marks-keep")).toHaveLength(3);
  });

  it.each([
    ["off", "off"],
    ["signed-out", "signed-out"],
    ["sign-in-off", "off"],
    ["offline", "offline"],
    ["too-big", "too-big"],
    ["server-error", "failed"],
    ["bad-reply", "failed"],
    ["no-answer", "failed"],
  ] as const)("when keeping, the app says %s, the section shows %s", async (error, shown) => {
    expect(await keepCopy(hereText, app({ "marks-fetch": { error: "no-copy" }, "marks-keep": { error } }).ask, () => 3_000)).toEqual({ kind: shown });
  });

  it.each([
    ["off", "off"],
    ["signed-out", "signed-out"],
    ["offline", "offline"],
    ["server-error", "failed"],
  ] as const)("when fetching first, the app says %s, the section shows %s and nothing is sent", async (error, shown) => {
    const { ask, asked } = app({ "marks-fetch": { error }, "marks-keep": kept(1) });
    expect(await keepCopy(hereText, ask, () => 3_000)).toEqual({ kind: shown });
    expect(asked.map((a) => a.name)).toEqual(["marks-fetch"]);
  });

  it("a copy on hifth.app that is not a marks file is never sent back over this device's marks", async () => {
    const { ask, asked } = app({ "marks-fetch": { value: JSON.stringify({ marks: { kind: "x" }, number: 2, savedAt: 1 }) } });
    expect(await keepCopy(hereText, ask, () => 3_000)).toEqual({ kind: "failed" });
    expect(asked.map((a) => a.name)).toEqual(["marks-fetch"]);
  });

  it("this device's marks that cannot be read are never sent", async () => {
    const { ask, asked } = app({ "marks-fetch": { error: "no-copy" } });
    expect(await keepCopy("not a marks file", ask, () => 3_000)).toEqual({ kind: "failed" });
    expect(asked).toEqual([]);
  });

  it("a garbled reply after keeping still counts as kept, dated now", async () => {
    const { ask } = app({ "marks-fetch": { error: "no-copy" }, "marks-keep": { value: "not json" } });
    expect(await keepCopy(hereText, ask, () => 3_000)).toMatchObject({ kind: "kept", savedAt: 3_000 });
  });

  it("waits long enough for a large file to travel", async () => {
    const { ask, asked } = app({ "marks-fetch": { error: "no-copy" }, "marks-keep": kept(1) });
    await keepCopy(hereText, ask, () => 3_000);
    for (const a of asked) expect(a.waitMs).toBeGreaterThanOrEqual(30_000);
  });
});

describe("taking the copy back", () => {
  it.each([
    [{ value: "dropped" }, "dropped"],
    [{ value: "yes" }, "failed"],
    [{ error: "signed-out" }, "signed-out"],
    [{ error: "offline" }, "offline"],
    [{ error: "server-error" }, "failed"],
  ] as const)("the app says %j, the section shows %s", async (reply, shown) => {
    expect(await dropCopy(app({ "marks-drop": reply }).ask)).toBe(shown);
  });
});
