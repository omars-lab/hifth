import { afterEach, describe, expect, it } from "vitest";
import { RELATED_LIST_KEY, rememberRelatedList, savedRelatedList } from "./related-list";

describe("how many related verses a note lists at first, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("the first few and a line for the rest when nobody chose, and keeps the choice made", () => {
    expect(savedRelatedList()).toBe("line");
    rememberRelatedList("all");
    expect(localStorage.getItem(RELATED_LIST_KEY)).toBe("all");
    expect(savedRelatedList()).toBe("all");
    rememberRelatedList("line");
    expect(savedRelatedList()).toBe("line");
  });

  it("a value it does not know falls back to the line", () => {
    localStorage.setItem(RELATED_LIST_KEY, "nonsense");
    expect(savedRelatedList()).toBe("line");
  });
});
