/**
 * The join, on words small enough to count by hand.
 *
 * `probe-diacritics.mjs` ④ and ⑤ are the measurement — 86,962 words joined and
 * 34 tokens pinned to one name each — and they need 380 MB of gitignored cache
 * to say anything, which is why they are a probe and not a gate. What a test
 * *can* hold is the arithmetic and, more importantly, the **refusals**: this
 * file's whole value downstream is that a caller can trust a non-null answer,
 * and it can only trust one if a partial answer is impossible to get.
 *
 * So most of what is asserted below is that `markPaths` returns `null` — for a
 * mark count that disagrees, for a name the tokens did not ask for, for letters
 * no assignment of ligatures can cover. A version of this file that guessed
 * would pass a happy-path test and would be exactly the defect this repo has
 * already shipped once, where a length check agreed while every mark was
 * misassigned (④'s left-to-right walk).
 *
 * Marks are written as `[id, x, y, w, h]` with ids from `@hifth/core`'s
 * `DIACRITICS`, looked up by name rather than pasted as numbers — a reordering
 * of that table must not silently rewrite what this file claims.
 */
import { diacriticId } from "@hifth/core";
import { describe, expect, it } from "vitest";
import { DRAWN_NAME, align, expected, letters, markPaths, pairMarks } from "./mark-join.mjs";

/** A mark at `x`, named. Only the name and the x ever matter here. */
const m = (name, x = 0) => [diacriticId(name), x, 0, 1, 1];

/** A word in the shape `readDiacritics` returns, minus the fields the join ignores. */
const word = (hafs, ligatures) => ({ hafs, ligatures });

/** `{ text, marks }` without the ceremony. */
const lig = (text, marks = []) => ({ text, marks });

describe("letters", () => {
  it("folds every combining mark onto the letter before it, carrying its index", () => {
    // «بِهِۦ» — beh, kasra, heh, kasra, small yeh.
    const ls = letters("بِهِۦ");
    expect(ls.map((l) => l.letter)).toEqual(["ب", "ه"]);
    expect(ls[0]).toMatchObject({ at: 0, marks: [{ ch: "ِ", at: 1 }] });
    expect(ls[1].at).toBe(2);
    expect(ls[1].marks.map((x) => x.at)).toEqual([3, 4]);
  });

  it("counts in codepoints, so `at` is an index into the string the print wrote", () => {
    const hafs = "شَيۡـٔٗا";
    const ls = letters(hafs);
    for (const l of ls) {
      expect([...hafs][l.at]).toBe(l.letter);
      for (const mk of l.marks) expect([...hafs][mk.at]).toBe(mk.ch);
    }
  });

  it("a leading combining mark has no letter to fold onto and stands alone", () => {
    // Not a word the print writes; the guard exists so a corrupt `data-hafs`
    // cannot index past the start of the array.
    expect(letters("ِب").map((l) => l.letter)).toEqual(["ِ", "ب"]);
  });
});

describe("expected", () => {
  const tokensOf = (hafs) => letters(hafs).flatMap(expected).map((t) => t.token);

  it("gives a seated hamza its own path, always", () => {
    // «أَنَّ» is drawn `[أ|ن]` and still carries hamza then fatha — the
    // conditional version of this cost 151 words.
    expect(tokensOf("أَ")).toEqual(["U+0623", "U+064E"]);
    expect(tokensOf("ٱل")).toEqual(["U+0671"]);
  });

  it("does not give a bare hamza one — the print draws it as a letter", () => {
    expect(tokensOf("ء")).toEqual([]);
  });

  it("folds an iqlab meem into the vowel before it, as one composite glyph", () => {
    // «كَافِرِۭ» — the kasra and U+06ED are one path the corpus calls `kasra iqlab`.
    expect(tokensOf("رِۭ")).toEqual(["U+0650+iqlab"]);
    expect(tokensOf("رَۢ")).toEqual(["U+064E+iqlab"]);
  });

  it("spans the vowel and the meem together, so a rule on either reaches the path", () => {
    const t = letters("رِۭ").flatMap(expected);
    expect(t).toEqual([{ token: "U+0650+iqlab", at: 1, len: 2 }]);
  });

  it("draws nothing for a tatweel or a sajda overline", () => {
    // «مَـَٔابٗا» — the tatweel is a tooth folded into its neighbour and gets no
    // path; the two fathas and the hamza-above on it do. U+06E4 is the sajda
    // overline, `data-type="sajda-line"`, which is not a named mark.
    expect(tokensOf("مَـَٔ")).toEqual(["U+064E", "U+064E", "U+0654"]);
    expect(tokensOf("اۤ")).toEqual([]);
  });

  it("names a madda on a seated hamza differently from a madda anywhere else", () => {
    // The one place in the dictionary where a codepoint's drawn name depends on
    // the letter under it — 277 of 277, measured, not assumed.
    expect(tokensOf("أٓ")).toEqual(["U+0623", "U+0653@hamza"]);
    expect(tokensOf("مٓ")).toEqual(["U+0653"]);
    expect(DRAWN_NAME["U+0653@hamza"]).toBe("fatha");
    expect(DRAWN_NAME["U+0653"]).toBe("maddah");
  });
});

