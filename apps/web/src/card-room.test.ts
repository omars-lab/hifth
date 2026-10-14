import { afterEach, describe, expect, it } from "vitest";
import { CARD_ROOM_KEY, rememberCardRoom, savedCardRoom } from "./card-room";

describe("how one page makes room for a card beside it, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("slides aside when nobody chose, and keeps the choice made", () => {
    expect(savedCardRoom()).toBe("aside");
    rememberCardRoom("smaller");
    expect(localStorage.getItem(CARD_ROOM_KEY)).toBe("smaller");
    expect(savedCardRoom()).toBe("smaller");
    rememberCardRoom("aside");
    expect(savedCardRoom()).toBe("aside");
  });

  it("a value it does not know falls back to the slide aside", () => {
    localStorage.setItem(CARD_ROOM_KEY, "nonsense");
    expect(savedCardRoom()).toBe("aside");
  });
});
