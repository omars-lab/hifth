/**
 * The fold, on words small enough to count by hand.
 *
 * These are not a second measurement of the mus'haf — `probe-tajweed-words.mjs`
 * is that, and it needs 378 MB of gitignored cache to say anything, which is
 * why it is a probe and not a gate. What a test *can* hold is the arithmetic:
 * that a toggled correction changes the string in exactly the stated way, that
 * spans stay half-open, and that the offsets a caller reads out of `hosts` are
 * absolute rather than relative to the prefix. Every one of those is a way the
 * inspector could show a confident wrong screen.
 *
 * The words below are the ordinary ones — al-Fatiha's opening, which is also
 * the basmala the fold prepends — because a correction is easiest to read as a
 * difference in a string a reader recognises.
 */
import { describe, expect, it } from "vitest";
import {
  ALL_CORRECTIONS,
  CORRECTIONS,
  CODEPOINT_NAMES,
  DRIFT_LIMIT,
  driftOnset,
  driftShape,
  foldAyah,
  hasBasmala,
  joinWords,
  nameOf,
  nameWindow,
  oracleOf,
  ORACLE,
  respellerFor,
  touchClass,
  touched,
} from "./tajweed-fold.mjs";

/** `{ hafs, waw, mark }` without the ceremony. */
const w = (hafs, extra = {}) => ({ hafs, waw: false, mark: false, ...extra });

/** 1:1 — «بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ», as the print numbers it. */
const BASMALA = [w("بِسۡمِ"), w("ٱللَّهِ"), w("ٱلرَّحۡمَٰنِ"), w("ٱلرَّحِيمِ")];

const str = (cps) => cps.join("");
const all = new Set(ALL_CORRECTIONS);

/**
 * The four features, written as codepoint escapes rather than pasted glyphs.
 * A combining mark in a source file is unreadable and a wrong one is invisible,
 * and every assertion below is about identity.
 */
const CP = {
  TATWEEL_YEH: "\u0640\u06e7", // 4, the common carrier — إِبۡرَٰهِـۧمُ
  TATWEEL_NOON: "\u0640\u06e8", // 4, the rare one — أَنجِـۨي
  BARE_TATWEEL: "\u0640\u062c", // a tatweel carrying nothing — 2:97's «لِّـجِ»
  ALEF_MADDA: "\u0623\u0653", // 5
  SMALL_MADDA: "\u06e4", // 6
  HAMZA_BELOW: "\u0655", // 7
};

describe("joinWords", () => {
  it("puts one space between words and none after the last", () => {
    const { cps } = joinWords([w("ا"), w("ب"), w("ج")], all);
    expect(str(cps)).toBe("ا ب ج");
  });

  it("reports half-open spans that index the codepoints it returned", () => {
    const { cps, spans } = joinWords([w("ابج"), w("ده")], all);
    expect(spans).toEqual([
      [0, 3],
      [4, 6],
    ]);
    expect(str(cps.slice(...spans[1]))).toBe("ده");
  });

  it("shifts every span by `at`, so a run after a prefix reads absolute", () => {
    const { spans } = joinWords([w("ابج"), w("ده")], all, 10);
    expect(spans).toEqual([
      [10, 13],
      [14, 16],
    ]);
  });

  describe("correction 2 — the split conjunction waw", () => {
    it("glues a flagged word to its successor when `waw` is on", () => {
      const { cps } = joinWords([w("وَ", { waw: true }), w("لَا"), w("ب")], all);
      expect(str(cps)).toBe("وَلَا ب");
    });

    it("spaces it like any other word when `waw` is off", () => {
      const on = new Set(["basmala", "marks"]);
      const { cps } = joinWords([w("وَ", { waw: true }), w("لَا"), w("ب")], on);
      expect(str(cps)).toBe("وَ لَا ب");
    });
  });

  describe("correction 3 — the pause marks", () => {
    const words = [w("ا"), w("ۖ", { mark: true }), w("ب")];

    it("drops a mark word AND the space it would have carried", () => {
      const { cps, spans } = joinWords(words, all);
      expect(str(cps)).toBe("ا ب");
      expect(spans[1]).toBeNull();
      // The two-codepoint insertion the histogram saw: the mark and its space.
      expect(joinWords(words, new Set(["basmala", "waw"])).cps.length - cps.length).toBe(2);
    });

    it("keeps the word slot, so later print indices do not renumber", () => {
      const { spans } = joinWords(words, all);
      expect(spans).toHaveLength(3);
    });

    it("does not leave a trailing space when the last word is a dropped mark", () => {
      const { cps } = joinWords([w("ا"), w("ب"), w("ۖ", { mark: true })], all);
      expect(str(cps)).toBe("ا ب");
    });
  });

  describe("corrections 4–7 — the orthographic respells", () => {
    it("changes a word's width and never its identity or its neighbours", () => {
      // «ٱلۡأٓ» spends one more codepoint after correction 5; the word after
      // it still starts one space later, and its span still indexes what it claims.
      const { cps, spans } = joinWords([w(CP.ALEF_MADDA), w("ب")], all);
      expect(spans[0][1] - spans[0][0]).toBe(3);
      expect(spans[1][0]).toBe(spans[0][1] + 1);
      expect(str(cps.slice(...spans[1]))).toBe("ب");
    });

    it("is off when its id is off, one correction at a time", () => {
      for (const c of CORRECTIONS.filter((x) => x.respell)) {
        const without = new Set(ALL_CORRECTIONS.filter((id) => id !== c.id));
        const sample = c.respell[0][0].source; // the literal that rule matches
        expect(respellerFor(without)(sample)).toBe(sample);
        expect(respellerFor(new Set([c.id]))(sample)).not.toBe(sample);
      }
    });
  });
});

