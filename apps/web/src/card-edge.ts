import { useEffect, useState } from "react";

/**
 * What a card laid over the facing page does at that page's outer edge, and
 * where the reader's choice is kept.
 *
 * On a spread the note, the roots, the similar verses and a highlight's menu
 * each lie over the whole facing page, fold to outer edge — and the outer edge
 * is the strip a hand grabs to turn the page, so with a card open only the
 * arrows and the keys turned it (docs/design/knowledge-graph-commentary.md,
 * item 26). The owner chose grabbing through the card on 2026-10-23; the
 * other two ways stay as settings:
 *
 *   turns   a drag from the edge, through the card, closes it and turns (default)
 *   clear   the card stops short of the edge, which stays free to grab
 *   covers  the card covers the edge; the arrows and keys turn the page
 *
 * Its own module, free of CSS, so the e2e tier imports the key rather than
 * retyping it — the discipline `jump-arrows.ts` keeps. A tiny store rather
 * than a prop, because the four cards and the edges all read it.
 */
export type CardEdge = "covers" | "clear" | "turns";

/** In settings order. */
export const CARD_EDGES: readonly CardEdge[] = ["turns", "clear", "covers"];

/** Versioned: a way that later changes what it does gets a new key. */
export const CARD_EDGE_KEY = "hifth.cards.edge.v1";

function isCardEdge(value: unknown): value is CardEdge {
  return value === "covers" || value === "clear" || value === "turns";
}

/** The way this device chose, or grabbing through when it never chose. */
export function savedCardEdge(): CardEdge {
  try {
    const stored = localStorage.getItem(CARD_EDGE_KEY);
    return isCardEdge(stored) ? stored : "turns";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "turns";
  }
}

const heard = new Set<(choice: CardEdge) => void>();

export function rememberCardEdge(choice: CardEdge): void {
  try {
    localStorage.setItem(CARD_EDGE_KEY, choice);
  } catch {
    /* nothing to do — see savedCardEdge */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useCardEdge(): CardEdge {
  const [choice, setChoice] = useState<CardEdge>(savedCardEdge);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}
