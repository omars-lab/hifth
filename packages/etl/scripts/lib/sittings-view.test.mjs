/**
 * The arithmetic and the wording the front door does twice.
 *
 * Two things are worth holding here, and only one of them is obvious.
 *
 * The obvious one is the counting: a census read off a pile of sittings, which
 * part a reader should carry on with, and which sittings have nothing left to
 * ask. Those are what the page is for.
 *
 * The other is the rule that makes running any of it in a browser possible at
 * all — **every function here is closed over nothing but the others**. It reads
 * as a style note and it is not: the builder ships these functions' own source
 * text into the page, and a function that quietly reaches for a module-level
 * constant keeps working here and is `undefined` there, on a page nobody runs
 * until they are holding a phone. So the last test evaluates the whole set in a
 * scope with nothing in it and makes it agree with this one.
 */
import { describe, expect, it } from "vitest";
import * as view from "./sittings-view.mjs";

const {
  Word,
  bandCopy,
  bandTile,
  bandsLine,
  carryOn,
  census,
  doneCount,
  esc,
  howLong,
  isDone,
  num,
  partTile,
  sizeOf,
  word,
} = view;

const part = (n, ids, over) => ({ name: `sit.part-${n}.html`, part: `${n}/3`, slice: `-p${n}of3-aXX`, shown: ids.length, pool: 6, population: 6, alreadyAnswered: 0, ids, ...over });
const band = (id, ids) => ({ name: `sit.band-${id}.html`, band: id, slice: `-b${id}-aXX`, shown: ids.length, pool: 40, ids });

const THREE = [part(1, ["1:1", "1:2"]), part(2, ["2:1", "2:2"]), part(3, ["3:1", "3:2"])];

describe("the census of what is on the disk", () => {
  it("tells the two kinds of sitting apart and adds the parts up", () => {
    const c = census([band("0.55-0.65", ["b:1"]), ...THREE]);
    expect(c.bands.length).toBe(1);
    expect(c.parts.map((p) => p.part)).toEqual(["1/3", "2/3", "3/3"]);
    expect(c.shown).toBe(6);
    expect(c.per).toBe(2);
    expect(c.dealId).toBe("aXX");
  });

  // Ten parts sorted as text puts part 10 between 1 and 2, and the front door
  // reads as a list somebody shuffled.
  it("sorts parts by their number rather than by their name", () => {
    const many = [10, 2, 1].map((n) => ({ ...part(n, ["x"]), part: `${n}/10` }));
    expect(census(many).parts.map((p) => p.part)).toEqual(["1/10", "2/10", "10/10"]);
  });

  it("reports parts from two different builds rather than adding them together", () => {
    const c = census([THREE[0], { ...THREE[1], slice: "-p2of3-aZZ" }]);
    expect(c.mixed.map((p) => p.part)).toEqual(["2/3"]);
  });

  // Every part finished and dropped is a real state, and the arithmetic has to
  // survive it rather than divide by zero on the way to saying so.
  it("survives having no parts at all", () => {
    const c = census([band("0.95-1.01", ["b:1"])]);
    expect(c.parts).toEqual([]);
    expect(c.per).toBe(0);
    expect(c.population).toBe(0);
    expect(c.dealId).toBe("?");
  });
});

describe("how far each sitting has got", () => {
  it("counts only the marks that sitting is holding", () => {
    const standing = new Set(["1:1", "2:1", "9:9"]);
    expect(THREE.map((p) => doneCount(p, standing))).toEqual([1, 1, 0]);
  });

  it("is finished when nothing is left to ask, and never when it asks nothing", () => {
    expect(isDone(THREE[0], 2)).toBe(true);
    expect(isDone(THREE[0], 1)).toBe(false);
    expect(isDone({ ids: [], shown: 0 }, 0)).toBe(false);
  });

  // A torn card list still has to say how big it is, or its tile reads "0 of 0"
  // and claims the opposite of what is true.
  it("falls back to the header's own count when the card list is torn", () => {
    expect(sizeOf({ ids: [], shown: 107 })).toBe(107);
  });
});

describe("where a reader should carry on", () => {
  it("prefers the one they are in the middle of over a fresh one", () => {
    const at = carryOn(THREE, new Set(["2:1"]));
    expect(at.sitting.part).toBe("2/3");
    expect(at.done).toBe(1);
  });

  it("offers the first untouched one when nothing is half-done", () => {
    expect(carryOn(THREE, new Set(["1:1", "1:2"])).sitting.part).toBe("2/3");
  });

  it("offers nothing when there is nothing left", () => {
    expect(carryOn(THREE, new Set(["1:1", "1:2", "2:1", "2:2", "3:1", "3:2"]))).toBe(null);
  });
});

