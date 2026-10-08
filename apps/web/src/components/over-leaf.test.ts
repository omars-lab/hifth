import { describe, expect, it } from "vitest";
import { EDGE_FREE, overLeaf } from "./over-leaf";

// A laptop's spread: the fold at 720, each page 620 wide.
const book = { left: 100, right: 1340, top: 50, bottom: 850 };
const screen = { width: 1440, height: 900 };

describe("where a card lies over the facing page", () => {
  it("covers the whole page, fold to outer edge, by default", () => {
    expect(overLeaf(book, "right", screen)).toEqual({ left: 724, width: 616, top: 50, height: 800 });
    expect(overLeaf(book, "left", screen)).toEqual({ left: 100, width: 616, top: 50, height: 800 });
  });

  it("stops short of the outer edge when the reader asked to keep it free", () => {
    // The strip a hand grabs to turn the page stays uncovered.
    const right = overLeaf(book, "right", screen, "clear");
    expect(right.left).toBe(724);
    expect(right.left + right.width).toBe(book.right - EDGE_FREE);
    const left = overLeaf(book, "left", screen, "clear");
    expect(left.left).toBe(book.left + EDGE_FREE);
    expect(left.left + left.width).toBe(716);
  });

  it("keeps the edge free even where the page is narrower than a card is read in", () => {
    // Covering, a narrow page is overhung past its edge; kept free, it is not.
    const narrow = { left: 300, right: 1100, top: 50, bottom: 850 };
    expect(overLeaf(narrow, "right", screen).width).toBe(460);
    const kept = overLeaf(narrow, "right", screen, "clear");
    expect(kept.left + kept.width).toBe(narrow.right - EDGE_FREE);
  });
});
