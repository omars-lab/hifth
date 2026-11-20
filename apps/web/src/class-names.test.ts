import { describe, expect, it } from "vitest";
import { classNamer } from "./class-names";

const css = ".row { color: red }\n.grip { width: 4px }\n";

describe("the class names the build gives a component's styles", () => {
  it("keep the readable name, which the browser tests find elements by", () => {
    expect(classNamer()("grip", "/x/Sheet.module.css", css)).toMatch(/^_grip_/);
  });

  it("end in a short hash of the file, with no line number after it", () => {
    // The default added the line the rule was on (`_grip_ab12c_2`). The hash
    // already keeps two files' names apart, so the line number was only
    // bytes, about 1,600 times over in the start-up download.
    expect(classNamer()("grip", "/x/Sheet.module.css", css)).toMatch(/^_grip_[0-9a-z]{5}$/);
  });

  it("give the same name for the same file wherever the checkout sits", () => {
    expect(classNamer()("row", "/a/Sheet.module.css", css)).toBe(classNamer()("row", "/b/Sheet.module.css", css));
  });

  it("give one file's rule the same name every time it is asked", () => {
    const name = classNamer();
    expect(name("row", "/x/Sheet.module.css", css)).toBe(name("row", "/x/Sheet.module.css", css));
  });

  it("tell apart the same name in two different files", () => {
    const name = classNamer();
    const other = ".row { color: blue }\n";
    expect(name("row", "/x/One.module.css", css)).not.toBe(name("row", "/x/Two.module.css", other));
  });

  it("refuse to build when two files would get the same name", () => {
    const name = classNamer();
    name("row", "/x/One.module.css", css);
    expect(() => name("row", "/x/Two.module.css", css)).toThrow(/Two style files/);
  });
});
