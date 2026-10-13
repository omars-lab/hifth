import { useEffect, useState } from "react";

/**
 * How big a page opens when a link or a hop lands on a verse, with one page
 * showing, and where the reader's choice is kept.
 *
 * A link or a hop frames its verse a little closer than the whole page (155%),
 * so the letters are larger; on a large iPad held upright that fills the width
 * and runs past the foot of the screen, and the page slides. The owner asked on
 * 2026-10-13 for it to be a setting (docs/PLAN.md, item 98):
 *
 *   closer  a little closer than the whole page, as before (the default)
 *   whole   the whole page at once, so nothing slides
 *
 * With the book open both pages already show whole, so this is for one page:
 * an iPad held upright, and a phone.
 */
export type OpenSize = "closer" | "whole";

/** In settings order. */
export const OPEN_SIZES: readonly OpenSize[] = ["closer", "whole"];

/** Versioned: a size that later changes what it does gets a new key. */
export const OPEN_SIZE_KEY = "hifth.open-size.v1";

function isOpenSize(value: unknown): value is OpenSize {
  return value === "closer" || value === "whole";
}

/** The size this device chose, or a little closer when it never chose. */
export function savedOpenSize(): OpenSize {
  try {
    const stored = localStorage.getItem(OPEN_SIZE_KEY);
    return isOpenSize(stored) ? stored : "closer";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "closer";
  }
}

/** The size to ask a hop for, or undefined to let it frame the verse as it does. */
export function openZoom(choice: OpenSize): number | undefined {
  return choice === "whole" ? 1 : undefined;
}

const heard = new Set<(choice: OpenSize) => void>();

export function rememberOpenSize(choice: OpenSize): void {
  try {
    localStorage.setItem(OPEN_SIZE_KEY, choice);
  } catch {
    /* nothing to do — see savedOpenSize */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useOpenSize(): OpenSize {
  const [choice, setChoice] = useState<OpenSize>(savedOpenSize);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}
