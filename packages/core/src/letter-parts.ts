/**
 * One letter of a word, as the word tool shows it (letter-parts = A,
 * docs/decisions/letter-parts.md): the print itself, cut where one letter joins
 * the next.
 *
 * The page's letter data holds, for each word the cut could be trusted on, the
 * dividing lines between neighbouring letters — never the letters themselves.
 * This turns those lines into one outline per letter, right to left, to clip
 * the print to. A word absent from the data has no letters to offer, and the
 * word tool shows its signs and the whole word as before.
 */

/** Page units of paper the word tool keeps round each copy; the lines reach this far past the box. */
export const LETTER_PAD = 2.5;

/**
 * A dividing line as the data stores it, in tenths of a page unit measured
 * from the word's box: a number is an upright line at that x; otherwise
 * [x, dy, dx, dy, dx, …] is its top point (at the top of the copy) and then
 * each next point as a step down and across. The last point runs on straight
 * to the bottom of the copy.
 */
export type WireLine = number | readonly number[];

/** One page's letter data: verse → this print's word index → the word's lines, right to left. */
export interface LetterShard {
  readonly page: number;
  readonly words: Readonly<Record<string, Readonly<Record<string, readonly WireLine[]>>>>;
}

export function isLetterShard(value: unknown): value is LetterShard {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { page?: unknown; words?: unknown };
  return typeof v.page === "number" && typeof v.words === "object" && v.words !== null;
}

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
type Point = readonly [number, number];

/** A line in page units, from the top of the copy to its bottom. */
function decode(line: WireLine, box: Box): Point[] {
  const left = box.x;
  const top = box.y - LETTER_PAD;
  const bottom = box.y + box.height + LETTER_PAD;
  if (typeof line === "number") {
    const x = left + line / 10;
    return [[x, top], [x, bottom]];
  }
  let x = left + (line[0] ?? 0) / 10;
  let y = top;
  const pts: Point[] = [[x, y]];
  for (let k = 1; k + 1 < line.length; k += 2) {
    y += (line[k] ?? 0) / 10;
    x += (line[k + 1] ?? 0) / 10;
    pts.push([x, y]);
  }
  if (y < bottom) pts.push([x, bottom]);
  return pts;
}

/**
 * Each letter's outline on the page, right to left, as a closed list of points
 * in page units; empty when the data has no letters for this word. Letter i
 * lies between line i−1 and line i; the first and last reach the copy's edges.
 */
export function lettersOfWord(shard: LetterShard, ayah: string, word: number, box: Box): Point[][] {
  const lines = shard.words[ayah]?.[String(word)];
  if (!lines || lines.length === 0) return [];
  const top = box.y - LETTER_PAD;
  const bottom = box.y + box.height + LETTER_PAD;
  const right: Point[] = [[box.x + box.width + LETTER_PAD, top], [box.x + box.width + LETTER_PAD, bottom]];
  const leftEdge: Point[] = [[box.x - LETTER_PAD, top], [box.x - LETTER_PAD, bottom]];
  const bounds = [right, ...lines.map((l) => decode(l, box)), leftEdge];
  const out: Point[][] = [];
  for (let i = 0; i + 1 < bounds.length; i += 1) {
    // Down the right-hand line, back up the left-hand one.
    out.push([...bounds[i]!, ...[...bounds[i + 1]!].reverse()]);
  }
  return out;
}
