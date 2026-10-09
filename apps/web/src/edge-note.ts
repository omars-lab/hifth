/**
 * The hand-written note on a look-alike pair, in the reader's language.
 *
 * Each note was written in English with the pair's own Arabic words in it, and
 * was shown as it was in the Arabic app; its two-way arrow drew as a blue
 * emoji tile on an iPad (walking the Arabic iPad app, 2026-10-09: look-alike
 * rows ③). Every note now carries an Arabic version beside the English one.
 */
import type { Lang } from "./lang";

export interface EdgeNoteText {
  readonly text: string;
  readonly lang: "ar" | "en";
  readonly dir: "rtl" | "ltr";
}

/** The two-way arrow, asked for as text: Apple's fonts otherwise draw an emoji. */
const ARROW = /↔︎?/g;

export function edgeNote(edge: { readonly note?: string; readonly noteAr?: string }, lang: Lang): EdgeNoteText | null {
  const arabic = lang === "ar" && edge.noteAr ? edge.noteAr : null;
  const text = arabic ?? edge.note;
  if (!text) return null;
  return {
    text: text.replace(ARROW, "↔︎"),
    lang: arabic ? "ar" : "en",
    dir: arabic ? "rtl" : "ltr",
  };
}