describe("respellerFor", () => {
  it("is the identity when no orthographic correction is on", () => {
    const respell = respellerFor(new Set(["basmala", "waw", "marks"]));
    const text = CP.ALEF_MADDA + CP.SMALL_MADDA + CP.HAMZA_BELOW;
    expect(respell(text)).toBe(text);
  });

  it("4 — unseats a small high mark from its tatweel, both carriers", () => {
    expect(respellerFor(all)(CP.TATWEEL_YEH)).toBe("\u06e7");
    expect(respellerFor(all)(CP.TATWEEL_NOON)).toBe("\u06e8");
  });

  it("4 — leaves a tatweel that carries nothing alone", () => {
    // 2:97 stays a residual ayah for exactly this reason: the generalisation
    // that would catch it costs 4.5 oracle points.
    expect(respellerFor(all)(CP.BARE_TATWEEL)).toBe(CP.BARE_TATWEEL);
  });

  it("5 — spends three codepoints where the print spends two", () => {
    expect([...respellerFor(all)(CP.ALEF_MADDA)]).toHaveLength(2 + 1);
  });

  it("6 and 7 — drop the small high madda and the hamza below", () => {
    expect(respellerFor(all)("\u0628" + CP.SMALL_MADDA)).toBe("\u0628");
    expect(respellerFor(all)("\u0628" + CP.HAMZA_BELOW)).toBe("\u0628");
  });

  it("composes all four, and none of them overlaps another", () => {
    const text = CP.ALEF_MADDA + "\u0628" + CP.TATWEEL_YEH + CP.SMALL_MADDA + "\u064a" + CP.HAMZA_BELOW;
    expect(respellerFor(all)(text)).toBe("\u0621\u064e\u0627" + "\u0628" + "\u06e7" + "\u064a");
  });
});

describe("hasBasmala", () => {
  it("is true for ayah 1 of every surah but al-Fatiha and at-Tawba", () => {
    expect(hasBasmala(2, 1)).toBe(true);
    expect(hasBasmala(114, 1)).toBe(true);
    expect(hasBasmala(1, 1)).toBe(false); // there it IS ayah 1
    expect(hasBasmala(9, 1)).toBe(false); // at-Tawba has none
    expect(hasBasmala(2, 2)).toBe(false);
  });
});

