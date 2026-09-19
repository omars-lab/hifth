#!/usr/bin/env node
/**
 * Render docs/design/selection-drawer.html — the live feature page for the two
 * drawers a reader opens ON a verse of the print:
 *
 *   a short tap on a word   → the WORD drawer  (a bottom sheet that holds the
 *                             fine picker: every letter and every mark of that
 *                             word, each its own target, laid out the way it
 *                             sits on the page — marks above or below the letter
 *                             they ride)
 *   a long press on a word  → the AYAH drawer  (a bottom sheet of the whole-verse
 *                             tools the app already carries: the four kinds of
 *                             note, plus recite, tafseer, bookmark)
 *
 * The sheet is the same shape on a phone and on a desktop — it rises from the
 * bottom of the page either way. Both drawers are built LIVE here, opened by the
 * real gesture, so the owner decides the split by doing it.
 *
 * The word drawer's picker is drawn in the "reconstruct the word" layout: the
 * letters sit in one row, left to right, and each mark sits in its own card in
 * the column of the letter it rides — above it (a fatha, damma, shadda, sukun)
 * or below it (a kasra). Read across, the grid spells the word. A second layout,
 * three plain bands of whole-word copies, is switchable beside it so the two can
 * be compared; the reconstruct one is the default.
 *
 * ── What it reads (committed bytes only) ────────────────────────────────────
 *   apps/web/public/assets/manifest.json              the print's viewBox
 *   apps/web/public/assets/pages/hafs-kfqc/7.svg      the leaf the verse sits on
 *   apps/web/public/assets/words/hafs-kfqc/7.json     the shipped word boxes
 *   apps/web/public/assets/marks/hafs-kfqc/7.json     the shipped per-sign boxes
 *   docs/design/data/harakah-shaped-2-38.json         per-letter / per-mark outlines
 *   apps/web/src/styles/tokens.css                    the app's sizes + colours
 *
 * ── No Qur'an, no held copy ─────────────────────────────────────────────────
 * The print is outlined <path>s with zero Arabic codepoints; page 7 is inlined
 * once as an SVG <symbol> and <use>d per view. Every label a reader reads is
 * English HTML chrome; the SVG carries no <text> and no Arabic. The writer
 * refuses if its own output breaks either rule.
 *
 *   node scripts/build-selection-drawer.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const MANIFEST = join(ROOT, "apps/web/public/assets/manifest.json");
const LEAF = join(ROOT, "apps/web/public/assets/pages/hafs-kfqc/7.svg");
const WORDS = join(ROOT, "apps/web/public/assets/words/hafs-kfqc/7.json");
const MARKS = join(ROOT, "apps/web/public/assets/marks/hafs-kfqc/7.json");
const SHAPED = join(ROOT, "docs/design/data/harakah-shaped-2-38.json");
const OUT = join(ROOT, "docs/design/selection-drawer.html");

const die = (m) => {
  console.error(`build-selection-drawer: ${m}`);
  process.exit(1);
};

// ── The leaf and the crop ────────────────────────────────────────────────────
const PAGE = 7;
const AYAH = "2:38"; // the top verse on page 7 — the one every drawing zooms into

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const [, , VBW, VBH] = manifest.viewBox.split(/\s+/).map(Number);
if (!(VBW > 0 && VBH > 0)) die("manifest viewBox");

const rawLeaf = readFileSync(LEAF, "utf8");
if (/[؀-ۿ]/.test(rawLeaf)) die(`page ${PAGE} carries Arabic codepoints`);
if (/<text\b/.test(rawLeaf)) die(`page ${PAGE} carries <text>`);
const leafInner = rawLeaf.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");

const words = JSON.parse(readFileSync(WORDS, "utf8"));
const marksDoc = JSON.parse(readFileSync(MARKS, "utf8"));

const wordEntry = words.words[AYAH];
if (!wordEntry) die(`no word boxes for ${AYAH}`);
const markList = marksDoc.marks[AYAH];
if (!markList) die(`no marks for ${AYAH}`);

// Word boxes for the verse, addressed by their word index (from + i).
const wordBoxes = wordEntry.boxes.map((b, i) => ({
  w: (wordEntry.from ?? 1) + i,
  x: b[0],
  y: b[1],
  bw: b[2],
  bh: b[3],
}));

// Marks for the verse, each already named and placed on its own ink or by hand.
const signs = markList.map((m, i) => ({
  id: i,
  w: m.w,
  name: m.n,
  x: m.r[0],
  y: m.r[1],
  mw: m.r[2],
  mh: m.r[3],
}));

// The word, shaped from its own Unicode font (Amiri Quran, OFL) so every letter
// and every mark is its OWN outline. Built by scripts/shape-verse-letters.mjs;
// carries outlined paths and ASCII names only.
const shapedDoc = JSON.parse(readFileSync(SHAPED, "utf8"));
if (shapedDoc.key !== AYAH) die(`shaped data is for ${shapedDoc.key}, not ${AYAH}`);

// The print cuts this verse into more boxes than the font makes words: one box is
// the pause mark, and one word is split across two boxes. Map each print box (the
// tap target, 1-based) to its shaped word (0-based), or to null where it has none.
const PRINT_TO_SHAPED = {
  1: 0, 2: 1, 3: 2, 4: 3, 5: null, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8,
  11: 9, 12: 10, 13: 11, 14: 12, 15: 13, 16: 14, 17: 14, 18: 15, 19: 16,
};
{
  const targets = Object.values(PRINT_TO_SHAPED).filter((v) => v !== null);
  for (const t of targets)
    if (!shapedDoc.words[t]) die(`print→shaped names a missing shaped word ${t}`);
  for (let i = 0; i < shapedDoc.words.length; i++)
    if (!targets.includes(i)) die(`shaped word ${i} is unreachable from any print box`);
  for (const w of wordBoxes)
    if (!(w.w in PRINT_TO_SHAPED)) die(`print word ${w.w} has no shaped mapping`);
}

// The crop is the union of the verse's word boxes, padded, so the verse fills the
// stage at a size where a reader can aim a tap at a single word.
const minX = Math.min(...wordBoxes.map((b) => b.x));
const minY = Math.min(...wordBoxes.map((b) => b.y));
const maxX = Math.max(...wordBoxes.map((b) => b.x + b.bw));
const maxY = Math.max(...wordBoxes.map((b) => b.y + b.bh));
const PAD = 3;
const crop = {
  x: Math.max(0, minX - PAD),
  y: Math.max(0, minY - PAD),
  w: Math.min(VBW, maxX + PAD) - Math.max(0, minX - PAD),
  h: Math.min(VBH, maxY + PAD) - Math.max(0, minY - PAD),
};

const DATA = {
  vbw: VBW,
  vbh: VBH,
  crop,
  words: wordBoxes,
  shaped: shapedDoc.words,
  printToShaped: PRINT_TO_SHAPED,
  ayah: AYAH,
  page: PAGE,
};

// ── The page ─────────────────────────────────────────────────────────────────
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The word and ayah drawers</title>
<style>
  :root{
    --paper:#f4efe6; --paper-raised:#fbf8f2; --paper-sunk:#ece4d6;
    --ink:#26201a; --ink-soft:#5c5347; --ink-faint:#6b6255;
    --accent:#1f6f66; --accent-strong:#17544d; --accent-tint:#d7e7e3;
    --sel:#e8a13a; --sel-soft:rgba(232,161,58,.32);
    --radius-sm:6px; --radius-md:10px; --radius-lg:16px; --radius-pill:999px;
    --shadow:0 1px 2px rgba(38,32,26,.10),0 6px 20px rgba(38,32,26,.10);
    --sheet-shadow:0 -2px 10px rgba(38,32,26,.10),0 -12px 40px rgba(38,32,26,.22);
    --k-comment:#1f6f66; --k-correction:#c1622d; --k-question:#7a5bbd; --k-dev:#5c5347;
    --maxw:52rem;
  }
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{margin:0;background:var(--paper);color:var(--ink);
    font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
  main{max-width:var(--maxw);margin:0 auto;padding:2rem 1.25rem 5rem;}
  h1{font-size:1.9rem;line-height:1.2;margin:.2rem 0 .4rem;text-wrap:balance;}
  h2{font-size:1.28rem;margin:2.4rem 0 .5rem;text-wrap:balance;}
  h3{font-size:1.05rem;margin:1.6rem 0 .35rem;color:var(--ink-soft);}
  p,li{max-width:38rem;} .lead{font-size:1.12rem;color:var(--ink-soft);}
  a{color:var(--accent-strong);text-underline-offset:2px;}
  .glossary{background:var(--paper-raised);border:1px solid var(--paper-sunk);
    border-radius:var(--radius-md);padding:.8rem 1rem;margin:1.2rem 0;font-size:.95rem;}
  .glossary dt{font-weight:650;} .glossary dd{margin:0 0 .5rem;color:var(--ink-soft);}
  .note{border-left:3px solid var(--accent);background:var(--accent-tint);
    padding:.7rem .95rem;border-radius:0 var(--radius-sm) var(--radius-sm) 0;margin:1.2rem 0;font-size:.96rem;}

  /* ── The live stage: the verse you press on ── */
  .try{background:var(--paper-raised);border:1px solid var(--paper-sunk);
    border-radius:var(--radius-lg);padding:1rem;margin:1.4rem 0;box-shadow:var(--shadow);}
  .hint{text-align:center;color:var(--ink-faint);font-size:.9rem;margin:.1rem 0 .8rem;min-height:1.2em;}
  .stage{position:relative;width:100%;max-width:34rem;margin:0 auto;
    aspect-ratio:${(crop.w / crop.h).toFixed(4)};background:var(--paper);
    border:1px solid var(--paper-sunk);border-radius:var(--radius-md);overflow:hidden;touch-action:none;}
  .stage svg{position:absolute;inset:0;width:100%;height:100%;display:block;}
  .leaf path{fill:var(--ink);}
  .wordhit{fill:transparent;stroke:none;cursor:pointer;}
  .wordhit.lit{fill:var(--accent-tint);opacity:.5;}
  .wordhit.press{fill:var(--sel-soft);opacity:.7;}
  .try-tip{text-align:center;color:var(--ink-faint);font-size:.82rem;margin:.7rem 0 0;}

  /* ── The bottom sheet: the same shape on phone and desktop ── */
  .scrim{position:fixed;inset:0;background:rgba(38,32,26,.34);opacity:0;visibility:hidden;
    transition:opacity .18s ease;z-index:50;}
  .scrim.open{opacity:1;visibility:visible;}
  .sheet{position:fixed;left:50%;bottom:0;transform:translate(-50%,100%);
    width:100%;max-width:40rem;background:var(--paper-raised);
    border-radius:var(--radius-lg) var(--radius-lg) 0 0;box-shadow:var(--sheet-shadow);
    z-index:51;transition:transform .22s cubic-bezier(.22,1,.36,1);
    max-height:88vh;display:flex;flex-direction:column;}
  .sheet.open{transform:translate(-50%,0);}
  .sheet-grip{width:2.4rem;height:.32rem;border-radius:999px;background:var(--paper-sunk);
    margin:.55rem auto .2rem;flex:0 0 auto;}
  .sheet-head{display:flex;align-items:baseline;gap:.6rem;justify-content:space-between;
    padding:.2rem 1.1rem .6rem;flex:0 0 auto;border-bottom:1px solid var(--paper-sunk);}
  .sheet-head h3{margin:0;font-size:1.05rem;color:var(--ink);}
  .sheet-head .scope{font-size:.78rem;color:var(--ink-faint);}
  .sheet-x{appearance:none;border:0;background:transparent;color:var(--ink-soft);
    font-size:1.3rem;line-height:1;cursor:pointer;padding:.1rem .3rem;border-radius:var(--radius-sm);}
  .sheet-x:hover{background:var(--paper-sunk);}
  .sheet-body{overflow-y:auto;padding:.85rem 1.1rem 1.4rem;flex:1 1 auto;}
  @media (min-width:34rem){
    /* on a wide screen the sheet still rises from the bottom, but sits inset a
       little from the edges so it reads as a panel, not a full drawer */
    .sheet{bottom:0;border-radius:var(--radius-lg) var(--radius-lg) 0 0;}
  }
  @media (prefers-reduced-motion:reduce){
    .sheet{transition:none;} .scrim{transition:none;}
  }

  /* ── The word drawer's picker ── */
  .laytoggle{display:flex;gap:.25rem;background:var(--paper-sunk);border-radius:var(--radius-pill);
    padding:.22rem;margin:0 auto .7rem;width:max-content;max-width:100%;}
  .laytoggle button{appearance:none;border:0;background:transparent;color:var(--ink-soft);
    font:inherit;font-size:.82rem;font-weight:600;padding:.32rem .8rem;border-radius:var(--radius-pill);cursor:pointer;}
  .laytoggle button[aria-pressed="true"]{background:var(--paper-raised);color:var(--ink);box-shadow:var(--shadow);}
  .lay-note{font-size:.78rem;color:var(--ink-faint);text-align:center;max-width:30rem;margin:0 auto .7rem;}

  /* Reconstruct layout: letters in one row, each mark stacked in its letter's
     column — above or below by kind. Three grid rows (above / letters / below)
     keep every letter card on one baseline; a column with no mark leaves its
     band empty so the letters still line up. */
  .recon{display:grid;grid-auto-flow:column;grid-template-rows:auto auto auto;
    gap:.3rem .28rem;justify-content:center;align-items:stretch;overflow-x:auto;padding:.2rem;}
  .rband{display:flex;flex-direction:column;align-items:center;gap:.24rem;}
  .rband.above{justify-content:flex-end;}
  .rband.below{justify-content:flex-start;}
  .rband.base{justify-content:center;}
  .rcell{appearance:none;font:inherit;border:1px solid var(--paper-sunk);
    background:var(--paper);border-radius:var(--radius-sm);padding:.12rem;
    cursor:pointer;display:flex;align-items:center;justify-content:center;
    transition:border-color .1s,background .1s;}
  .rcell svg{display:block;}
  .rcell .ink{fill:var(--ink);transition:fill .12s;}
  .rcell:hover{border-color:var(--accent);background:var(--accent-tint);}
  .rcell:hover .ink{fill:var(--accent-strong);}
  .rcell:focus-visible{outline:2px solid var(--accent);outline-offset:1px;}
  .rcell.sel{border-color:var(--sel);background:var(--sel-soft);}
  .rcell.sel .ink{fill:var(--sel);}
  .rcell.mark{border-style:dashed;}

  /* Three-bands layout: keep the whole-word ghost copies, split into rows. */
  .bands{display:flex;flex-direction:column;gap:.5rem;}
  .bandrow{display:flex;gap:.4rem;overflow-x:auto;padding:.1rem;}
  .bandrow .lab{flex:0 0 auto;align-self:center;font-size:.7rem;color:var(--ink-faint);
    text-transform:uppercase;letter-spacing:.03em;writing-mode:vertical-rl;transform:rotate(180deg);}
  .ppc{appearance:none;font:inherit;border:1px solid var(--paper-sunk);flex:0 0 auto;
    background:var(--paper);border-radius:var(--radius-sm);padding:.15rem;cursor:pointer;
    display:flex;flex-direction:column;align-items:center;gap:.1rem;}
  .ppc .gh{fill:var(--ink);opacity:.10;}
  .ppc .ctx{fill:var(--ink);opacity:.34;}
  .ppc .tk{fill:var(--ink);}
  .ppc:hover{border-color:var(--accent);} .ppc:hover .tk{fill:var(--accent-strong);}
  .ppc.sel{border-color:var(--sel);background:var(--sel-soft);} .ppc.sel .tk{fill:var(--sel);}
  .ppc small{font-size:.62rem;color:var(--ink-soft);white-space:nowrap;}

  /* whole-word buttons + the running tally + the four actions */
  .pp-word{display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;margin:.9rem 0 .2rem;}
  .pp-word button{appearance:none;border:1px solid var(--paper-sunk);background:var(--paper);color:var(--ink);
    border-radius:var(--radius-pill);padding:.35rem .85rem;font:inherit;font-size:.85rem;cursor:pointer;}
  .pp-word button.sel{border-color:var(--sel);background:var(--sel-soft);}
  .pp-word button:focus-visible,.pp-actions button:focus-visible,.aya button:focus-visible,
    .laytoggle button:focus-visible{outline:2px solid var(--accent);outline-offset:1px;}
  .tally{margin:.8rem auto 0;max-width:26rem;border:1px solid var(--paper-sunk);
    border-radius:var(--radius-md);background:var(--paper);padding:.6rem .8rem;}
  .tally h4{margin:0 0 .4rem;font-size:.72rem;font-weight:600;letter-spacing:.03em;
    text-transform:uppercase;color:var(--ink-soft);}
  .tally .none{font-size:.85rem;color:var(--ink-faint);margin:0;}
  .tally ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.35rem .8rem;}
  .tally li{display:flex;align-items:baseline;gap:.4rem;font-size:.9rem;}
  .tally li .n{font-variant-numeric:tabular-nums;font-weight:700;color:var(--sel);}
  .tally li.mark .n{color:var(--ink-soft);}
  .pp-actions{display:none;flex-wrap:wrap;gap:.5rem;justify-content:center;align-items:center;margin:.9rem 0 0;
    border-top:1px dashed var(--paper-sunk);padding-top:.8rem;}
  .pp-actions.show{display:flex;}
  .pp-actions .lab{width:100%;text-align:center;font-size:.85rem;color:var(--ink-soft);margin-bottom:.05rem;}
  .pp-actions button,.aya .kinds button{appearance:none;border:0;color:#fff;border-radius:var(--radius-pill);
    padding:.44rem .95rem;font:inherit;font-size:.85rem;font-weight:600;cursor:pointer;}

  /* ── The ayah drawer ── */
  .aya .lead2{font-size:.92rem;color:var(--ink-soft);margin:.1rem 0 .8rem;}
  .aya h4{margin:1rem 0 .45rem;font-size:.74rem;font-weight:600;letter-spacing:.03em;
    text-transform:uppercase;color:var(--ink-soft);}
  .aya .kinds{display:flex;flex-wrap:wrap;gap:.5rem;}
  .aya .tools{display:flex;flex-wrap:wrap;gap:.5rem;}
  .aya .tools button{appearance:none;border:1px solid var(--paper-sunk);background:var(--paper);
    color:var(--ink);border-radius:var(--radius-pill);padding:.42rem .9rem;font:inherit;font-size:.85rem;cursor:pointer;}
  .aya .tools button:hover{border-color:var(--accent);}
  .aya .did{margin:.9rem 0 0;font-size:.92rem;color:var(--ink);min-height:1.3em;}
  .aya .did b{color:var(--accent-strong);}

  table{border-collapse:collapse;margin:1rem 0;font-size:.94rem;width:100%;max-width:38rem;}
  th,td{border:1px solid var(--paper-sunk);padding:.45rem .6rem;text-align:left;vertical-align:top;}
  th{background:var(--paper-raised);} td:first-child{white-space:nowrap;font-weight:600;}
  .foot{margin-top:3rem;color:var(--ink-faint);font-size:.86rem;border-top:1px solid var(--paper-sunk);padding-top:1rem;}
  @media (prefers-color-scheme:dark){
    :root{--paper:#1c1813;--paper-raised:#241f18;--paper-sunk:#332c22;
      --ink:#ece4d6;--ink-soft:#c3b8a6;--ink-faint:#9a8f7d;
      --accent:#5bb3a6;--accent-strong:#7fc9bd;--accent-tint:#22403b;
      --sheet-shadow:0 -2px 10px rgba(0,0,0,.30),0 -12px 40px rgba(0,0,0,.5);}
    .leaf path{fill:#ece4d6;}
  }
</style>
</head>
<body>
<main>
  <p style="color:var(--ink-faint);font-size:.86rem;margin:0 0 .3rem;">A design, drawn — Hifth</p>
  <h1>The word drawer and the ayah drawer</h1>
  <p class="lead">On a page of the print, one press should reach the tools for a single word, and a
  firmer, longer press should reach the tools for the whole verse. Both open the same way — a sheet
  that rises from the bottom of the screen, on a phone and on a desktop alike. Try it on the real verse
  below: a quick tap opens the word's fine picker; press and hold opens the verse's tools.</p>

  <div class="glossary">
    <dl>
      <dt>Verse (ayah)</dt><dd>One numbered sentence of the Qur'an. The crop below is the top verse of a real page.</dd>
      <dt>Vowel-sign (mark)</dt><dd>A small mark above or below a letter that tells you how it is voiced.</dd>
      <dt>A drawer</dt><dd>A panel of tools that slides up from the bottom of the screen and closes again — the same on a phone and a desktop.</dd>
    </dl>
  </div>

  <div class="note">
    <strong>Two reaches, one page.</strong> Tapping a word already lit it and let a reader note it.
    This adds a second reach on the same spot: hold instead of tap, and the tools widen from the one
    word to the whole verse. The gesture is felt, not read — so it is built here, live, on a real page.
  </div>

  <div class="try">
    <p class="hint" id="hint">Tap a word for its picker. Press and hold a word for the verse's tools.</p>
    <div class="stage" id="stage">
      <svg id="page" viewBox="${crop.x} ${crop.y} ${crop.w} ${crop.h}" aria-label="A real verse of the print, zoomed in">
        <use href="#leaf" x="0" y="0" width="${VBW}" height="${VBH}" class="leaf"></use>
        <g id="words"></g>
      </svg>
    </div>
    <p class="try-tip">On a mouse, hold the button down; on a phone, press and hold. A drag scrolls and cancels.</p>
  </div>

  <!-- the bottom sheet, reused for both drawers -->
  <div class="scrim" id="scrim"></div>
  <div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle" aria-hidden="true">
    <div class="sheet-grip"></div>
    <div class="sheet-head">
      <div>
        <h3 id="sheetTitle">—</h3>
        <div class="scope" id="sheetScope"></div>
      </div>
      <button class="sheet-x" id="sheetX" type="button" aria-label="Close">&times;</button>
    </div>
    <div class="sheet-body" id="sheetBody"></div>
  </div>

  <h2>What is being decided?</h2>
  <p>How a reader opens two different sets of tools on the same page — the ones for a single word, and
  the ones for a whole verse — and where those tools live. The answer drawn here: a quick tap on a word
  opens a bottom drawer holding that word's fine picker; a press-and-hold on the same word opens a
  bottom drawer holding the verse's tools. The drawer is one shape, rising from the bottom, on phone and
  desktop alike.</p>

  <h2>Why is this being asked now?</h2>
  <p>Because the pieces on both sides are ready and want a home. The whole-verse tools already exist —
  a reader can note a verse, read a translation, hear it recited, bookmark it. The word's fine picker
  is built and shaped. What was missing was the single gesture that decides which of the two a reader
  gets when they reach for a word, and one calm place to show each. This page is that gesture and that
  place.</p>

  <h2>What happens if nobody decides?</h2>
  <p>The two toolsets stay split across two places and two habits, and the fine word picker has nowhere
  to open. Nothing breaks — a reader can still light a verse and note a word — but the finest thing this
  was for, pinning a slip to a single sign, has no door, and the verse's tools stay where they are rather
  than meeting the word's tools under one gesture.</p>

  <h2>How does a reader open each? — the options</h2>
  <p>The first is built live above; the other two are described so the edge of the choice is visible.</p>
  <table>
    <tr><th>Way</th><th>The gesture</th><th>What it trades</th></tr>
    <tr><td>Tap vs hold<br><small>drawn here</small></td><td>A quick tap opens the word drawer; a press
      and hold on the same word opens the ayah drawer. Both are bottom sheets.</td><td>One target, two
      depths — nothing new to learn but the hold. Asks a reader to discover that holding does more, and
      asks the build to tell a tap from a hold without misfiring on a scroll.</td></tr>
    <tr><td>Ask which</td><td>Any press opens one sheet that asks &ldquo;this word, or the whole
      verse?&rdquo; and the reader picks.</td><td>Nothing hidden — but a question on every touch, and a
      second tap before any tool, for a choice that is usually obvious.</td></tr>
    <tr><td>Two affordances</td><td>The word's tools open on the word; the verse's tools live behind a
      separate control (a margin handle, a verse number).</td><td>No hold to discover, but a second thing
      on the page to find, and the verse tools no longer reached from the word a reader is looking at.</td></tr>
  </table>

  <h2>What did we already decide that this leans on?</h2>
  <ul>
    <li><strong>A drag across the page selects rather than turns it</strong> — the press-to-a-word gesture
      this splits into a tap and a hold, rather than inventing a new one.</li>
    <li><strong>A reader may pin a note to a single spot</strong> — the four kinds of note (a comment, a
      correction, a question for scholars, a note to the people who build the app) that both drawers carry.</li>
    <li><strong>How a reader picks the exact part of a word</strong> — the fine picker the word drawer
      hosts. This page gives that picker its door and its final layout; it does not reopen which gesture
      picks a part once the drawer is open.</li>
  </ul>

  <h2>What else was considered, and left off?</h2>
  <ul>
    <li><strong>A hard press (force touch) for the verse.</strong> Left off as the primary gesture: only
      some phones sense force and no desktop does, so a press-and-hold that works everywhere is the
      portable form of the same idea. A phone that senses force may use it as a shortcut to the same hold.</li>
    <li><strong>A side drawer on desktop.</strong> Left off so the drawer is one thing to learn: the same
      sheet rising from the bottom on every screen, rather than a sheet on the phone and a rail on the desktop.</li>
    <li><strong>Right-click for the verse on desktop.</strong> Kept as a convenience a real build can add,
      not the thing the design rests on, since a phone has no right-click.</li>
  </ul>

  <h2>What would change the answer?</h2>
  <p>A reader who holds too briefly and keeps landing in the word drawer when they meant the verse would
  push the hold shorter, or toward the &ldquo;ask which&rdquo; option. A reader who never discovers the
  hold at all would argue for a visible second affordance. The honest test is a hafiz on their own phone,
  reaching for a verse's tools without being told how — which is what the live stage above is for.</p>

  <h2>What is this not settling?</h2>
  <p>Not what the verse tools finally hold — recite, translate, bookmark and note are shown as the set
  the app already carries, and their own polish is elsewhere. Not the exact hold time, which is tuning,
  not shape. And not how a part is picked once the word drawer is open — that is the picker's own
  decision; this page only gives it a door and settles its layout, letters in a row with each mark in
  its letter's column.</p>

  <p class="foot">Built by <code>scripts/build-selection-drawer.mjs</code> from the vendored print
  (page ${PAGE}), its shipped word and per-sign boxes, the shaped outlines of verse ${AYAH}, and the
  app's design tokens — committed bytes only. The print is outlined paths; this page carries no Qur'an
  text.</p>
</main>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="leaf" viewBox="0 0 ${VBW} ${VBH}">${leafInner}</symbol>
</svg>

<script>
"use strict";
var DATA = ${JSON.stringify(DATA)};
var SVGNS = "http://www.w3.org/2000/svg";
var stage = document.getElementById("stage");
var page = document.getElementById("page");
var gWords = document.getElementById("words");
var hint = document.getElementById("hint");
var scrim = document.getElementById("scrim");
var sheet = document.getElementById("sheet");
var sheetTitle = document.getElementById("sheetTitle");
var sheetScope = document.getElementById("sheetScope");
var sheetBody = document.getElementById("sheetBody");
var sheetX = document.getElementById("sheetX");

function el(tag, attrs){ var e=document.createElementNS(SVGNS,tag); for(var k in attrs){ e.setAttribute(k, attrs[k]); } return e; }

// Draw the word hit-areas (transparent, tappable) once.
DATA.words.forEach(function(b){
  gWords.appendChild(el("rect",{x:b.x,y:b.y,width:b.bw,height:b.bh,class:"wordhit","data-w":b.w}));
});
function litWord(w, cls){
  gWords.querySelectorAll(".wordhit").forEach(function(r){
    r.setAttribute("class", Number(r.getAttribute("data-w"))===w ? "wordhit "+cls : "wordhit");
  });
}
function clearLit(){ gWords.querySelectorAll(".wordhit").forEach(function(r){ r.setAttribute("class","wordhit"); }); }

function shapedFor(w){ var si=DATA.printToShaped[w]; return (si==null)?null:DATA.shaped[si]; }

// ── The bottom sheet ─────────────────────────────────────────────────────────
var sheetOpen=false, lastFocus=null;
function openSheet(title, scope){
  sheetTitle.textContent=title;
  sheetScope.textContent=scope||"";
  scrim.classList.add("open");
  sheet.classList.add("open");
  sheet.setAttribute("aria-hidden","false");
  sheetOpen=true;
  lastFocus=document.activeElement;
  sheetX.focus();
}
function closeSheet(){
  scrim.classList.remove("open");
  sheet.classList.remove("open");
  sheet.setAttribute("aria-hidden","true");
  sheetOpen=false; clearLit();
  if(lastFocus && lastFocus.focus) lastFocus.focus();
}
scrim.addEventListener("click", closeSheet);
sheetX.addEventListener("click", closeSheet);
document.addEventListener("keydown", function(e){ if(e.key==="Escape"&&sheetOpen) closeSheet(); });

// ── The word drawer ──────────────────────────────────────────────────────────
var sel={}, curNames={}, curWord=null, layout="recon";

// The letter a mark rides: the one whose horizontal span best contains the mark's
// centre, else the nearest by centre. Returns the letter's index.
function baseIdxOf(word, mark){
  var mx=(mark.bb[0]+mark.bb[2])/2, best=0, bestD=Infinity;
  for(var i=0;i<word.letters.length;i++){
    var L=word.letters[i], lo=L.bb[0], hi=L.bb[2];
    var d=(mx>=lo&&mx<=hi)?0:Math.min(Math.abs(mx-lo),Math.abs(mx-hi));
    if(d<bestD){ bestD=d; best=i; }
  }
  return best;
}
// Above or below its letter, read from the ink: a mark whose centre sits higher
// (smaller y, the font is y-down) than the letter's centre rides above it; lower
// rides below. This is the font placing the mark by kind — fatha/damma/shadda/
// sukun land above, kasra lands below — read back off the geometry, not a list.
function bandOf(word, mark, bi){
  var L=word.letters[bi];
  var lcy=(L.bb[1]+L.bb[3])/2, mcy=(mark.bb[1]+mark.bb[3])/2;
  return mcy < lcy ? "above" : "below";
}

// Group the word's marks under their letter, split into the above and below bands,
// each ordered outward from the letter (closest to the letter last, so a flex band
// packs them toward it).
function columnsOf(word){
  var cols=word.letters.map(function(L,i){ return {li:i, letter:L, above:[], below:[]}; });
  word.marks.forEach(function(m,mi){
    var bi=baseIdxOf(word,m);
    var band=bandOf(word,m,bi);
    cols[bi][band].push({m:m, mi:mi});
  });
  // above band DOM order top→bottom = farthest-from-letter first (smallest y first)
  cols.forEach(function(c){
    c.above.sort(function(a,b){ return (a.m.bb[1]+a.m.bb[3]) - (b.m.bb[1]+b.m.bb[3]); });
    // below band top→bottom = closest-to-letter first (smallest y first)
    c.below.sort(function(a,b){ return (a.m.bb[1]+a.m.bb[3]) - (b.m.bb[1]+b.m.bb[3]); });
  });
  return cols;
}

// A tight SVG of one part (letter or mark), the glyph centred in a padded box of
// its own bounds, at a shared scale so a mark reads at its true size beside a letter.
function partSvg(part, heightRem){
  var bb=part.bb, w=bb[2]-bb[0], h=bb[3]-bb[1];
  var pad=Math.max(w,h)*0.16 + 8;
  var vb=[bb[0]-pad, bb[1]-pad, w+2*pad, h+2*pad];
  var ratio=vb[2]/vb[3];
  var svg=el("svg",{viewBox:vb.join(" "),preserveAspectRatio:"xMidYMid meet",
    style:"height:"+heightRem+"rem;width:"+(heightRem*ratio).toFixed(2)+"rem"});
  svg.appendChild(el("path",{d:part.d,class:"ink"}));
  return svg;
}
function partCell(key, name, part, isMark, heightRem){
  var b=document.createElement("button");
  b.type="button"; b.className="rcell"+(isMark?" mark":""); b.setAttribute("data-key",key);
  b.setAttribute("aria-label",name+(isMark?" (mark)":" (letter)"));
  b.title=name;
  b.appendChild(partSvg(part, heightRem));
  b.addEventListener("click", function(){ toggle(key); });
  curNames[key]=name;
  return b;
}

// Reconstruct layout: three grid rows (above / letters / below), one column per
// letter, marks stacked in their letter's column.
function renderRecon(word){
  var grid=document.createElement("div"); grid.className="recon";
  var cols=columnsOf(word);
  cols.forEach(function(c){
    var above=document.createElement("div"); above.className="rband above";
    c.above.forEach(function(x){ above.appendChild(partCell("m:"+x.mi, x.m.name, x.m, true, 1.5)); });
    var base=document.createElement("div"); base.className="rband base";
    base.appendChild(partCell("L:"+c.li, c.letter.name, c.letter, false, 2.8));
    var below=document.createElement("div"); below.className="rband below";
    c.below.forEach(function(x){ below.appendChild(partCell("m:"+x.mi, x.m.name, x.m, true, 1.5)); });
    grid.appendChild(above); grid.appendChild(base); grid.appendChild(below);
  });
  return grid;
}

// Three-bands layout: the whole-word ghost copies, split into an above-marks row,
// a letters row, and a below-marks row. Each copy shows the whole word with one
// part solid; a mark's copy also dims the letter it rides (its anchor).
function wordFrame(word){
  var x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  word.letters.concat(word.marks).forEach(function(s){
    x0=Math.min(x0,s.bb[0]); y0=Math.min(y0,s.bb[1]);
    x1=Math.max(x1,s.bb[2]); y1=Math.max(y1,s.bb[3]);
  });
  var pad=(x1-x0)*0.04+20;
  return [x0-pad, y0-pad, (x1-x0)+2*pad, (y1-y0)+2*pad];
}
function ghostCell(word, frame, key, name, targetPart, anchor){
  var b=document.createElement("button");
  b.type="button"; b.className="ppc"; b.setAttribute("data-key",key); b.setAttribute("aria-label",name);
  var ratio=frame[2]/frame[3];
  var svg=el("svg",{viewBox:frame.join(" "),preserveAspectRatio:"xMidYMid meet",
    style:"height:3.6rem;width:"+(3.6*ratio).toFixed(2)+"rem"});
  var inkClass=function(p){ return p===targetPart?"tk":(p===anchor?"ctx":"gh"); };
  word.letters.forEach(function(L){ svg.appendChild(el("path",{d:L.d,class:inkClass(L)})); });
  word.marks.forEach(function(m){ svg.appendChild(el("path",{d:m.d,class:inkClass(m)})); });
  b.appendChild(svg);
  var lab=document.createElement("small"); lab.textContent=name; b.appendChild(lab);
  b.addEventListener("click", function(){ toggle(key); });
  curNames[key]=name;
  return b;
}
function renderBands(word){
  var frame=wordFrame(word);
  var wrap=document.createElement("div"); wrap.className="bands";
  var cols=columnsOf(word);
  var aboveMarks=[], belowMarks=[];
  cols.forEach(function(c){
    c.above.forEach(function(x){ aboveMarks.push(x); });
    c.below.forEach(function(x){ belowMarks.push(x); });
  });
  function row(labelText, build){
    var r=document.createElement("div"); r.className="bandrow";
    var lab=document.createElement("span"); lab.className="lab"; lab.textContent=labelText; r.appendChild(lab);
    build(r); wrap.appendChild(r);
  }
  row("above", function(r){
    aboveMarks.forEach(function(x){ r.appendChild(ghostCell(word,frame,"m:"+x.mi,x.m.name,x.m,word.letters[baseIdxOf(word,x.m)])); });
  });
  row("letters", function(r){
    for(var li=0; li<word.letters.length; li++) r.appendChild(ghostCell(word,frame,"L:"+li,word.letters[li].name,word.letters[li]));
  });
  row("below", function(r){
    belowMarks.forEach(function(x){ r.appendChild(ghostCell(word,frame,"m:"+x.mi,x.m.name,x.m,word.letters[baseIdxOf(word,x.m)])); });
  });
  return wrap;
}

function renderPicker(){
  var word=curWord;
  var host=document.getElementById("pickerHost");
  host.innerHTML="";
  host.appendChild(layout==="recon" ? renderRecon(word) : renderBands(word));
  renderSel();
}

function openWordDrawer(w){
  var word=shapedFor(w);
  if(!word) return;
  litWord(w,"lit");
  curWord=word; sel={}; curNames={};
  openSheet("Pick a part of this word", "one word · verse "+DATA.ayah);
  sheetBody.className="sheet-body";
  sheetBody.innerHTML=
    '<div class="laytoggle" role="group" aria-label="How the parts are laid out">'+
      '<button type="button" data-lay="recon" aria-pressed="true">In place</button>'+
      '<button type="button" data-lay="bands" aria-pressed="false">Three bands</button>'+
    '</div>'+
    '<p class="lay-note" id="layNote"></p>'+
    '<div id="pickerHost"></div>'+
    '<div class="pp-word">'+
      '<button id="wWith" type="button">Whole word, with marks</button>'+
      '<button id="wWithout" type="button">Letters only, no marks</button>'+
    '</div>'+
    '<div class="tally" id="tally"></div>'+
    '<div class="pp-actions" id="ppActions">'+
      '<span class="lab">What do you want to do with the selection?</span>'+
      '<button type="button" style="background:var(--k-comment)" data-kind="Comment">Add a comment</button>'+
      '<button type="button" style="background:var(--k-correction)" data-kind="Correction">Flag a mistake</button>'+
      '<button type="button" style="background:var(--k-question)" data-kind="Question">Ask a question</button>'+
      '<button type="button" style="background:var(--k-dev)" data-kind="Note to us">Note to us</button>'+
    '</div>';
  setLayoutNote();
  renderPicker();
  sheetBody.querySelectorAll(".laytoggle button").forEach(function(b){
    b.addEventListener("click", function(){ setLayout(b.getAttribute("data-lay")); });
  });
  document.getElementById("wWith").addEventListener("click", function(){ toggle("word"); });
  document.getElementById("wWithout").addEventListener("click", function(){ toggle("wordbare"); });
  sheetBody.querySelectorAll(".pp-actions button").forEach(function(b){
    b.addEventListener("click", function(){ doAction(b.getAttribute("data-kind")); });
  });
}
function setLayout(l){
  layout=l;
  sheetBody.querySelectorAll(".laytoggle button").forEach(function(b){
    b.setAttribute("aria-pressed", b.getAttribute("data-lay")===l?"true":"false");
  });
  setLayoutNote();
  renderPicker();
}
function setLayoutNote(){
  var n=document.getElementById("layNote"); if(!n) return;
  n.textContent = layout==="recon"
    ? "The letters sit in a row; each mark is in its letter's column, above it or below it. Read across, they spell the word."
    : "Each letter and mark is a whole-word copy with one part inked; the copies are split into an above row, a letters row, and a below row.";
}
function toggle(key){ if(sel[key]) delete sel[key]; else sel[key]=true; renderSel(); }
function renderSel(){
  var host=document.getElementById("pickerHost");
  if(host) host.querySelectorAll("[data-key]").forEach(function(c){ c.classList.toggle("sel", !!sel[c.getAttribute("data-key")]); });
  var wWith=document.getElementById("wWith"), wWithout=document.getElementById("wWithout");
  if(wWith) wWith.classList.toggle("sel", !!sel["word"]);
  if(wWithout) wWithout.classList.toggle("sel", !!sel["wordbare"]);
  var acts=document.getElementById("ppActions");
  if(acts) acts.classList.toggle("show", Object.keys(sel).length>0);
  renderTally();
}
function tallyBy(keys,pred){
  var byName={}, order=[];
  keys.filter(pred).forEach(function(k){
    var nm=curNames[k]||"part";
    if(byName[nm]==null){ byName[nm]=0; order.push(nm); }
    byName[nm]++;
  });
  return order.map(function(nm){ return {nm:nm, n:byName[nm]}; });
}
function plural(nm,n){ return n>1 ? nm+"s" : nm; }
function renderTally(){
  var t=document.getElementById("tally"); if(!t) return;
  var keys=Object.keys(sel);
  if(!keys.length){ t.innerHTML='<h4>Your pick</h4><p class="none">Tap a letter or a mark. Take one, or several at once.</p>'; return; }
  var lets=tallyBy(keys,function(k){ return k.charAt(0)==="L"; });
  var marks=tallyBy(keys,function(k){ return k.indexOf("m:")===0; });
  var html='<h4>Your pick</h4><ul>';
  lets.forEach(function(r){ html+='<li><span class="n">'+r.n+'</span><span class="nm">'+plural(r.nm,r.n)+'</span></li>'; });
  marks.forEach(function(r){ html+='<li class="mark"><span class="n">'+r.n+'</span><span class="nm">'+plural(r.nm,r.n)+'</span></li>'; });
  if(sel["word"]) html+='<li><span class="nm">the whole word, with marks</span></li>';
  if(sel["wordbare"]) html+='<li><span class="nm">the letters, no marks</span></li>';
  html+='</ul>';
  t.innerHTML=html;
}
function summary(){
  var keys=Object.keys(sel);
  var nl=keys.filter(function(k){ return k.charAt(0)==="L"; }).length;
  var mk=keys.filter(function(k){ return k.indexOf("m:")===0; }).map(function(k){ return curNames[k]; });
  var parts=[];
  if(nl) parts.push(nl+(nl===1?" letter":" letters"));
  if(mk.length) parts.push(mk.join(", "));
  if(sel["word"]) parts.push("the whole word");
  if(sel["wordbare"]) parts.push("the letters (no marks)");
  return parts.join(" + ") || "nothing";
}
function doAction(kind){
  if(!Object.keys(sel).length) return;
  var acts=document.getElementById("ppActions");
  var lab=acts.querySelector(".lab");
  lab.innerHTML="<b>"+kind+"</b> pinned to <b>"+summary()+"</b>. In the app this opens the note editor.";
}

// ── The ayah drawer ──────────────────────────────────────────────────────────
function openAyahDrawer(w){
  litWord(w,"press");
  openSheet("Verse "+DATA.ayah, "the whole ayah");
  sheetBody.className="sheet-body aya";
  sheetBody.innerHTML=
    '<p class="lead2">The tools for the whole verse — the same set the app already carries, reached by holding instead of tapping.</p>'+
    '<h4>Pin a note to the verse</h4>'+
    '<div class="kinds">'+
      '<button type="button" style="background:var(--k-comment)" data-kind="Comment">Add a comment</button>'+
      '<button type="button" style="background:var(--k-correction)" data-kind="Correction">Flag a mistake</button>'+
      '<button type="button" style="background:var(--k-question)" data-kind="Question">Ask a question</button>'+
      '<button type="button" style="background:var(--k-dev)" data-kind="Note to us">Note to us</button>'+
    '</div>'+
    '<h4>Verse tools</h4>'+
    '<div class="tools">'+
      '<button type="button" data-tool="Recite">Play recitation</button>'+
      '<button type="button" data-tool="Translation">Read a translation</button>'+
      '<button type="button" data-tool="Tafseer">Open tafseer</button>'+
      '<button type="button" data-tool="Bookmark">Bookmark</button>'+
    '</div>'+
    '<p class="did" id="ayaDid"></p>';
  var did=document.getElementById("ayaDid");
  sheetBody.querySelectorAll(".kinds button").forEach(function(b){
    b.addEventListener("click", function(){ did.innerHTML="<b>"+b.getAttribute("data-kind")+"</b> pinned to verse "+DATA.ayah+". In the app this opens the note editor."; });
  });
  sheetBody.querySelectorAll(".tools button").forEach(function(b){
    b.addEventListener("click", function(){ did.innerHTML="<b>"+b.getAttribute("data-tool")+"</b> — in the app this opens the verse's "+b.getAttribute("data-tool").toLowerCase()+"."; });
  });
}

// ── The gesture: tap vs press-and-hold ───────────────────────────────────────
var HOLD_MS=450, MOVE_CANCEL=10; // px of movement that turns a press into a scroll
var press=null; // {w, x, y, timer, fired}
function wordAt(e){
  var t=e.target;
  if(t && t.classList && t.classList.contains("wordhit")) return Number(t.getAttribute("data-w"));
  return null;
}
function onDown(e){
  if(sheetOpen) return;
  var w=wordAt(e); if(w==null) return;
  e.preventDefault();
  stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
  litWord(w,"press");
  press={ w:w, x:e.clientX, y:e.clientY, fired:false, timer:setTimeout(function(){
    press.fired=true; openAyahDrawer(w);
  }, HOLD_MS) };
}
function onMove(e){
  if(!press || press.fired) return;
  if(Math.abs(e.clientX-press.x)>MOVE_CANCEL || Math.abs(e.clientY-press.y)>MOVE_CANCEL){
    clearTimeout(press.timer); clearLit(); press=null;
  }
}
function onUp(e){
  if(!press) return;
  clearTimeout(press.timer);
  var wasQuick=!press.fired, w=press.w;
  press=null;
  if(wasQuick) openWordDrawer(w); // a hold already opened the ayah drawer
}
function onCancel(){ if(press){ clearTimeout(press.timer); press=null; } if(!sheetOpen) clearLit(); }
stage.addEventListener("pointerdown", onDown);
stage.addEventListener("pointermove", onMove);
stage.addEventListener("pointerup", onUp);
stage.addEventListener("pointercancel", onCancel);
// keyboard: a plain click (Enter/Space on a focused word) opens the word drawer;
// the hold has no keyboard form, so the ayah drawer is reached another way there.
gWords.querySelectorAll(".wordhit").forEach(function(r){
  r.setAttribute("tabindex","0"); r.setAttribute("role","button");
  r.addEventListener("keydown", function(ev){
    if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); openWordDrawer(Number(r.getAttribute("data-w"))); }
  });
});
</script>
</body>
</html>
`;

if (/[؀-ۿ]/.test(html)) die("output carries an Arabic codepoint");
if (/<text\b/.test(leafInner)) die("leaf symbol carries <text>");

writeFileSync(OUT, html);
console.log(
  `build-selection-drawer: wrote ${OUT} — page ${PAGE} verse ${AYAH}, ` +
    `${wordBoxes.length} words, ${shapedDoc.words.length} shaped, crop ${crop.w.toFixed(0)}x${crop.h.toFixed(0)}`,
);
