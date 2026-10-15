import { useEffect, useState } from "react";

/**
 * The size a page comes back at when an iPad turned on its side is held upright
 * again, and where the reader's choice is kept.
 *
 * Held upright, a verse's page opens a little bigger than the screen; on its
 * side the open book shows both pages whole. Turned back upright, the page used
 * to stay whole, so the reader lost the size it had opened at, though the open
 * book had made it whole, not they (docs/PLAN.md, item 69). The owner chose on
 * 2026-10-13 to bring it back, and to keep the old way (item 99):
 *
 *   opening  back at the size the page opened at (the default)
 *   whole    the whole page, as the open book left it
 *
 * An iPad mini shows one page on its side, a little bigger than its room; it
 * came back on its side whole after a turn upright (item 107), so the same
 * choice brings back the size a page opened at whichever way up it is held.
 *
 * Its own module, free of CSS, as `open-size.ts` is.
 */
export type UprightAgain = "opening" | "whole";

/** In settings order. */
export const UPRIGHT_AGAINS: readonly UprightAgain[] = ["opening", "whole"];

/** Versioned: a way that later changes what it does gets a new key. */
export const UPRIGHT_AGAIN_KEY = "hifth.upright-again.v1";

function isUprightAgain(value: unknown): value is UprightAgain {
  return value === "opening" || value === "whole";
}

/** The way this device chose, or the opening size when it never chose. */
export function savedUprightAgain(): UprightAgain {
  try {
    const stored = localStorage.getItem(UPRIGHT_AGAIN_KEY);
    return isUprightAgain(stored) ? stored : "opening";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "opening";
  }
}

/**
 * The size to bring back, or null to leave the page as it is: only from the
 * whole page, so a size the reader zoomed to on its side stands, and only when
 * the page had opened at some other size.
 */
export function uprightAgainZoom(now: number, opened: number | null, choice: UprightAgain): number | null {
  if (choice !== "opening" || opened === null) return null;
  if (Math.abs(now - 1) > 0.005 || Math.abs(opened - 1) <= 0.005) return null;
  return opened;
}

const heard = new Set<(choice: UprightAgain) => void>();

export function rememberUprightAgain(choice: UprightAgain): void {
  try {
    localStorage.setItem(UPRIGHT_AGAIN_KEY, choice);
  } catch {
    /* nothing to do — see savedUprightAgain */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useUprightAgain(): UprightAgain {
  const [choice, setChoice] = useState<UprightAgain>(savedUprightAgain);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}
