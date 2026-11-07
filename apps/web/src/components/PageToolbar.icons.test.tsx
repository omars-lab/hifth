import { describe, it, expect } from "vitest";
import { render } from "@testing-library/preact";
import { ToolIcon } from "./PageToolbar";

/**
 * The Note tool leaves a note on the page, so its button looks like a sticky
 * note: a square sheet with one corner turned down. It used to be a map pin,
 * which read as "a place", not "something written" (owner's page comment of
 * 2026-11-07, "this should look like a post it").
 */
describe("the Note tool's icon", () => {
  it("is a square sheet with a turned-down corner, not a map pin", () => {
    const { container } = render(<ToolIcon tool="note" />);
    const svg = container.querySelector("svg")!;
    // A pin is a teardrop with a dot in it; a sticky note has neither.
    expect(svg.querySelector("circle"), "the pin's dot is still there").toBeNull();
    const shapes = [...svg.querySelectorAll("path")].map((p) => p.getAttribute("d") ?? "");
    expect(shapes.some((d) => /\ba\d/i.test(d)), "the outline is still curved like a pin").toBe(false);
    expect(svg.querySelector("[data-part='fold']"), "no turned-down corner").not.toBeNull();
  });
});
