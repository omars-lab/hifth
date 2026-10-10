import { describe, expect, it } from "vitest";
import {
  bboxToScreen,
  clampView,
  clampZoom,
  DEFAULT_HOP_ZOOM,
  easeInOutCubic,
  frameBboxToView,
  hopZoomFor,
  hopZoomOnLargeType,
  lerpView,
  nearFitRoom,
  nearFitZoom,
  viewFitsAcross,
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

  it("starts a verse wider than the stage at its first word, not its middle", () => {
    // Two lines of one verse, shaped like 18:10: it starts at the head of the
    // first line (the right, since the page reads right to left), runs the whole
    // of it and part of the second. At the hop zoom it is wider than the stage,
    // so centring it hid where it begins off the right edge. The first word must
    // be on screen, near the right.
    const verse: Rect = { x: 30, y: 250, width: 285, height: 50 };
    const firstLine: Rect = { x: 30, y: 250, width: 285, height: 25 }; // head at 315
    const v = frameBboxToView(verse, CTX, 1.55, firstLine);
    const lead = bboxToScreen(firstLine, v, CTX);
    expect(lead.x + lead.width).toBeLessThanOrEqual(CTX.stageWidth);
    expect(lead.x + lead.width).toBeGreaterThan(CTX.stageWidth - 40);
  });

  it("still centres a verse that fits across, whatever its first line", () => {
    const verse: Rect = { x: 145, y: 265, width: 55, height: 20 };
    const withLead = frameBboxToView(verse, CTX, 1.55, verse);
    expect(withLead).toEqual(frameBboxToView(verse, CTX, 1.55));
  });

});

describe("hopZoomFor: a verse a link opens on is shown whole across", () => {
  // Ayat al-Kursi on a phone: the hop zoom made every full line wider than the
  // screen, so both ends of its middle lines were cut off (2026-10-04).
  const s = 320 / 345;
  const kursi: Rect = { x: 15, y: 200, width: 315, height: 150 };

  it("comes down from the hop zoom until the verse's lines fit across, with a margin", () => {
    const z = hopZoomFor(kursi, CTX, DEFAULT_HOP_ZOOM);
    expect(z).toBeLessThan(DEFAULT_HOP_ZOOM);
    expect(kursi.width * s * z).toBeLessThanOrEqual(CTX.stageWidth - 32 + 1e-9);
    const v = frameBboxToView(kursi, CTX, z);
    const at = bboxToScreen(kursi, v, CTX);
    expect(at.x).toBeGreaterThanOrEqual(0);
    expect(at.x + at.width).toBeLessThanOrEqual(CTX.stageWidth);
  });

  it("keeps the full hop zoom for a short verse", () => {
    expect(hopZoomFor({ x: 145, y: 265, width: 55, height: 20 }, CTX, DEFAULT_HOP_ZOOM)).toBe(DEFAULT_HOP_ZOOM);
  });

  it("never goes below the whole page, and never raises a zoom asked to be lower", () => {
    const narrow = { ...CTX, stageWidth: 300 };
    expect(hopZoomFor({ x: 0, y: 0, width: 345, height: 40 }, narrow, DEFAULT_HOP_ZOOM)).toBe(1);
    expect(hopZoomFor({ x: 145, y: 265, width: 55, height: 20 }, CTX, 1)).toBe(1);
  });
});

describe("hopZoomOnLargeType: a link lands at the same size of type on every page", () => {
  // The first two pages draw their text larger than the rest, and the hop's
  // closer look went on top of that: a one-word verse there landed at more
  // than twice other pages' type (plan item 37).
  it("takes off what the page has already enlarged", () => {
    expect(hopZoomOnLargeType(1.5, 1.25)).toBeCloseTo(1.2);
  });

  it("never goes below the whole page", () => {
    expect(hopZoomOnLargeType(1.5, 2)).toBe(1);
  });

  it("leaves a page drawn at the usual size alone", () => {
    expect(hopZoomOnLargeType(1.5, 1)).toBe(1.5);
    expect(hopZoomOnLargeType(1.5, 0.75)).toBe(1.5);
  });
});

