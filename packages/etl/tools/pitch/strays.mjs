/**
 * Pieces the book capture took in as note paragraphs that are not part of the
 * note: the page's margin column of verse references ("2:61 87 91 3:21 …"),
 * sometimes glued to the front of the paragraph beside it or of its verse label, or to
 * the end of a paragraph after its last sentence along with the column's stray
 * letters ("… (Q). un un 2:171 17:97"); a lone letter left
 * over from a raised ending; and, where a page was read twice, a cut-short
 * copy of a paragraph or a piece of the previous verse's note.
 */
const REF = "\\d+:\\d+(?:[–-]\\d+)?";
const ONLY_REFS = new RegExp(`^${REF}(?:\\s+(?:${REF}|\\d+))*\\s*$`);
// …up to the capital the paragraph opens on, or up to its own verse label.
const LEADING_REFS = new RegExp(`^(?:${REF}\\s+)+(?=(?:\\d+(?:[–-]\\d+)?\\s+)?\\p{Lu})`, "u");
const LONE_LETTERS = /^\p{L}{1,2}$/u;
// …after the last sentence's own stop: only short lowercase scraps and references
// to the end. A paragraph's real last words ("in v. 155", "See 2:41") stay, and
// the stop of a short form (v., vv., cf.) is not a sentence's.
const TRAILING_SCRAPS = new RegExp(`(?<!\\b(?:vv?|[Cc]f)\\.)(?<=[.?!][”’")\\]]*)(?:\\s+(?:\\p{Ll}{1,2}|${REF}c?|\\d+))+\\s*$`, "u");

/** One captured block with the margin's references and lone letters taken out. */
export function dropMarginRefs(text) {
  const s = text.trim();
  if (ONLY_REFS.test(s) || LONE_LETTERS.test(s)) return "";
  return text.replace(LEADING_REFS, "").replace(TRAILING_SCRAPS, "");
}

/**
 * A verse's finished paragraphs without the ones that only repeat: the start of
 * a later paragraph of its own, or a piece of the previous verse's note. A note
 * shared whole with the previous verse is the book's own layout and stays.
 */
export function dropStrayBlocks(blocks, previous) {
  const own = blocks.map((b) => b.trim());
  const prev = previous.map((b) => b.trim());
  return blocks.filter((_, i) => {
    const b = own[i];
    if (own.some((o, j) => j !== i && o !== b && o.startsWith(b))) return false;
    return prev.includes(b) || !prev.some((p) => p.includes(b));
  });
}
