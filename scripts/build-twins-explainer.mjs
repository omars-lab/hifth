#!/usr/bin/env node
/**
 * The reader's page for the whole-verse twins — plain, no decision framing.
 *
 * `build-similar-ayah-gap.mjs` draws the same twins to argue a *choice* (the
 * decision `similar-ayah-enrichment`, decided D). This page argues nothing. It
 * is for a hafiz who is not deciding anything: what a twin is, a handful drawn
 * on the real page, and why the app points them out. The full reasoning — the
 * options, the measurement, the copy-nothing boundary — lives on the decision
 * page, linked at the foot.
 *
 * The crop machinery is shared with the decision page (`twin-crop.mjs`), so no
 * geometry is duplicated and no letter is retyped — each verse is cut from the
 * artwork the app already ships. The counts come straight out of the checked-in
 * twins file, so any number on the page re-derives by rebuilding that file
 * (`pnpm --filter @hifth/etl build:twins`).
 *
 * The pairs drawn are a subset of the ones a human already looked at on the
 * printed page for the decision page — only eye-confirmed twins are shown.
 *
 * A dated public snapshot of this page exists for readers who do not have the
 * repo: `bytesofpurpose-blog/designs/2026-09-04-verse-twins.mdx` in
 * `omars-lab.github.io` (draft, kind `design-story`). It carries no crops — it
 * points back here for those — and repeats the two figures this page cites
 * (636 pairs / 208 verses). This page is the record; the post is a dated
 * snapshot of it, the same one-way arrangement `etl-pipeline.md` ⑧ describes.
 * The generated page carries the same note as an HTML comment, so an editor
 * viewing its source learns the derived copy is out there.
 *
 *   node scripts/build-twins-explainer.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import { twinPanel } from "./twin-crop.mjs";

const OUT = join(ROOT, "docs/design/verse-twins.html");
const TWINS = join(ROOT, "packages/etl/data/mutashabihat/verbatim-twins.json");

const meta = JSON.parse(readFileSync(TWINS, "utf8"));
const num = (x) => x.toLocaleString("en-US");

/**
 * A handful to draw — chosen from the eye-checked set the decision page uses,
 * favouring pairs that sit in *different* sūras, pages apart, because that is
 * the whole point: the same verse, far from itself. Each is whole-verse green.
 */
const DRAW = [
  ["11:110", "41:45"],
  ["21:41", "6:10"],
  ["36:46", "6:4"],
  ["24:5", "3:89"],
  ["2:134", "2:141"],
];

const gallery = DRAW.map((p) => twinPanel(p, { green: true })).join("\n");

