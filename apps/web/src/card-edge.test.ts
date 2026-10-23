import { afterEach, describe, expect, it } from "vitest";
import { CARD_EDGE_KEY, rememberCardEdge, savedCardEdge } from "./card-edge";

describe("what a card does at the page's outer edge, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("grabs through the card when nobody chose, and keeps the choice made", () => {
    expect(savedCardEdge()).toBe("turns");
    rememberCardEdge("clear");
    expect(localStorage.getItem(CARD_EDGE_KEY)).toBe("clear");
    expect(savedCardEdge()).toBe("clear");
    rememberCardEdge("covers");
    expect(savedCardEdge()).toBe("covers");
  });

  it("a value it does not know falls back to grabbing through", () => {
    localStorage.setItem(CARD_EDGE_KEY, "nonsense");
    expect(savedCardEdge()).toBe("turns");
  });
});
