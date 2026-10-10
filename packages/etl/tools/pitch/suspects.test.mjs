import { describe, expect, it } from "vitest";
import { opensOnStray, suspects } from "./suspects.mjs";

// Made-up notes: the shape of the capture, none of its words.
describe("suspects", () => {
  it("finds a bracket the paragraph opens and never closes", () => {
    expect(suspects("The lamp was lit (see 4:2; 5:3;")).toEqual([{ kind: "open-bracket", at: 17 }]);
    expect(suspects("The lamp [of oil was lit.")).toEqual([{ kind: "open-bracket", at: 9 }]);
  });

  it("finds references set side by side with nothing between them", () => {
    expect(suspects("Was the lamp lit? 9:83–85 7:142c The oil ran out.")).toEqual([{ kind: "bare-refs", at: 18 }]);
    expect(suspects("See 4:2; 5:3 6:47.")).toEqual([{ kind: "bare-refs", at: 9 }]);
  });

  it("reads past the marks around slanted words", () => {
    expect(suspects("The lamp (see 4:2;")).toEqual([{ kind: "open-bracket", at: 11 }]);
  });

  it("finds a paragraph that opens on the end of the sentence before it", () => {
    // A break placed a word late leaves the next paragraph opening on a word
    // and a stop, or on the closing quote alone (27:7's, 3:83's, 2026-10-10).
    expect(suspects("lamp. The oil ran out.")).toEqual([{ kind: "stray-opening", at: 0 }]);
    expect(suspects(".” The oil ran out.")).toEqual([{ kind: "stray-opening", at: 0 }]);
    expect(suspects("lamp.) The oil ran out.")).toEqual([{ kind: "stray-opening", at: 0 }]);
  });

  it("finds it before the book's quotes are set, so the splits listing can show the seam", () => {
    expect(opensOnStray('." The oil ran out.')).toBe(true);
    expect(opensOnStray('lamp." The oil ran out.')).toBe(true);
    expect(opensOnStray('"The oil ran out."')).toBe(false);
  });

  it("passes a paragraph that opens on a short sentence of its own or a numbered aside", () => {
    expect(suspects("Lit. The oil ran out.")).toEqual([]);
    expect(suspects("2. The oil ran out.")).toEqual([]);
    expect(suspects("V. 4 The oil ran out.")).toEqual([]);
    expect(suspects("The lamp. The oil ran out.")).toEqual([]);
  });

  it("passes a paragraph whose brackets close and whose references are set apart", () => {
    expect(suspects("The lamp was lit (see 4:2; 5:3, 9). Then 6:47 and 7:1.")).toEqual([]);
    expect(suspects("Verses 4:2–3 speak of it.")).toEqual([]);
  });
});
