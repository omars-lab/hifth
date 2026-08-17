#!/usr/bin/env node
/**
 * Draws the options for `comparison-crop`: what the look-alike panel should
 * show *around* an ayah, now that it cuts both ayahs out of the printed page
 * instead of retyping them.
 *
 * Every specimen on the page is the real artwork with real geometry over it.
 * Nothing here is a mock-up and nothing is transcribed: the bands, the washes
 * and the shared range all come out of the same `WordIndex`/`divergentRuns`
 * the app itself calls, and the measurement in the prose is computed by this
 * script over every edge in the shipped adjacency shards. An options page that
 * argued from a hand-drawn diagram would be arguing about a different picture
 * than the one the reader is being asked to judge.
 *
 * Two copies, and one run writes both — the same rule as the placement page,
 * for the same reason. They differ in exactly one thing: where the picture of
 * the mus'haf comes from.
 *
 * The checked-in copy points at the print with a relative URL, which is right
 * for somebody who opens the file inside a checkout and keeps it to a few tens
 * of KB. The published copy cannot do that — it is served from claude.ai under
 * a CSP that blocks every external host, so a relative URL resolves to nothing
 * and every specimen is an empty overlay over blank paper. That copy inlines
 * each page ONCE into a hidden `<defs>` and `<use>`s it per specimen. Writing
 * both from one pass removes the only state in which the repo can lie about
 * what was published.
 *
 *   node scripts/build-crop-options.mjs
 *
 * Registered in docs/decisions.json as the `builtBy` for comparison-crop; the
 * reasons live in docs/decisions/comparison-crop.md.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import { WordIndex, divergentRuns } from "../packages/core/dist/index.js";

const ASSETS = join(ROOT, "apps/web/public/assets");
const OUT = join(ROOT, "docs/design/comparison-crop.html");
const OUT_ARTIFACT = join(ROOT, "docs/design/comparison-crop.artifact.html");

/** Where the checked-in copy reaches the print from, relative to docs/design/. */
const PRINT_HREF = (page) => `../../apps/web/public/assets/pages/hafs-kfqc/${page}.svg`;

const COPIES = [
  { artifact: false, out: OUT },
  { artifact: true, out: OUT_ARTIFACT },
];

/** The pair every specimen is drawn on, and the words the two have in common. */
const SHARED = [1, 13];
const SIDES = [
  { key: "2:48", page: 7, label: "البقرة · ٢:٤٨ · هنا", wash: "a" },
  { key: "2:123", page: 19, label: "البقرة · ٢:١٢٣", wash: "b" },
];

/** The panel's own padding around a crop, in page units — mirrors DiffView. */
const PAD = 2;

// ---------------------------------------------------------------- geometry

const shardCache = new Map();
function indexOf(page) {
  if (!shardCache.has(page)) {
    try {
      const raw = readFileSync(join(ASSETS, `words/hafs-kfqc/${page}.json`), "utf8");
      shardCache.set(page, new WordIndex(JSON.parse(raw)));
    } catch {
      shardCache.set(page, null);
    }
  }
  return shardCache.get(page);
}

const areaOf = (rs) => rs.reduce((n, r) => n + r.width * r.height, 0);

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

/**
 * The measurement the page is built on: for every side of every look-alike pair
 * the panel can draw, how much of the rectangle it actually draws belongs to
 * the ayah it names.
 *
 * Clamped at 1: a handful of sides score fractionally over 100% because two
 * adjacent lines' bands overlap slightly where letters descend, and a number
 * above 100 in a share column reads as a bug rather than as the rounding it is.
 * The page says so in its own prose rather than hiding it here.
 */
function sweep() {
  const shares = [];
  let pairs = 0;
  for (const file of readdirSync(join(ASSETS, "adj/hafs-kfqc"))) {
    if (!file.endsWith(".json")) continue;
    const surah = file.replace(".json", "");
    const shard = JSON.parse(readFileSync(join(ASSETS, "adj/hafs-kfqc", file), "utf8"));
    for (const [ayah, entry] of Object.entries(shard)) {
      for (const e of entry.edges ?? []) {
        // No matching run on both sides means no comparison to draw at all —
        // the row keeps its plain note, and there is no crop to measure.
        if (!e.span?.from || !e.toSpan?.from) continue;
        pairs++;
        const sides = [
          { key: `${surah}:${ayah}`, page: e.page - (e.dir?.dPage ?? 0) },
          { key: e.to.split("/").pop(), page: e.page },
        ];
        for (const s of sides) {
          const idx = indexOf(s.page);
          if (!idx?.has(s.key)) continue;
          const present = idx.span(s.key);
          const bands = idx.bandsFor(s.key, present.from, present.to);
          const drawn = unionOf(bands);
          const box = drawn.width * drawn.height;
          if (!box) continue;
          shares.push({ share: Math.min(1, areaOf(bands) / box), lines: bands.length, key: s.key, page: s.page });
        }
      }
    }
  }
  shares.sort((a, b) => a.share - b.share);
  return { shares, pairs };
}

/** Everything a specimen needs for one side of the pair. */
function measureSide(side) {
  const idx = indexOf(side.page);
  const present = idx.span(side.key);
  const bands = idx.bandsFor(side.key, present.from, present.to);
  const u = unionOf(bands);
  return {
    ...side,
    bands,
    shared: idx.bandsFor(side.key, SHARED[0], Math.min(SHARED[1], present.to)),
    washes: divergentRuns(present, SHARED).flatMap(([f, t]) => idx.bandsFor(side.key, f, t)),
    frame: { x: u.x - PAD, y: u.y - PAD, width: u.width + PAD * 2, height: u.height + PAD * 2 },
    share: areaOf(bands) / (u.width * u.height),
  };
}

