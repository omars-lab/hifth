import { useEffect, useState } from "react";

/**
 * Where the zoom buttons grow the page from, and where the reader's choice is
 * kept (docs/PLAN.md, item 66).
 *
 * A button has no finger to grow from, so the stage picks the height. It used
 * to be the middle of the page, always: with a verse chosen low on the page,
 * three presses carried the whole verse below the screen, and its note was left
 * pointing at nothing. Both ways are built and kept here as a setting:
 *
 *   verse   the page grows from the chosen verse, so the verse stays where the
 *           reader was looking (the default); with no verse chosen, the middle.
 *   middle  the page grows from its middle, as it always did.
 *
 * Only the height: across the page, an open book still grows from its fold.
 * Its own module, free of CSS, as `run-follow.ts` is.
 */
export type ZoomAnchor = "verse" | "middle";

/** In settings order. */
export const ZOOM_ANCHORS: readonly ZoomAnchor[] = ["verse", "middle"];

/** Versioned: a way that later changes what it does gets a new key. */
export const ZOOM_ANCHOR_KEY = "hifth.zoom.anchor.v1";

/** A verse's lines, top of the first to bottom of the last, in screen pixels. */
export interface VerseSpan {
  top: number;
  bottom: number;
}

function isZoomAnchor(value: unknown): value is ZoomAnchor {
  return value === "verse" || value === "middle";
}

/** The way this device chose, or the chosen verse when it never chose. */
export function savedZoomAnchor(): ZoomAnchor {
  try {
    const stored = localStorage.getItem(ZOOM_ANCHOR_KEY);
    return isZoomAnchor(stored) ? stored : "verse";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "verse";
  }
}

const heard = new Set<(choice: ZoomAnchor) => void>();

export function rememberZoomAnchor(choice: ZoomAnchor): void {
  try {
    localStorage.setItem(ZOOM_ANCHOR_KEY, choice);
  } catch {
    /* nothing to do — see savedZoomAnchor */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useZoomAnchor(): ZoomAnchor {
  const [choice, setChoice] = useState<ZoomAnchor>(savedZoomAnchor);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}

/** The verse a press grows from: the chosen one, unless the reader set the middle. */
export function verseToGrowFrom(choice: ZoomAnchor, verse: VerseSpan | null): VerseSpan | null {
  return choice === "middle" ? null : verse;
}

/**
 * The height a press grows the page from: the middle of the verse, kept inside
 * the page's box, or the middle of the box with no verse to follow.
 */
export function zoomAnchorY(verse: VerseSpan | null, box: VerseSpan): number {
  if (!verse) return (box.top + box.bottom) / 2;
  return Math.min(box.bottom, Math.max(box.top, (verse.top + verse.bottom) / 2));
}
