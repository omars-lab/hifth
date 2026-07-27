import { describe, expect, it } from "vitest";
import {
  bboxToScreen,
  clampZoom,
  DEFAULT_HOP_ZOOM,
  easeInOutCubic,
  frameBboxToView,
  lerpView,
  type FrameContext,
  type View,
} from "./view.js";
import type { Rect } from "./highlighter.js";

// The bundled pages share viewBox "0 0 345 550". A square-ish stage sized to a
// phone: content rendered at 320px wide, stage 360×640 — concrete numbers so the
// framing math is asserted, not just exercised.
const CTX: FrameContext = {
  contentWidth: 320,
  stageWidth: 360,
  stageHeight: 640,
  viewBoxWidth: 345,
};

describe("frameBboxToView (mock focus() port)", () => {
  it("centers a bbox in the stage at the requested zoom", () => {
    // A bbox in the middle of the page.
    const bbox: Rect = { x: 145, y: 265, width: 55, height: 20 };
    const v = frameBboxToView(bbox, CTX, 1.55);
    // s = 320/345; center px = (bbox center)*s; view.x = stageW/2 - z*cx.
    const s = 320 / 345;
    const cx = (145 + 55 / 2) * s;
    const cy = (265 + 20 / 2) * s;
    expect(v.z).toBe(1.55);
    expect(v.x).toBeCloseTo(180 - 1.55 * cx, 6);
    expect(v.y).toBeCloseTo(320 - 1.55 * cy, 6);
  });

  it("defaults to the hop zoom", () => {
    const v = frameBboxToView({ x: 0, y: 0, width: 10, height: 10 }, CTX);
    expect(v.z).toBe(DEFAULT_HOP_ZOOM);
  });

  it("places the bbox center exactly at the stage center on screen", () => {
    // Round-trip: framing then projecting the same bbox must land its center at
    // the stage midpoint. This is the property that keeps a hop on-screen.
    const bbox: Rect = { x: 40, y: 400, width: 80, height: 30 };
    const v = frameBboxToView(bbox, CTX, 2);
    const screen = bboxToScreen(bbox, v, CTX);
    expect(screen.x + screen.width / 2).toBeCloseTo(CTX.stageWidth / 2, 6);
    expect(screen.y + screen.height / 2).toBeCloseTo(CTX.stageHeight / 2, 6);
  });
});

describe("bboxToScreen (mock toScreen() port)", () => {
  it("scales width/height by content-scale × zoom", () => {
    const view: View = { x: 10, y: 20, z: 2 };
    const bbox: Rect = { x: 0, y: 0, width: 345, height: 550 };
    const screen = bboxToScreen(bbox, view, CTX);
    const s = (320 / 345) * 2;
    expect(screen.x).toBe(10);
    expect(screen.y).toBe(20);
    expect(screen.width).toBeCloseTo(345 * s, 6);
    expect(screen.height).toBeCloseTo(550 * s, 6);
  });
});

describe("clampZoom", () => {
  it("holds zoom inside the gesture bounds", () => {
    expect(clampZoom(0.2, 0.8, 5)).toBe(0.8);
    expect(clampZoom(9, 0.8, 5)).toBe(5);
    expect(clampZoom(2, 0.8, 5)).toBe(2);
  });
});

describe("easeInOutCubic", () => {
  it("pins the endpoints and the midpoint", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6);
  });

  it("is monotonic and eased (slow-start)", () => {
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25); // below the diagonal early
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75); // above it late
  });
});

describe("lerpView", () => {
  it("interpolates each field independently", () => {
    const from: View = { x: 0, y: 0, z: 1 };
    const to: View = { x: 100, y: -50, z: 2 };
    expect(lerpView(from, to, 0)).toEqual(from);
    expect(lerpView(from, to, 1)).toEqual(to);
    expect(lerpView(from, to, 0.5)).toEqual({ x: 50, y: -25, z: 1.5 });
  });
});
