import { describe, expect, it } from "vitest";
import { paragraphStarts, placeStarts } from "./indents.mjs";
import { seams, seamPrint } from "./breaks.mjs";

// Made-up lines and notes: the shape of a page reading, none of its words.
const line = (x, y, text) => ({ x, y, text });
const PAGE = [
  line(0.3, 0.02, "Running Head"),
  line(0.058, 0.1, "the travellers rested by the well on the"),
  line(0.058, 0.12, "third day and gave thanks for the water."),
  line(0.07, 0.14, "The next morning they set out again over"),
  line(0.058, 0.16, "the hills toward the sea."),
  line(0.086, 0.18, "12 The road to the sea was long and"),
  line(0.057, 0.2, "“dusty,” they said, and the well was far."),
  line(0.531, 0.1, "far behind them when the rain came down"),
  line(0.529, 0.12, "on the third night of the march."),
  line(0.541, 0.14, "Shelter was found in a cave by the road"),
  line(0.53, 0.16, "and they slept there until the dawn."),
  line(0.878, 0.95, "301"),
];

describe("paragraphStarts", () => {
  it("picks the lines set in by a paragraph indent, on either half of the spread", () => {
    expect(paragraphStarts(PAGE).map((s) => s.text)).toEqual([
      "The next morning they set out again over",
      "Shelter was found in a cave by the road",
    ]);
  });

  it("passes over a note's opening line, set in further, and a quote mark hung in the margin", () => {
    const starts = paragraphStarts(PAGE).map((s) => s.text);
    expect(starts.some((t) => t.startsWith("12 "))).toBe(false);
    expect(starts.some((t) => t.startsWith("“"))).toBe(false);
  });

  it("does not take a line read further up for the line before, where the reading skipped some", () => {
    const skipped = [...PAGE.slice(1, 3), line(0.07, 0.2, "The next morning they set out again over"), line(0.058, 0.22, "the hills.")];
    expect(paragraphStarts(skipped)[0].before).toBe("");
  });

  it("carries the end of the line before, to tell two places with the same opening apart", () => {
    expect(paragraphStarts(PAGE)[0].before).toBe("third day and gave thanks for the water.");
  });
});

describe("placeStarts", () => {
  const RUN = "They rested by the well and gave thanks for the water. The next morning they set out again over the hills.";
  const SPLIT = ["They rested by the well.", "The next morning they set out again over the hills."];
  const start = { text: "The next morning they set out again over", before: "gave thanks for the water.", page: "page_0009" };

  it("finds a paragraph start the capture ran on from a kept full stop", () => {
    const [placed] = placeStarts([start], [{ verse: "9:9", blocks: [RUN] }]);
    const at = seams(RUN).find((s) => RUN.slice(s.at + 1).startsWith("The next")).at;
    expect(placed).toMatchObject({ kind: "stop-kept", verse: "9:9", print: seamPrint(RUN, at), page: "page_0009" });
  });

  it("says when the capture already starts a paragraph there", () => {
    expect(placeStarts([start], [{ verse: "9:9", blocks: SPLIT }])[0].kind).toBe("split");
  });

  it("tells a start whose full stop the capture also lost", () => {
    const lost = RUN.replace("water.", "water");
    expect(placeStarts([start], [{ verse: "9:9", blocks: [lost] }])[0].kind).toBe("stop-lost");
  });

  it("names the marks the page and the capture each end the line before on, and no words", () => {
    const lost = RUN.replace("water.", "water (cf. 4:2)");
    const page = { ...start, before: "thanks for the water (cf. 4:2)." };
    expect(placeStarts([page], [{ verse: "9:9", blocks: [lost] }])[0]).toMatchObject({ kind: "stop-lost", ends: { page: ").", capture: ")" } });
  });

  it("reads past the marks the print's slant and its curly quotes leave", () => {
    const slanted = RUN.replace("morning", "morning");
    expect(placeStarts([start], [{ verse: "9:9", blocks: [slanted] }])[0].kind).toBe("stop-kept");
  });

  it("matches a word the reading broke in two at a mark it could not read", () => {
    const run = "They drank at the well. The keeper (sāqiʿah) of the well was old and kind to them.";
    const line = { text: "The keeper (sāqì ah) of the well was old and", before: "drank at the well.", page: "page_0009" };
    expect(placeStarts([line], [{ verse: "9:9", blocks: [run] }])[0].kind).toBe("stop-kept");
  });

  it("forgives a few letters the reading got wrong, but not a different line", () => {
    const run = "They drank at the well. The keeper of the well (ḥāfir) was old and kind to the travellers.";
    const misread = { text: "The keeper of the well (bāfir) was old and kind to the", before: "drank at the well.", page: "page_0009" };
    expect(placeStarts([misread], [{ verse: "9:9", blocks: [run] }])[0].kind).toBe("stop-kept");
    const other = { ...misread, text: "The keeper of the gate was young and cruel to all the" };
    expect(placeStarts([other], [{ verse: "9:9", blocks: [run] }])[0].kind).toBe("unmatched");
  });

  it("reads on past a shared opening to tell two places apart", () => {
    const run = "They rested. The next morning they set out again over the hills. They ate. The next morning they set out for home at last.";
    const line = { text: "The next morning they set out for home at", before: "they ate.", page: "page_0009" };
    const placed = placeStarts([line], [{ verse: "9:9", blocks: [run] }])[0];
    const at = seams(run).filter((s) => run.slice(s.at + 1).startsWith("The next"))[1].at;
    expect(placed.print).toBe(seamPrint(run, at));
  });

  it("uses the line before to choose between two places with the same opening", () => {
    const twice = "They ate at noon. The next morning they set out again over the hills. " + RUN;
    const placed = placeStarts([start], [{ verse: "9:9", blocks: [twice] }])[0];
    expect(placed.kind).toBe("stop-kept");
    const at = seams(twice).filter((s) => twice.slice(s.at + 1).startsWith("The next"))[1].at;
    expect(placed.print).toBe(seamPrint(twice, at));
  });

  it("says when it cannot place a start, or cannot choose", () => {
    expect(placeStarts([{ ...start, text: "Nothing like this is in any note" }], [{ verse: "9:9", blocks: [RUN] }])[0].kind).toBe("unmatched");
    const same = { verse: "9:10", blocks: [RUN] };
    expect(placeStarts([start], [{ verse: "9:9", blocks: [RUN] }, same])[0].kind).toBe("ambiguous");
  });

  it("counts a paragraph several verses share as one place", () => {
    const shared = [{ verse: "9:9", blocks: [RUN] }, { verse: "9:10", blocks: [RUN] }];
    expect(placeStarts([start], shared, (b) => (b === RUN ? ["9:9", "9:10"] : []))[0].kind).toBe("stop-kept");
  });
});
