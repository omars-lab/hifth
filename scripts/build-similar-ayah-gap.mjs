#!/usr/bin/env node
/**
 * Draws the options for `similar-ayah-enrichment`: whether the app's set of
 * look-alike verse pairs should take in the whole-verse twins the outside
 * measuring library knows about and the app does not — as bare verse numbers,
 * no Qur'an text — even though we decided (qul-reliance) to copy nothing from
 * that library.
 *
 * Every specimen is the real printed page with real geometry over it. The
 * verses are cut out of the mus'haf artwork the app already ships (the same
 * `WordIndex` the app itself calls), never retyped. The counts in the prose
 * come straight out of the checked-in measurement pin, so any number on the
 * page can be re-derived by rebuilding that pin.
 *
 * Two things this generator will NOT do, on purpose:
 *
 *   1. It never applies the library's own word ranges to our artwork. The
 *      library counts words more coarsely than the print does (a verse the
 *      print draws in 17 words the library counts as 15), so borrowing its
 *      per-word ranges would silently colour the wrong words. Where a
 *      differing word is marked below, its index was found by eye against the
 *      page and written into this file by hand — not read from the library.
 *   2. It draws only pairs a human has looked at on the page and confirmed.
 *      The library scores some pairs a full match that in fact differ by a
 *      word; those belong in the "but for a word" group, not the "word for
 *      word" one, and only an eye can tell them apart.
 *
 *   node scripts/build-similar-ayah-gap.mjs
 *
 * Registered in docs/decisions.json as the `builtBy` for
 * similar-ayah-enrichment; the reasons live in
 * docs/decisions/similar-ayah-enrichment.md.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import { WordIndex } from "../packages/core/dist/index.js";

const ASSETS = join(ROOT, "apps/web/public/assets");
const WORDS = join(ASSETS, "words/hafs-kfqc");
const OUT = join(ROOT, "docs/design/similar-ayah-enrichment.html");
const PIN = join(ROOT, "packages/etl/data/qul/qul-rulers.probe.json");

/** Where the checked-in copy reaches the print from, relative to docs/design/. */
const PRINT_HREF = (page) => `../../apps/web/public/assets/pages/hafs-kfqc/${page}.svg`;

/** Breathing room around a crop, in page units — about a letter's width. */
const PAD = 2;

/**
 * The twins to draw, each one looked at on the printed page and confirmed.
 *
 * `same` — word for word identical wherever they sit in the mus'haf. Drawn
 * with the whole verse washed green: every word is shared.
 *
 * `nearly` — the same but for a word or two. Drawn clean, with the differing
 * word marked yellow where a single word carries the whole difference. Each
 * marked index was read off the page by eye (see the header note); none came
 * from the outside library's numbering.
 */
// Each of these was looked at on the page — with the neighbouring verses faded,
// so a word belonging to the verse before or after is not mistaken for the
// verse's own. (61:9 and 9:33 both sit right after a verse ending in the same
// word, which reads as a difference until the neighbour is faded and it is
// plainly the same verse.)
const SAME = [
  ["2:134", "2:141"],
  ["11:110", "41:45"],
  ["22:62", "31:30"],
  ["2:122", "2:47"],
  ["21:41", "6:10"],
  ["24:5", "3:89"],
  ["36:46", "6:4"],
  ["61:9", "9:33"],
];

const NEARLY = [
  {
    pair: ["2:136", "3:84"],
    note: "The same profession of faith. They part in the middle, and over more than one word — which is exactly what the app cannot mark on these without doing its own word-by-word alignment first.",
  },
  {
    pair: ["16:115", "2:173"],
    note: "The same list of what is forbidden to eat, in a different order and opening. Again the resemblance is plain; where they diverge is not something the library's numbering can mark for us.",
  },
];

// ---------------------------------------------------------------- geometry

