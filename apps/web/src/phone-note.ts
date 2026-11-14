import { useEffect, useState } from "react";

/**
 * How the note sits on a phone, and where the reader's two choices are kept
 * (docs/design/iphone-app.md, item 3).
 *
 * Measured on the pitch's longest verse, the short note on an iPhone showed its
 * title and the translation and not one line of the commentary, held upright
 * or on its side. Each way of fixing it was built, the default first:
 *
 * What the note leads with:
 *   clamp  the translation cut to two lines, a button for the rest, so the
 *          commentary starts inside the short note
 *   whole  the translation whole, as it was before
 *   tall   the note opens grown to the full height
 *
 * Where it stands on a phone on its side:
 *   beside  the full height of the screen beside the page
 *   foot    lying across the foot of the screen, as it was before
 *
 * Its own module, free of CSS, so the e2e tier imports the keys rather than
 * retyping them — the discipline `long-verse.ts` keeps.
 */
export type NoteLead = "clamp" | "whole" | "tall";
export type NoteSideways = "beside" | "foot";

/** In settings order. */
export const NOTE_LEADS: readonly NoteLead[] = ["clamp", "whole", "tall"];
export const NOTE_SIDEWAYS: readonly NoteSideways[] = ["beside", "foot"];

/** Versioned: a way that later changes what it does gets a new key. */
export const NOTE_LEAD_KEY = "hifth.note.lead.v1";
export const NOTE_SIDEWAYS_KEY = "hifth.note.sideways.v1";

/** One kept choice: read, remembered, and heard by every note on the screen. */
function kept<T extends string>(key: string, options: readonly T[]) {
  const fallback = options[0] as T;
  const saved = (): T => {
    try {
      const stored = localStorage.getItem(key);
      return options.includes(stored as T) ? (stored as T) : fallback;
    } catch {
      // Safari private mode throws on localStorage; a device we cannot
      // remember gets the default.
      return fallback;
    }
  };
  const heard = new Set<(choice: T) => void>();
  const remember = (choice: T): void => {
    try {
      localStorage.setItem(key, choice);
    } catch {
      /* nothing to do — see saved */
    }
    for (const tell of heard) tell(choice);
  };
  const use = (): T => {
    const [choice, setChoice] = useState<T>(saved);
    useEffect(() => {
      heard.add(setChoice);
      return () => {
        heard.delete(setChoice);
      };
    }, []);
    return choice;
  };
  return { saved, remember, use };
}

const lead = kept(NOTE_LEAD_KEY, NOTE_LEADS);
const sideways = kept(NOTE_SIDEWAYS_KEY, NOTE_SIDEWAYS);

/** What the note leads with, or two lines of the translation when nobody chose. */
export const savedNoteLead = lead.saved;
export const rememberNoteLead = lead.remember;
/** The reader's choice, kept current as they change it in settings. */
export const useNoteLead = lead.use;

/** Where the note stands on a phone on its side, or beside the page when nobody chose. */
export const savedNoteSideways = sideways.saved;
export const rememberNoteSideways = sideways.remember;
/** The reader's choice, kept current as they change it in settings. */
export const useNoteSideways = sideways.use;
