// The verse-number ring swap (launch item 45), on made-up pages: a ring is the upstream
// group the copy step looks for, a numeral is a small square standing in for a verse number.
import { describe, expect, it } from "vitest";
import { pathBounds, swapRings, RING_MODES } from "./verse-rings.mjs";

// 12.48 units wide once scaled, centred 6.24 across and 4.04 down from its translate.
const ring = (x, y) =>
  `<g transform="translate(${x} ${y}) scale(0.01 0.01)"><path d="m1248,4 l-1248,0 l0,800 z"/></g>`;
const numeral = (x, y) =>
  `<g transform="translate(${x} ${y})" ayah:x="1"><path d="M0 0h2v4h-2z"/></g>`;
const page = (parts) => `<svg>${parts.join("")}</svg>`;

// Offsets that are easy to check by hand: +1 across, +2 down on ordinary pages.
const LINES = {
  regular: { dx: [1, 0, 0], dy: [2, 0, 0] },
  small: { dx: [0.5, 0, 0], dy: [0.5, 0, 0], scale: 0.5, pages: [1, 2] },
};
const COMPLEX = { ...LINES, complex: { d: "M-1 -1L1 -1L1 1Z", fill: "#bfe8c1" } };
const PLAIN = { ...LINES, plain: { radius: 6, width: 0.75, fill: "#231f20" } };

describe("pathBounds", () => {
  it("follows relative steps, h and v", () => {
    expect(pathBounds("M10 20h2v4h-2z")).toEqual([10, 20, 12, 24]);
  });
  it("starts a relative move from the origin", () => {
    expect(pathBounds("m5,5 l1,1")).toEqual([5, 5, 6, 6]);
  });
  it("reads a number written with an exponent as a number, not a command", () => {
    expect(pathBounds("m5,5 c1e-5,0 1,1 2,2")).toEqual([5, 5, 7, 7]);
  });
});

describe("swapRings", () => {
  it("leaves the page byte for byte as it was when the rings stay upstream's", () => {
    const svg = page([ring(10, 10), numeral(10, 10)]);
    const out = swapRings(svg, 7, { mode: "upstream" });
    expect(out.svg).toBe(svg);
    expect(out).toMatchObject({ found: 1, twins: 0, placed: 0 });
  });

  it("puts the Complex's medallion at each numeral's centre plus the fitted offset", () => {
    const svg = page([ring(10, 10), numeral(10, 10), ring(50, 10), numeral(50, 10)]);
    const out = swapRings(svg, 7, { mode: "complex", ...COMPLEX });
    // numeral centres (11, 12) and (51, 12); offsets +1, +2
    expect(out.svg).toContain('<path d="M11.00 13.00L13.00 13.00L13.00 15.00Z" fill="#bfe8c1"/>');
    expect(out.svg).toContain('<path d="M51.00 13.00L53.00 13.00L53.00 15.00Z" fill="#bfe8c1"/>');
    expect(out.svg).not.toContain("m1248,4");
    expect(out).toMatchObject({ found: 2, twins: 0, placed: 2 });
  });

  it("drops the second of each doubled ring on the opening pages and draws them smaller", () => {
    const svg = page([ring(10, 10), ring(10, 10), numeral(10, 10)]);
    const out = swapRings(svg, 1, { mode: "complex", ...COMPLEX });
    // centre (11, 12) + (0.5, 0.5), shape at half size
    expect(out.svg).toContain('<path d="M11.00 12.00L12.00 12.00L12.00 13.00Z" fill="#bfe8c1"/>');
    expect(out.svg.match(/<path d="M/g)).toHaveLength(2); // the medallion and the numeral
    expect(out).toMatchObject({ found: 2, twins: 1, placed: 1 });
  });

  it("draws a plain ring of our own, centred the same way", () => {
    const svg = page([ring(10, 10), numeral(10, 10)]);
    const out = swapRings(svg, 7, { mode: "plain", ...PLAIN });
    expect(out.svg).toContain('fill="#231f20" fill-rule="evenodd"');
    expect(out.svg).toContain("M6.00 14.00a6.00 6.00"); // centre (12, 14), radius 6
    expect(out.svg).toContain("M6.75 14.00a5.25 5.25"); // the inner edge, 0.75 in
    expect(out).toMatchObject({ found: 1, placed: 1 });
  });

  it("refuses a page whose rings and numerals do not pair up", () => {
    const svg = page([ring(10, 10), numeral(10, 10), ring(50, 10)]);
    expect(() => swapRings(svg, 7, { mode: "complex", ...COMPLEX })).toThrow(/page 7: 2 rings .* 1 verse number/);
  });

  it("refuses a ring that is not on its own verse number", () => {
    const svg = page([ring(10, 10), numeral(10, 10), ring(50, 10), numeral(90, 10)]);
    expect(() => swapRings(svg, 7, { mode: "complex", ...COMPLEX })).toThrow(/page 7: ring 2 sits \d/);
  });

  it("refuses a mode it does not know, or one missing its shape", () => {
    const svg = page([ring(10, 10), numeral(10, 10)]);
    expect(() => swapRings(svg, 7, { mode: "gold" })).toThrow(/unknown ring mode "gold"/);
    expect(() => swapRings(svg, 7, { mode: "complex", ...LINES })).toThrow(/needs its shape/);
    expect(RING_MODES).toEqual(["upstream", "complex", "plain"]);
  });
});
