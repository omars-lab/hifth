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

describe("the height a press grows the page from, with a note over the page's lower part", () => {
  // The stage runs 0 to 1000; a note covers it from 700 down, so 0 to 700 is free.
  const box = { top: 0, bottom: 1000 };
  const free = { top: 0, bottom: 700 };
  // Where a point lands once the page grows by `k` about the height `y`.
  const land = (p: number, y: number, k: number) => y + (p - y) * k;

  it("grows from the verse's middle while the grown verse still clears the note", () => {
    expect(zoomAnchorY({ top: 200, bottom: 300 }, box, 1.25, free)).toBe(250);
  });

  it("moves the height just enough that the grown verse's last line stays above the note", () => {
    // From its middle (480), its last line would land at 705, under the note.
    const verse = { top: 300, bottom: 660 };
    const y = zoomAnchorY(verse, box, 1.25, free);
    expect(land(verse.bottom, y, 1.25)).toBeCloseTo(700);
    expect(land(verse.top, y, 1.25)).toBeGreaterThanOrEqual(0);
  });

  it("keeps the verse's first line at the top when the grown verse is too tall for the free space", () => {
    const verse = { top: 100, bottom: 680 };
    const y = zoomAnchorY(verse, box, 1.5, free);
    expect(land(verse.top, y, 1.5)).toBeCloseTo(0);
  });

  it("grows from the verse's middle when zooming out, wherever the note is", () => {
    expect(zoomAnchorY({ top: 500, bottom: 900 }, box, 0.8, free)).toBe(700);
  });
});
