/**
 * The marks inside a word, on our frame.
 *
 * `build-words.mjs` ships one rectangle per word. This reads the level below
 * it: the fatha, the shadda, the superscript alef — the twenty-six things the
 * ligature corpus names in `data-diacritic`, each with its own exact box, each
 * attached to the word it sits on.
 *
 * ## Why this is a lib and not a script
 *
 * It has two callers with different appetites. `probe-encodings.mjs` wants the
 * marks for one page at a time, to draw them and check the tajweed spans
 * against them, and ships nothing. `build-words.mjs` will eventually want all
 * 604 to write shards. Those are the same extraction and must stay the same
 * extraction, for the reason `mushaf-frame.mjs`'s header gives about itself: if
 * the inspector's boxes and the shipped boxes came from two implementations,
 * looking at the inspector would stop being evidence about what gets shipped,
 * which is the only reason to look at it.
 *
 * ## Nothing here fits anything
 *
 * `apply` is handed in. The transform from their frame to ours is fitted once
 * per page by `build-words.mjs` and recorded in `word-boxes.pin.json`, so a
 * caller reconstitutes it from four committed numbers rather than re-deriving
 * it from the ornaments. Re-fitting here would create a second transform that
 * could disagree with the one the word boxes were built with, and a mark that
 * disagrees with its own word by a tenth of a unit is indistinguishable from a
 * mark on the wrong letter.
 *
 * ## The containment invariant
 *
 * A word's box in the shards is `union(pathBBox(d))` over **every** path in the
 * word's segment — the letters and the marks alike. So a mark's box is inside
 * its word's box by construction, exactly, before rounding. That is not a
 * pleasing coincidence; it is the check that makes this data verifiable
 * offline. A mark that escapes its word's box cannot be a geometry error,
 * because the geometry is a subset of the geometry the word box was computed
 * from — it can only be an *alignment* error, a mark filed under the wrong
 * word. Which is the failure mode worth catching, and the one that produced the
 * off-by-one behind `gate:edges`.
 */
import { isDiacriticName, diacriticId } from "@hifth/core";

import { pathBBox } from "./mushaf-frame.mjs";

/**
 * Where a word ends. The same boundary `readTheirs` uses, and it has to be:
 * this walks the same document with the same idea of where a word's paths stop,
 * so the marks it collects for word *n* are the paths that went into word *n*'s
 * box.
 */
const BOUNDARY = /<g id="md-(?:line|word|aya-mark)-/;

const PATHS = /<path\b[^>]*\/>/g;

/**
 * Where a ligature ends. The corpus nests one level below a word:
 *
 *     <g id="md-word-005" data-hafs="…" data-imlaey="ذلك">
 *       <g id="md-ligature-005-01">
 *         <path data-type="text" data-text="ذ" d="…"/>
 *         <g id="md-diacritic-005-01">
 *           <path data-type="diacritic" data-diacritic="fatha" d="…"/>
 *
 * so a mark is not merely *in* a word, it is drawn **on named letters** — and
 * that is the only join in this corpus between a mark and a codepoint. The
 * split is a lookahead rather than a close-tag match because the segment is
 * already bounded by the word above it and `<g>` nesting is not parseable by
 * regex; the same trade `readTheirs` makes.
 */
