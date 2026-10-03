import { afterEach, describe, expect, it } from "vitest";
import { JUMP_ARROWS_KEY, rememberArrowShowing, savedArrowShowing } from "./jump-arrows";

describe("how the saved arrows show, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("stays when nobody chose, and keeps the choice made", () => {
    expect(savedArrowShowing()).toBe("stays");
    rememberArrowShowing("asked");
    expect(localStorage.getItem(JUMP_ARROWS_KEY)).toBe("asked");
    expect(savedArrowShowing()).toBe("asked");
    rememberArrowShowing("stays");
    expect(savedArrowShowing()).toBe("stays");
  });

  it("a value it does not know falls back to staying", () => {
    localStorage.setItem(JUMP_ARROWS_KEY, "nonsense");
    expect(savedArrowShowing()).toBe("stays");
  });
});