/**
 * The page's own markup, with every `id` stripped.
 *
 * Two leaves go into one document, and both declare `verse-N` ids. Nothing in
 * either page references an id — no `<use>`, no `url(#…)`, no `href="#…"`, all
 * three checked — so dropping them costs nothing and removes the only way the
 * two could collide.
 */
function printMarkup(page) {
  return readFileSync(join(ASSETS, `pages/hafs-kfqc/${page}.svg`), "utf8")
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/ id="[^"]*"/g, "");
}

function printSize(page) {
  const vb = readFileSync(join(ASSETS, `pages/hafs-kfqc/${page}.svg`), "utf8").match(/viewBox="([^"]+)"/);
  const [, , w, h] = vb[1].split(/\s+/).map(Number);
  return { w, h };
}

// ----------------------------------------------------------------- drawing

const n = (v) => Number(v.toFixed(2));
const vb = (r) => `${n(r.x)} ${n(r.y)} ${n(r.width)} ${n(r.height)}`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

function makeRenderer(ARTIFACT) {
  /** The print itself, however this copy is reaching it. */
  const print = (page) => {
    if (ARTIFACT) return `<use href="#page-${page}"></use>`;
    const { w, h } = printSize(page);
    return `<image href="${PRINT_HREF(page)}" x="0" y="0" width="${w}" height="${h}"></image>`;
  };

  const washes = (side, cls = side.wash) =>
    side.washes
      .map(
        (r) =>
          `<rect class="w-${cls}" x="${n(r.x - 0.5)}" y="${n(r.y - 0.5)}"` +
          ` width="${n(r.width + 1)}" height="${n(r.height + 1)}" rx="1"></rect>`,
      )
      .join("");

  /** A — the whole rectangle the lines occupy, exactly as it ships today. */
  const A = (side) =>
    `<svg class="art" viewBox="${vb(side.frame)}" aria-hidden="true" focusable="false">` +
    `${print(side.page)}${washes(side)}</svg>`;

  /** B — one strip per line, each cut to that line's own words, kept in place. */
  const B = (side) => {
    const f = side.frame;
    const strips = side.bands
      .map((b) => {
        const r = { x: b.x - 1.5, y: b.y - 1.5, width: b.width + 3, height: b.height + 3 };
        const style = [
          `left:${n(((r.x - f.x) / f.width) * 100)}%`,
          `top:${n(((r.y - f.y) / f.height) * 100)}%`,
          `width:${n((r.width / f.width) * 100)}%`,
          `height:${n((r.height / f.height) * 100)}%`,
        ].join(";");
        return (
          `<svg class="art strip" style="${style}" viewBox="${vb(r)}" preserveAspectRatio="none"` +
          ` aria-hidden="true" focusable="false">${print(side.page)}${washes(side)}</svg>`
        );
      })
      .join("");
    return `<div class="stack" style="aspect-ratio:${n(f.width)}/${n(f.height)}">${strips}</div>`;
  };

  /** C — the whole rectangle, with everything that is not this ayah faded back. */
  const C = (side) => {
    const f = side.frame;
    const box = (r) => `M${n(r.x)} ${n(r.y)}H${n(r.x + r.width)}V${n(r.y + r.height)}H${n(r.x)}Z`;
    const holes = side.bands.map((b) => box({ x: b.x - 1, y: b.y - 1, width: b.width + 2, height: b.height + 2 }));
    return (
      `<svg class="art" viewBox="${vb(f)}" aria-hidden="true" focusable="false">${print(side.page)}` +
      `<path class="scrim" d="${box(f)}${holes.join("")}" fill-rule="evenodd"></path>${washes(side)}</svg>`
    );
  };

  /** D — the shared opening marked too, so nothing meaningful is left plain. */
  const D = (side) => {
    const same = side.shared
      .map(
        (r) =>
          `<rect class="w-same" x="${n(r.x - 0.5)}" y="${n(r.y - 0.5)}"` +
          ` width="${n(r.width + 1)}" height="${n(r.height + 1)}" rx="1"></rect>`,
      )
      .join("");
    return (
      `<svg class="art" viewBox="${vb(side.frame)}" aria-hidden="true" focusable="false">` +
      `${print(side.page)}${same}${washes(side)}</svg>`
    );
  };

  /** E — a bracket at the first word and the last, and nothing else added. */
  const E = (side) => {
    const first = side.bands[0];
    const last = side.bands[side.bands.length - 1];
    const T = 5; // tick length, page units
    // The print runs right to left, so an ayah opens at the right edge of its
    // first line's band and closes at the left edge of its last.
    const open = first.x + first.width;
    const close = last.x;
    const marks = [
      `M${n(open - T)} ${n(first.y - 1)}H${n(open)}V${n(first.y + first.height + 1)}H${n(open - T)}`,
      `M${n(close + T)} ${n(last.y - 1)}H${n(close)}V${n(last.y + last.height + 1)}H${n(close + T)}`,
    ]
      .map((d) => `<path class="bracket" d="${d}"></path>`)
      .join("");
    return (
      `<svg class="art" viewBox="${vb(side.frame)}" aria-hidden="true" focusable="false">` +
      `${print(side.page)}${marks}${washes(side)}</svg>`
    );
  };

  const DRAW = { A, B, C, D, E };

  /** The panel exactly as the app builds it: label, crop, label, crop. */
  return (which, sides) =>
    `<div class="panel">` +
    sides.map((s) => `<div class="row"><span class="who">${s.label}</span>${DRAW[which](s)}</div>`).join("") +
    `</div>`;
}

