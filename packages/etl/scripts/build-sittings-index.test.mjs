/**
 * The front door, and the two things it is easy to get wrong there.
 *
 * The first is the mistake it was written to end: a page whose numbers were typed,
 * right on the day they were typed and quietly wrong every day after. Those numbers
 * are now counted out of the sittings, so what has to be tested is that the counting
 * is real — that a part with one answer against it says one, and that an answer for
 * a mark in no part on the page is not counted at all. That last one is the trap: the
 * running log covers every deal there has ever been, and adding its length to
 * anything would take the remaining figure below zero.
 *
 * The second is subtler and is the reason `standingIds` was written closed over
 * nothing. The page has to answer *which answers still stand* in a browser, and the
 * tempting way to do that is to write the arithmetic out again in the generated
 * script — three lines, hard to get wrong, and wrong within a month of the next time
 * somebody changes what a retraction means. Instead the builder ships that
 * function's own source text. These tests are what makes that claim checkable: the
 * inlined copy is pulled back out of the page, evaluated with nothing in scope, and
 * made to agree with the module it came from.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { standingIds } from "./lib/answered.mjs";

const SCRIPT = new URL("./build-sittings-index.mjs", import.meta.url).pathname;

let dir;

function sitting(name, head, ids) {
  const full = { built: "mark-report", set: "fallback", seed: 23, band: null, ...head };
  writeFileSync(
    join(dir, name),
    [
      "<!doctype html><html><body><script>",
      `const HEAD = ${JSON.stringify(full)};`,
      `const CARDS = ${JSON.stringify(ids.map((id) => ({ id })))};`,
      "</script></body></html>",
    ].join("\n"),
  );
}

/** Three parts of two marks each, as a fresh rebuild leaves them. */
function deal({ already = 0 } = {}) {
  const pool = [["1:1", "1:2"], ["2:1", "2:2"], ["3:1", "3:2"]];
  for (let n = 1; n <= 3; n += 1) {
    sitting(`sit.part-${n}.html`, {
      slice: `-p${n}of3-aXX`,
      part: `${n}/3`,
      pool: 6,
      population: 6 + already,
      alreadyAnswered: already,
      shown: 2,
    }, pool[n - 1]);
  }
}

function answers(ids, name = "mark-answers.jsonl") {
  writeFileSync(join(dir, name), `${ids.map((id) => JSON.stringify({ kind: "placement", id })).join("\n")}\n`);
}

// Both streams, always. The builder says what it could not read on the error stream
// and keeps going, so a helper that only kept the output stream would make the
// carries-on-and-says-so case indistinguishable from the says-nothing case.
function build(...extra) {
  const r = spawnSync(process.execPath, [SCRIPT, "--dir", dir, ...extra], { encoding: "utf8" });
  return {
    code: r.status,
    out: `${r.stdout}${r.stderr}`,
    html: r.status === 0 ? readFileSync(join(dir, "index.html"), "utf8") : null,
  };
}