const html = `<!doctype html>
<!--
  A dated public snapshot of this page lives at
  bytesofpurpose-blog/designs/2026-09-04-verse-twins.mdx in omars-lab.github.io
  (draft, kind design-story). This page is the record; that post is a dated
  snapshot of it — the one-way arrangement etl-pipeline.md section 8 describes.
  Rebuilt by scripts/build-twins-explainer.mjs; edit there, not here.
-->
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>The same verse, in two places</title>
<style>
  :root {
    --paper: #f7f4ee; --paper-raised: #fffdf8; --ink: #26201a; --ink-soft: #5c5348;
    --hair: #e4ddd0; --green: #3f7d43; --accent: #17544d;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink);
    font: 16px/1.6 "Iowan Old Style", Palatino, Georgia, serif; }
  main { max-width: 720px; margin: 0 auto; padding: 2.5rem 1.25rem 5rem; }
  h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 0.5rem; }
  h2 { font-size: 1.3rem; margin: 2.6rem 0 0.6rem; }
  .standfirst { font-size: 1.15rem; color: var(--ink-soft); margin: 0 0 1.5rem; }
  p { margin: 0 0 1rem; }
  b { color: var(--ink); }
  .glossary { background: var(--paper-raised); border: 1px solid var(--hair);
    border-radius: 10px; padding: 0.6rem 1rem; margin: 1.5rem 0; }
  .glossary dt { font-weight: 600; margin-top: 0.5rem; }
  .glossary dd { margin: 0 0 0.2rem; color: var(--ink-soft); }
  .stat { display: flex; flex-wrap: wrap; gap: 1.4rem; margin: 1.4rem 0; }
  .stat div { flex: 1 1 8rem; }
  .stat .big { font-size: 2.2rem; font-weight: 700; color: var(--accent); line-height: 1; }
  .stat .cap { font-size: 0.9rem; color: var(--ink-soft); }
  .gallery { display: grid; grid-template-columns: 1fr; gap: 1.4rem; margin: 1.4rem 0; }
  .pair { background: var(--paper-raised); border: 1px solid var(--hair);
    border-radius: 10px; padding: 0.9rem; }
  .crop { margin: 0 0 0.6rem; }
  .crop:last-of-type { margin-bottom: 0; }
  .crop figcaption { font: 0.85rem monospace; color: var(--ink-soft); margin-bottom: 0.25rem; }
  .art { display: block; width: 100%; height: auto; background: #fff;
    border: 1px solid var(--hair); border-radius: 4px; }
  .scrim { fill: var(--paper); opacity: 0.72; }
  .w-share { fill: rgba(63, 125, 67, 0.16); stroke: var(--green);
    stroke-width: 0.3; vector-effect: non-scaling-stroke; }
  .swatch { display: inline-block; width: 0.8em; height: 0.8em; border-radius: 2px;
    vertical-align: -1px; margin-right: 0.15em; }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--hair);
    font-size: 0.9rem; color: var(--ink-soft); }
  footer a { color: var(--accent); }
</style>
</head>
<body>
<main>
  <h1>The same verse, in two places</h1>
  <p class="standfirst">Some verses of the Qur'an appear twice — the very same words, sitting
  pages apart, in two different sūras. For someone memorising, these are the easiest of all to mix
  up. The app now finds every one of them and shows you, on the page, that you are standing on a
  verse that lives somewhere else too.</p>

  <dl class="glossary">
    <dt>mus'haf</dt><dd>The printed Qur'an, page by page, as you read it.</dd>
    <dt>verse</dt><dd>One āyah. The app names each by its sūra and number — 11:110 is sūra 11,
      verse 110.</dd>
    <dt>twin</dt><dd>Two verses that are word for word the same, in two places. The tradition
      counts these among the mutashābihāt — the look-alikes a hafiz has to hold apart.</dd>
  </dl>

  <h2>What is a twin?</h2>
  <p>A twin is not two verses that <em>resemble</em> each other. It is one verse, printed twice —
  the same words, in the same order, once here and once pages away. Nothing in the wording tells
  you which of the two you are reading; only what comes before and after it does.</p>

  <h2>Why are they the hardest to keep apart?</h2>
  <p>When you are reciting from memory and reach a verse that exists in two places, there is a
  fork in the road with no sign on it. The words that would tell you which way to go are identical,
  so the only thing that can keep you on the right sūra is the memory of what surrounds it. That is
  exactly the slip a memoriser fears, and exactly the place a reminder helps most.</p>

  <h2>How many are there?</h2>
  <div class="stat">
    <div><div class="big">${num(meta.pairs)}</div><div class="cap">pairs of twin verses</div></div>
    <div><div class="big">${num(meta.verses)}</div><div class="cap">verses that have a twin</div></div>
  </div>
  <p>Some verses have more than one twin — a short refrain can repeat many times over — which is
  why there are more pairs than verses. The app connects all of them.</p>

  <h2>What do they look like?</h2>
  <p>Each verse below is cut straight out of the printed page, at the size the app shows it. The
  neighbouring verses are faded so only the verse itself reads clearly, and the whole verse is
  washed <span class="swatch" style="background:rgba(63,125,67,.16);border:1px solid var(--green)"></span>
  green — because for a twin, every single word is shared. Read the two crops in each pair and you
  are reading the same verse, twice.</p>
  <div class="gallery">
${gallery}
  </div>

  <h2>What does the app do with them?</h2>
  <p>When you are on one twin, the app offers you the other — a bridge from here to the place this
  same verse also lives. It is drawn from the app's own reading of the printed pages; the app finds
  the twins itself, from the words it already has, and keeps no separate copy of the Qur'an to do
  it.</p>

  <footer>
    <p>Built by <code>scripts/build-twins-explainer.mjs</code> from the app's own twin data and the
    printed pages it already ships. The counts re-derive from that data; every crop is the real
    page.</p>
    <p>Why the app finds these itself rather than copying them from elsewhere, and what that choice
    cost — the full reasoning is on the decision page:
    <a href="similar-ayah-enrichment.html">similar-ayah-enrichment.html</a>.</p>
    <p>This page's address on the site:
    <a href="https://blog.bytesofpurpose.com/hifth/docs/design/verse-twins.html">blog.bytesofpurpose.com/hifth/docs/design/verse-twins.html</a></p>
  </footer>
</main>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log(`wrote ${OUT.replace(ROOT, "")}  (${DRAW.length} twins drawn, ${num(meta.pairs)} pairs / ${num(meta.verses)} verses cited)`);
