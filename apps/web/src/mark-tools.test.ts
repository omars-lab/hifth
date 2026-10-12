import { afterEach, describe, expect, it } from "vitest";
import { MARK_TOOLS_KEY, isMarkAim, rememberMarkTools, savedMarkTools, toolsFor } from "./mark-tools";

// Made-up tools in the bar's shape; the real list lives with the bar.
const BAR = ["read", "select", "highlight", "bookmark", "note", "sign", "word", "mistake", "crop", "jump"].map((tool, i) => ({
  tool,
  letter: String.fromCharCode(65 + i),
}));

describe("Note, Harakat and Word as three buttons or one, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("is three buttons when nobody chose, and keeps the choice made", () => {
    expect(savedMarkTools()).toBe("three");
    rememberMarkTools("one");
    expect(localStorage.getItem(MARK_TOOLS_KEY)).toBe("one");
    expect(savedMarkTools()).toBe("one");
    rememberMarkTools("three");
    expect(savedMarkTools()).toBe("three");
  });

  it("a value it does not know falls back to three buttons", () => {
    localStorage.setItem(MARK_TOOLS_KEY, "nonsense");
    expect(savedMarkTools()).toBe("three");
  });

  it("three buttons leave the bar as it is", () => {
    expect(toolsFor(BAR, "three", "sign")).toBe(BAR);
  });

  it("one button stands where Note stood, for the one last used, and the other two leave the bar", () => {
    for (const aim of ["note", "sign", "word"] as const) {
      const tools = toolsFor(BAR, "one", aim);
      expect(tools.map((x) => x.tool)).toEqual(["read", "select", "highlight", "bookmark", aim, "mistake", "crop", "jump"]);
      // It keeps the key of the one it stands for.
      expect(tools[4]).toBe(BAR.find((x) => x.tool === aim));
    }
  });

  it("knows the three it stands for", () => {
    expect(["note", "sign", "word", "highlight", "mistake"].map(isMarkAim)).toEqual([true, true, true, false, false]);
  });
});