// --------------------------------------------------------------- the chart

const BINS = 10;

function chartOf(shares) {
  const bins = Array.from({ length: BINS }, () => 0);
  for (const s of shares) bins[Math.min(BINS - 1, Math.floor(s.share * BINS))]++;
  const top = Math.max(...bins);

  const CW = 640;
  const CH = 208;
  const LEFT = 34;
  const BOT = 48;
  const TOP = 12;
  const RIGHT = 22;
  const plotW = CW - LEFT - RIGHT;
  const plotH = CH - TOP - BOT;
  const barW = plotW / BINS;

  const grid = [0, 0.5, 1]
    .map((g) => {
      const y = TOP + plotH - g * plotH;
      return (
        `<line class="grid" x1="${LEFT}" y1="${n(y)}" x2="${CW - RIGHT}" y2="${n(y)}"></line>` +
        `<text class="tick" x="${LEFT - 6}" y="${n(y + 3.5)}" text-anchor="end">${Math.round(g * top)}</text>`
      );
    })
    .join("");

  const bars = bins
    .map((count, i) => {
      const h = (count / top) * plotH;
      const low = i / BINS < 0.5;
      return (
        `<rect class="bar${low ? " bar-low" : ""}" x="${n(LEFT + i * barW + 2)}"` +
        ` y="${n(TOP + plotH - h)}" width="${n(barW - 4)}" height="${n(h)}"></rect>`
      );
    })
    .join("");

  const ticks = [0, 2, 4, 6, 8, 10]
    .map((i) => `<text class="tick" x="${n(LEFT + i * barW)}" y="${CH - BOT + 16}" text-anchor="middle">${i * 10}%</text>`)
    .join("");

  const under = shares.filter((s) => s.share < 0.5).length;
  const label =
    `Distribution: how much of each drawn rectangle is the verse it names. ` +
    `Most crops sit between 50 and 90 per cent; ${((under / shares.length) * 100).toFixed(1)} per cent fall below half.`;

  return (
    `<svg class="chart" viewBox="0 0 ${CW} ${CH}" role="img" aria-label="${esc(label)}">${grid}${bars}` +
    `<line class="axis" x1="${LEFT}" y1="${TOP + plotH}" x2="${CW - RIGHT}" y2="${TOP + plotH}"></line>${ticks}` +
    `<text class="tick" x="${LEFT + plotW / 2}" y="${CH - 6}" text-anchor="middle">` +
    `share of the drawn rectangle that is the verse it names</text></svg>`
  );
}

// ---------------------------------------------------------------- the copy

const OPTIONS = [
  {
    id: "A",
    family: "Change nothing",
    name: "Leave it as it is",
    lede:
      "The rectangle stays as it is drawn today: every line the verse touches, edge to edge, whatever else " +
      "is printed on those lines.",
    for: [
      "It ships. It is already a large improvement on what it replaced, and it is the only option with no work behind it.",
      "The context is not worthless — seeing what runs before and after is how a hafiz places a verse on the page in the first place.",
      "The verse numbers are printed in the artwork, so the boundaries are visible to anyone who looks for them.",
    ],
    against: [
      "Unmarked does not mean shared, and the panel gives the reader no way to know that.",
      "On the lower crop here, the whole first line is the previous verse — the labelled one does not start until line two, and nothing says so.",
      "On one crop in six, more of what is drawn belongs to other verses than to the one being named.",
      "It is the one option with no precedent behind it: nothing else that marks a run of text on a page marks it this way.",
    ],
  },
  {
    id: "B",
    family: "Take the neighbours away",
    name: "Cut each line down to the verse's own words",
    lede:
      "Instead of one rectangle over all the lines, one strip per line, each cut to exactly the words of this " +
      "verse — kept in its true place, so the shape of the verse on the page survives.",
    for: [
      "The problem disappears by construction. Nothing is drawn that is not the verse, so unmarked can only mean shared.",
      "It is what everything else already does. Selecting three wrapped lines of text in any browser gives three shapes cut to the words, never a rectangle around them — and the formats that describe scanned pages put their geometry on the line for the same reason.",
      "It keeps the printer's own line breaks and the verse's real position, so it still looks like the page it came from.",
      "It costs nothing to read: no new colour, no new mark, no legend.",
    ],
    against: [
      "It is ragged. A verse that opens with three words at the end of a line gets a stub floating above a full line, which looks broken until you understand why.",
      "None of the precedents above has to look like a page of a mus'haf — a selection is transient and a scanned newspaper is not a place of reverence.",
      "It removes the context argument entirely — including for the readers who were using it.",
      "It is the largest change of the five: the crop stops being one picture and becomes several.",
    ],
  },
  {
    id: "C",
    family: "Push the neighbours back",
    name: "Fade everything that is not this verse",
    lede:
      "One rectangle still, but a translucent veil over every part of it that belongs to another verse, so this " +
      "one sits forward and the rest recedes.",
    for: [
      "Context survives and stops competing. You can still read what runs before and after, but only if you go looking.",
      "It is a small change — the same single picture, one shape drawn over it.",
      "It answers the actual confusion directly: faded is visibly a different category from washed.",
    ],
    against: [
      "It puts a veil over printed Quran, which is a heavier thing to do than tinting a few words, and it does it to most of the crop.",
      "Three visual states now — faded, plain, washed — where there were two.",
      "On a small screen a faint veil may not read as a veil at all; it may just look like uneven printing.",
    ],
  },
  {
    id: "E",
    family: "Push the neighbours back",
    name: "Mark where the verse begins and ends",
    lede:
      "The rectangle is untouched. Two small brackets are drawn instead — one at the first word, one at the " +
      "last — so the verse's extent is stated without anything being hidden or dimmed.",
    for: [
      "The lightest possible intervention: two marks, no colour over the ink, nothing obscured.",
      "It states the boundary exactly, which is the fact the reader is missing.",
      "It reads the same at any size, unlike a faint veil.",
    ],
    against: [
      "It tells you where the verse ends without making the neighbours any quieter — a reader skimming still sees one block of ink.",
      "Two more marks in a panel that already carries a coloured wash, on a surface where restraint is the whole aesthetic.",
      "A bracket is a convention, and conventions have to be learnt.",
    ],
  },
  {
    id: "D",
    family: "Say what the marks mean",
    name: "Mark the words the two share, as well as the ones they do not",
    lede:
      "Nothing is removed or dimmed. A third, neutral tint goes over the shared opening — so the two states " +
      "that carry meaning are both stated, and anything left plain is simply not part of the comparison.",
    for: [
      "It fixes the actual error rather than its cause: the reader's wrong inference was that plain means shared. Here, shared is marked, so plain means nothing at all.",
      "The neighbours keep whatever context value they have, at no cost.",
      "It is the smallest change to what is drawn — one more tint, using machinery already there.",
    ],
    against: [
      "Almost the whole verse is now under colour, which is close to the opposite of the panel's intent — the wash exists so the eye lands on a few words.",
      "Three tints on one crop needs a legend, and there is no room for a legend under a row in a list.",
      "It is the only option that makes the crop busier rather than quieter.",
    ],
  },
];

