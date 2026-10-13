import { useEffect, useState } from "react";

/**
 * Which way the look-alike signs' arrows point, and where the reader's choice
 * is kept.
 *
 * The signs say where the other verse is: "≈" then a small arrow for an earlier
 * or a later surah. The book and the page slider run right to left, so later
 * pages lie to the left, and the slider's own arrows already follow the book
 * (docs/design/knowledge-graph-commentary.md, item 8). The owner chose on
 * 2026-10-12; the other way stays a setting:
 *
 *   book     later points left and earlier right, as the pages lie (the default)
 *   reading  later points right, the way "next" runs in English
 */
export type LookalikeArrows = "book" | "reading";

/** In settings order. */
export const LOOKALIKE_ARROWS: readonly LookalikeArrows[] = ["book", "reading"];

/** Versioned: a way that later changes what it does gets a new key. */
export const LOOKALIKE_ARROWS_KEY = "hifth.lookalike-arrows.v1";

function isLookalikeArrows(value: unknown): value is LookalikeArrows {
  return value === "book" || value === "reading";
}

/** The way this device chose, or the book's way when it never chose. */
export function savedLookalikeArrows(): LookalikeArrows {
  try {
    const stored = localStorage.getItem(LOOKALIKE_ARROWS_KEY);
    return isLookalikeArrows(stored) ? stored : "book";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "book";
  }
}

/**
 * A sign's small mark as the reader chose it. The signs are written the reading
 * way (← earlier, → later); the book's way turns the two arrows round.
 */
export function arrowFor(mark: string, choice: LookalikeArrows): string {
  if (choice === "reading") return mark;
  return mark === "←" ? "→" : mark === "→" ? "←" : mark;
}

const heard = new Set<(choice: LookalikeArrows) => void>();

export function rememberLookalikeArrows(choice: LookalikeArrows): void {
  try {
    localStorage.setItem(LOOKALIKE_ARROWS_KEY, choice);
  } catch {
    /* nothing to do — see savedLookalikeArrows */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useLookalikeArrows(): LookalikeArrows {
  const [choice, setChoice] = useState<LookalikeArrows>(savedLookalikeArrows);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}
