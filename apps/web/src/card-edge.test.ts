import { afterEach, describe, expect, it } from "vitest";
import { CARD_EDGE_KEY, rememberCardEdge, savedCardEdge } from "./card-edge";

describe("what a card does at the page's outer edge, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("covers the edge when nobody chose, and keeps the choice made", () => {
    expect(savedCardEdge()).toBe("covers");
    rememberCardEdge("clear");
    expect(localStorage.getItem(CARD_EDGE_KEY)).toBe("clear");
    expect(savedCardEdge()).toBe("clear");
    rememberCardEdge("turns");
    expect(savedCardEdge()).toBe("turns");
  });

  it("a value it does not know falls back to covering", () => {
    localStorage.setItem(CARD_EDGE_KEY, "nonsense");
    expect(savedCardEdge()).toBe("covers");
  });
});
