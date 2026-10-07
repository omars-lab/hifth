import { describe, expect, it } from "vitest";
import { dropMarginRefs, dropStrayBlocks } from "./strays.mjs";

// Made-up notes: the shape of the capture, none of its words.
describe("dropMarginRefs", () => {
  it("empties a block that is only the margin's verse references", () => {
    expect(dropMarginRefs("2:61 87 91 3:21 112 4:155")).toBe("");
    expect(dropMarginRefs("5:46")).toBe("");
  });

  it("drops the margin's references printed in front of a paragraph", () => {
    expect(dropMarginRefs("5:47 3:6 The lamp confirms what came before")).toBe("The lamp confirms what came before");
    expect(dropMarginRefs("2:55 The lamp confirms")).toBe("The lamp confirms");
  });

  it("drops a lone stray letter", () => {
    expect(dropMarginRefs("a")).toBe("");
    expect(dropMarginRefs("an")).toBe("");
  });

  it("leaves a paragraph that cites references or opens with its own label", () => {
    expect(dropMarginRefs("2:41 and 3:6 speak of the lamp")).toBe("2:41 and 3:6 speak of the lamp");
    expect(dropMarginRefs("See 2:41 and 3:6 on the lamp.")).toBe("See 2:41 and 3:6 on the lamp.");
    expect(dropMarginRefs("12 The lamp here")).toBe("12 The lamp here");
  });
});

describe("dropStrayBlocks", () => {
  it("drops a block that is only the start of a later block of the same note", () => {
    expect(dropStrayBlocks(["The lamp is", "Other words.", "The lamp is lit."], [])).toEqual(["Other words.", "The lamp is lit."]);
  });

  it("drops a piece of the previous verse's note captured under this one", () => {
    expect(dropStrayBlocks(["lit at night (X).", "Own note."], ["The lamp is lit at night (X). Then more."])).toEqual(["Own note."]);
  });

  it("keeps a note shared with the previous verse whole", () => {
    expect(dropStrayBlocks(["Shared note."], ["Shared note."])).toEqual(["Shared note."]);
  });
});
