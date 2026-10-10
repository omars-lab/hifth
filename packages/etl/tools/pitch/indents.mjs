/**
 * Paragraph starts the capture of The Study Quran ran into the paragraph before.
 *
 * Where a printed paragraph opens a column, the capture sometimes keeps the full
 * stop before it and loses the break, so the drawer shows two paragraphs as one.
 * Nothing in the text marks such a spot: a full stop and a capital follow each
 * other in every paragraph. The page itself does mark it. The book sets a
 * paragraph's first line a little further in than the lines around it, and a
 * note's first line, which opens with its verse number, further in again; the
 * page readings place every line, so the set-in lines can be picked out.
 *
 * Each set-in line is then found in the notes by its opening words, and the
 * spot is named by the same fingerprint print-breaks.json uses. The `--indents`
 * listing of extract.mjs prints those fingerprints, never the words, ready to be
 * checked on the page picture and added to the list by hand.
 */
import { seams, seamPrint } from "./breaks.mjs";

// Where lines sit, as a share of the spread's width, measured from each half's
// own body column so a page scanned a little askew still reads.
const INDENT = [0.008, 0.018]; // a paragraph's first line
const COLUMN = [-0.01, 0.04]; // anything else here is a margin, a head or a folio

/** The x most lines of one half share: that half's body column. */
function bodyOf(lines) {
  let best = { x: 0, n: -1 };
  for (const { x } of lines) {
    const n = lines.filter((l) => Math.abs(l.x - x) <= 0.003).length;
    if (n > best.n) best = { x, n };
  }
  return best.x;
}

const opensWithCapital = (text) => /^\P{L}*\p{Lu}/u.test(text);

/**
 * The lines of one page reading (a two-page spread, each line `{x, y, text}`)
 * set in by a paragraph indent, in reading order, each with where it sits and
 * the line read just before it, or "" where the reading skipped the lines between.
 */
export function paragraphStarts(lines) {
  const out = [];
  let before = "";
  for (const half of [lines.filter((l) => l.x < 0.5), lines.filter((l) => l.x >= 0.5)]) {
    if (!half.length) continue;
    const body = bodyOf(half);
    const column = half
      .filter((l) => l.x - body >= COLUMN[0] && l.x - body <= COLUMN[1])
      .sort((a, b) => a.y - b.y);
    // The step from one line to the next. A reading sometimes skips lines, so
    // the step is taken from the shorter gaps, and a line read further up than
    // two steps is not the line before.
    const steps = column.slice(1).map((l, i) => l.y - column[i].y).filter((d) => d > 0.005).sort((a, b) => a - b);
    const step = steps[Math.floor(steps.length / 4)] ?? Infinity;
    let above = -Infinity;
    for (const l of column) {
      if (l.y - above > 2 * step) before = "";
      const inset = l.x - body;
      if (inset >= INDENT[0] && inset <= INDENT[1] && opensWithCapital(l.text)) out.push({ text: l.text, before, x: l.x, y: l.y });
      before = l.text;
      above = l.y;
    }
  }
  return out;
}

/**
 * Text as the comparison sees it: its letters and digits only, lower case, no
 * accents. A reading drops a mark it cannot read or breaks a word in two at it,
 * and sets slant and quote marks its own way; none of that reaches the letters.
 */
const letters = (text) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const STOP = /[.!?][”’")\]\uE001]*$/u;
/** The marks a text ends on, after its last letter or digit; never a word. */
const endMarks = (text) => (text.trimEnd().match(/[^\p{L}\p{N}\s]*$/u) ?? [""])[0].replace(/[\uE000\uE001]/gu, "");
// Letters a start must carry to be placed at all, how many open the index,
// and how many letters in a line's worth the reading may have got wrong.
const LEAST = 15;
const KEY = 8;
const MISREAD = 1 / 12;

/** Letters to change, add or drop to turn `a` into `b`: the edit distance. */
function misread(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

/**
 * Where in the notes each start falls. `notes` is every verse's paragraphs as
 * captured; `holders` names the verses that share a paragraph, which is one
 * place however many verses hold it. A start is matched on the whole line but
 * its last word, forgiving a few misread letters, and where two places still
 * open the same way, on the end of the line before. Each start comes back as: `split` (the capture already
 * starts a paragraph there), `stop-kept` (run on after a full stop it kept: the
 * kind this finds), `stop-lost` (run on, the stop lost too), `unmatched` or
 * `ambiguous`. A placed start also says which marks the page and the capture
 * each end the line before on (`ends`), so a lost stop can be read off the page.
 */
export function placeStarts(starts, notes, holders = () => []) {
  // Every place a paragraph could start, by its first letters.
  const index = new Map();
  for (const { verse, blocks } of notes)
    blocks.forEach((block, bi) => {
      const shared = holders(block).length > 0;
      const add = (at) => {
        const after = letters(block.slice(at + 1, at + 400));
        if (after.length < KEY) return;
        const id = shared ? `${block}\u0000${at}` : `${verse}\u0000${bi}\u0000${at}`;
        const prior = at < 0 ? "" : letters(block.slice(Math.max(0, at - 60), at));
        const key = after.slice(0, KEY);
        index.set(key, [...(index.get(key) ?? []), { id, verse, block, at, after, prior }]);
      };
      add(-1);
      for (const { at } of seams(block)) add(at);
    });

  return starts.map((start) => {
    const at = { page: start.page, x: start.x, y: start.y };
    // The line's last word may be cut by a hyphen; leave it out.
    const head = letters(start.text.trim().split(/\s+/).slice(0, -1).join(" "));
    if (head.length < LEAST) return { kind: "unmatched", ...at };
    // The closest places within what a reading gets wrong.
    const limit = Math.max(2, Math.floor(head.length * MISREAD));
    const seen = new Map();
    for (const p of index.get(head.slice(0, KEY)) ?? []) {
      if (seen.has(p.id)) continue;
      const d = misread(head, p.after.slice(0, head.length));
      if (d <= limit) seen.set(p.id, { ...p, d });
    }
    const best = Math.min(...[...seen.values()].map((p) => p.d));
    let found = [...seen.values()].filter((p) => p.d === best);
    if (found.length > 1) {
      const tail = letters(start.before ?? "").slice(-10);
      found = found.filter((p) => tail && p.prior.endsWith(tail));
    }
    if (found.length === 0) return { kind: seen.size ? "ambiguous" : "unmatched", ...at };
    if (found.length > 1) return { kind: "ambiguous", ...at };
    const [p] = found;
    if (p.at < 0) return { kind: "split", verse: p.verse, ...at };
    const kind = STOP.test(p.block.slice(0, p.at)) ? "stop-kept" : "stop-lost";
    const ends = { page: endMarks(start.before ?? ""), capture: endMarks(p.block.slice(0, p.at)) };
    return { kind, verse: p.verse, print: seamPrint(p.block, p.at), ends, ...at };
  });
}