describe("align", () => {
  it("matches on content, not on order — ligature order is not reading order", () => {
    // «ٱلرَّحِيمِ» is drawn `[لر|حيم|ٱ]`, and a left-to-right walk got this wrong
    // while every length balanced.
    const ls = letters("ٱلرَّحِيمِ");
    const plan = align(ls, [lig("لر"), lig("حيم"), lig("ٱ")]);
    expect(plan).not.toBeNull();
    const drawn = plan.filter((s) => !s.redraw).map((s) => s.lig);
    expect(drawn).toEqual([2, 0, 1]);
  });

  it("allows a letter to be redrawn, markless, in a second ligature", () => {
    // «فَلَا» → `[فلا|ا]`: the alef is drawn twice and the second stroke carries
    // nothing. That second step is `redraw`, and `markPaths` skips it.
    const plan = align(letters("فَلَا"), [lig("فلا"), lig("ا")]);
    expect(plan).not.toBeNull();
    expect(plan.some((s) => s.redraw)).toBe(true);
  });

  it("returns null when no assignment covers the letters", () => {
    expect(align(letters("فَلَا"), [lig("فل")])).toBeNull();
  });

  it("returns null for a word with no ligatures at all", () => {
    expect(align(letters("فَلَا"), [])).toBeNull();
  });
});

describe("pairMarks", () => {
  const tokens = (hafs) => letters(hafs).flatMap(expected);

  it("pairs by the name the dictionary predicts, not by position", () => {
    // «أَ» wants [hamza, fatha]; the print here draws them fatha-first.
    const marks = [m("fatha", 10), m("hamza", 20)];
    expect(pairMarks(tokens("أَ"), marks)).toEqual([1, 0]);
  });

  it("breaks a same-name tie right to left, the direction the script runs", () => {
    // Two fathas, drawn in document order left then right; the first token is
    // the first letter, which is the rightmost mark.
    const marks = [m("fatha", 10), m("fatha", 30)];
    expect(pairMarks(tokens("بَبَ"), marks)).toEqual([1, 0]);
  });

  it("returns null when a wanted name is not drawn at all", () => {
    expect(pairMarks(tokens("أَ"), [m("fatha"), m("fatha")])).toBeNull();
  });

  it("returns null when a name runs out before the tokens do", () => {
    expect(pairMarks(tokens("بَبَ"), [m("fatha", 10)])).toBeNull();
  });

  it("returns null for a token the dictionary does not name", () => {
    expect(pairMarks([{ token: "U+FFFF", at: 0, len: 1 }], [m("fatha")])).toBeNull();
  });
});

describe("markPaths", () => {
  it("returns one row per drawn path, indexed into the word's own `data-hafs`", () => {
    // «بِهِۦ» drawn as one ligature carrying kasra, kasra, small yeh.
    const marks = [m("kasra", 30), m("kasra", 20), m("small yeh", 10)];
    const out = markPaths(word("بِهِۦ", [lig("به", marks)]));
    expect(out.map((r) => [r.at, r.len, r.name])).toEqual([
      [1, 1, "kasra"],
      [3, 1, "kasra"],
      [4, 1, "small yeh"],
    ]);
    expect(out[2].mark).toBe(marks[2]);
  });

  it("sorts by codepoint index, whatever order the print drew them in", () => {
    const out = markPaths(word("أَ", [lig("ا", [m("fatha", 10), m("hamza", 20)])]));
    expect(out.map((r) => r.at)).toEqual([0, 1]);
  });

  it("skips a redraw, which carries no marks by construction", () => {
    const out = markPaths(word("فَلَا", [lig("فلا", [m("fatha", 30), m("fatha", 20)]), lig("ا")]));
    expect(out.map((r) => r.at)).toEqual([1, 3]);
  });

  it("returns null — not a partial answer — when a mark count disagrees", () => {
    // The three residual words of ④ land here. A row for the marks it *could*
    // place would be worse than nothing: it would look like an answer.
    expect(markPaths(word("بِهِۦ", [lig("به", [m("kasra"), m("kasra")])]))).toBeNull();
  });

  it("returns null when the letters cannot be assigned to the ligatures", () => {
    expect(markPaths(word("فَلَا", [lig("فل", [m("fatha")])]))).toBeNull();
  });

  it("returns null when the drawn names cannot satisfy the tokens", () => {
    expect(markPaths(word("أَ", [lig("ا", [m("fatha"), m("damma")])]))).toBeNull();
  });

  it("returns an empty list for a word the print draws with no named path", () => {
    expect(markPaths(word("من", [lig("من")]))).toEqual([]);
  });
});

describe("DRAWN_NAME", () => {
  it("is frozen — ⑤ re-derives it every full run and reports any drift", () => {
    expect(Object.isFrozen(DRAWN_NAME)).toBe(true);
  });

  it("names only marks the shipped vocabulary carries", () => {
    for (const name of Object.values(DRAWN_NAME)) expect(diacriticId(name)).toBeGreaterThanOrEqual(0);
  });

  it("keys are `U+XXXX`, optionally with one qualifier", () => {
    for (const token of Object.keys(DRAWN_NAME)) {
      expect(token).toMatch(/^U\+[0-9A-F]{4}(\+iqlab|@hamza)?$/);
    }
  });
});
