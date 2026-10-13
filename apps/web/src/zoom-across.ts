import { useEffect, useState } from "react";

/**
 * Where across the page the zoom buttons grow it from, and where the reader's
 * choice is kept (docs/PLAN.md, item 100).
 *
 * A line of the mus'haf begins at its right-hand edge. The open book used to
 * grow each page from the fold, so the right-hand page grew rightward and at
 * 200% the first words of its lines were off the screen; a hafiz had to slide
 * back for the start of every line (item 67). Both ways are built and kept
 * here as a setting:
 *
 *   starts  the line starts stay on the screen: the open book slides left as
 *           the right-hand page grows past the screen's edge (the left-hand
 *           page's lines begin at the fold, which stays in sight), and a page
 *           on its own grows from its right edge (the default).
 *   fold    an open book grows outward from its fold as one sheet, and a page
 *           on its own from its middle, as it always did.
 *
 * A page of the open book is held at its fold as it grows, so neither page
 * slides over the other (#148); to keep the right-hand page's line starts in
 * sight the whole book slides left, only as far as that page runs past the
 * screen. It follows the size, however it was reached, so a pinch on the open
 * book slides it too; a pinch on a page on its own still grows from the
 * fingers. The height is `zoom-anchor.ts`'s.
 */
export type ZoomAcross = "starts" | "fold";

/** In settings order. */
export const ZOOM_ACROSSES: readonly ZoomAcross[] = ["starts", "fold"];

/** Versioned: a way that later changes what it does gets a new key. */
export const ZOOM_ACROSS_KEY = "hifth.zoom.across.v1";

function isZoomAcross(value: unknown): value is ZoomAcross {
  return value === "starts" || value === "fold";
}

/** The way this device chose, or the line starts when it never chose. */
export function savedZoomAcross(): ZoomAcross {
  try {
    const stored = localStorage.getItem(ZOOM_ACROSS_KEY);
    return isZoomAcross(stored) ? stored : "starts";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "starts";
  }
}

const heard = new Set<(choice: ZoomAcross) => void>();

export function rememberZoomAcross(choice: ZoomAcross): void {
  try {
    localStorage.setItem(ZOOM_ACROSS_KEY, choice);
  } catch {
    /* nothing to do — see savedZoomAcross */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useZoomAcross(): ZoomAcross {
  const [choice, setChoice] = useState<ZoomAcross>(savedZoomAcross);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}

/**
 * The point across a page on its own that a press grows it from: its right
 * edge, or set to the fold, its middle. A page of the open book is held at the
 * fold whatever point it grows from (#148), so it is never asked.
 */
export function growFromX(choice: ZoomAcross, box: { left: number; right: number }): number {
  return choice === "starts" ? box.right : (box.left + box.right) / 2;
}

/**
 * How far the open book slides to the left, so the right-hand page's outer
 * edge, where its lines begin, stays on the screen: `outer` is where that edge
 * would stand with the book unslid, `limit` the right of the room the book has.
 * Only as far as it runs past, and nothing set to grow from the fold.
 */
export function bookShift(choice: ZoomAcross, outer: number, limit: number): number {
  return choice === "starts" ? Math.max(0, outer - limit) : 0;
}
