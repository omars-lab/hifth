import { describe, expect, it } from "vitest";
import {
  HARAKAH_PICKERS,
  HARAKAH_PICK_DEFAULT,
  OptionA,
  OptionB,
  OptionC,
  nearestSign,
  signsOnWord,
  type PickSign,
} from "./harakah-pick.js";

// Two words: word 1 has three signs, the rightmost first in reading order;
// word 2 has one. Positions only — no text.
const SIGNS: PickSign[] = [
  { id: 0, w: 1, name: "fatha", x: 20, y: 10, mw: 4, mh: 2 },
  { id: 1, w: 1, name: "kasra", x: 30, y: 30, mw: 4, mh: 2 },
  { id: 2, w: 1, name: "fatha", x: 10, y: 10, mw: 4, mh: 2 },
  { id: 3, w: 2, name: "sukun", x: 60, y: 10, mw: 3, mh: 3 },
];

describe("harakah-pick options", () => {
  it("orders a word's signs right to left", () => {
    expect(signsOnWord(SIGNS, 1).map((s) => s.id)).toEqual([1, 0, 2]);
    expect(signsOnWord(SIGNS, 9)).toEqual([]);
  });

  it("A opens the word's signs by name, in reading order", () => {
    expect(OptionA.choices(SIGNS, 1)).toEqual([
      { id: 1, label: "kasra" },
      { id: 0, label: "fatha" },
      { id: 2, label: "fatha" },
    ]);
    expect(OptionA.startsOn).toBe("word");
    expect(OptionA.snap(SIGNS, 21, 11)).toBeNull();
  });

  it("C numbers the names, so two signs of one name stay apart", () => {
    expect(OptionC.choices(SIGNS, 1).map((c) => c.label)).toEqual(["1 · kasra", "2 · fatha", "3 · fatha"]);
  });

  it("B opens nothing and snaps a press to the nearest sign", () => {
    expect(OptionB.choices(SIGNS, 1)).toEqual([]);
    expect(OptionB.startsOn).toBe("press");
    expect(OptionB.snap(SIGNS, 21, 11)).toBe(0);
    expect(OptionB.snap(SIGNS, 100, 0)).toBe(3);
    expect(nearestSign([], 0, 0)).toBeNull();
  });

  it("lists the three options, and the app's default is A until one is chosen", () => {
    expect(HARAKAH_PICKERS.map((p) => p.id)).toEqual(["A", "B", "C"]);
    expect(HARAKAH_PICK_DEFAULT).toBe(OptionA);
  });

  // The page builder inlines each function by its source; a function that
  // reached for a module-level name would break on the page.
  it("every function stands alone", () => {
    for (const p of HARAKAH_PICKERS) {
      const choices = new Function(`return (${p.choices.toString()})`)();
      const snap = new Function(`return (${p.snap.toString()})`)();
      expect(choices(SIGNS, 1)).toEqual(p.choices(SIGNS, 1));
      expect(snap(SIGNS, 21, 11)).toEqual(p.snap(SIGNS, 21, 11));
    }
  });
});