const shardCache = new Map();
function indexOf(page) {
  if (!shardCache.has(page)) {
    try {
      shardCache.set(page, new WordIndex(JSON.parse(readFileSync(join(WORDS, `${page}.json`), "utf8"))));
    } catch {
      shardCache.set(page, null);
    }
  }
  return shardCache.get(page);
}

// verse key -> page, built once from the shipped word geometry.
const v2p = new Map();
for (const f of readdirSync(WORDS)) {
  if (!f.endsWith(".json")) continue;
  const d = JSON.parse(readFileSync(join(WORDS, f), "utf8"));
  for (const k of Object.keys(d.words ?? {})) if (!v2p.has(k)) v2p.set(k, d.page);
}

function unionOf(rs) {
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  for (const q of rs) {
    l = Math.min(l, q.x);
    t = Math.min(t, q.y);
    r = Math.max(r, q.x + q.width);
    b = Math.max(b, q.y + q.height);
  }
  return { x: l, y: t, width: r - l, height: b - t };
}

function printSize(page) {
  const vb = readFileSync(join(ASSETS, `pages/hafs-kfqc/${page}.svg`), "utf8").match(/viewBox="([^"]+)"/);
  const [, , w, h] = vb[1].split(/\s+/).map(Number);
  return { w, h };
}

// ----------------------------------------------------------------- drawing

const n = (v) => Number(v.toFixed(2));
const vb = (r) => `${n(r.x)} ${n(r.y)} ${n(r.width)} ${n(r.height)}`;
const box = (r) => `M${n(r.x)} ${n(r.y)}H${n(r.x + r.width)}V${n(r.y + r.height)}H${n(r.x)}Z`;
const wash = (cls, r) =>
  `<rect class="${cls}" x="${n(r.x - 0.5)}" y="${n(r.y - 0.5)}" width="${n(r.width + 1)}" height="${n(r.height + 1)}" rx="1"></rect>`;

/**
 * One verse, cut out of its printed page. Neighbours that the crop rectangle
 * catches are faded (the same treatment the app itself uses). `green` washes
 * the whole verse; `mark` washes named words yellow.
 */
function crop(key, { green = false, mark = null } = {}) {
  const page = v2p.get(key);
  const idx = indexOf(page);
  const sp = idx.span(key);
  const bands = idx.bandsFor(key, sp.from, sp.to);
  const u = unionOf(bands);
  const frame = { x: u.x - PAD, y: u.y - PAD, width: u.width + PAD * 2, height: u.height + PAD * 2 };
  const { w, h } = printSize(page);
  const holes = bands.map((b) => box({ x: b.x - 1, y: b.y - 1, width: b.width + 2, height: b.height + 2 }));
  const greens = green ? bands.map((r) => wash("w-share", r)).join("") : "";
  const yellows = mark ? mark.map((i) => idx.boxOf(key, i)).filter(Boolean).map((r) => wash("w-diff", r)).join("") : "";
  return (
    `<svg class="art" viewBox="${vb(frame)}" aria-hidden="true" focusable="false">` +
    `<image href="${PRINT_HREF(page)}" x="0" y="0" width="${w}" height="${h}"></image>` +
    `<path class="scrim" d="${box(frame)}${holes.join("")}" fill-rule="evenodd"></path>` +
    greens +
    yellows +
    `</svg>`
  );
}