const tiles = (html) => [...html.matchAll(/<span class="pc">([^<]*)<\/span>/g)].map((m) => m[1]);
const seen = (html) => JSON.parse(/var SEEN = (\[[^\]]*\]);/.exec(html)[1]);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hifth-front-door-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("counting out of the sittings rather than out of somebody's memory", () => {
  it("draws one tile per part, each knowing which marks it holds", () => {
    deal();
    const r = build();
    expect(r.code).toBe(0);
    expect([...r.html.matchAll(/data-ids="([^"]*)"/g)].map((m) => m[1])).toEqual(["1:1 1:2", "2:1 2:2", "3:1 3:2"]);
    expect(tiles(r.html)).toEqual(["0 of 2", "0 of 2", "0 of 2"]);
  });

  it("shows how far each part has got, from the answers on disk", () => {
    deal();
    answers(["2:1"]);
    const r = build();
    expect(tiles(r.html)).toEqual(["0 of 2", "1 of 2", "0 of 2"]);
    expect(seen(r.html)).toEqual(["2:1"]);
  });

  // The trap. One log covers every deal there has ever been, so most of what is in
  // it belongs to marks that were dropped from these parts at build time — and were
  // already subtracted from the totals the page prints.
  it("ignores answers for marks that are in no part on this page", () => {
    deal({ already: 4 });
    answers(["9:9", "8:8", "2:1"]);
    const r = build();
    expect(seen(r.html)).toEqual(["2:1"]);
    expect(tiles(r.html)).toEqual(["0 of 2", "1 of 2", "0 of 2"]);
  });

  it("takes a retraction back out again", () => {
    deal();
    writeFileSync(
      join(dir, "mark-answers.jsonl"),
      `${[{ kind: "placement", id: "1:1" }, { kind: "placement", id: "1:2" }, { kind: "retracted", id: "1:2" }].map((e) => JSON.stringify(e)).join("\n")}\n`,
    );
    const r = build();
    expect(tiles(r.html)[0]).toBe("1 of 2");
    expect(seen(r.html)).toEqual(["1:1"]);
  });

  it("opens at nothing done when nobody has answered anything yet", () => {
    deal();
    const r = build();
    expect(seen(r.html)).toEqual([]);
    expect(r.out).toContain("no answers on disk");
  });
});

describe("the state where an index would mislead", () => {
  it("refuses to render parts from two different builds", () => {
    deal();
    sitting("sit.part-3.html", { slice: "-p3of3-aZZ", part: "3/3", pool: 6, population: 6, alreadyAnswered: 0, shown: 2 }, ["3:1", "3:2"]);
    const r = build();
    expect(r.code).toBe(1);
    expect(r.out).toContain("more than one deal");
  });

  it("says so and carries on when one part's card list is torn", () => {
    deal();
    writeFileSync(join(dir, "sit.part-2.html"), `const HEAD = ${JSON.stringify({ built: "mark-report", slice: "-p2of3-aXX", part: "2/3", pool: 6, population: 6, alreadyAnswered: 0, shown: 2 })};`);
    const r = build();
    expect(r.code).toBe(0);
    expect(r.out).toContain("cannot be checked");
    expect([...r.html.matchAll(/data-part="(\d)"/g)].map((m) => m[1])).toEqual(["1", "2", "3"]);
  });
});

describe("one reading of the word answered, in two runtimes", () => {
  const inlined = (html) => {
    const src = /\nfunction standingIds\(events\) \{[\s\S]*?\n\}\n/.exec(html);
    expect(src, "the page carries no copy of standingIds").not.toBe(null);
    return src[0];
  };

  it("ships the function's own source, not a paraphrase of it", () => {
    deal();
    expect(inlined(build().html).trim()).toBe(standingIds.toString());
  });

  // Evaluated with nothing in scope but its own arguments. If somebody ever closes
  // this function over a module-level binding, the page keeps building and this is
  // what stops it going out.
  it("runs in a scope with nothing in it, and agrees", () => {
    deal();
    const copy = new Function(`${inlined(build().html)}; return standingIds;`)();

    const cases = [
      [],
      [{ kind: "placement", id: "a" }],
      [{ kind: "placement", id: "a" }, { kind: "placement", id: "a" }],
      [{ kind: "placement", id: "a" }, { kind: "retracted", id: "a" }],
      [{ kind: "placement", id: "a" }, { kind: "placement", id: "a" }, { kind: "retracted", id: "a" }],
      [{ kind: "retracted", id: "a" }, { kind: "placement", id: "b" }],
      [null, undefined, { kind: "placement" }, { kind: "placement", id: "c" }],
    ];
    for (const events of cases) {
      expect(copy(events), JSON.stringify(events)).toEqual(standingIds(events));
    }
  });
});

describe("the address a reader should be at", () => {
  it("never warns against the address it is telling them to use", () => {
    deal();
    const html = build().html;
    const canon = JSON.parse(/var CANON = (.*);/.exec(html)[1]);
    const also = JSON.parse(/var ALSO = (.*);/.exec(html)[1]);
    if (canon !== null) expect(also).not.toContain(canon);
  });

  // A front door that cried wolf on every unfamiliar address would be switched off,
  // so it only speaks up for spellings this machine is known to answer to.
  it("only speaks up for another spelling of this same machine", () => {
    deal();
    expect(build().html).toContain("ALSO.indexOf(location.hostname) < 0");
  });
});
