import { afterEach, describe, expect, it } from "vitest";
import { ZOOM_ANCHOR_KEY, rememberZoomAnchor, savedZoomAnchor, verseToGrowFrom, zoomAnchorY } from "./zoom-anchor";

describe("where the zoom buttons grow the page from, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("is the chosen verse when nobody chose, and keeps the choice made", () => {
    expect(savedZoomAnchor()).toBe("verse");
    for (const choice of ["middle", "verse"] as const) {
      rememberZoomAnchor(choice);
      expect(localStorage.getItem(ZOOM_ANCHOR_KEY)).toBe(choice);
      expect(savedZoomAnchor()).toBe(choice);
    }
  });

  it("a value it does not know falls back to the chosen verse", () => {
    localStorage.setItem(ZOOM_ANCHOR_KEY, "nonsense");
    expect(savedZoomAnchor()).toBe("verse");
  });
});

describe("which verse a press grows from", () => {
  const span = { top: 700, bottom: 900 };

  it("is the chosen verse by default, and none when the reader set the middle", () => {
    expect(verseToGrowFrom("verse", span)).toEqual(span);
    expect(verseToGrowFrom("middle", span)).toBeNull();
  });

  it("is none when no verse is chosen", () => {
    expect(verseToGrowFrom("verse", null)).toBeNull();
  });
});

describe("the height a press grows the page from", () => {
  const box = { top: 100, bottom: 1000 };

  it("is the middle of the page's box with no verse to follow", () => {
    expect(zoomAnchorY(null, box)).toBe(550);
  });

  it("is the middle of the chosen verse, top line to bottom line", () => {
    expect(zoomAnchorY({ top: 700, bottom: 900 }, box)).toBe(800);
  });

  it("stays inside the page's box when the verse runs past its edge", () => {
    expect(zoomAnchorY({ top: 950, bottom: 1250 }, box)).toBe(1000);
    expect(zoomAnchorY({ top: -300, bottom: 0 }, box)).toBe(100);
  });
});
