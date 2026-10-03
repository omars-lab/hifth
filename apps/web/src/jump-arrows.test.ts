import { describe, expect, it } from "vitest";
import { arrowShowingFromUrl } from "./jump-arrows";

describe("which way the saved arrows show, on trial", () => {
  it("the page address picks the way, and stays is the default", () => {
    expect(arrowShowingFromUrl("")).toBe("stays");
    expect(arrowShowingFromUrl("?jumparrows=asked")).toBe("asked");
    expect(arrowShowingFromUrl("?phonebar=a&jumparrows=ASKED")).toBe("asked");
    expect(arrowShowingFromUrl("?jumparrows=stays")).toBe("stays");
    expect(arrowShowingFromUrl("?jumparrows=nonsense")).toBe("stays");
  });
});
