/**
 * Notes a page or column break cut part way through a sentence.
 *
 * The capture of The Study Quran starts a new paragraph at the top of every
 * column it reads, so where a sentence runs over a column or a page the drawer
 * showed it as two paragraphs, the first stopping on "of the" or on half a word
 * ("dif" then "ferent"). 83 places across the book.
 *
 * Where a paragraph ends with no closing mark and the next carries on in
 * lowercase, the two are one sentence and run back together. If the break cut a
 * word, the halves close up with no space, but only when the book itself spells
 * the whole word somewhere and the halves are not both words of their own.
 *
 * What text cannot tell — a sentence that carries on into a capital ("the" then
 * a name), a word that also lost the letter before its hyphen ("wor-ship" read
 * as "wo"), leftovers of the page foot between the halves (its verse links
 * again, a raised ending set down as "an"), or two paragraphs the print keeps
 * apart that only lost their stop — was read off the printed page and listed in
 * print-joins.json, by a fingerprint of the words either side, never the words,
 * with what to put back or leave off counted in letters.
 */
import { seamPrint } from "./breaks.mjs";

const CLOSED = /[.!?;:”"’)\]]\s*$/u;
const CARRIES_ON = /^[\p{Ll}(]/u;

/**
 * Every word the book uses, lowercased, to tell a cut word from two words. A
 * paragraph's first and last words are left out: that is where a break leaves
 * its halves ("dif", "ferent"), and a real word turns up elsewhere too.
 */
export function wordsOf(texts) {
  const words = new Set();
  for (const text of texts) {
    const found = [...text.matchAll(/\p{L}+/gu)].map(([w]) => w.toLowerCase());
    for (const w of found.slice(1, -1)) words.add(w);
  }
  return words;
}

function closeUp(a, b, words) {
  const tail = (a.match(/\p{L}+$/u)?.[0] ?? "").toLowerCase();
  const head = (b.match(/^\p{L}+/u)?.[0] ?? "").toLowerCase();
  return Boolean(tail && head) && words.has(tail + head) && !(words.has(tail) && words.has(head));
}

/**
 * Run one verse's split paragraphs back together. `marks` is the whole
 * hand-read list; `used` says which of its entries matched, by index.
 */
export function joinSplits(verse, blocks, words, marks = []) {
  const mine = new Map();
  marks.forEach((m, i) => m.verse === verse && mine.set(m.print, i));
  const used = new Set();
  const out = [];
  for (const block of blocks) {
    const last = out.length - 1;
    if (last < 0) {
      out.push(block);
      continue;
    }
    const a = out[last].trimEnd();
    const i = mine.get(seamPrint(`${a} ${block}`, a.length));
    if (i !== undefined) {
      used.add(i);
      const { fill = "", cut = 0, skip = 0, space = true, apart = false } = marks[i];
      const kept = a.slice(0, a.length - cut).trimEnd() + fill;
      const rest = block.slice(skip);
      if (apart) {
        out[last] = kept;
        out.push(rest);
      } else out[last] = kept + (space ? " " : "") + rest;
    } else if (!CLOSED.test(a) && CARRIES_ON.test(block)) {
      out[last] = a + (closeUp(a, block, words) ? "" : " ") + block;
    } else out.push(block);
  }
  return { blocks: out, used };
}