const LIGATURES = /<g id="md-ligature-\d+-(\d+)">([\s\S]*?)(?=<g id="md-ligature-|$)/g;

/**
 * One attribute off a tag.
 *
 * The leading `\s` is not decoration and was not free: without it, asking for
 * `d` matches the tail of `id="md-path-002-01-02"` and every box in the corpus
 * comes back `[Infinity, …, -Infinity, …]`. `readTheirs` has always had it;
 * this had to learn it.
 */
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null;

const round = (n) => Math.round(n * 10) / 10;

const unescapeXml = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

/** The marks drawn inside one ligature's group, in document order. */
function marksIn(seg, apply) {
  const marks = [];
  for (const p of seg.matchAll(PATHS)) {
    const name = attr(p[0], "data-diacritic");
    if (name === null) continue;
    if (!isDiacriticName(name)) {
      // A name @hifth/core has never heard of is a corpus that grew, and the
      // only safe response is to stop. Emitting it under a made-up id would
      // write geometry nothing can name; skipping it would silently drop a
      // mark from a page and look like the print simply has fewer.
      throw new Error(
        `data-diacritic="${name}" on ${attr(p[0], "id")} is not in DIACRITICS. ` +
          "Append it to packages/core/src/diacritics.ts — append, never reorder, " +
          "because an id is only meaningful against that array's order.",
      );
    }
    const d = attr(p[0], "d");
    if (d === null) continue;
    const [x0, y0, x1, y1] = apply(pathBBox(d));
    marks.push([diacriticId(name), round(x0), round(y0), round(x1 - x0), round(y1 - y0)]);
  }
  return marks;
}

/**
 * Every named mark on the page, grouped by word and by the ligature inside it.
 *
 * Returns one entry per `<g id="md-word-…">` the page carries, in the same
 * order `readTheirs().words` returns them, so a caller can zip the two without
 * a join. Each entry is
 *
 *     { surah, aya, idx, hafs, imlaey, ligatures, marks }
 *
 * where `idx` is the print's `data-word-index-in-ayah` — the same index the
 * word shards' `from` counts from, and emphatically not QAC's (see
 * `build-words.mjs` on the 4,499 ayahs where the two segmentations disagree).
 *
 * A mark is `[id, x, y, w, h]`, `id` indexing `DIACRITICS`, the box already
 * through `apply` and rounded to a tenth of a viewBox unit — the same precision
 * the word boxes ship at, and the smallest mark in the corpus is 1.42 × 1.64
 * units in their frame (≈1.9 × 2.2 in ours), so a tenth cannot round one away.
 *
 * ## Why the ligatures are returned and not just flattened
 *
 * `marks` is the flat concatenation and is what a shard would carry: an app
 * painting a mark needs a rectangle and a name, not a letter. `ligatures` is
 * for the instrument rather than the asset. Each is `{ text, marks }`, `text`
 * being the ligature's own `data-text` — the letters it draws — and that is the
 * **only** join this corpus offers between a mark and a codepoint. Without it a
 * mark is a rectangle inside a word and a tajweed offset can be resolved no
 * finer than the word; with it, a word's letters are partitioned across its
 * ligatures and each partition carries its own marks in order.
 *
 * The join is measured rather than assumed — `probe-diacritics.mjs` ④ reports
 * how often a ligature's mark count equals the mark-bearing codepoints of the
 * letters it draws, and names what is left. Nothing here acts on it; a caller
 * that wants the correspondence reads both fields and does its own arithmetic,
 * because the residual is the interesting part and swallowing it inside an
 * extractor would hide it.
 *
 * @param {string} svg   a ligature-corpus page, verbatim
 * @param {(b: number[]) => number[]} apply  their frame → ours
 */
export function readDiacritics(svg, apply) {
  const out = [];
  for (const m of svg.matchAll(/<g id="md-word-(\d+)"([^>]*)>/g)) {
    const rest = svg.slice(m.index + m[0].length);
    const nxt = rest.match(BOUNDARY);
    const seg = nxt ? rest.slice(0, nxt.index) : rest;

    const ligatures = [];
    for (const g of seg.matchAll(LIGATURES)) {
      ligatures.push({
        text: unescapeXml(attr(g[2], "data-text") ?? ""),
        marks: marksIn(g[2], apply),
      });
    }

    // Not `ligatures.flatMap` for its own sake: a mark drawn under a word but
    // outside every ligature group would be dropped by that, and dropping a
    // mark silently is the one thing this file exists not to do. Scanning the
    // whole segment keeps the flat list authoritative, and ④'s ligature check
    // is what would notice the two disagreeing.
    const marks = marksIn(seg, apply);

    out.push({
      surah: Number(attr(m[2], "data-surah")),
      aya: Number(attr(m[2], "data-aya")),
      idx: Number(attr(m[2], "data-word-index-in-ayah")),
      hafs: unescapeXml(attr(m[2], "data-hafs") ?? ""),
      imlaey: unescapeXml(attr(m[2], "data-imlaey") ?? ""),
      ligatures,
      marks,
    });
  }
  return out;
}

/**
 * The same marks, as the outlines that drew them, in their own frame.
 *
 * `readDiacritics` returns rectangles, because a rectangle is what a shard
 * carries and what an app paints. It is also, on its own, unable to answer the
 * one question `sub-word-marks.md` §⑦ leaves open — whether the ink a reader
 * sees is under the rectangle — because a rectangle has no shape and the check
 * needs one. The publisher already drew every mark; this hands that drawing
 * back, so a caller can put the mark's own outline over the print we ship and
 * compare the two directly.
 *
 * Returned flat, in the same document order as
 * `readDiacritics(svg, …).flatMap((w) => w.marks)`, and **deliberately not**
 * bundled into that return. Two reasons: the outlines are a hundred megabytes
 * across the corpus and every existing caller wants none of them; and a caller
 * that reads both can assert the two agree — same length, and each outline's own
 * box equal to the box the other side reported — which turns "these are the same
 * marks" from a comment into a check. `probe-mark-ink.mjs` makes exactly that
 * assertion on every page it reads.
 *
 * The constants are shared with the extractor above rather than re-declared,
 * which is the only thing that makes the assertion meaningful: two walks with
 * two ideas of where a word ends would agree about nothing worth agreeing about.
 *
 * @param {string} svg a ligature-corpus page, verbatim
 * @returns {{ name: string, d: string }[]}
 */
export function readMarkOutlines(svg) {
  const out = [];
  for (const m of svg.matchAll(/<g id="md-word-(\d+)"([^>]*)>/g)) {
    const rest = svg.slice(m.index + m[0].length);
    const nxt = rest.match(BOUNDARY);
    const seg = nxt ? rest.slice(0, nxt.index) : rest;
    for (const p of seg.matchAll(PATHS)) {
      const name = attr(p[0], "data-diacritic");
      if (name === null) continue;
      const d = attr(p[0], "d");
      if (d === null) continue;
      out.push({ name, d });
    }
  }
  return out;
}

/**
 * `ours = s·theirs + t`, rebuilt from the four numbers `word-boxes.pin.json`
 * records for a page.
 *
 * A copy of `build-words.mjs`'s `applier` in shape but not in role: that one
 * closes over a fit that just happened, this one over a fit that happened once
 * and was written down. Both exist so that nobody hand-multiplies the numbers
 * at a call site, which is where a sign or an axis gets swapped.
 */
export const applierFromPin = (row) => (b) => [
  row.sx * b[0] + row.tx,
  row.sy * b[1] + row.ty,
  row.sx * b[2] + row.tx,
  row.sy * b[3] + row.ty,
];
