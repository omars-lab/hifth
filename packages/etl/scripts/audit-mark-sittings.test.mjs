/**
 * The instruction that had no command behind it.
 *
 * A sitting review ends by asking somebody to confirm the deal did not move — same
 * number of parts, same total, nothing already answered coming round again. Sixteen
 * files, by eye, at the end of an hour of work, and the two ways it goes wrong are
 * both invisible from inside a part: a rebuild that never happened looks exactly like
 * a rebuild that did, and a rebuild against the wrong measurements looks like a
 * perfectly ordinary sitting whose answers are all about rectangles nobody drew.
 *
 * So these are the failures the auditor exists to catch, each one built on purpose.
 * A test that only proves the clean case passes proves nothing about an auditor: the
 * one that always says yes passes it too.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { answeredKey, fingerprint } from "./lib/answered.mjs";

const SCRIPT = new URL("./audit-mark-sittings.mjs", import.meta.url).pathname;

const ROWS = '{"rows":[]}';
const ROWS_FP = fingerprint(ROWS);

let dir;

/**
 * A built sitting, reduced to the two things a built sitting says about itself.
 *
 * The real file is a megabyte of cropped page artwork around these two lines. The
 * artwork is not what is being audited and forging it would only mean the fixtures
 * rot whenever the page changes, so what these hold is the shape the auditor
 * actually reads — which is also a claim about the builder, and the reason the
 * builder emits both literals on one line each.
 */
function sitting(name, head, ids) {
  const full = {
    built: "mark-report",
    rows: "out/mark-rows.line-tilt.json",
    rowsFingerprint: ROWS_FP,
    set: "fallback",
    seed: 23,
    band: null,
    ...head,
  };
  const cards = ids.map((id) => ({ id, page: Number(id.split(":")[0]) }));
  writeFileSync(
    join(dir, name),
    ["<!doctype html><html><body><script>", `const HEAD = ${JSON.stringify(full)};`, `const CARDS = ${JSON.stringify(cards)};`, "</script></body></html>"].join("\n"),
  );
}

/** Two parts of four marks, one answer standing, exactly as a fresh rebuild leaves it. */
function deal({ answered = [], parts = 2 } = {}) {
  const pool = [["1:1", "1:2"], ["2:1", "2:2"]];
  const key = answeredKey(new Set(answered));
  for (let n = 1; n <= parts; n += 1) {
    sitting(`sit.part-${n}.html`, {
      slice: `-p${n}of2${key}`,
      part: `${n}/2`,
      pool: 4,
      population: 4 + answered.length,
      alreadyAnswered: answered.length,
      shown: 2,
    }, pool[n - 1]);
  }
}

function audit(answeredFile) {
  const args = [SCRIPT, "--dir", dir, "--rows", join(dir, "rows.json")];
  if (answeredFile) args.push("--answered", join(dir, answeredFile));
  try {
    return { code: 0, out: execFileSync(process.execPath, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (e) {
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
}

function answers(name, ids) {
  writeFileSync(join(dir, name), ids.map((id) => JSON.stringify({ kind: "placement", id })).join("\n") + "\n");
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hifth-sittings-"));
  writeFileSync(join(dir, "rows.json"), ROWS);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("a deal that did not move", () => {
  it("passes, and says what the deal is", () => {
    deal();
    const r = audit();
    expect(r.code).toBe(0);
    expect(r.out).toContain("the deal did not move");
    expect(r.out).toContain("4 marks across 2 parts");
  });

  it("passes with an answer standing, once the rebuild has dropped it", () => {
    answers("log.jsonl", ["9:9"]);
    deal({ answered: ["9:9"] });
    const r = audit("log.jsonl");
    expect(r.code).toBe(0);
    expect(r.out).toContain("1 already answered");
  });
});

describe("the rebuild that never happened", () => {
  it("fails when an answer exists that no part knows about", () => {
    deal();
    answers("log.jsonl", ["9:9"]);
    const r = audit("log.jsonl");
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/built against a different set of answers/);
  });

  it("fails when a mark already answered is asked again", () => {
    answers("log.jsonl", ["1:1"]);
    deal({ answered: ["1:1"] });
    const r = audit("log.jsonl");
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/already carrying a standing answer is asked again/);
  });

  it("fails when only some of the parts were rebuilt", () => {
    answers("log.jsonl", ["9:9"]);
    deal({ answered: ["9:9"] });
    sitting("sit.part-2.html", { slice: "-p2of2", part: "2/2", pool: 4, population: 5, alreadyAnswered: 1, shown: 2 }, ["2:1", "2:2"]);
    const r = audit("log.jsonl");
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/disagree about which answers had been given/);
  });
});

describe("the rebuild against the wrong measurements", () => {
  it("fails, and says the rectangles are not where the parts say", () => {
    deal();
    sitting("sit.part-1.html", { rowsFingerprint: "deadbeef", slice: "-p1of2", part: "1/2", pool: 4, population: 4, alreadyAnswered: 0, shown: 2 }, ["1:1", "1:2"]);
    sitting("sit.part-2.html", { rowsFingerprint: "deadbeef", slice: "-p2of2", part: "2/2", pool: 4, population: 4, alreadyAnswered: 0, shown: 2 }, ["2:1", "2:2"]);
    const r = audit();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/Rebuild before anyone sits/);
  });
});

describe("a deal with a hole in it", () => {
  it("fails when a part is not built at all", () => {
    deal({ parts: 1 });
    const r = audit();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/part 2 of 2 is not built — those marks are in nobody's sitting/);
  });

  it("fails when one mark is dealt into two parts", () => {
    deal();
    sitting("sit.part-2.html", { slice: "-p2of2", part: "2/2", pool: 4, population: 4, alreadyAnswered: 0, shown: 2 }, ["1:1", "2:2"]);
    const r = audit();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/1:1 is asked in part 1\/2 and again in part 2\/2/);
  });

  it("fails when the parts hold fewer marks than they claim to be dealing out", () => {
    deal();
    sitting("sit.part-2.html", { slice: "-p2of2", part: "2/2", pool: 4, population: 4, alreadyAnswered: 0, shown: 1 }, ["2:1"]);
    const r = audit();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/hold 3 marks between them but claim to be dealing out 4/);
  });
});

describe("what it will not do", () => {
  it("does not treat a band sitting as an incomplete deal", () => {
    deal();
    sitting("sit.band.html", { slice: "", part: null, band: "0.55,0.65", pool: 9, population: 9, alreadyAnswered: 0, shown: 9 }, ["7:1"]);
    const r = audit();
    expect(r.code).toBe(0);
    expect(r.out).toContain("counted, not audited for coverage");
  });

  it("says nothing has been built rather than passing on an empty folder", () => {
    const r = audit();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/no built sittings/);
  });
});
