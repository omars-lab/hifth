import { useEffect, useState } from "react";

/**
 * How long a bookmark's ribbon hangs down its page, and where the reader's
 * choice is kept.
 *
 * The first words of a page are the cue a hafiz revises by, and a ribbon as long
 * as a finger hung over the start of the first three lines (docs/PLAN.md,
 * item 49). Both ways are built and kept here as a setting:
 *
 *   short  the ribbon stops in the band above the first line (the default);
 *          its name is its accessible name and its tooltip
 *   long   it hangs over the first lines, its name written down its length
 */
export type RibbonLength = "short" | "long";

/** In settings order. */
export const RIBBON_LENGTHS: readonly RibbonLength[] = ["short", "long"];

/** Versioned: a way that later changes what it does gets a new key. */
export const RIBBON_LENGTH_KEY = "hifth.ribbon-length.v1";

function isRibbonLength(value: unknown): value is RibbonLength {
  return value === "short" || value === "long";
}

/** The way this device chose, or the short ribbon when it never chose. */
export function savedRibbonLength(): RibbonLength {
  try {
    const stored = localStorage.getItem(RIBBON_LENGTH_KEY);
    return isRibbonLength(stored) ? stored : "short";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "short";
  }
}

const heard = new Set<(choice: RibbonLength) => void>();

export function rememberRibbonLength(choice: RibbonLength): void {
  try {
    localStorage.setItem(RIBBON_LENGTH_KEY, choice);
  } catch {
    /* nothing to do — see savedRibbonLength */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useRibbonLength(): RibbonLength {
  const [choice, setChoice] = useState<RibbonLength>(savedRibbonLength);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}
