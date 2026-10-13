import { afterEach, describe, expect, it } from "vitest";
import { LOOKALIKE_ARROWS_KEY, arrowFor, rememberLookalikeArrows, savedLookalikeArrows } from "./lookalike-arrows";

describe("which way the look-alike signs' arrows point, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  // The owner's pick, 2026-10-12 (knowledge-graph-commentary item 8): the
  // arrows follow the book, where later pages lie to the left.
  it("follows the book when nobody chose, and keeps the choice made", () => {
    expect(savedLookalikeArrows()).toBe("book");
    rememberLookalikeArrows("reading");
    expect(localStorage.getItem(LOOKALIKE_ARROWS_KEY)).toBe("reading");
    expect(savedLookalikeArrows()).toBe("reading");
  });

  it("a value it does not know falls back to the book's way", () => {
    localStorage.setItem(LOOKALIKE_ARROWS_KEY, "nonsense");
    expect(savedLookalikeArrows()).toBe("book");
  });

  it("the book's way turns the two arrows round and leaves the rest alone", () => {
    expect(arrowFor("→", "book")).toBe("←");
    expect(arrowFor("←", "book")).toBe("→");
    expect(arrowFor("↻", "book")).toBe("↻");
    expect(arrowFor("", "book")).toBe("");
  });

  it("the reading way keeps the arrows as written", () => {
    expect(arrowFor("→", "reading")).toBe("→");
    expect(arrowFor("←", "reading")).toBe("←");
  });
});