function twinPanel([a, b], opts = {}) {
  const marks = opts.mark ?? {};
  const one = (k) => `<figure class="crop"><figcaption>${k}</figcaption>${crop(k, { green: opts.green, mark: marks[k] })}</figure>`;
  const note = opts.note ? `<p class="note">${esc(opts.note)}</p>` : "";
  return `<div class="pair">${one(a)}${one(b)}${note}</div>`;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ------------------------------------------------------------------- numbers

const pin = JSON.parse(readFileSync(PIN, "utf8"));
const S = pin.similarity;
const G = S.corpus74.gap;
const num = (x) => x.toLocaleString("en-US");

// ---------------------------------------------------------------------- page

const sameGallery = SAME.map((p) => twinPanel(p, { green: true })).join("\n");
const nearGallery = NEARLY.map((t) => twinPanel(t.pair, { mark: t.mark, note: t.note })).join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>The look-alikes the app does not connect</title>
<style>
  :root {
    --paper: #f7f4ee; --paper-raised: #fffdf8; --ink: #26201a; --ink-soft: #5c5348;
    --hair: #e4ddd0; --green: #3f7d43; --yellow: #a8791d; --accent: #17544d;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink);
    font: 16px/1.6 "Iowan Old Style", Palatino, Georgia, serif; }
  main { max-width: 760px; margin: 0 auto; padding: 2.5rem 1.25rem 5rem; }
  h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 0.5rem; }
  h2 { font-size: 1.3rem; margin: 2.6rem 0 0.6rem; }
  .standfirst { font-size: 1.15rem; color: var(--ink-soft); margin: 0 0 1.5rem; }
  p { margin: 0 0 1rem; }
  b { color: var(--ink); }
  .glossary { background: var(--paper-raised); border: 1px solid var(--hair);
    border-radius: 10px; padding: 0.6rem 1rem; margin: 1.5rem 0; }
  .glossary dt { font-weight: 600; margin-top: 0.5rem; }
  .glossary dd { margin: 0 0 0.2rem; color: var(--ink-soft); }
  .stat { display: flex; flex-wrap: wrap; gap: 1.4rem; margin: 1.2rem 0; }
  .stat div { flex: 1 1 8rem; }
  .stat .big { font-size: 2rem; font-weight: 700; color: var(--accent); line-height: 1; }
  .stat .cap { font-size: 0.9rem; color: var(--ink-soft); }
  .gallery { display: grid; grid-template-columns: 1fr; gap: 1.4rem; margin: 1.4rem 0; }
  .pair { background: var(--paper-raised); border: 1px solid var(--hair);
    border-radius: 10px; padding: 0.9rem; }
  .crop { margin: 0 0 0.6rem; }
  .crop:last-of-type { margin-bottom: 0; }
  .crop figcaption { font: 0.85rem monospace; color: var(--ink-soft); margin-bottom: 0.25rem; }
  .art { display: block; width: 100%; height: auto; background: #fff;
    border: 1px solid var(--hair); border-radius: 4px; }
  .note { font-size: 0.95rem; color: var(--ink-soft); margin: 0.6rem 0 0; }
  .scrim { fill: var(--paper); opacity: 0.72; }
  .w-share { fill: rgba(63, 125, 67, 0.16); stroke: var(--green);
    stroke-width: 0.3; vector-effect: non-scaling-stroke; }
  .w-diff { fill: rgba(198, 141, 20, 0.22); stroke: var(--yellow);
    stroke-width: 0.3; vector-effect: non-scaling-stroke; }
  .swatch { display: inline-block; width: 0.8em; height: 0.8em; border-radius: 2px;
    vertical-align: -1px; margin-right: 0.15em; }
  .options { list-style: none; padding: 0; margin: 1.2rem 0; }
  .options > li { background: var(--paper-raised); border: 1px solid var(--hair);
    border-radius: 10px; padding: 0.9rem 1.1rem; margin-bottom: 0.9rem; }
  .options .lbl { font-weight: 700; }
  .options .tag { font: 0.8rem monospace; color: var(--ink-soft); }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--hair);
    font-size: 0.9rem; color: var(--ink-soft); }
