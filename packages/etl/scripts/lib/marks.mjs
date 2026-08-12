/**
 * One row per mark on a page, with the outline that drew it.
 *
 * This used to live inside the placement probe. It moved here the moment a
 * second tool needed the same rows — the adjudication page, which draws marks
 * for a person to judge and must draw *exactly* the marks the probe measured or
 * the judgement is about something else. Two walks over the same cache is the
 * way a pair like this rots: something gets added to one and not the other, and
 * the two disagree for a season before anybody notices.
 *
 * The two readers below are still called side by side and checked against each
 * other. They share their constants, so this is not a test that they parse XML
 * the same way — it is a test that nothing has been added to one walk and not
 * the other.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DIACRITICS } from "@hifth/core";
import { applierFromPin, readDiacritics, readMarkOutlines } from "./diacritics.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ETL = join(HERE, "..", "..");
const CACHE = join(ETL, "data", "pages", ".cache", "words");
const PIN = JSON.parse(readFileSync(join(ETL, "data", "pages", "word-boxes.pin.json"), "utf8"));

const pad3 = (n) => String(n).padStart(3, "0");

/** The ligature-corpus page for `p`, which is the print every mark is read from. */
export const markPageFile = (p) => join(CACHE, `${pad3(p)}.svg`);

/** Which pages of that corpus are on this machine. It is a cache, so it may be partial. */
export function cachedMarkPages() {
  const out = [];
  for (let p = 1; p <= 604; p += 1) if (existsSync(markPageFile(p))) out.push(p);
  return out;
}

/**
 * The fit recorded for a page — `ours = s · theirs + t`, the four numbers the
 * word boxes were placed by. Every mark rectangle on the page is placed by this
 * same transform, which is why a displacement in it is a displacement in
 * shipped word geometry too and not only in the marks.
 */
export function fitOf(p) {
  const row = PIN.pages.find((r) => r.page === p);
  if (!row) throw new Error(`no fit recorded for page ${p}`);
  return row;
}

export function marksOf(p) {
  const svg = readFileSync(markPageFile(p), "utf8");
  const row = fitOf(p);
  const words = readDiacritics(svg, applierFromPin(row));
  const outlines = readMarkOutlines(svg);
  const flat = [];
  for (const w of words) {
    for (let k = 0; k < w.marks.length; k += 1) flat.push({ w, m: w.marks[k] });
  }
  if (flat.length !== outlines.length) {
    throw new Error(`page ${p}: ${flat.length} marks but ${outlines.length} outlines`);
  }
  const rows = flat.map((e, k) => {
    const [id, x, y, wd, ht] = e.m;
    if (DIACRITICS[id] !== outlines[k].name) {
      throw new Error(`page ${p} mark ${k}: box says ${DIACRITICS[id]}, outline says ${outlines[k].name}`);
    }
    return {
      page: p,
      k,
      id,
      name: DIACRITICS[id],
      box: [x, y, wd, ht],
      d: outlines[k].d,
      lig: outlines[k].lig,
      surah: e.w.surah,
      aya: e.w.aya,
      idx: e.w.idx,
      hafs: e.w.hafs,
      fit: row,
    };
  });

  // Where a mark stands among the ones it could be mistaken for: same ligature,
  // same name. Counted right to left, because that is the order the letters are
  // read in and therefore the only order a sentence naming one of them can use.
  //
  // This is identification and not position. A tool that shows somebody a crop of
  // print and asks where a mark belongs has to be able to say WHICH mark, and
  // "the fatha" is not an answer on letters carrying two of them. Saying "the
  // second from the right" costs nothing that matters: it separates two
  // candidates a whole letter apart, and the thing being measured is a fraction
  // of a letter.
  //
  // The ligature and not the word, even though the word is the more obvious unit,
  // because a rank is only followable over a group the reader can see all of. A
  // word can run past the edge of a crop, and "the third of three" counted over
  // letters half of which are off-screen is worse than saying nothing. The
  // ligature is the group a tool can point at — it is what `lig.letters` draws —
  // so it is the group the counting has to match. Marks the corpus drew inside no
  // ligature fall back to their word, which is the widest group still true of
  // them.
  //
  // Keyed by the ligature object itself: `ligaturesByMark` hands every mark in
  // one ligature the same object, so identity is the grouping, with no key to
  // spell and nothing to collide.
  const peers = new Map();
  for (const r of rows) {
    const scope = r.lig ?? `${r.surah}:${r.aya}:${r.idx}`;
    const key = `${r.name}`;
    if (!peers.has(scope)) peers.set(scope, new Map());
    const byName = peers.get(scope);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(r);
  }
  for (const byName of peers.values()) {
    for (const group of byName.values()) {
      const order = [...group].sort((a, b) => b.box[0] - a.box[0]);
      order.forEach((r, i) => {
        r.nth = i + 1;
        r.of = order.length;
      });
    }
  }
  return rows;
}
