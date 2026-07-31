/**
 * The DOM half of the field — reading it off the link, and putting it on the
 * document.
 *
 * The table, the ids and the tolerance rule live in `@hifth/core`'s `field.ts`,
 * which is framework-free and knows nothing about `location` or `documentElement`.
 * This is the L3 side: one function to find the field in the URL before React
 * exists, and one to write it where `styles/field.css` can see it.
 *
 * It is a module rather than three lines inside `App`, for the same reason
 * `lang.ts` is: `main.tsx` calls it *before* the first paint. A field arrives in
 * a cold-opened link, and applying it from a React effect would paint the
 * default desk for one frame first — on `?field=dark` that is a white flash in
 * a dark room, which is precisely the reader this option exists for.
 */

import { DEFAULT_FIELD, parseHash, type FieldId } from "@hifth/core";

/**
 * The field a URL asks for, or the default.
 *
 * Deliberately forgiving twice over: `parseHash` returns `null` for a hash that
 * is not a link at all (an empty one, on a plain cold open), and it drops a
 * `field=` value it does not recognise rather than rejecting the link. Either
 * way the answer is a real field and the desk gets painted.
 */
export function fieldFromHash(hash: string): FieldId {
  return parseHash(hash)?.field ?? DEFAULT_FIELD;
}

/**
 * Put the field on the document element, where `styles/field.css` selects on it.
 *
 * An attribute rather than inline custom properties: the values belong in a
 * stylesheet where they can be read next to each other and diffed, and the one
 * thing JS gets to say is *which* of them applies.
 */
export function applyFieldToDocument(field: FieldId): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.field = field;
}
