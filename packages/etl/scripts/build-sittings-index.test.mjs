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
import * as view from "./lib/sittings-view.mjs";

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

// Digits, not any text: the page also carries the source of the function that
// draws these, and its own unfilled template would otherwise count as a tile.
const tiles = (html) => [...html.matchAll(/<span class="pc">(\d+ of \d+)<\/span>/g)].map((m) => m[1]);

/** The tiles inside one list, by the part number each links to. */
const listed = (html, id) => {
  const m = new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)</ul>`).exec(html);
  return m ? [...m[1].matchAll(/data-part="(\d+)"/g)].map((x) => x[1]) : null;
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hifth-front-door-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("counting out of the sittings rather than out of somebody's memory", () => {
  it("draws one tile per part", () => {
    deal();
    const r = build();
    expect(r.code).toBe(0);
    expect(listed(r.html, "parts")).toEqual(["1", "2", "3"]);
    expect(tiles(r.html)).toEqual(["0 of 2", "0 of 2", "0 of 2"]);
  });

  it("shows how far each part has got, from the answers on disk", () => {
    deal();
    answers(["2:1"]);
    expect(tiles(build().html)).toEqual(["0 of 2", "1 of 2", "0 of 2"]);
  });

  // The trap. One log covers every deal there has ever been, so most of what is in
  // it belongs to marks that were dropped from these parts at build time — and were
  // already subtracted from the totals the page prints.
  it("ignores answers for marks that are in no part on this page", () => {
    deal({ already: 4 });
    answers(["9:9", "8:8", "2:1"]);
    const r = build();
    expect(tiles(r.html)).toEqual(["0 of 2", "1 of 2", "0 of 2"]);
    expect(/id="left">(\d+)/.exec(r.html)[1]).toBe("5");
  });

  it("takes a retraction back out again", () => {
    deal();
    writeFileSync(
      join(dir, "mark-answers.jsonl"),
      `${[{ kind: "placement", id: "1:1" }, { kind: "placement", id: "1:2" }, { kind: "retracted", id: "1:2" }].map((e) => JSON.stringify(e)).join("\n")}\n`,
    );
    expect(tiles(build().html)[0]).toBe("1 of 2");
  });

  it("opens at nothing done when nobody has answered anything yet", () => {
    const r = (deal(), build());
    expect(r.out).toContain("no answers on disk");
    expect(tiles(r.html)).toEqual(["0 of 2", "0 of 2", "0 of 2"]);
  });

  /**
   * The page used to carry every mark id of every part — twelve bytes a mark and
   * about fifteen kilobytes of it — because that was the only way it could recount
   * itself against the server. It asks the server for the listing now, ids and all,
   * so shipping a second copy would be a stale second copy.
   */
  it("no longer ships a copy of which marks are in which part", () => {
    deal();
    const html = build().html;
    expect(html).not.toContain("data-ids");
    expect(html).not.toContain("1:1");
  });
});

/**
 * The thing the front door could not do, which is why it was a photograph.
 *
 * Finishing a sitting is what a reader is there to do, and until this the page had
 * no way to show it: the tile stayed in the list looking exactly as unfinished as
 * the ones beside it. Folding rather than deleting is deliberate — a front door
 * that silently drops rooms cannot be checked against the directory behind it, and
 * somebody who has just finished number two wants one glance's worth of proof.
 */
describe("getting finished sittings out of the way", () => {
  it("moves a finished part into the fold and leaves the rest in the list", () => {
    deal();
    answers(["2:1", "2:2"]);
    const html = build().html;
    expect(listed(html, "parts")).toEqual(["1", "3"]);
    expect(listed(html, "parts-done")).toEqual(["2"]);
    expect(/<summary id="parts-fold-line">([^<]*)/.exec(html)[1]).toBe("One finished sitting");
  });

  it("keeps the fold shut away entirely when nothing is finished", () => {
    deal();
    const html = build().html;
    expect(listed(html, "parts-done")).toEqual([]);
    expect(/<details class="fold" id="parts-fold" hidden>/.test(html)).toBe(true);
  });

  it("says so in place of an empty grid when every one is finished", () => {
    deal();
    answers(["1:1", "1:2", "2:1", "2:2", "3:1", "3:2"]);
    const html = build().html;
    expect(listed(html, "parts")).toEqual([]);
    expect(listed(html, "parts-done")).toEqual(["1", "2", "3"]);
    expect(html).toContain('id="parts-empty">Every one has been seen.');
    expect(/id="carry" hidden/.test(html)).toBe(true);
  });

  it("points at the part somebody is in the middle of", () => {
    deal();
    answers(["2:1"]);
    expect(build().html).toContain("<strong>Carry on with sitting 2.</strong>");
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

  /**
   * The same discipline, over a much bigger surface.
   *
   * The page now redraws itself from a listing this builder never saw, which means
   * it has to do the counting, the wording and the drawing all over again in a
   * browser. Every one of those is a place where a paraphrase would look right and
   * drift — a tile drawn slightly differently after a fetch, a total reached by
   * arithmetic that rounds the other way — so none of them is paraphrased. What
   * ships is the source text of the functions in lib/sittings-view.mjs, and this
   * is what makes that claim checkable rather than merely stated.
   */
  it("ships every view function's own source too", () => {
    deal();
    const html = build().html;
    for (const [name, fn] of Object.entries(view)) {
      expect(html, `the page carries no copy of ${name}`).toContain(fn.toString());
    }
  });

  it("asks the serving side for the listing as well as for the answers", () => {
    deal();
    const html = build().html;
    expect(html).toContain("S.sittings()");
    expect(html).toContain('S.answers("")');
  });
});

/**
 * The half that only ever runs on a phone.
 *
 * Everything above tests the page as it is written. What a reader actually looks
 * at is the page after it has asked the machine what is on the disk *now* and
 * worked the whole thing out again — and that code had nothing holding it, which
 * is the sort of gap that shows up as a front door quietly frozen at whatever it
 * was built with.
 *
 * There is no jsdom here and adding one to run twenty lines of DOM writing would
 * be a poor trade, so the page's own script is pulled out and run against a
 * document small enough to read: elements that remember what was set on them and
 * nothing else. That is enough, because what is being checked is which sitting
 * ends up in which list and what the totals come to, not layout.
 */
describe("redrawing itself from a listing it has never seen", () => {
  const fakeDom = () => {
    const els = new Map();
    const get = (id) => {
      if (!els.has(id)) {
        els.set(id, { id, innerHTML: "", textContent: "", hidden: false, classList: { add() {}, remove() {}, toggle() {} } });
      }
      return els.get(id);
    };
    return {
      els,
      get,
      document: {
        getElementById: get,
        querySelector: () => null,
        querySelectorAll: (sel) => (/^[#.]/.test(sel) ? [get(sel.replace(/^#/, ""))] : []),
      },
    };
  };

  /** The page's own script, run with nothing around it but that document. */
  const load = (html) => {
    const src = /<script>([\s\S]*?)<\/script>\s*<\/body>/.exec(html)[1];
    const dom = fakeDom();
    const run = new Function(
      "document", "window", "location",
      `${src}\nreturn { draw: draw };`,
    )(dom.document, {}, { hostname: "elsewhere", protocol: "http:", port: "", pathname: "/" });
    return { ...dom, draw: run.draw };
  };

  /** What the serving side would hand back for a three-part deal. */
  const listing = () => [1, 2, 3].map((n) => ({
    name: `sit.part-${n}.html`,
    part: `${n}/3`,
    slice: `-p${n}of3-aXX`,
    pool: 6,
    population: 6,
    alreadyAnswered: 0,
    shown: 2,
    ids: [`${n}:1`, `${n}:2`],
  }));

  const partsIn = (el) => [...el.innerHTML.matchAll(/data-part="(\d+)"/g)].map((m) => m[1]);

  it("folds away a sitting finished since the page was built", () => {
    deal();
    const page = load(build().html);
    page.draw(listing(), new Set(["2:1", "2:2"]));
    expect(partsIn(page.get("parts"))).toEqual(["1", "3"]);
    expect(partsIn(page.get("parts-done"))).toEqual(["2"]);
    expect(page.get("parts-fold").hidden).toBe(false);
    expect(page.get("parts-fold-line").textContent).toBe("One finished sitting");
  });

  it("brings the totals down as the answers arrive", () => {
    deal();
    const page = load(build().html);
    page.draw(listing(), new Set(["1:1", "2:1", "2:2"]));
    expect(page.get("left").textContent).toBe("3");
    expect(page.get("gone").textContent).toBe("3 are answered and gone.");
    expect(page.get("carry").innerHTML).toContain("Carry on with sitting 1");
    expect(page.get("carry").innerHTML).toContain("You are 1 of 2 through it");
  });

  // The listing is the truth about what is on the disk, so a part that has gone
  // away has to go away here too. Nothing about the baked page can hold it open.
  it("shows the set that is on the disk now, not the set it was built from", () => {
    deal();
    const page = load(build().html);
    page.draw(listing().slice(0, 2), new Set());
    expect(partsIn(page.get("parts"))).toEqual(["1", "2"]);
    expect(page.get("left").textContent).toBe("4");
  });

  it("says so out loud when the parts have been re-dealt underneath it", () => {
    deal();
    const page = load(build().html);
    page.draw(listing().map((p) => ({ ...p, slice: p.slice.replace("aXX", "aZZ") })), new Set());
    expect(page.get("rebuilt").hidden).toBe(false);
    expect(page.get("rebuilt").innerHTML).toContain("re-dealt");
  });

  // Half a rebuild is the one state where adding two censuses together would give
  // a number that looks fine and means nothing.
  it("refuses to add up parts from two different deals", () => {
    deal();
    const page = load(build().html);
    const half = listing();
    half[2] = { ...half[2], slice: "-p3of3-aZZ" };
    page.draw(half, new Set());
    expect(page.get("rebuilt").innerHTML).toContain("half-rebuilt");
    expect(page.get("left").textContent).toBe("");
  });

  it("says every one has been seen when the last of them is finished", () => {
    deal();
    const page = load(build().html);
    page.draw(listing(), new Set(["1:1", "1:2", "2:1", "2:2", "3:1", "3:2"]));
    expect(partsIn(page.get("parts"))).toEqual([]);
    expect(page.get("parts-empty").hidden).toBe(false);
    expect(page.get("carry").hidden).toBe(true);
    expect(page.get("left").textContent).toBe("0");
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
