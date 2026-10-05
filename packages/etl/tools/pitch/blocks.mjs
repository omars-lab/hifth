/**
 * A verse's commentary, joined where the printed page broke it.
 *
 * The capture of The Study Quran gives a note as the paragraphs it read off each
 * page. Where a paragraph runs over the foot of a page, the capture keeps the
 * part it saw on the first page and then gives the whole paragraph again on the
 * next, so the drawer showed the same passage twice — 2:255 and 124 other notes
 * across the Qur'an. Sometimes the repeat lost a full stop the first copy had,
 * and sometimes the first copy ends in the stray verse numbers printed at the
 * foot of the page.
 *
 * So where a paragraph opens with words the one before it ends on, the two are
 * read as one: the earlier copy up to where the two stop agreeing, then the rest
 * of the later one. A full stop only the earlier copy kept is put back; anything
 * else after the agreement ends is page-foot debris and is left off. A paragraph
 * that is nothing but a repeat of what was already shown is dropped. The words
 * themselves are never changed.
 */

// How many opening characters must match before a paragraph counts as a repeat:
// long enough that two paragraphs merely starting alike are left alone.
const HEAD = 40;

// The most an earlier copy may run on past the agreement and still be a page
// break: its stray numbers or a full stop, never a paragraph of its own.
const DEBRIS = 24;

const agreeing = (a, b) => {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
};

export function joinPageBreaks(blocks) {
  const out = [];
  for (const block of blocks) {
    if (block.length >= HEAD && out.join(" ").includes(block)) continue;
    const last = out.length - 1;
    const at = block.length >= HEAD && last >= 0 ? out[last].lastIndexOf(block.slice(0, HEAD)) : -1;
    if (at < 0) {
      out.push(block);
      continue;
    }
    const tail = out[last].slice(at);
    const n = agreeing(tail, block);
    const rest = tail.slice(n);
    const after = block.slice(n);
    if (rest.length > DEBRIS) {
      out.push(block);
      continue;
    }
    const stop = /^[.;:]\s*$/.test(rest) && /^\s/.test(after) ? rest.trim() : "";
    out[last] = out[last].slice(0, at + n) + stop + after;
  }
  return out;
}
