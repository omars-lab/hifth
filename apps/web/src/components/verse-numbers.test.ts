import { describe, expect, it } from "vitest";
import { verseNumberDisc } from "./verse-numbers";

describe("verse numbers · the disc a verse's number fills", () => {
  // A made-up verse over two lines; on its last line the words start at x=90,
  // and its outline stops at x=60, so the number fills 60 to 90.
  const lines = [
    { x: 10, y: 120, width: 320, height: 30 },
    { x: 60, y: 155, width: 270, height: 30 },
  ];
  const words = [
    { x: 200, y: 122, width: 60, height: 26 },
    { x: 90, y: 157, width: 80, height: 26 },
    { x: 180, y: 157, width: 60, height: 26 },
  ];

  it("sits in the middle of the gap on the last line, as wide as the gap", () => {
    expect(verseNumberDisc(lines, words)).toEqual({ cx: 75, cy: 170, r: 15 });
  });

  it("does not depend on the order the lines come in", () => {
    expect(verseNumberDisc([...lines].reverse(), words)).toEqual(verseNumberDisc(lines, words));
  });

  it("is never taller than its line", () => {
    const wide = [{ x: 0, y: 155, width: 330, height: 30 }];
    expect(verseNumberDisc(wide, [{ x: 50, y: 157, width: 80, height: 26 }])?.r).toBe(15);
  });

  it("nothing when the verse runs on to the next page and its number is not here", () => {
    expect(verseNumberDisc([{ x: 2, y: 155, width: 328, height: 30 }], [{ x: 4, y: 157, width: 80, height: 26 }])).toBeNull();
    expect(verseNumberDisc([], words)).toBeNull();
  });
});