describe("nearFitZoom: a verse a little taller than the room is shown whole", () => {
  // Ayat al-Kursi on an upright iPad: at the hop zoom its six lines were a few
  // dozen pixels taller than the room above the note (2026-10-09).
  it("zooms out just enough for a verse that nearly fits", () => {
    const z = nearFitZoom(600, 570, DEFAULT_HOP_ZOOM);
    expect(z).not.toBeNull();
    expect((600 / DEFAULT_HOP_ZOOM) * z!).toBeCloseTo(570, 6);
  });

  it("leaves the zoom alone for a verse that fits", () => {
    expect(nearFitZoom(500, 570, DEFAULT_HOP_ZOOM)).toBeNull();
  });

  it("leaves a long passage at its zoom, to be read from its first line, rather than shrink the page by more than a fifth", () => {
    expect(nearFitZoom(1000, 570, DEFAULT_HOP_ZOOM)).toBeNull();
  });

  it("never draws the page smaller than the whole page", () => {
    expect(nearFitZoom(600, 570, 1)).toBeNull();
    expect(nearFitZoom(600, 570, 1.02)).toBe(1);
  });
});

describe("nearFitRoom: the other way, the note opens a little shorter", () => {
  it("asks the note for just the room the verse is missing", () => {
    expect(nearFitRoom(600, 570, 500)).toBe(30);
  });

  it("asks nothing for a verse that fits", () => {
    expect(nearFitRoom(500, 570, 500)).toBeNull();
  });

  it("never takes more than a fifth of the note", () => {
    expect(nearFitRoom(600, 570, 100)).toBeNull();
    expect(nearFitRoom(600, 570, 150)).toBe(30);
  });

  it("leaves a long passage to be read from its first line, as the smaller page does", () => {
    expect(nearFitRoom(1000, 570, 5000)).toBeNull();
  });
});