</style>
</head>
<body>
<main>
  <h1>The look-alikes the app does not connect</h1>
  <p class="standfirst">A separate library of Qur'an data, used here only as a measuring stick,
  knows of hundreds of verse pairs that are the same verse in two places. The app's own set of
  look-alikes barely overlaps them. This page asks whether those pairs should be brought in —
  and shows you the ones that are missing.</p>

  <dl class="glossary">
    <dt>mus'haf</dt><dd>The printed Qur'an, page by page, as the reader sees it.</dd>
    <dt>verse</dt><dd>One āyah. The app names each one by its sūra and number, e.g. 2:134.</dd>
    <dt>look-alike</dt><dd>Two verses close enough to be confused in memorisation — the thing a
      hafiz most needs a bridge between. The tradition calls these the mutashābihāt.</dd>
    <dt>the outside library</dt><dd>A public collection of Qur'an data the app measures itself
      against but, by an earlier decision, copies nothing from.</dd>
  </dl>

  <h2>What is being decided?</h2>
  <p>The app carries a set of look-alike verse pairs, and offers the reader a bridge from one to
  the other. That set was built from recurring phrases. The outside library holds a different
  kind of look-alike — whole verses repeated, word for word, in two places — and the two sets
  hardly overlap. <b>Should the app take the library's whole-verse pairs in, as bare verse
  numbers and no Qur'an text, so a reader on one is offered the other?</b></p>

  <h2>Why is this being asked now?</h2>
  <p>The library was brought in as a ruler — a way to check the app's own numbers. Held up
  against it, the app's look-alike set turned out to cover almost none of the library's
  whole-verse twins. That is not a bug in either set; they were built to catch different things.
  But it means a reader standing on one of these twins is shown nothing about the other, and the
  measurement is what surfaced it.</p>

  <h2>What happens if nobody decides?</h2>
  <p>Nothing breaks. The app keeps working exactly as it does today, and the reader is simply
  not told about these particular twins. The cost is quiet and real: these are among the hardest
  verses to keep apart, and the bridge the app is for is precisely the one it is not offering
  here. Nothing else is blocked behind this — it can sit open at no cost to anything else.</p>

  <h2>What does the app do today, and what is it costing?</h2>
  <div class="stat">
    <div><div class="big">${num(S.ourEdges)}</div><div class="cap">look-alike links the app ships today</div></div>
    <div><div class="big">${S.corpus74.oursCorroboratedPct}%</div><div class="cap">of them the outside library also knows</div></div>
    <div><div class="big">${num(G.strongMisses)}</div><div class="cap">strong look-alikes the library has that the app lacks</div></div>
    <div><div class="big">${num(G.verbatimMisses)}</div><div class="cap">of those scored a full word-for-word match</div></div>
  </div>
  <p>The app's set and the library's set describe the same danger from two sides and meet in
  almost none of the same pairs. The library scores <b>${num(G.verbatimMisses)}</b> pairs as a
  full match, across <b>${num(G.versesTouched)}</b> verses. Looked at on the page, these are the
  same verse in two places — sometimes identical throughout, sometimes with one side carrying an
  extra word or phrase the other does not. The rest of the library's extra pairs —
  <b>${num(G.shortNoise)}</b> of them — are short coincidences a reader would never confuse, and
  are left out of these counts.</p>

  <h2>What do the missing twins look like?</h2>
  <p>Each verse below is cut straight out of the printed page, at the size the app would show it.
  Nothing is retyped, and the neighbouring verses the crop catches are faded so only the verse
  itself reads clearly. <span class="swatch" style="background:rgba(63,125,67,.16);border:1px solid var(--green)"></span>
  green means the app has confirmed, on the page, that the two verses are word for word the
  same.</p>

  <h2>Word for word the same, in two places</h2>
  <p>The app connects none of these today. Each pair is one verse, printed twice, pages apart.</p>
  <div class="gallery">
${sameGallery}
  </div>

  <h2>Nearly the same</h2>
  <p>These resemble each other closely but are not identical. The app can show that they are
  alike — that is what the crops below do — but it cannot mark <em>where</em> they part without
  first working out, word by word, which word on one page answers to which on the other. The
  library's own word numbering will not do that job: it counts a verse's words more coarsely than
  the printed page draws them (a verse the page sets in seventeen words the library counts as
  fifteen), so its marks would land on the wrong words. That mismatch is the whole reason the
  last option below costs what it does.</p>
  <div class="gallery">
