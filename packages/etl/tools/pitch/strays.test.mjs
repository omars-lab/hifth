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

  it("drops a reference from the page foot printed in front of a paragraph's own label", () => {
    expect(dropMarginRefs("29:1 185 The lamp confirms")).toBe("185 The lamp confirms");
    expect(dropMarginRefs("2:14 95–7 The lamp confirms")).toBe("95–7 The lamp confirms");
  });

  it("drops a lone stray letter", () => {
    expect(dropMarginRefs("a")).toBe("");
    expect(dropMarginRefs("an")).toBe("");
  });

  it("drops the margin's references and stray letters left after a paragraph's last sentence", () => {
    expect(dropMarginRefs("The lamp was lit (Q). un un")).toBe("The lamp was lit (Q).");
    expect(dropMarginRefs("They said, “The lamp.” u")).toBe("They said, “The lamp.”");
    expect(dropMarginRefs("On the lamp, see 5:3c. in in 5:3c")).toBe("On the lamp, see 5:3c.");
    expect(dropMarginRefs("The lamp was lit. an 4 4:93c 5:34")).toBe("The lamp was lit.");
    expect(dropMarginRefs("The lamp was lit. 4:138 2:65 7:163–66 2:65c")).toBe("The lamp was lit.");
    expect(dropMarginRefs("Did they light the lamp? an 138")).toBe("Did they light the lamp?");
  });

  it("leaves a paragraph's own last words after its last full stop", () => {
    expect(dropMarginRefs("Did they light the lamp? in v. 155")).toBe("Did they light the lamp? in v. 155");
    expect(dropMarginRefs("The lamp was lit. Cf. v. 108")).toBe("The lamp was lit. Cf. v. 108");
    expect(dropMarginRefs("The lamp was lit. See 2:41")).toBe("The lamp was lit. See 2:41");
    expect(dropMarginRefs("The lamp was lit as in 2:41")).toBe("The lamp was lit as in 2:41");
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
