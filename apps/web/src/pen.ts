/**
 * The highlighter's pens, and where the reader's pick is remembered.
 *
 * The owner settled the colours on 2026-09-30 (docs/design/highlight-texture-
 * options.md ②): a passage is pastel green and a run of words pastel blue by
 * default, and the highlighter carries four pens, green, blue, yellow and
 * pink, picked from the tools bar while it is on. The pen colours the passage
 * the highlighter paints, and the verse you are on keeps its amber. Since
 * 2026-10-12 (⑤) the words you hold take one of the same four, picked beside
 * it and blue until another is.
 *
 * The colours themselves live in tokens.css (`--pen-*`), each held to the
 * reading floor where it crosses the amber verse by pen.test.ts. This module
 * only names them and remembers the pick, free of React, so the tests import
 * the key rather than retyping it — the discipline turn-style.ts keeps.
 */

export type Pen = "green" | "blue" | "yellow" | "pink";

/** In toolbar order: the default first. */
export const PENS: readonly Pen[] = ["green", "blue", "yellow", "pink"];

/** Versioned: a pen that later changes what it means gets a new key. */
export const PEN_KEY = "hifth.highlighter.pen.v1";

function isPen(value: unknown): value is Pen {
  return PENS.includes(value as Pen);
}

/** The pen this device picked, or green when it never picked one. */
export function savedPen(): Pen {
  try {
    const stored = localStorage.getItem(PEN_KEY);
    return isPen(stored) ? stored : "green";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "green";
  }
}

export function rememberPen(pen: Pen): void {
  try {
    localStorage.setItem(PEN_KEY, pen);
  } catch {
    /* nothing to do — see savedPen */
  }
}

/** Puts the pen on the page: the stylesheet maps it to the passage's ink. */
export function applyPen(pen: Pen): void {
  document.documentElement.dataset.pen = pen;
}

/** Versioned, as the passage's pen is. */
export const WORD_PEN_KEY = "hifth.highlighter.wordPen.v1";

/** The pen this device picked for the words you hold, or blue. */
export function savedWordPen(): Pen {
  try {
    const stored = localStorage.getItem(WORD_PEN_KEY);
    return isPen(stored) ? stored : "blue";
  } catch {
    return "blue";
  }
}

export function rememberWordPen(pen: Pen): void {
  try {
    localStorage.setItem(WORD_PEN_KEY, pen);
  } catch {
    /* nothing to do — see savedPen */
  }
}

/** Puts it on the page: the stylesheet maps it to the held words' ink. */
export function applyWordPen(pen: Pen): void {
  document.documentElement.dataset.wordPen = pen;
}
