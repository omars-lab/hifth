import { useEffect, useState } from "react";

/**
 * How a verse only a little taller than the room above its note is shown
 * whole, and where the reader's choice is kept.
 *
 * On an upright iPad a link to 2:255 lands zoomed in and the note rises over
 * the lower part of the screen; the verse came out a few dozen pixels taller
 * than the room left above it. Both ways of making room were built
 * (docs/design/knowledge-graph-commentary.md, items 42 and 43); drawing the page
 * smaller is the default, and the other stays here as a setting:
 *
 *   smaller  the page is drawn a little smaller, the note keeps its height
 *   shorter  the note opens a little shorter, the page keeps its zoom
 *
 * Its own module, free of CSS, so the e2e tier imports the key rather than
 * retyping it — the discipline `card-edge.ts` keeps.
 */
export type LongVerse = "smaller" | "shorter";

/** In settings order. */
export const LONG_VERSES: readonly LongVerse[] = ["smaller", "shorter"];

/** Versioned: a way that later changes what it does gets a new key. */
export const LONG_VERSE_KEY = "hifth.long-verse.v1";

function isLongVerse(value: unknown): value is LongVerse {
  return value === "smaller" || value === "shorter";
}

/** The way this device chose, or the page a little smaller when it never chose. */
export function savedLongVerse(): LongVerse {
  try {
    const stored = localStorage.getItem(LONG_VERSE_KEY);
    return isLongVerse(stored) ? stored : "smaller";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "smaller";
  }
}

const heard = new Set<(choice: LongVerse) => void>();

export function rememberLongVerse(choice: LongVerse): void {
  try {
    localStorage.setItem(LONG_VERSE_KEY, choice);
  } catch {
    /* nothing to do — see savedLongVerse */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useLongVerse(): LongVerse {
  const [choice, setChoice] = useState<LongVerse>(savedLongVerse);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}

/*
 * The px the short note gives up so the verse above it shows whole. The page
 * works it out, since it is the one that knows how tall the verse is; the note
 * reads it. Kept here rather than passed down because the two sit in different
 * parts of the screen and the page asks again on every settle.
 */
let room = 0;
const roomHeard = new Set<(px: number) => void>();

export function noteRoom(): number {
  return room;
}

export function giveNoteRoom(px: number): void {
  const next = Math.max(0, px);
  if (next === room) return;
  room = next;
  for (const tell of roomHeard) tell(room);
}

/** The room the note gives up, kept current as the page asks for more or less. */
export function useNoteRoom(): number {
  const [px, setPx] = useState(noteRoom);
  useEffect(() => {
    roomHeard.add(setPx);
    setPx(room);
    return () => {
      roomHeard.delete(setPx);
    };
  }, []);
  return px;
}
