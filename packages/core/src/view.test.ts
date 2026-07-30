import { describe, expect, it } from "vitest";
import {
  bboxToScreen,
  clampView,
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
// framing math is asserted, not just exercised. contentHeight follows the
// viewBox: 320 × 550/345 ≈ 510.14, so at z=1 the page is *shorter* than the
// stage and at the hop zoom it is a good deal taller. Both regimes of the clamp
// are reachable from this one fixture, which is why these numbers.
const CTX: FrameContext = {
  contentWidth: 320,
  contentHeight: (320 * 550) / 345,
  stageWidth: 360,
  stageHeight: 640,
  viewBoxWidth: 345,
};

describe("frameBboxToView (mock focus() port)", () => {
  it("centers a bbox in the stage at the requested zoom", () => {
    // A bbox in the middle of the page — far enough from every edge that the
    // clamp has nothing to say and the raw framing math is what is asserted.
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

  it("puts the bbox center at the stage center when the page can afford it", () => {
    // Round-trip: framing then projecting the same bbox must land its center at
    // the stage midpoint. This is the property that keeps a hop on-screen.
    // A full-width line in the middle third of the page: at z=2 its centre is
    // reachable on both axes, so nothing is clamped and the round-trip is exact.
    const bbox: Rect = { x: 40, y: 260, width: 265, height: 30 };
    const v = frameBboxToView(bbox, CTX, 2);
    const screen = bboxToScreen(bbox, v, CTX);
    expect(screen.x + screen.width / 2).toBeCloseTo(CTX.stageWidth / 2, 6);
    expect(screen.y + screen.height / 2).toBeCloseTo(CTX.stageHeight / 2, 6);
  });

  it("gives up the center rather than show blank stage under the last line", () => {
    // The defect this replaced: centring an ayah 20 user-units from the foot of
    // the page dragged the page's bottom edge a long way up into the stage, and
    // the reader got the end of the mus'haf floating over a band of nothing.
    const foot: Rect = { x: 40, y: 520, width: 265, height: 20 };
    const v = frameBboxToView(foot, CTX, 2);
    const bottomOfPage = v.y + CTX.contentHeight * v.z;
    expect(bottomOfPage).toBeCloseTo(CTX.stageHeight, 6);
    // Landing on the page's edge is only worth anything if the ayah asked for is
    // still on screen once we get there.
    const screen = bboxToScreen(foot, v, CTX);
    expect(screen.y).toBeGreaterThanOrEqual(0);
    expect(screen.y + screen.height).toBeLessThanOrEqual(CTX.stageHeight);
  });

  it("does the same at the head of the page", () => {
    const head: Rect = { x: 40, y: 10, width: 265, height: 20 };
    const v = frameBboxToView(head, CTX, 2);
    expect(v.y).toBeCloseTo(0, 6);
    const screen = bboxToScreen(head, v, CTX);
    expect(screen.y).toBeGreaterThanOrEqual(0);
  });
});

describe("clampView", () => {
  const FIT = {
    contentWidth: CTX.contentWidth,
    contentHeight: CTX.contentHeight,
    stageWidth: CTX.stageWidth,
    stageHeight: CTX.stageHeight,
  };

  it("centers an axis the page is too small to fill", () => {
    // At z=1 the page is 320×510 in a 360×640 stage: nothing to pan, and the
    // only place it belongs is the middle. Note the input asks for a corner.
    const v = clampView({ x: -900, y: 900, z: 1 }, FIT);
    expect(v.x).toBeCloseTo((360 - 320) / 2, 6);
    expect(v.y).toBeCloseTo((640 - CTX.contentHeight) / 2, 6);
  });

  it("lets the page roam over its overhang and no further", () => {
    const overhang = CTX.contentHeight * 2 - 640;
    expect(clampView({ x: 0, y: -1e6, z: 2 }, FIT).y).toBeCloseTo(-overhang, 6);
    expect(clampView({ x: 0, y: 1e6, z: 2 }, FIT).y).toBeCloseTo(0, 6);
    expect(clampView({ x: 0, y: -50, z: 2 }, FIT).y).toBeCloseTo(-50, 6);
  });

  it("holds each axis on its own terms", () => {
    // z=1.2 sits in the gap between the two thresholds: 320 × 1.2 = 384 has
    // already outgrown the 360 stage while 510 × 1.2 = 612 has not outgrown the
    // 640 one. So x roams to its limit and y is centred, in the same call. A
    // single "does the page fit" verdict for both axes gets one of them wrong on
    // every page that is not the shape of the stage.
    const v = clampView({ x: -100, y: -400, z: 1.2 }, FIT);
    expect(v.x).toBeCloseTo(360 - 320 * 1.2, 6);
    expect(v.y).toBeCloseTo((640 - CTX.contentHeight * 1.2) / 2, 6);
  });

  it("never alters the zoom", () => {
    expect(clampView({ x: 5, y: 5, z: 3.7 }, FIT).z).toBe(3.7);
  });

  it("leaves an unmeasured page alone instead of slamming it into a corner", () => {
    // A host is `display: none` until it becomes the current page, and a hidden
    // element measures zero. Treating that as "a page that fits" would center a
    // zero-sized box — i.e. throw away the view — on whichever frame the
    // measurement happened to be taken.
    const unmeasured = { ...FIT, contentWidth: 0, contentHeight: 0 };
    expect(clampView({ x: -120, y: -340, z: 1.55 }, unmeasured)).toEqual({
      x: -120,
      y: -340,
      z: 1.55,
    });
  });

  it("is idempotent — clamping a held view changes nothing", () => {
    // The tween clamps every frame, so a view that is already legal must be a
    // fixed point or the motion would creep.
    const once = clampView({ x: -1e6, y: -1e6, z: 2 }, FIT);
    expect(clampView(once, FIT)).toEqual(once);
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