describe("foldAyah", () => {
  const args = { surah: 2, ayah: 1, words: [w("الٓمٓ")], basmala: BASMALA, indices: [1] };

  it("prepends the basmala and one space when `basmala` is on", () => {
    const { cps, prefix } = foldAyah({ ...args, on: all });
    expect(str(cps)).toBe("بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ الٓمٓ");
    expect(prefix).toBe(str(cps).indexOf("الٓمٓ"));
  });

  it("omits it when `basmala` is off — the 326-out-of-range case", () => {
    const { cps, prefix } = foldAyah({ ...args, on: new Set(["waw", "marks"]) });
    expect(str(cps)).toBe("الٓمٓ");
    expect(prefix).toBe(0);
  });

  it("folds the prefix under the same corrections as the body", () => {
    // A mark inside the basmala must vanish from the prefix too, or the ayah's
    // own offsets shift by two and every span in it is wrong.
    const basmala = [w("بِسۡمِ"), w("ۖ", { mark: true }), w("ٱللَّهِ")];
    const on = new Set(ALL_CORRECTIONS);
    const withMarks = foldAyah({ ...args, basmala, on: new Set(["basmala", "waw"]) });
    const without = foldAyah({ ...args, basmala, on });
    expect(withMarks.prefix - without.prefix).toBe(2);
  });

  it("gives basmala hosts a null print index — they belong to another ayah", () => {
    const { hosts } = foldAyah({ ...args, on: all });
    expect(hosts.filter((h) => h.print === null)).toHaveLength(4);
    expect(hosts.at(-1)).toMatchObject({ print: 1 });
  });

  it("carries the caller's print indices rather than renumbering", () => {
    const { hosts } = foldAyah({
      surah: 2,
      ayah: 4,
      words: [w("ا"), w("ۖ", { mark: true }), w("ب")],
      indices: [7, 8, 9],
      on: all,
    });
    expect(hosts.map((h) => h.print)).toEqual([7, 9]);
  });

  it("puts the hosts' offsets on the same ruler as the codepoints", () => {
    const { cps, hosts } = foldAyah({ ...args, on: all });
    const last = hosts.at(-1);
    expect(str(cps.slice(last.from, last.to))).toBe("الٓمٓ");
  });
});

describe("touched / touchClass", () => {
  const hosts = [
    { print: 1, from: 0, to: 4 },
    { print: 2, from: 5, to: 9 },
    { print: 3, from: 10, to: 14 },
  ];

  it("is half-open: a span ending where a word begins does not touch it", () => {
    expect(touched(hosts, 0, 5)).toEqual([0]);
    expect(touched(hosts, 0, 6)).toEqual([0, 1]);
  });

  it("names the four outcomes", () => {
    expect(touchClass(hosts, 1, 3, 14)).toBe("one");
    expect(touchClass(hosts, 3, 6, 14)).toBe("two-adjacent");
    expect(touchClass(hosts, 3, 11, 14)).toBe("wider");
    expect(touchClass(hosts, 12, 20, 14)).toBe("past-end");
  });

  it("calls a span touching nothing `one` — a gap is not a second word", () => {
    // Offsets landing in the space between two words. There is nothing to paint
    // and nothing wrong; what would be wrong is counting it as a wide span.
    expect(touchClass(hosts, 4, 5, 14)).toBe("one");
  });

  it("checks past-end before overlap, so a long span is not also `wider`", () => {
    expect(touchClass(hosts, 0, 99, 14)).toBe("past-end");
  });
});

describe("oracleOf", () => {
  const cps = [..."بِٱلۡحَقِّ"];

  it("is null for the sixteen rules that name no letter", () => {
    expect(oracleOf(cps, { rule: "madd_2", start: 0, end: 2 })).toBeNull();
  });

  it("hits when the expected letter is under the offset", () => {
    const at = cps.indexOf("ٱ");
    expect(oracleOf(cps, { rule: "hamzat_wasl", start: at })).toEqual({
      want: "ٱ",
      hit: true,
      delta: 0,
    });
  });

  it("signs the delta: + means the fold ran long", () => {
    const at = cps.indexOf("ٱ");
    expect(oracleOf(cps, { rule: "hamzat_wasl", start: at - 1 }).delta).toBe(1);
    expect(oracleOf(cps, { rule: "hamzat_wasl", start: at + 1 }).delta).toBe(-1);
  });

  it("prefers the nearer letter, and searches behind before ahead", () => {
    const two = [..."ٱبٱ"];
    expect(oracleOf(two, { rule: "hamzat_wasl", start: 1 }).delta).toBe(-1);
  });

  it("reports `null` rather than a large delta beyond the limit", () => {
    const far = [..."ٱ"].concat(Array(DRIFT_LIMIT + 4).fill("ب"));
    expect(oracleOf(far, { rule: "hamzat_wasl", start: far.length - 1 }).delta).toBeNull();
  });

  it("uses only rules whose letter is not in doubt", () => {
    expect(Object.keys(ORACLE)).toEqual(["hamzat_wasl", "lam_shamsiyyah"]);
  });
});

