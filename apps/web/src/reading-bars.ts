/**
 * Whether the bars hide while reading (the layout plan's item ⑪). A rough
 * build behind a switch, off until it has been tried on an iPad and a phone:
 *
 *   stay   the bars are always there (default, as before)
 *   hide   after a few quiet seconds the bars leave and the page takes the
 *          room; a tap anywhere brings them back
 *
 * They never leave while a pen is in hand, a panel is open, the reader is
 * working in a bar, or full screen is on (which has its own rules).
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key rather
 * than retyping it: the discipline `jump-arrows.ts` keeps.
 */

export type ReadingBars = "stay" | "hide";

/** In settings order. */
export const READING_BARS: readonly ReadingBars[] = ["stay", "hide"];

/** Versioned: a way that later changes what it does gets a new key. */
export const READING_BARS_KEY = "hifth.reading.bars.v1";

/**
 * How long the reader leaves the app alone before the bars go. Other readers
 * wait 3 to 5 seconds (taken from their code, not from use).
 */
export const BARS_HIDE_MS = 4000;

function isReadingBars(value: unknown): value is ReadingBars {
  return value === "stay" || value === "hide";
}

/** What this device chose, or staying when it never chose. */
export function savedReadingBars(): ReadingBars {
  try {
    const stored = localStorage.getItem(READING_BARS_KEY);
    return isReadingBars(stored) ? stored : "stay";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "stay";
  }
}

export function rememberReadingBars(choice: ReadingBars): void {
  try {
    localStorage.setItem(READING_BARS_KEY, choice);
  } catch {
    /* nothing to do: see savedReadingBars */
  }
}

export interface ReadingNow {
  readonly way: ReadingBars;
  /** The tool in hand; only the two that mark nothing count as reading. */
  readonly tool: string;
  /** A drawer, sheet, menu or tour is open. */
  readonly open: boolean;
  /** Full screen is on. */
  readonly full: boolean;
  /** The keyboard's focus is inside one of the bars. */
  readonly inBar: boolean;
}

/** May the bars leave once the reader has been quiet long enough? */
export function barsMayHide({ way, tool, open, full, inBar }: ReadingNow): boolean {
  if (way !== "hide") return false;
  if (tool !== "select" && tool !== "read") return false;
  return !open && !full && !inBar;
}
