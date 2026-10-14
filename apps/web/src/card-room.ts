import { useEffect, useState } from "react";

/**
 * How one page makes room for a card standing beside it — the roots list, a
 * note grown into the corner, the share card — and where the reader's choice
 * is kept.
 *
 * A laptop window closed to one page puts those cards in its corner, over
 * where the page's lines begin. Both ways of clearing them were built
 * (docs/design/lookalike-rows.md, items ⑩ and ⑪); sliding the page aside is
 * the default, and the other stays here as a setting:
 *
 *   aside    the page slides into the room the card leaves, at its own size
 *   smaller  the page stays in the middle of the window, drawn smaller
 *
 * Its own module, free of CSS, so the e2e tier imports the key rather than
 * retyping it — the discipline `card-edge.ts` keeps.
 */
export type CardRoom = "aside" | "smaller";

/** In settings order. */
export const CARD_ROOMS: readonly CardRoom[] = ["aside", "smaller"];

/** Versioned: a way that later changes what it does gets a new key. */
export const CARD_ROOM_KEY = "hifth.card-room.v1";

function isCardRoom(value: unknown): value is CardRoom {
  return value === "aside" || value === "smaller";
}

/** The way this device chose, or the slide aside when it never chose. */
export function savedCardRoom(): CardRoom {
  try {
    const stored = localStorage.getItem(CARD_ROOM_KEY);
    return isCardRoom(stored) ? stored : "aside";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "aside";
  }
}

const heard = new Set<(choice: CardRoom) => void>();

export function rememberCardRoom(choice: CardRoom): void {
  try {
    localStorage.setItem(CARD_ROOM_KEY, choice);
  } catch {
    /* nothing to do — see savedCardRoom */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useCardRoom(): CardRoom {
  const [choice, setChoice] = useState<CardRoom>(savedCardRoom);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}