describe("frameBboxToView defaults", () => {
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

  it("with a note over the foot of the stage, lands the last line above the note", () => {
    // A phone note covers the lower 300px. The last line of the page must still
    // come to rest in the 340px left showing, even at fit, where without the
    // note the page would not move at all.
    const covered = { ...CTX, coverBottom: 300 };
    const foot: Rect = { x: 40, y: 520, width: 265, height: 20 };
    for (const z of [1, 2]) {
      const screen = bboxToScreen(foot, frameBboxToView(foot, covered, z), covered);
      expect(screen.y).toBeGreaterThanOrEqual(0);
      expect(screen.y + screen.height).toBeLessThanOrEqual(640 - 300);
    }
  });

  it("centres a mid-page line in the part the note leaves showing", () => {
    const covered = { ...CTX, coverBottom: 300 };
    const bbox: Rect = { x: 40, y: 260, width: 265, height: 30 };
    const screen = bboxToScreen(bbox, frameBboxToView(bbox, covered, 2), covered);
    expect(screen.y + screen.height / 2).toBeCloseTo((640 - 300) / 2, 6);
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

  it("lets the page's foot be scrolled up above a note, and no further", () => {
    // At fit the page is shorter than the stage, but with 300px covered it is
    // taller than what shows: it may roam so its last line clears the note.
    const covered = { ...FIT, coverBottom: 300 };
    expect(clampView({ x: 0, y: -1e6, z: 1 }, covered).y).toBeCloseTo(340 - CTX.contentHeight, 6);
    expect(clampView({ x: 0, y: 1e6, z: 1 }, covered).y).toBeCloseTo(0, 6);
  });

  it("is idempotent — clamping a held view changes nothing", () => {
    // The tween clamps every frame, so a view that is already legal must be a
    // fixed point or the motion would creep.
    const once = clampView({ x: -1e6, y: -1e6, z: 2 }, FIT);
    expect(clampView(once, FIT)).toEqual(once);
  });
});

// A laptop window closed to one page, with a list docked beside the page: the
// stage runs the window's width, the page sits in the middle of it, and a card
// 484px wide stands over the stage's right side (left, in Arabic).
describe("a list standing beside one page", () => {
  const WIDE: FrameContext = {
    contentWidth: 400,
    contentHeight: (400 * 550) / 345,
    stageWidth: 1280,
    stageHeight: 700,
    viewBoxWidth: 345,
  };

  it("centres a page that fits in the part the list leaves, on either side", () => {
    const right = clampView({ x: 0, y: 0, z: 1 }, { ...WIDE, coverRight: 484 });
    expect(right.x).toBeCloseTo((796 - 400) / 2, 6);
    const left = clampView({ x: 0, y: 0, z: 1 }, { ...WIDE, coverLeft: 484 });
    expect(left.x).toBeCloseTo(484 + (796 - 400) / 2, 6);
  });

  it("with nothing beside it, still centres the page in the whole stage", () => {
    expect(clampView({ x: 0, y: 0, z: 1 }, WIDE).x).toBeCloseTo((1280 - 400) / 2, 6);
    expect(clampView({ x: 0, y: 0, z: 1 }, { ...WIDE, coverLeft: 0, coverRight: 0 }).x).toBeCloseTo(440, 6);
  });

  it("lets a page wider than what shows be panned until each edge comes clear of the list", () => {
    const covered = { ...WIDE, coverRight: 484 };
    // At z=2.5 the page is 1000px wide in the 796px still showing.
    expect(clampView({ x: 1e6, y: 0, z: 2.5 }, covered).x).toBeCloseTo(0, 6);
    expect(clampView({ x: -1e6, y: 0, z: 2.5 }, covered).x).toBeCloseTo(796 - 1000, 6);
    const mirrored = { ...WIDE, coverLeft: 484 };
    expect(clampView({ x: 1e6, y: 0, z: 2.5 }, mirrored).x).toBeCloseTo(484, 6);
    expect(clampView({ x: -1e6, y: 0, z: 2.5 }, mirrored).x).toBeCloseTo(1280 - 1000, 6);
  });

  it("frames a verse in the middle of the part the list leaves", () => {
    const covered = { ...WIDE, coverLeft: 484 };
    const bbox: Rect = { x: 145, y: 265, width: 55, height: 20 };
    // At z=2.5 the page overhangs what shows, so the clamp leaves the centring alone.
    const screen = bboxToScreen(bbox, frameBboxToView(bbox, covered, 2.5), covered);
    expect(screen.x + screen.width / 2).toBeCloseTo(484 + 796 / 2, 6);
  });

  it("starts a verse too wide for what shows at its first word, inside the list's edge", () => {
    const covered = { ...WIDE, coverRight: 484 };
    const bbox: Rect = { x: 10, y: 265, width: 325, height: 40 };
    const lead: Rect = { x: 200, y: 265, width: 135, height: 20 };
    const v = frameBboxToView(bbox, covered, 2.5, lead);
    const first = bboxToScreen(lead, v, covered);
    expect(first.x + first.width).toBeLessThanOrEqual(796);
    expect(first.x + first.width).toBeGreaterThan(796 - 40);
  });

  it("says a page fits across only when it fits beside the list", () => {
    const covered = { ...WIDE, coverRight: 484 };
    expect(viewFitsAcross({ x: 0, y: 0, z: 1.9 }, covered)).toBe(true);
    expect(viewFitsAcross({ x: 0, y: 0, z: 2.1 }, covered)).toBe(false);
  });

  it("is idempotent beside a list, too", () => {
    const covered = { ...WIDE, coverLeft: 484 };
    const once = clampView({ x: -1e6, y: -1e6, z: 2.5 }, covered);
    expect(clampView(once, covered)).toEqual(once);
  });
});

describe("viewFitsAcross", () => {
  const FIT = {
    contentWidth: CTX.contentWidth,
    contentHeight: CTX.contentHeight,
    stageWidth: CTX.stageWidth,
    stageHeight: CTX.stageHeight,
  };

  it("is true while there is no horizontal slack to roam over", () => {
    expect(viewFitsAcross({ x: 0, y: 0, z: 1 }, FIT)).toBe(true);
  });

  it("agrees with clampView about the boundary, exactly", () => {
    // 320 × 1.125 = 360, precisely the stage. The predicate and the clamp both
    // use `<=`, so the page that is exactly stage-width is centred by one and
    // reported as fitting by the other. If they ever disagreed here, a gesture
    // would be armed against a pan that does move, or declined against one that
    // does not.
    const exact = 360 / 320;
    expect(viewFitsAcross({ x: 0, y: 0, z: exact }, FIT)).toBe(true);
    expect(clampView({ x: -100, y: 0, z: exact }, FIT).x).toBeCloseTo(0, 6);

    // A hair past it the predicate says no and the clamp stops centring: the
    // page now roams, over an overhang of a third of a pixel. Tiny, but the two
    // must flip on the same frame, not merely eventually.
    const over = exact * 1.001;
    expect(viewFitsAcross({ x: 0, y: 0, z: over }, FIT)).toBe(false);
    expect(clampView({ x: -100, y: 0, z: over }, FIT).x).toBeCloseTo(360 - 320 * over, 6);
  });

  it("asks about one axis, because the phone it is for overflows the other", () => {
    // The reason this is not `fits both axes`. z=1.2 puts the page inside the
    // stage across and past it down — on the acceptance phone that is the state
    // at *rest*, so a two-axis predicate would report "does not fit" at
    // fit-zoom and the turn gesture would be dead on arrival on the only device
    // it was written for.
    const tall = { ...FIT, contentHeight: 900 };
    expect(viewFitsAcross({ x: 0, y: 0, z: 1 }, tall)).toBe(true);
    // …and the vertical pan it shares the surface with is genuinely live.
    expect(clampView({ x: 0, y: -1e6, z: 1 }, tall).y).toBeCloseTo(640 - 900, 6);
  });

  it("an unmeasured page does not fit", () => {
    // Same refusal as `holdAxis`: a zero box is a measurement that has not
    // happened yet. Answering "yes, it fits" would arm a turn against a page
    // nobody has seen.
    expect(viewFitsAcross({ x: 0, y: 0, z: 1 }, { ...FIT, contentWidth: 0 })).toBe(false);
    expect(viewFitsAcross({ x: 0, y: 0, z: 1 }, { ...FIT, stageWidth: 0 })).toBe(false);
  });

  it("ignores the translate — it is a question about size, not position", () => {
    // A page can only be off-centre if something bypassed the clamp; even then
    // the horizontal slot is free, because the next clamp puts it back.
    expect(viewFitsAcross({ x: -1e6, y: 1e6, z: 1 }, FIT)).toBe(true);
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

describe("the text's offset inside the leaf", () => {
  // The drawing does not start at the leaf's corner. The paper carries a border,
  // the stacked fore-edge on its free side, and a printed band above the text
  // with the surah and juz in it (and one below with the page number). So the
  // leaf is 320 wide but the text is drawn 300 wide, 14 px in and 24 px down.
  const INSET: FrameContext = {
    ...CTX,
    contentHeight: (300 * 550) / 345 + 24 + 20,
    text: { x: 14, y: 24, width: 300 },
  };

  it("places a verse by where the text really is, not the leaf's corner", () => {
    const view: View = { x: 10, y: 20, z: 2 };
    const bbox: Rect = { x: 0, y: 0, width: 345, height: 550 };
    const screen = bboxToScreen(bbox, view, INSET);
    expect(screen.x).toBeCloseTo(10 + 14 * 2, 6);
    expect(screen.y).toBeCloseTo(20 + 24 * 2, 6);
    expect(screen.width).toBeCloseTo(300 * 2, 6);
    expect(screen.height).toBeCloseTo(550 * (300 / 345) * 2, 6);
  });

  it("still centres a hop's verse exactly", () => {
    const bbox: Rect = { x: 40, y: 260, width: 265, height: 30 };
    const screen = bboxToScreen(bbox, frameBboxToView(bbox, INSET, 2), INSET);
    expect(screen.x + screen.width / 2).toBeCloseTo(INSET.stageWidth / 2, 6);
    expect(screen.y + screen.height / 2).toBeCloseTo(INSET.stageHeight / 2, 6);
  });
});