describe("driftShape", () => {
  it("names what the fold inserted when it ran long", () => {
    // The reconstruction carries a tatweel the offsets do not count, so the
    // expected letter sits one later than Tanzil says.
    const cps = [..."بـٱل"];
    expect(driftShape(cps, 1, 1)).toBe("ـ");
  });

  it("falls back to the print's own spelling when the fold ran short", () => {
    const cps = [..."بأٓٱل"];
    expect(driftShape(cps, 4, -1)).toBe("ٓٱل");
  });

  it("has its own bucket for a letter that is nowhere near", () => {
    expect(driftShape([], 0, null)).toMatch(/±8/);
  });
});

describe("driftOnset", () => {
  // Four words at [0,4) [5,9) [10,14) [15,19), which is what `hosts` looks like
  // after a fold; the codepoints only have to be countable.
  const hosts = [0, 5, 10, 15].map((from, i) => ({ print: i + 1, from, to: from + 4 }));
  const cps = [..."aaaa bbbb cccc dddd"];

  it("brackets the first miss with the last hit before it", () => {
    const onset = driftOnset([{ start: 2, delta: 0 }, { start: 12, delta: -1 }], hosts, cps);
    expect(onset).toMatchObject({ from: 2, to: 12, delta: -1, bounded: true });
    // Only the word wholly inside the window — the two the annotations sit in
    // are half-covered and cannot be blamed.
    expect(onset.words.map((w) => w.text)).toEqual(["bbbb"]);
  });

  it("does not narrow the window with a hit that comes after the miss", () => {
    // A later hit would mean the drift undid itself, which does not happen; if
    // it appeared, using it would point at the wrong words.
    const onset = driftOnset([{ start: 12, delta: -1 }, { start: 17, delta: 0 }], hosts, cps);
    expect(onset.from).toBe(0);
    expect(onset.bounded).toBe(false);
  });

  it("says it is unbounded rather than pretending to a left edge", () => {
    const onset = driftOnset([{ start: 7, delta: 1 }], hosts, cps);
    expect(onset).toMatchObject({ from: 0, bounded: false });
  });

  it("is null for an ayah the oracle is perfect on", () => {
    expect(driftOnset([{ start: 2, delta: 0 }], hosts, cps)).toBeNull();
  });

  it("takes the FIRST miss, wherever the caller listed it", () => {
    const rows = [{ start: 17, delta: -1 }, { start: 2, delta: 0 }, { start: 12, delta: -1 }];
    expect(driftOnset(rows, hosts, cps)).toMatchObject({ from: 2, to: 12 });
  });
});

describe("naming codepoints", () => {
  it("gives the hex and the Unicode name", () => {
    expect(nameOf("ـ")).toBe("U+0640 ARABIC TATWEEL");
    expect(nameOf("ۧ")).toBe("U+06E7 ARABIC SMALL HIGH YEH");
    expect(nameOf(" ")).toBe("U+0020 SPACE");
  });

  it("keeps the hex for a codepoint the table does not know", () => {
    expect(nameOf("A")).toBe("U+0041");
  });

  it("says so rather than throwing past the end of the string", () => {
    expect(nameOf(undefined)).toMatch(/past the end/);
  });

  it("covers the two rules' own letters, or the oracle is unreadable", () => {
    for (const letter of Object.values(ORACLE)) {
      expect(CODEPOINT_NAMES[letter.codePointAt(0)]).toBeTruthy();
    }
  });

  it("windows around an offset and marks the focus", () => {
    const win = nameWindow([..."ابجده"], 2, 1);
    expect(win.map((c) => c.ch)).toEqual(["ب", "ج", "د"]);
    expect(win.filter((c) => c.focus)).toHaveLength(1);
  });

  it("clamps the window at both ends of the string", () => {
    expect(nameWindow([..."اب"], 0, 3)).toHaveLength(2);
  });
});

describe("the corrections list", () => {
  it("is what `on` is written in terms of, with no id spelt twice", () => {
    expect(new Set(ALL_CORRECTIONS).size).toBe(CORRECTIONS.length);
  });

  it("carries the evidence for each, because the report renders it", () => {
    for (const c of CORRECTIONS) {
      expect(c.title).toBeTruthy();
      expect(c.what).toBeTruthy();
      expect(c.evidence).toBeTruthy();
    }
  });
});