${nearGallery}
  </div>

  <h2>What have we already decided that touches this?</h2>
  <p>One decision rules most of this space, and this page cannot pretend otherwise. The app
  settled that when it leans on the outside library it <b>copies none of its bytes</b> — it
  measures against the library and links out to it, and it turned down even copying the
  library's bare layout numbers. Taking the library's look-alike pairs in — even as nothing but
  verse numbers — would reopen that decision. So the real question here is narrower and more
  honest than "should we add these pairs": it is <b>whether these twins are worth reopening the
  copy-nothing boundary for.</b> The decision this page belongs to is recorded as related to
  that one, in both directions.</p>
  <p>A second decision settles how a look-alike is <em>shown</em> once the app has it: both
  verses cut from the page, the shared words marked, the differing words marked. Whatever is
  taken in here would flow into that display — which is what makes the word-numbering mismatch
  above a real cost and not a footnote.</p>

  <h2>So what are the options?</h2>
  <ul class="options">
    <li>
      <div><span class="lbl">A — Leave the set as it is.</span> <span class="tag">status quo</span></div>
      <p>Keep the copy-nothing boundary whole. The app connects the look-alikes it built itself
      and stays silent about the library's twins. Costs nothing to build; the
      ${num(G.verbatimMisses)} twins above stay unconnected.</p>
    </li>
    <li>
      <div><span class="lbl">B — Take in the pair numbers only, and show a whole-verse resemblance.</span></div>
      <p>Bring in the library's twins as bare verse-number pairs — no Qur'an text, no fonts, no
      layout. A reader on one twin is offered the other, drawn from the app's own printed pages.
      Reopens the copy-nothing boundary the smallest amount that closes the gap. What it does not
      give: the word-by-word green/yellow marking, because the library's word numbers do not line
      up with the print, so the app would show that these two resemble each other without marking
      where they part.</p>
    </li>
    <li>
      <div><span class="lbl">C — Take in the pairs and align the words ourselves.</span></div>
      <p>As B, plus the app works out the word-by-word correspondence on its own printed pages,
      so the shared-and-differing marking works on these twins exactly as it does on the ones the
      app built itself. Full parity with the existing display; the most work, and the marking has
      to be checked by eye where a verse's word count differs between the page and the library.</p>
    </li>
  </ul>

  <h2>What else could be considered, and why is it not here?</h2>
  <p>The app could try to find these twins itself, without the library at all. It cannot: the app
  ships no Qur'an text — only anonymous page artwork and numbers — so it has nothing to compare
  word against word. Finding whole-verse twins needs a text-bearing collection computed
  somewhere else, and the library is one. Copying the library's verified text and fonts in
  wholesale was considered when the boundary was first drawn and turned down; it is not revived
  here.</p>

  <h2>What would change the answer?</h2>
  <p>If the app ever gained a text-bearing collection of its own — for any other reason — the
  twins could be computed in-house and the boundary would not need reopening at all. If the
  word-by-word alignment turns out cheap and reliable, C stops being expensive relative to B, and
  the choice collapses to "reopen the boundary or not."</p>

  <h2>What is this not settling?</h2>
  <p>Not whether a verse should announce on the page you are reading that it resembles others —
  that is a separate question about the reading surface. Not the exact shape the imported numbers
  would take. And not the copy-nothing boundary in general: this asks only whether these twins
  are the exception worth making, not whether the boundary was right.</p>

  <footer>
    <p>Built by <code>scripts/build-similar-ayah-gap.mjs</code> over the checked-in measurement
    pin and the shipped page artwork. Every count re-derives from the pin; every crop is the real
    page. Reasons in full: <code>docs/decisions/similar-ayah-enrichment.md</code>.</p>
    <p>This page's address on the site:
    <a href="https://blog.bytesofpurpose.com/hifth/docs/design/similar-ayah-enrichment.html">blog.bytesofpurpose.com/hifth/docs/design/similar-ayah-enrichment.html</a></p>
  </footer>
</main>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log(`wrote ${OUT.replace(ROOT, "")}  (${SAME.length} verbatim twins, ${NEARLY.length} near-twins drawn)`);
