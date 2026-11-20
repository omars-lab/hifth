import { describe, expect, it } from "vitest";
import { hideDrawingFromReaders } from "./page-drawing-a11y";

/** A made-up page drawing with the same shape as the real ones: one wrapper
 * holding the verse-number rings and the lettering, and the verse outlines
 * beside it. The paths draw nothing real. */
function drawing(): SVGSVGElement {
  const host = document.createElement("div");
  host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">
    <g>
      <g id="ayah_markers"><g><path d="M0 0h1v1z"/></g><g><path d="M0 0h1v1z"/></g></g>
      <g id="content"><g><path d="M0 0h2v2z"/></g></g>
    </g>
    <path id="verse-1" d="M0 0h3v3z"/>
    <path id="verse-2" d="M0 0h3v3z"/>
  </svg>`;
  return host.querySelector("svg") as SVGSVGElement;
}

describe("the page drawing, to a screen reader", () => {
  // Apple's accessibility check on the iPad (2026-11-19) found each ring, each
  // ring's number and the lettering as a nameless picture, 23 on page 7 alone,
  // and most too small to touch. The verses are named by their own buttons.
  it("hides the verse-number rings and the lettering", () => {
    const svg = drawing();
    hideDrawingFromReaders(svg);
    expect(svg.querySelector("#ayah_markers")?.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelector("#content")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("leaves every verse outline where a screen reader can reach it", () => {
    const svg = drawing();
    hideDrawingFromReaders(svg);
    const hidden = [...svg.querySelectorAll("path[id^='verse-']")].filter((p) => p.closest("[aria-hidden='true']"));
    expect(hidden).toHaveLength(0);
  });

  it("does nothing to a drawing without those parts", () => {
    const host = document.createElement("div");
    host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"><path id="verse-1" d="M0 0h3v3z"/></svg>`;
    const svg = host.querySelector("svg") as SVGSVGElement;
    hideDrawingFromReaders(svg);
    expect(svg.querySelectorAll("[aria-hidden]")).toHaveLength(0);
  });
});
