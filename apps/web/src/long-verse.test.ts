import { afterEach, describe, expect, it } from "vitest";
import { LONG_VERSE_KEY, giveNoteRoom, noteRoom, rememberLongVerse, savedLongVerse } from "./long-verse";

describe("how a verse a little too tall for the room above its note is shown, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("the page a little smaller when nobody chose, and keeps the choice made", () => {
    expect(savedLongVerse()).toBe("smaller");
    rememberLongVerse("shorter");
    expect(localStorage.getItem(LONG_VERSE_KEY)).toBe("shorter");
    expect(savedLongVerse()).toBe("shorter");
    rememberLongVerse("smaller");
    expect(savedLongVerse()).toBe("smaller");
  });

  it("a value it does not know falls back to the page a little smaller", () => {
    localStorage.setItem(LONG_VERSE_KEY, "nonsense");
    expect(savedLongVerse()).toBe("smaller");
  });
});

describe("the room the note gives up for the verse above it", () => {
  afterEach(() => giveNoteRoom(0));

  it("is none until the page asks, then what it asked, never less than none", () => {
    expect(noteRoom()).toBe(0);
    giveNoteRoom(30);
    expect(noteRoom()).toBe(30);
    giveNoteRoom(-5);
    expect(noteRoom()).toBe(0);
  });
});