describe("saying it the way a person would", () => {
  it("counts sittings in words up to twenty and in digits after", () => {
    expect(word(0)).toBe("no");
    expect(word(16)).toBe("sixteen");
    expect(word(21)).toBe("21");
    expect(Word(2)).toBe("Two");
  });

  it("groups digits the same way in both runtimes", () => {
    expect(num(1710)).toBe("1,710");
  });

  it("puts a sitting's length in minutes or hours, never in seconds", () => {
    expect(howLong(30, 31)).toBe("about 15 minutes");
    expect(howLong(107, 31)).toBe("about an hour");
    expect(howLong(400, 31)).toBe("about 3.5 hours");
  });

  // The sentence moved off the header's already-answered figure, which was how
  // many marks had been answered when the band was built — a fact about the deal,
  // not about the band, quietly answering a different question than it was asked.
  it("says whether anybody has checked the confidence number yet", () => {
    const bands = [band("0.55-0.65", ["a", "b"]), band("0.65-0.75", ["c", "d"])];
    expect(bandsLine(bands, new Set())).toContain("Nothing has ever checked");
    expect(bandsLine(bands, new Set(["a"]))).toContain("One of the two has been started");
    expect(bandsLine(bands, new Set(["a", "b"]))).toContain("One of the two has been sat");
    expect(bandsLine(bands, new Set(["a", "b", "c", "d"]))).toContain("All two have been sat");
  });

  it("names a band nobody wrote a line for by its own range", () => {
    expect(bandCopy("0.55-0.65", [["0.55-0.65", "Barely accepted", "the weakest"]]).title).toBe("Barely accepted");
    expect(bandCopy("0.4-0.5", []).title).toBe("0.4-0.5");
  });
});

describe("the tiles", () => {
  it("draws a part with its number, its bar and its fraction", () => {
    const html = partTile(THREE[0], 1);
    expect(html).toContain('href="sit.part-1.html"');
    expect(html).toContain('data-part="1"');
    expect(html).toContain("width:50%");
    expect(html).toContain("1 of 2");
    expect(html).not.toContain("done");
  });

  it("marks a finished one so it can be told apart and folded away", () => {
    expect(partTile(THREE[0], 2)).toContain('class="sit part done"');
  });

  it("draws a band with the words somebody wrote for it", () => {
    const html = bandTile(band("0.55-0.65", ["a", "b"]), 0, "Barely accepted", "the weakest matches");
    expect(html).toContain("Barely accepted");
    expect(html).toContain("the weakest matches");
    expect(html).toContain("0 of 2");
  });

  // These strings go into href and data- attributes, so a quote in a file name
  // that survived escaping would end the attribute early.
  it("escapes what it puts inside an attribute", () => {
    expect(esc('a"b<c&d')).toBe("a&quot;b&lt;c&amp;d");
  });
});

/**
 * The rule, checked rather than asserted in a comment.
 *
 * Each function's source is re-evaluated alongside its siblings in a scope that
 * has nothing else in it — no imports, no module constants, not even the other
 * halves of this file that were not shipped. If somebody closes one of these over
 * a binding at module scope, it keeps working everywhere except the one place it
 * has to work, and this is what stops that going out.
 */
describe("closed over nothing but each other", () => {
  const loose = new Function(
    `${Object.values(view).map((f) => f.toString()).join("\n")}\nreturn {${Object.keys(view).join(",")}};`,
  )();

  it("re-evaluates in an empty scope", () => {
    expect(Object.keys(loose).sort()).toEqual(Object.keys(view).sort());
  });

  it("reaches the same answers there as it does here", () => {
    const standing = new Set(["1:1", "2:1"]);
    expect(loose.census(THREE).per).toBe(census(THREE).per);
    expect(loose.partTile(THREE[0], 1)).toBe(partTile(THREE[0], 1));
    expect(loose.bandsLine([band("0.55-0.65", ["1:1"])], standing)).toBe(bandsLine([band("0.55-0.65", ["1:1"])], standing));
    expect(loose.carryOn(THREE, standing).sitting.part).toBe(carryOn(THREE, standing).sitting.part);
    expect(loose.howLong(107, 31)).toBe(howLong(107, 31));
    expect(loose.num(1710)).toBe(num(1710));
  });
});