// ---------------------------------------------------------------- assembly

function render({ artifact: ARTIFACT, out }) {
  const panel = makeRenderer(ARTIFACT);
  const sides = SIDES.map(measureSide);
  const { shares, pairs } = sweep();

  const N = shares.length;
  const pct1 = (x) => (x * 100).toFixed(1);
  const pct0 = (x) => Math.round(x * 100);
  const mean = shares.reduce((a, s) => a + s.share, 0) / N;
  const median = shares[Math.floor(N / 2)].share;
  const oneLine = shares.filter((s) => s.lines === 1).length;
  const underHalf = shares.filter((s) => s.share < 0.5).length;
  const underThird = shares.filter((s) => s.share < 1 / 3).length;
  const worst = shares[0];
  const twoLine = shares.filter((s) => s.lines === 2);
  const twoLineMean = twoLine.reduce((a, s) => a + s.share, 0) / twoLine.length;
  const num = (v) => v.toLocaleString("en");

  const optionCard = (o) => `
<article class="option" id="option-${o.id}">
  <div class="option-head">
    <span class="key">${o.id}</span>
    <div>
      <p class="family">${o.family}</p>
      <h3>${esc(o.name)}</h3>
    </div>
  </div>
  <div class="option-body">
    <div class="option-prose">
      <p class="lede">${esc(o.lede)}</p>
      <div class="weigh">
        <div>
          <p class="wl">What it gets you</p>
          <ul>${o.for.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>
        <div>
          <p class="wl">What it costs</p>
          <ul>${o.against.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>
      </div>
    </div>
    <figure class="specimen">
      ${panel(o.id, sides)}
      <figcaption>Drawn on 2:48 and 2:123, at the width the panel really is on a phone. ${
        o.id === "A"
          ? "This is a picture of the live app."
          : "Everything here is the printed page — only what is drawn over it changes."
      }</figcaption>
    </figure>
  </div>
</article>`;

  const glance = `
<div class="glance-rail">
  ${OPTIONS.map(
    (o) =>
      `<figure class="glance"><figcaption><span class="key small">${o.id}</span> ${esc(o.name)}</figcaption>` +
      `${panel(o.id, [sides[1]])}</figure>`,
  ).join("")}
</div>`;

  const defs = ARTIFACT
    ? `<svg class="vault" aria-hidden="true" focusable="false"><defs>${[...new Set(SIDES.map((s) => s.page))]
        .map((p) => `<g id="page-${p}">${printMarkup(p)}</g>`)
        .join("")}</defs></svg>`
    : "";

  const html = `<title>What should the panel show around the ayah?</title>
<style>
:root {
  /* The app's own tokens. This page is about the app's surface, so it borrows
     the surface's palette rather than inventing one beside it. */
  --ground: #f4efe6;
  --raised: #fbf8f2;
  --sunk: #ece4d6;
  --ink: #26201a;
  --soft: #5c5347;
  --faint: #6b6255;
  --rule: #ded4c3;
  --rule-soft: #eae1d2;
  --accent: #1f6f66;
  --accent-ink: #17544d;
  --accent-soft: #d7e7e3;
  --terra: #a23b2c;
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", "Hoefler Text", Georgia, serif;
  --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  --measure: 37rem;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #17140f;
    --raised: #201c16;
    --sunk: #100e0a;
    --ink: #ece3d3;
    --soft: #b4a893;
    --faint: #918675;
    --rule: #352f26;
    --rule-soft: #262019;
    --accent: #5fb0a3;
    --accent-ink: #7cc4b8;
    --accent-soft: #1c3a35;
    --terra: #d9826c;
  }
}
:root[data-theme="dark"] {
  --ground: #17140f;
  --raised: #201c16;
  --sunk: #100e0a;
  --ink: #ece3d3;
  --soft: #b4a893;
  --faint: #918675;
  --rule: #352f26;
  --rule-soft: #262019;
  --accent: #5fb0a3;
  --accent-ink: #7cc4b8;
  --accent-soft: #1c3a35;
  --terra: #d9826c;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: var(--serif);
  font-size: 17px;
  line-height: 1.62;
  -webkit-text-size-adjust: 100%;
}
.wrap { max-width: 78rem; margin: 0 auto; padding: 0 clamp(1.25rem, 4vw, 3rem) 6rem; }
.col { max-width: var(--measure); }
p { margin: 0 0 1.05em; text-wrap: pretty; }
h1, h2, h3 { text-wrap: balance; font-weight: 600; letter-spacing: -0.011em; }
a { color: var(--accent-ink); text-underline-offset: 2px; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 2px; }

header.top { padding: clamp(3rem, 9vw, 6rem) 0 0; }
.eyebrow {
  font-family: var(--mono); font-size: 12px; letter-spacing: 0.13em;
  text-transform: uppercase; color: var(--faint); margin: 0 0 1.4rem;
}
h1 { font-size: clamp(1.9rem, 5.2vw, 2.65rem); line-height: 1.14; margin: 0 0 1.1rem; }
.standfirst { font-size: 1.16rem; line-height: 1.55; color: var(--soft); max-width: var(--measure); }
.status {
  display: inline-flex; align-items: baseline; gap: 0.55rem;
  margin-top: 0.4rem; padding: 0.4rem 0.85rem;
  border: 1px solid var(--rule); border-radius: 999px;
  font-family: var(--mono); font-size: 12px; color: var(--soft);
}
.status b { color: var(--accent-ink); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }

section { padding-top: 3.4rem; }
h2 {
  font-size: clamp(1.3rem, 3vw, 1.6rem); line-height: 1.25;
  margin: 0 0 1.1rem; padding-top: 1.5rem;
  border-top: 1px solid var(--rule);
}
h2 .n {
  display: block; font-family: var(--mono); font-size: 11px; font-weight: 400;
  letter-spacing: 0.13em; text-transform: uppercase; color: var(--faint);
  margin-bottom: 0.7rem;
}
h3 { font-size: 1.16rem; margin: 0; line-height: 1.3; }

.gloss { display: grid; gap: 0.1rem 1.6rem; grid-template-columns: max-content 1fr; max-width: var(--measure); }
.gloss dt { font-weight: 600; padding-top: 0.55rem; }
.gloss dd { margin: 0; padding-top: 0.55rem; color: var(--soft); }
@media (max-width: 34rem) {
  .gloss { grid-template-columns: 1fr; }
  .gloss dd { padding-top: 0.1rem; padding-bottom: 0.5rem; }
}

.figures {
  display: grid; gap: 1px; background: var(--rule);
  grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
  border: 1px solid var(--rule); border-radius: 3px; overflow: hidden;
  margin: 0 0 1.9rem; max-width: 54rem;
}
.fig { background: var(--raised); padding: 0.95rem 1.05rem; }
.fig b {
  display: block; font-family: var(--mono); font-size: 1.5rem; font-weight: 500;
  font-variant-numeric: tabular-nums; letter-spacing: -0.02em; line-height: 1.1;
}
.fig span { display: block; font-size: 12.5px; line-height: 1.4; color: var(--faint); margin-top: 0.35rem; }
.fig.warn b { color: var(--terra); }

.chart-box { max-width: 42rem; margin: 0 0 1.5rem; overflow-x: auto; }
.chart { width: 100%; height: auto; display: block; min-width: 22rem; }
.chart .bar { fill: var(--accent); opacity: 0.82; }
.chart .bar-low { fill: var(--terra); opacity: 0.82; }
.chart .grid, .chart .axis { stroke: var(--rule); stroke-width: 1; }
.chart .tick { font-family: var(--mono); font-size: 10px; fill: var(--faint); }

/* The specimen: the panel, at the size it really is.
   The app never re-themes the printed page — the printer's ink is a fixed dark
   and would vanish on a dark ground — so the specimen keeps the app's own paper
   in both themes, deliberately. */
.vault { position: absolute; width: 0; height: 0; overflow: hidden; }
.panel {
  width: 344px; max-width: 100%;
  display: flex; flex-direction: column; gap: 8px;
  padding: 8px 12px; border-radius: 8px;
  background: #ece4d6;
  border: 1px solid var(--rule);
}
.row { display: flex; flex-direction: column; gap: 2px; }
.who { font-size: 12px; letter-spacing: 0.04em; color: #6b6255; direction: rtl; }
.art { display: block; width: 100%; height: auto; background: #fdfbf5; border-radius: 4px; }
.stack { position: relative; width: 100%; background: #fdfbf5; border-radius: 4px; }
.stack .strip { position: absolute; border-radius: 0; }
.w-a { fill: rgba(162, 59, 44, 0.1); stroke: #a23b2c; stroke-width: 0.3; vector-effect: non-scaling-stroke; }
.w-b { fill: rgba(23, 84, 77, 0.1); stroke: #17544d; stroke-width: 0.3; vector-effect: non-scaling-stroke; }
.w-same { fill: rgba(38, 32, 26, 0.07); stroke: rgba(38, 32, 26, 0.28); stroke-width: 0.3; vector-effect: non-scaling-stroke; }
.scrim { fill: rgba(253, 251, 245, 0.74); }
.bracket { fill: none; stroke: #1f6f66; stroke-width: 1.1; vector-effect: non-scaling-stroke; stroke-linecap: square; }

.glance-rail {
  display: flex; gap: 1.1rem; overflow-x: auto; padding-bottom: 1rem;
  scroll-snap-type: x proximity; margin-bottom: 0.4rem;
}
.glance { margin: 0; flex: 0 0 auto; scroll-snap-align: start; }
.glance figcaption {
  font-family: var(--mono); font-size: 11.5px; color: var(--soft);
  margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.45rem;
  max-width: 344px; line-height: 1.35;
}
.rail-note { font-size: 13.5px; color: var(--faint); max-width: var(--measure); }

.option { padding-top: 2.6rem; }
.option + .option { border-top: 1px solid var(--rule-soft); }
.option-head { display: flex; gap: 0.95rem; align-items: flex-start; margin-bottom: 1.2rem; }
.key {
  flex: 0 0 auto; width: 2rem; height: 2rem; border-radius: 50%;
  display: grid; place-items: center;
  font-family: var(--mono); font-size: 13px; font-weight: 600;
  background: var(--accent-soft); color: var(--accent-ink);
}
.key.small { width: 1.4rem; height: 1.4rem; font-size: 11px; }
.family {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--faint); margin: 0.35rem 0 0.3rem;
}
.option-body { display: grid; gap: 2rem; grid-template-columns: minmax(0, 1fr) auto; align-items: start; }
@media (max-width: 60rem) { .option-body { grid-template-columns: 1fr; } }
.option-prose { max-width: var(--measure); }
.lede { font-size: 1.04rem; }
.weigh { display: grid; gap: 1.4rem; grid-template-columns: 1fr 1fr; }
@media (max-width: 42rem) { .weigh { grid-template-columns: 1fr; } }
.wl {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.11em;
  text-transform: uppercase; color: var(--faint); margin: 0 0 0.5rem;
}
.weigh ul { margin: 0; padding-left: 1.05rem; }
.weigh li { margin-bottom: 0.5rem; font-size: 15.5px; line-height: 1.5; color: var(--soft); }
.specimen { margin: 0; }
.specimen figcaption {
  font-size: 12.5px; line-height: 1.45; color: var(--faint);
  margin-top: 0.65rem; max-width: 344px;
}

.col ul.plain { padding-left: 1.1rem; margin: 0 0 1.05em; }
.col ul.plain li { margin-bottom: 0.55rem; }
.hollow {
  border: 1px solid var(--rule); border-left: 3px solid var(--terra);
  border-radius: 3px; padding: 1rem 1.2rem; max-width: var(--measure);
  background: var(--raised);
}
.hollow p:last-child { margin-bottom: 0; }
.src { font-size: 13.5px; color: var(--faint); margin-top: 0.35rem; }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
</style>

${defs}

<div class="wrap">
<header class="top">
  <p class="eyebrow">Hifth · open question</p>
  <h1>What should the panel show around the ayah?</h1>
  <p class="standfirst">When you open a pair of look-alike verses, the app now cuts both of them straight out of the printed page instead of retyping them. That fixed a real problem and introduced a smaller one: a verse almost never begins and ends at the edge of a line, so the rectangle cut around it brings its neighbours along for the ride.</p>
  <p class="status"><b>Open</b> <span>Nobody has decided. Option A is what ships today.</span></p>
</header>

<section class="col">
  <h2><span class="n">The words on this page</span>What do these words mean?</h2>
  <dl class="gloss">
    <dt>ayah</dt><dd>A verse.</dd>
    <dt>mus'haf</dt><dd>The printed Quran the app draws. Every page is the printer's own artwork, vendored as-is.</dd>
    <dt>look-alikes</dt><dd>Pairs of verses that read almost the same — the thing a hafiz has to keep apart. Opening one is called a hop.</dd>
    <dt>the crop</dt><dd>The rectangle the app cuts out of a printed page to show one verse.</dd>
    <dt>the wash</dt><dd>The translucent colour laid over the words the two verses do <em>not</em> share.</dd>
  </dl>
</section>

<section class="col">
  <h2><span class="n">The question</span>What is being decided?</h2>
  <p>What the app draws <em>around</em> a verse when it shows it beside its look-alike — not what it marks. Which words get the wash is read off the pair itself and is correct; that part is not in question.</p>
  <p>What is in question is everything else inside the frame. Because a verse starts and stops mid-line, the rectangle that holds it also holds whatever else is printed on those lines. The reader is given no way to tell the difference between <em>this is the other half of the verse, and the two agree here</em> and <em>this is a different verse that happens to sit on the same line</em>.</p>
</section>

<section class="col">
  <h2><span class="n">Timing</span>Why is this being asked now?</h2>
  <p>Until this week the panel showed the two verses as retyped text. That was wrong on its own terms — the transcription used a plainer spelling than the printed page, so a reader comparing the panel against the page underneath saw one set of letters in each. It was also the larger of the only two places in this project holding running scripture, which is the reason it went.</p>
  <p>The replacement cuts the verses out of the page itself, so there is exactly one set of letters now, and it covers <b>${num(pairs)}</b> pairs where the retyped table covered twelve. The neighbours arrived with the ink. This question exists because the fix worked.</p>
</section>

<section class="col">
  <h2><span class="n">Doing nothing</span>What happens if nobody decides?</h2>
  <p>Option A stands, because option A is live. Nothing breaks, and the panel remains a clear improvement on what it replaced.</p>
  <p>The risk is quiet rather than loud: a reader takes an unmarked neighbour for shared wording and memorises a difference that is not there — in an app whose entire purpose is to stop exactly that.</p>
</section>

<section>
  <div class="col">
    <h2><span class="n">Measured, not estimated</span>What does the app do today, and what does that cost?</h2>
    <p>Every look-alike pair that the panel can draw was measured, both sides — <b>${num(N)}</b> crops across <b>${num(pairs)}</b> pairs. For each one: how much of the rectangle actually drawn belongs to the verse it names.</p>
  </div>
  <div class="figures">
    <div class="fig"><b>${pct1(mean)}%</b><span>of the average crop is the verse it names</span></div>
    <div class="fig"><b>${pct1(median)}%</b><span>is the middle crop — half are worse</span></div>
    <div class="fig warn"><b>${pct1(underHalf / N)}%</b><span>are more neighbour than verse (${num(underHalf)} crops)</span></div>
    <div class="fig warn"><b>${pct1(worst.share)}%</b><span>is the worst of them — ${worst.key} on page ${worst.page}</span></div>
    <div class="fig"><b>${pct1(oneLine / N)}%</b><span>sit on one line and have no neighbours at all</span></div>
  </div>
  <div class="chart-box">${chartOf(shares)}</div>
  <div class="col">
    <p>Two facts in that distribution matter more than the average. The first is that <b>${num(oneLine)}</b> crops — the verses that fit on a single line — are perfect already: the strip drawn for them contains nothing but the verse. Whatever is decided here should not disturb them.</p>
    <p>The second is that the worst case is not the longest verse but the <em>shortest multi-line one</em>. Verses spanning two lines average just ${pct1(twoLineMean)}%, because both of their lines are partial and there is no full line in the middle to dilute the edges. ${num(underThird)} crops are under a third. At the very bottom sits ${worst.key} on page ${worst.page}, where nine tenths of what the reader is shown is other verses.</p>
    <p>The pair drawn on every specimen below is the app's own signature example, and it straddles the problem neatly: <b>2:48</b> is ${pct0(sides[0].share)}% its own verse, and <b>2:123</b> is ${pct0(sides[1].share)}%.</p>
    <p>Look at what that means on the lower crop, in option A below. It is labelled <b>2:123</b>, and its <em>entire first line</em> is 2:122 — the verse before it, ending in a printed verse number, none of it marked in any way. The verse the label names does not begin until the second line. A reader who takes plain ink for shared wording has just been told that a whole line the two verses do not have in common is a line they agree on.</p>
    <p class="src">A note on the arithmetic: a few crops score fractionally over 100% because two adjacent lines' strips overlap slightly where letters descend. They are counted as 100% rather than more.</p>
  </div>
</section>

<section class="col">
  <h2><span class="n">Prior art</span>What do other people do about this?</h2>
  <p><b>The whole thing, nobody.</b> I did not find anyone cutting a verse out of a printed page and setting it beside its look-alike. The largest public library of Quran data publishes the two halves as separate downloads and has not joined them: printed-page layouts in one place, and look-alike phrase data in another — <a href="https://qul.tarteel.ai/resources/mutashabihat">5,277 look-alike phrase entries</a> and <a href="https://qul.tarteel.ai/resources/similar-ayah">4,001 similar-verse links</a>, alongside <a href="https://qul.tarteel.ai/resources/mushaf-layout">twenty approved page layouts</a>. The most-used Quran reader shows no look-alike feature on a verse's own page at all.</p>
  <p><b>The hard part of it, everybody — and they all do the same thing.</b> Marking a run of text that wraps across several lines of a page is a solved problem, and in four independent traditions it is solved <em>per line</em>, never by drawing a box around the whole run.</p>
  <ul class="plain">
    <li><b>Every text selection you have ever made.</b> The specification that governs how a highlight is painted says it is not one shape over a range: there is a single overlay for the document, and <q>Each box owns the piece of the overlay</q> corresponding to the text directly inside it. Drag across three wrapped lines in any browser and you get three shapes cut to the words. <span class="src"><a href="https://www.w3.org/TR/css-pseudo-4/#highlight-bounds">CSS Pseudo-Elements 4, §3.4 Area of a Highlight</a></span></li>
    <li><b>The web platform gives the two shapes different names.</b> You can ask a range for its geometry as a list — <q>one for each box fragment</q> — or as a single rectangle, <q>the smallest rectangle that includes all of the rectangles in list</q>. Two methods, because they are two different answers to two different questions. The app is currently calling the second one. <span class="src"><a href="https://drafts.csswg.org/cssom-view/">CSSOM View Module Level 1</a></span></li>
    <li><b>The standard for annotating part of an image.</b> Its ordinary rectangle selector can say only origin, width and height, and the spec is blunt about the limit — <q>even a simple circular region of an image, or a diagonal line across it, are not possible</q> — so it defines a second, shape-based selector and points you at it whenever the region is not a rectangle. <span class="src"><a href="https://www.w3.org/TR/annotation-model/">W3C Web Annotation Data Model</a></span></li>
    <li><b>The standard for serving a crop of a scanned page can cut only rectangles</b> — the whole image, a square, or a box given in pixels or per cent. There is no multi-part or non-rectangular request in it. That is worth naming, because it explains <em>why</em> our crop is a rectangle: a rectangle is what the tooling hands you, not what the content is. Viewers that need a real shape draw it over the image instead of asking for it. <span class="src"><a href="https://iiif.io/api/image/3.0/">IIIF Image API 3.0, §4.1 Region</a></span></li>
    <li><b>The formats that describe scanned pages put the geometry on the line.</b> Both of the widely used ones carry a box per text line, while logical units like a paragraph are containers that group lines rather than shapes of their own. One goes further and defines an element for exactly our case, documented as describing <q>the bounding shape of a block, if it is not rectangular</q>, holding a polygon. A verse crossing three lines is that block. <span class="src"><a href="https://kba.github.io/hocr-spec/1.2/">hOCR 1.2</a> · <a href="https://github.com/altoxml/schema">ALTO 4.4 schema</a></span></li>
  </ul>
  <p><b>What this changes.</b> Option B stops being the boldest of the five and becomes the conventional one. Its remaining objection is not correctness but appearance — none of the precedents above has to look like a page of a mus'haf — and that is a question about taste and reverence, which is exactly the sort a stranger to this code is better placed to answer than its author.</p>
  <div class="hollow">
    <p><b>What I could not confirm.</b> I believe a multi-line highlight in a PDF is stored as several quadrilaterals rather than one rectangle — the same convention a fifth time — but both sources I tried for that specification returned nothing, and this session's search budget was spent, so it is not counted above.</p>
    <p>I also could not open the layout or look-alike data files themselves to see whether they carry word positions. The finding about them rests on the library's own descriptions.</p>
  </div>
</section>

<section class="col">
  <h2><span class="n">Constraints</span>What have we already decided that limits the answer?</h2>
  <ul class="plain">
    <li><b>The printed page is never edited.</b> Whatever the panel does, it does by drawing over the artwork. Moving, re-flowing, or re-setting the letters is not available — that was the whole point of cropping the page instead of retyping it.</li>
    <li><b>The page is paper and stays paper.</b> It is never re-themed, because the printer's ink is a fixed dark that would vanish on a dark ground. Every specimen below is on paper even if you are reading this at night, and that is not an oversight.</li>
    <li><b>The wash must not hide the words it points at.</b> It is translucent for that reason, and a solid fill is not on the table for anything drawn over the ink.</li>
    <li><b>When the comparison cannot be drawn, nothing is drawn</b> and the row keeps its plain note. Any option has to keep that fallback.</li>
    <li><b>Whether a rectangle should line up with a printed line or with a whole page is already an open question here</b>, asked about the marks the app draws over recitation rules. This is the same tension in a second place, and the two should not be answered in opposite directions without somebody saying why.</li>
  </ul>
</section>

<section>
  <div class="col">
    <h2><span class="n">Side by side</span>How do the five compare at a glance?</h2>
    <p class="rail-note">The hard side of the pair — 2:123, where a little under half the crop is other verses — drawn five ways at the panel's real width. Scroll sideways. Each one is the actual printed page with the actual measured geometry over it.</p>
  </div>
  ${glance}
</section>

<section>
  <div class="col">
    <h2><span class="n">The options</span>What could be done instead?</h2>
    <p>Five, grouped by what they actually do about the neighbours: take them away, push them back, or leave them and say plainly what the marks mean. They are not exclusive — B and D compose, and so do C and E — but each is drawn on its own so it can be judged on its own.</p>
  </div>
  ${OPTIONS.map(optionCard).join("")}
</section>

<section class="col">
  <h2><span class="n">Rejected</span>What else was considered, and why is it not here?</h2>
  <ul class="plain">
    <li><b>Show the whole page and point at the verse.</b> The panel is a strip underneath a row in a list. A whole page at that size is unreadable, and the reader is already looking at one.</li>
    <li><b>Re-flow the verse's words onto a line of their own.</b> It would move the printer's letters, and showing the reader letters arranged differently from the page is the exact defect that cropping the page was brought in to fix.</li>
    <li><b>Blur the neighbours' ink.</b> Same objection as re-flowing, and a blur laid over printed Quran is a harder thing to defend than a translucent tint of the same strength.</li>
    <li><b>Draw only the words that differ.</b> A difference with no context is not memorable. The shared opening is the reason the pair is confusable in the first place — remove it and the panel stops answering its own question.</li>
  </ul>
</section>

<section class="col">
  <h2><span class="n">Sensitivity</span>What would change the answer?</h2>
  <ul class="plain">
    <li><b>A hafiz reading the panel and saying whether the neighbours help or hurt.</b> The case against A rests on a guess about someone else's habit — that context is a distraction rather than an aid. That guess has not been tested on a single person who memorises.</li>
    <li><b>Whether the raggedness actually reads as broken.</b> After the prior art above, this is the only real objection left to B, and it is an appearance claim nobody has tested. Two people and fifteen minutes would settle it.</li>
    <li><b>The panel moving out of a list row.</b> B's raggedness is only a problem in a cramped strip. On a full screen, most of the objection to it evaporates.</li>
    <li><b>Any change to how the page is themed.</b> C is a veil in the page's own paper colour; if the artwork's ground ever moves, C moves with it.</li>
  </ul>
</section>

<section class="col">
  <h2><span class="n">Scope</span>What is this not settling?</h2>
  <ul class="plain">
    <li><b>Which words get washed.</b> Read off the pair itself, verified, and correct.</li>
    <li><b>The two colours.</b> Terracotta for the verse you are on, verdigris for the one you are looking at — settled elsewhere, and not reopened here.</li>
    <li><b>Whether the panel should exist at all.</b> It should.</li>
    <li><b>Anything about the printed page.</b> It is vendored unmodified apart from three declared transforms, and nothing here touches that.</li>
  </ul>
</section>
</div>
`;

  writeFileSync(out, html);
  return { html, N, pairs, mean, underHalf, worst, sides };
}

let last;
for (const copy of COPIES) {
  const r = render(copy);
  console.log(`${copy.out.replace(ROOT, "")}  ${(r.html.length / 1024).toFixed(0)} KB`);
  last = r;
}
console.log(
  `  measured ${last.N} crops over ${last.pairs} pairs — mean ${(last.mean * 100).toFixed(1)}%, ` +
    `${last.underHalf} under half, worst ${(last.worst.share * 100).toFixed(1)}% (${last.worst.key} p${last.worst.page})`,
);
