/** A commentator's initials as the prose cites them, and the key's spelling of them. */
export interface Siglum {
  /** As written in the prose. */
  readonly text: string;
  /** The key's spelling, with its accents composed. */
  readonly sig: string;
  /** Which bracket of the text it is in; initials sharing one share this. */
  readonly bracket: number;
}

// A bracket with no bracket inside it, then each piece of it between commas and semicolons.
const BRACKET = /\(([^()]*)\)/g;
const PIECE = /[^,;]+/g;

/**
 * Split a paragraph of The Study Quran's prose into plain text and the
 * commentators' initials it cites in brackets — "(Xy, Ṭz)" — so each can say
 * whose commentary it is. Only a whole piece of a bracket that is in the key
 * counts, so a capital in a sentence, or initials the key lacks, stay text.
 */
export function splitSigla(text: string, known: { has(sig: string): boolean }): (string | Siglum)[] {
  const parts: (string | Siglum)[] = [];
  let last = 0;
  for (const b of text.matchAll(BRACKET)) {
    const start = b.index + 1;
    for (const p of b[1]!.matchAll(PIECE)) {
      const lead = p[0].length - p[0].trimStart().length;
      const word = p[0].trim();
      const sig = word.normalize("NFC");
      if (!word || !known.has(sig)) continue;
      const at = start + p.index + lead;
      if (at > last) parts.push(text.slice(last, at));
      parts.push({ text: word, sig, bracket: b.index });
      last = at + word.length;
    }
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
