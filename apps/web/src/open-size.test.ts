import { afterEach, describe, expect, it } from "vitest";
import { OPEN_SIZE_KEY, openZoom, rememberOpenSize, savedOpenSize } from "./open-size";

describe("how big a page opens at a verse, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("opens a little closer when nobody chose, and keeps the choice made", () => {
    expect(savedOpenSize()).toBe("closer");
    rememberOpenSize("whole");
    expect(localStorage.getItem(OPEN_SIZE_KEY)).toBe("whole");
    expect(savedOpenSize()).toBe("whole");
  });

  it("a value it does not know falls back to a little closer", () => {
    localStorage.setItem(OPEN_SIZE_KEY, "nonsense");
    expect(savedOpenSize()).toBe("closer");
  });

  it("the whole page asks for the page's own size; closer leaves the hop to frame", () => {
    expect(openZoom("whole")).toBe(1);
    expect(openZoom("closer")).toBeUndefined();
  });
});
