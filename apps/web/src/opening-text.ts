import { useEffect, useState } from "react";

/**
 * How the book's two opening pages lay out their text, and where the reader's
 * choice is kept.
 *
 * Those two pages are drawn as the text block alone, smaller than every other
 * page's, and now sit on paper the same size as the rest
 * (docs/design/knowledge-graph-commentary.md, item 36). Both ways of filling
 * that paper were built; the owner picked the first, and the other stays here
 * as a setting rather than being thrown away:
 *
 *   large  the text spans the page's width, larger than on other pages
 *   even   the text keeps the size of type every other page uses, in the middle
 *
 * Its own module, free of CSS, so the e2e tier imports the key rather than
 * retyping it — the discipline `card-edge.ts` keeps.
 */
export type OpeningText = "large" | "even";

/** In settings order. */
export const OPENING_TEXTS: readonly OpeningText[] = ["large", "even"];

/** Versioned: a way that later changes what it does gets a new key. */
export const OPENING_TEXT_KEY = "hifth.opening.text.v1";

function isOpeningText(value: unknown): value is OpeningText {
  return value === "large" || value === "even";
}

/** The way this device chose, or large text when it never chose. */
export function savedOpeningText(): OpeningText {
  try {
    const stored = localStorage.getItem(OPENING_TEXT_KEY);
    return isOpeningText(stored) ? stored : "large";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "large";
  }
}

const heard = new Set<(choice: OpeningText) => void>();

export function rememberOpeningText(choice: OpeningText): void {
  try {
    localStorage.setItem(OPENING_TEXT_KEY, choice);
  } catch {
    /* nothing to do — see savedOpeningText */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useOpeningText(): OpeningText {
  const [choice, setChoice] = useState<OpeningText>(savedOpeningText);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}
