#!/usr/bin/env node
/**
 * Render docs/design/harakah-pick-options.html — the live options for the one
 * thing left before a reader can pin a note to a single vowel-sign: how, on a
 * real page where a sign is smaller than a fingertip, they pick the one they
 * mean. The decision to ALLOW a single-mark note is already made
 * (docs/decisions/mistake-marking.md, option D, 2026-09-02); that record noted
 * the app "does not know a rectangle for a single letter". It does now — the
 * per-mark ink geometry ships (docs/decisions/mark-placement.md, option H) — so
 * the only open thing is the picking gesture, and a gesture is felt, not drawn.
 *
 * Three interactions are built LIVE and switched by a segmented control, each
 * on the same real crop of the print, so the owner decides by doing them:
 *   A · Word then sign — tap the (big) word, its signs lift into a tray, tap one
 *   B · Press & loupe  — press the page, a magnifier snaps the nearest sign
 *   C · Word then names — tap the word, pick its sign by name from a chip row
 *
 * The three are interchangeable pickers behind one shared interface in the core
 * (packages/core/src/decision-options/harakah-pick.ts, OptionA..OptionC). Which
 * signs a word opens into, and which sign a press snaps to, come from THOSE
 * functions, inlined here by `.toString()` — so the page runs the code the unit
 * test checks and the app's mistake tool mounts (A, the default, until the owner
 * chooses). Build the core first: `pnpm --filter @hifth/core build`.
 * A's fuller version, which reaches single letters as well as signs, stays
 * behind a switch under A; it is drawn from one verse's font shapes only.
 *
 * ── What it reads (committed bytes only) ────────────────────────────────────
 *   apps/web/public/assets/manifest.json              the print's viewBox
 *   apps/web/public/assets/pages/hafs-kfqc/7.svg      the leaf the signs sit on
 *   apps/web/public/assets/words/hafs-kfqc/7.json     the shipped word boxes
 *   apps/web/public/assets/marks/hafs-kfqc/7.json     the shipped per-sign boxes
 *   apps/web/src/styles/tokens.css                    the app's sizes + colours
 *
 * ── No Qur'an, no held copy ─────────────────────────────────────────────────
 * The print is outlined <path>s with zero Arabic codepoints; page 7 is inlined
 * once as an SVG <symbol> and <use>d per view. Every label a reader reads is
 * English HTML chrome; the SVG carries no <text> and no Arabic. The writer
 * refuses if its own output breaks either rule.
 *
 *   node scripts/build-harakah-pick-options.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const MANIFEST = join(ROOT, "apps/web/public/assets/manifest.json");
const LEAF = join(ROOT, "apps/web/public/assets/pages/hafs-kfqc/7.svg");
const WORDS = join(ROOT, "apps/web/public/assets/words/hafs-kfqc/7.json");
const MARKS = join(ROOT, "apps/web/public/assets/marks/hafs-kfqc/7.json");
const OUT = join(ROOT, "docs/design/harakah-pick-options.html");
const CORE = join(ROOT, "packages/core/dist/index.js");

const die = (m) => {
  console.error(`build-harakah-pick-options: ${m}`);
  process.exit(1);
};

// ── The pickers, from the core ───────────────────────────────────────────────
const { HARAKAH_PICKERS, HARAKAH_PICK_DEFAULT } = await import(CORE);
if (!HARAKAH_PICKERS) die("core has no HARAKAH_PICKERS — run the core build first");
// Each picker's two functions, inlined once by source and named by their own
// names, so the page's script calls exactly what the core exports.
const pickerFns = new Map();
for (const p of HARAKAH_PICKERS) for (const fn of [p.choices, p.snap]) pickerFns.set(fn.name, fn);
const PICKERS_JS = [
  ...[...pickerFns.values()].map((fn) => fn.toString()),
  `var PICKERS = {${HARAKAH_PICKERS.map(
    (p) =>
      `${p.id}: {label: ${JSON.stringify(p.label)}, startsOn: ${JSON.stringify(p.startsOn)}, ` +
      `shows: ${JSON.stringify(p.shows)}, choices: ${p.choices.name}, snap: ${p.snap.name}}`,
  ).join(", ")}};`,
  `var DEFAULT_PICKER = ${JSON.stringify(HARAKAH_PICK_DEFAULT.id)};`,
].join("\n");

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
  src: m.s,
}));

// The word, shaped from its own Unicode font (Amiri Quran, OFL) so every letter
// and every mark is its OWN outline. This is what the precision picker draws each
// part from: because the parts are separate shapes, inking one and hiding the rest
// is bleed-free, where slicing one merged print outline could not be. Built by
// scripts/shape-verse-letters.mjs; carries outlined paths and ASCII names only.
const SHAPED = join(ROOT, "docs/design/data/harakah-shaped-2-38.json");
const shapedDoc = JSON.parse(readFileSync(SHAPED, "utf8"));
if (shapedDoc.key !== AYAH) die(`shaped data is for ${shapedDoc.key}, not ${AYAH}`);
// The print cuts this verse into 19 boxes; the font shapes it into 17 words. Map
// each print word (the tap target, 1-based) to its shaped word (0-based). Two
// print boxes carry no word of their own: box 5 is the pause mark, and boxes
// 16+17 are the two halves of one word — both of which open that one shaped word.
const PRINT_TO_SHAPED = {
  1: 0, 2: 1, 3: 2, 4: 3, 5: null, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8,
  11: 9, 12: 10, 13: 11, 14: 12, 15: 13, 16: 14, 17: 14, 18: 15, 19: 16,
};
// Guard the map against a data drift: every target must exist, and every shaped
// word must be reachable from some print box.
{
  const targets = Object.values(PRINT_TO_SHAPED).filter((v) => v !== null);
  for (const t of targets)
    if (!shapedDoc.words[t]) die(`print→shaped names a missing shaped word ${t}`);
  for (let i = 0; i < shapedDoc.words.length; i++)
    if (!targets.includes(i)) die(`shaped word ${i} is unreachable from any print box`);
  for (const w of wordBoxes)
    if (!(w.w in PRINT_TO_SHAPED)) die(`print word ${w.w} has no shaped mapping`);
}

// The crop is the union of the verse's word boxes, padded, so the verse fills
// the stage at a size where the signs are actually visible.
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

// How many signs sit on the verse, and the median sign size, for the prose.
const medW = [...signs.map((s) => s.mw)].sort((a, b) => a - b)[signs.length >> 1];
const medH = [...signs.map((s) => s.mh)].sort((a, b) => a - b)[signs.length >> 1];

const DATA = {
  vbw: VBW,
  vbh: VBH,
  crop,
  words: wordBoxes,
  signs,
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
<title>Picking the exact part</title>
<style>
  :root{
    --paper:#f4efe6; --paper-raised:#fbf8f2; --paper-sunk:#ece4d6;
    --ink:#26201a; --ink-soft:#5c5347; --ink-faint:#6b6255;
    --accent:#1f6f66; --accent-strong:#17544d; --accent-tint:#d7e7e3;
    --danger:#a23b2c;
    /* A caught sign is a marked mistake, so it wears the app's mistake red. */
    --sel:var(--danger); --sel-soft:rgba(162,59,44,.18);
    --radius-sm:6px; --radius-md:10px; --radius-lg:16px; --radius-pill:999px;
    --shadow:0 1px 2px rgba(38,32,26,.10),0 6px 20px rgba(38,32,26,.10);
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

  /* ── The live stage ── */
  .try{background:var(--paper-raised);border:1px solid var(--paper-sunk);
    border-radius:var(--radius-lg);padding:1rem;margin:1.4rem 0;box-shadow:var(--shadow);}
  .seg{display:flex;gap:.25rem;background:var(--paper-sunk);border-radius:var(--radius-pill);
    padding:.25rem;margin:0 auto 1rem;width:max-content;max-width:100%;flex-wrap:wrap;}
  .seg button{appearance:none;border:0;background:transparent;color:var(--ink-soft);
    font:inherit;font-size:.92rem;font-weight:600;padding:.4rem .9rem;border-radius:var(--radius-pill);cursor:pointer;}
  .seg button[aria-pressed="true"]{background:var(--paper-raised);color:var(--ink);box-shadow:var(--shadow);}
  .hint{text-align:center;color:var(--ink-faint);font-size:.9rem;margin:.1rem 0 .8rem;min-height:1.2em;}
  .stage{position:relative;width:100%;max-width:34rem;margin:0 auto;
    aspect-ratio:${(crop.w / crop.h).toFixed(4)};background:var(--paper);
    border:1px solid var(--paper-sunk);border-radius:var(--radius-md);overflow:hidden;touch-action:none;}
  .stage svg{position:absolute;inset:0;width:100%;height:100%;display:block;}
  .leaf path{fill:var(--ink);}
  .wordhit{fill:transparent;stroke:none;cursor:pointer;}
  .wordhit.lit{fill:var(--accent-tint);opacity:.5;}
  .sign{fill:none;stroke:var(--accent);stroke-width:.5;opacity:.55;}
  .sign.snap{stroke:var(--sel);stroke-width:.9;opacity:1;}
  .sign.caught{fill:var(--sel-soft);stroke:var(--sel);stroke-width:.9;opacity:1;}
  .loupe{position:fixed;z-index:60;width:9rem;height:9rem;border-radius:50%;
    border:2px solid var(--accent-strong);box-shadow:var(--shadow);overflow:hidden;
    pointer-events:none;background:var(--paper);transform:translate(-50%,-50%);display:none;}
  .loupe .cross{position:absolute;inset:0;}
  /* ── The tray (option A) and chips (option C) ── */
  /* Right to left, as the app's tray is: the first sign read is the first tile. */
  .tray{display:none;flex-wrap:wrap;gap:.5rem;justify-content:center;margin:.9rem 0 .2rem;direction:rtl;}
  .fuller{display:block;text-align:center;font-size:.8rem;color:var(--ink-soft);margin:.4rem 0 0;}
  .tray.show{display:flex;}
  .tray .sgn{appearance:none;border:1px solid var(--paper-sunk);background:var(--paper-raised);
    border-radius:var(--radius-md);padding:.4rem;cursor:pointer;display:flex;flex-direction:column;
    align-items:center;gap:.2rem;min-width:3.4rem;}
  .tray .sgn.sel{border-color:var(--danger);box-shadow:inset 0 0 0 1px var(--danger);}
  .tray .sgn svg{width:4rem;height:4rem;background:#fff;border-radius:4px;}
  .tray .sgn small{font-size:.68rem;color:var(--ink-soft);}
  .tray .sgn:focus-visible,.chip:focus-visible,.seg button:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
  .chips{display:none;flex-wrap:wrap;gap:.4rem;justify-content:center;margin:.9rem 0 .2rem;}
  .chips.show{display:flex;}
  .chip{appearance:none;border:1px solid var(--paper-sunk);background:var(--paper-raised);
    color:var(--ink);border-radius:var(--radius-pill);padding:.35rem .8rem;font:inherit;font-size:.86rem;cursor:pointer;}
  .chip .pos{color:var(--ink-faint);font-variant-numeric:tabular-nums;margin-inline-end:.35rem;}
  /* ── The precision panel (option A, the winner being shaped) ── */
  .panel{display:none;margin:.9rem 0 .2rem;}
  .panel.show{display:block;}
  .pp-note{font-size:.78rem;color:var(--ink-faint);text-align:center;max-width:34rem;margin:0 auto .6rem;}
  /* the word and its running tally sit side by side; the tally is a status menu
     beside the word, not a line beneath it. On a narrow screen they stack. */
  .pp-body{display:flex;gap:1rem;align-items:stretch;justify-content:center;flex-wrap:wrap;}
  .pp-scroll{overflow-x:auto;padding:.15rem;flex:1 1 20rem;min-width:0;}
  /* Each part gets its OWN copy of the word, spaced apart in a row. In a copy, one
     part is solid ink and every other part is invisible ink — there to hold the
     letter's place, so you still see which word it is. Tap a copy to take that part. */
  .pp-strip{display:flex;flex-wrap:nowrap;gap:.55rem;width:max-content;min-width:16rem;
    margin:0 auto;padding:.1rem;}
  .pp-cell{appearance:none;font:inherit;border:1px solid var(--paper-sunk);
    background:var(--paper-raised);border-radius:var(--radius);padding:.3rem .3rem .2rem;
    cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:.2rem;
    transition:border-color .1s,background .1s;}
  .pp-cell .cellword{display:block;height:5.6rem;width:auto;}
  /* invisible ink: the other parts, faint, holding their place in the word */
  .pp-cell .gh{fill:var(--ink);opacity:.10;transition:fill .12s;}
  /* the anchor: in a mark's copy, the one letter the mark sits on — drawn a shade
     up from invisible, so the mark reads as stacked above or below THAT letter */
  .pp-cell .ctx{fill:var(--ink);opacity:.34;transition:fill .12s;}
  /* the one part this copy is for */
  .pp-cell .tk{fill:var(--ink);transition:fill .12s;}
  .pp-cell:hover{border-color:var(--accent);background:var(--accent-tint);}
  .pp-cell:hover .tk{fill:var(--accent-strong);}
  .pp-cell:focus-visible{outline:2px solid var(--accent);outline-offset:1px;}
  .pp-cell.sel{border-color:var(--sel);background:var(--sel-soft);}
  .pp-cell.sel .tk{fill:var(--sel);}
  /* the name under each copy — what you take when you tap it */
  .pp-cn{font-size:.72rem;color:var(--ink-soft);white-space:nowrap;line-height:1.1;}
  .pp-cell.sel .pp-cn{color:var(--sel);font-weight:600;}
  /* ── The running tally beside the word ── */
  .pp-aside{flex:0 0 12rem;min-width:11rem;align-self:center;border:1px solid var(--paper-sunk);
    border-radius:var(--radius);background:var(--paper-raised);padding:.65rem .75rem;text-align:left;}
  .pp-aside h4{margin:0 0 .5rem;font-size:.74rem;font-weight:600;letter-spacing:.03em;
    text-transform:uppercase;color:var(--ink-soft);}
  .pp-aside .none{font-size:.82rem;color:var(--ink-faint);line-height:1.35;margin:0;}
  .pp-aside ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.3rem;}
  .pp-aside li{display:flex;align-items:baseline;gap:.5rem;font-size:.9rem;}
  .pp-aside li .n{flex:0 0 1.4rem;text-align:right;font-variant-numeric:tabular-nums;
    font-weight:700;color:var(--sel);}
  .pp-aside li .nm{color:var(--ink);}
  /* letters name the shapes, marks name the signs on them — a hair of colour
     apart so the two groups read as two groups without needing a divider */
  .pp-aside li.mark .n{color:var(--ink-soft);}
  .pp-aside li.whole{margin-top:.15rem;padding-top:.35rem;border-top:1px dashed var(--paper-sunk);
    color:var(--ink-soft);font-size:.82rem;}
  .pp-word button:focus-visible,.pp-actions button:focus-visible{
    outline:2px solid var(--accent);outline-offset:1px;}
  .pp-word{display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;margin:.7rem 0 0;}
  .pp-word button{appearance:none;border:1px solid var(--paper-sunk);background:var(--paper-raised);color:var(--ink);
    border-radius:var(--radius-pill);padding:.35rem .85rem;font:inherit;font-size:.85rem;cursor:pointer;}
  .pp-word button.sel{border-color:var(--sel);background:var(--sel-soft);}
  .pp-actions{display:none;flex-wrap:wrap;gap:.5rem;justify-content:center;align-items:center;margin:.85rem 0 0;
    border-top:1px dashed var(--paper-sunk);padding-top:.75rem;}
  .pp-actions.show{display:flex;}
  .pp-actions .lab{width:100%;text-align:center;font-size:.85rem;color:var(--ink-soft);margin-bottom:.05rem;}
  .pp-actions button{appearance:none;border:0;color:#fff;border-radius:var(--radius-pill);padding:.42rem .9rem;
    font:inherit;font-size:.85rem;font-weight:600;cursor:pointer;}
  /* ── The readout ── */
  .readout{margin:1rem auto 0;max-width:34rem;min-height:3.2rem;
    border-top:1px dashed var(--paper-sunk);padding-top:.8rem;text-align:center;}
  .readout .caught{font-size:1.05rem;color:var(--ink);}
  .readout .caught b{color:var(--accent-strong);}
  .readout .empty{color:var(--ink-faint);font-size:.95rem;}
  .kinds{display:none;gap:.5rem;justify-content:center;margin:.6rem 0 0;flex-wrap:wrap;}
  .kinds.show{display:flex;}
  .kinds span{display:inline-flex;align-items:center;gap:.35rem;font-size:.82rem;color:var(--ink-soft);}
  .kinds i{width:.7rem;height:.7rem;border-radius:50%;display:inline-block;}
  table{border-collapse:collapse;margin:1rem 0;font-size:.94rem;width:100%;max-width:38rem;}
  th,td{border:1px solid var(--paper-sunk);padding:.45rem .6rem;text-align:left;vertical-align:top;}
  th{background:var(--paper-raised);} td:first-child{white-space:nowrap;font-weight:600;}
  .foot{margin-top:3rem;color:var(--ink-faint);font-size:.86rem;border-top:1px solid var(--paper-sunk);padding-top:1rem;}
  @media (prefers-color-scheme:dark){
    :root{--paper:#1c1813;--paper-raised:#241f18;--paper-sunk:#332c22;
      --ink:#ece4d6;--ink-soft:#c3b8a6;--ink-faint:#9a8f7d;
      --accent:#5bb3a6;--accent-strong:#7fc9bd;--accent-tint:#22403b;}
    .leaf path{fill:#ece4d6;}
  }
</style>
</head>
<body>
<main>
  <p style="color:var(--ink-faint);font-size:.86rem;margin:0 0 .3rem;">A decision, drawn — Hifth</p>
  <h1>Picking the exact part of a word to note</h1>
  <p class="lead">A reader can already pin a private note to a whole verse or a whole word. The
  next step lets them reach finer than that — one vowel-sign, several at once, or the whole word with
  its marks or with the marks stripped off — for a personal recitation slip, or a &ldquo;the print is
  off right here&rdquo; flag. The parts are drawn and placed; the open thing is the gesture that reaches the
  one you mean. Try the three below, on a real page. The gesture you choose is the one that ships.</p>

  <div class="glossary">
    <dl>
      <dt>Verse</dt><dd>One numbered sentence of the Qur'an. The crop below is the top verse of a real page.</dd>
      <dt>Vowel-sign</dt><dd>A small mark above or below a letter that tells you how it is voiced. The app now knows the exact spot of every one.</dd>
      <dt>A note</dt><dd>Something a reader pins to a spot for themselves — a slip they keep making, a place the print looks wrong. Kept on their own device.</dd>
    </dl>
  </div>

  <div class="note">
    <strong>This is not deciding whether to allow it.</strong> That was decided already: a reader
    may pin a note down to a single spot. What was missing then was that the app could not point at
    one sign; now it can. So this page decides only <em>how the reader reaches</em> one — and that
    is a thing you judge with a thumb, not from a paragraph, which is why all three are live.
  </div>

  <div class="try">
    <div class="seg" role="tablist" aria-label="Ways to pick one sign">
      <button data-opt="A" aria-pressed="true">Word, then sign</button>
      <button data-opt="B" aria-pressed="false">Press &amp; loupe</button>
      <button data-opt="C" aria-pressed="false">Word, then names</button>
    </div>
    <p class="hint" id="hint"></p>
    <div class="stage" id="stage">
      <svg id="page" viewBox="${crop.x} ${crop.y} ${crop.w} ${crop.h}" aria-label="A real verse of the print, zoomed in">
        <use href="#leaf" x="0" y="0" width="${VBW}" height="${VBH}" class="leaf"></use>
        <g id="words"></g>
        <g id="signs"></g>
      </svg>
      <div class="loupe" id="loupe">
        <svg id="loupeSvg" viewBox="0 0 20 20"><use href="#leaf" x="0" y="0" width="${VBW}" height="${VBH}" class="leaf"></use><g id="loupeSigns"></g></svg>
      </div>
    </div>
    <label class="fuller" id="fullerWrap"><input type="checkbox" id="fuller"> Fuller version: letters too, not only signs</label>
    <div class="tray" id="tray" aria-label="Signs on the word you tapped"></div>
    <div class="chips" id="chips" aria-label="Signs on the word you tapped, by name"></div>
    <div class="panel" id="panel" aria-label="The word broken into its parts">
      <p class="pp-note">Each letter and each mark gets its own copy of the word, side by side. In a
        copy, one part is solid ink and the rest is invisible ink — there so you can still see which
        word it is. Tap a copy to take that part; take as many as you like, or the whole word below.
        Every shape here is drawn from the word's own font, so one part never carries a neighbour's ink.</p>
      <div class="pp-body">
        <div class="pp-scroll"><div class="pp-strip" id="ppStrip" aria-label="a copy of the word for each letter and mark, one part inked in each"></div></div>
        <aside class="pp-aside" id="ppAside" aria-live="polite" aria-label="What you have picked, named"></aside>
      </div>
      <div class="pp-word">
        <button id="wWith" type="button">Whole word, with marks</button>
        <button id="wWithout" type="button">Letters only, no marks</button>
      </div>
      <div class="pp-actions" id="ppActions">
        <span class="lab">What do you want to do with the selection?</span>
        <button type="button" style="background:var(--k-comment)" data-kind="Comment">Add a comment</button>
        <button type="button" style="background:var(--k-correction)" data-kind="Correction">Flag a mistake</button>
        <button type="button" style="background:var(--k-question)" data-kind="Question">Ask a question</button>
        <button type="button" style="background:var(--k-dev)" data-kind="Note to us">Note to us</button>
      </div>
    </div>
    <div class="readout" id="readout">
      <div class="empty" id="empty">Nothing caught yet.</div>
      <div class="caught" id="caught" hidden></div>
      <div class="kinds" id="kinds">
        <span><i style="background:var(--k-comment)"></i>a comment</span>
        <span><i style="background:var(--k-correction)"></i>a correction</span>
        <span><i style="background:var(--k-question)"></i>a question</span>
        <span><i style="background:var(--k-dev)"></i>a note to us</span>
      </div>
    </div>
  </div>

  <h2>What is being decided?</h2>
  <p>When a reader wants to note something finer than a whole word — one vowel-sign, a few of them, or the word itself with or without its marks — how do they reach for it? A sign on this page is about
  ${medW.toFixed(1)} by ${medH.toFixed(1)} in the page's own units, on a page ${VBW} wide — around a
  fiftieth of the width. This one verse carries ${signs.length} of them, stacked above and below the
  letters. A fingertip covers a dozen at once, so tapping the sign directly is not on the table; every
  option below is a way around that.</p>

  <h2>Why is this being asked now?</h2>
  <p>Because the feature it unlocks is already decided and already half-built. The marking tool lets a
  reader pin a note to a verse or a word today; the decision to let that note reach a single sign was
  made in September, and the only thing it waited on — the app knowing where each sign sits — has since
  shipped. So this is the last gate, and it is a gesture, which the project's own rule says to build and
  hand over rather than draw and argue.</p>

  <h2>What happens if nobody decides?</h2>
  <p>The single-sign note stays decided but unreachable. A reader can still mark the word the sign is in,
  which is often enough — so the cost of waiting is small and real at once: small, because nobody is
  blocked; real, because the two things this was for (a hafiz pinning a slip finer than a word, and
  flagging a sign the print gets wrong) both need to reach the sign, not the word around it.</p>

  <h2>What are the three ways?</h2>
  <p>Each is mounted above; switch between them and pick a sign a few times before reading on. None
  aims at the tiny target directly.</p>
  <table>
    <tr><th>Way</th><th>The gesture</th><th>What it trades</th></tr>
    <tr><td>Word, then sign<br><small>what the app does until you choose</small></td><td>Tap the word — a big,
      familiar target — and its signs lift into a tray under it, each an enlarged window on the print
      with its name beneath, in reading order. Tap the one you mean. Its fuller version (the switch under
      the buttons) opens the word whole instead, each letter as well as each mark its own target, several
      at once.</td><td>Two deliberate taps, then a calm second choice where every target is finger-sized,
      and you still see the ink you are choosing. Slower than one motion; the fuller version reaches
      letters too, but today it can be drawn for this one verse only.</td></tr>
    <tr><td>Press &amp; loupe</td><td>Press the page; a magnifier rises and snaps to the nearest sign;
      slide to change it, let go to take it.</td><td>One continuous gesture, direct — you reach for the
      ink itself. Asks for a steadier hand, and a loupe to see past the fingertip.</td></tr>
    <tr><td>Word, then names</td><td>Tap the word; its signs appear as a row named in words; pick by
      name.</td><td>Never touches the small target at all, and reads out loud for a screen reader. Asks
      the reader to know the names.</td></tr>
  </table>

  <h2>What did we already decide that this leans on?</h2>
  <ul>
    <li><strong>A reader may pin a note to a single spot</strong> — decided September 2, with four kinds
      of note: a comment, a correction, a question for scholars, a note to the people who build the app.
      This page is the gesture that decision left to the build.</li>
    <li><strong>Each sign is drawn where its own ink is</strong> — the placement decision that put a box
      on every sign and corrected where those boxes sat. It is what makes any of these three possible;
      the boxes you are catching are those.</li>
    <li><strong>The letter or the sign is a real unit to point at</strong> — settled when the app chose
      to colour recitation rules on the exact sign rather than washing the whole verse.</li>
  </ul>

  <h2>What else was considered, and left off?</h2>
  <ul>
    <li><strong>Tap the sign directly.</strong> Left off: measured too small — a fingertip covers a
      dozen. Every option here exists because this one cannot.</li>
    <li><strong>A long list of every sign on the page.</strong> Left off: it turns a spatial choice into
      a reading task and loses the place on the page the reader is looking at.</li>
    <li><strong>Type the address of the sign</strong> (this word, this sign). Left off: nobody thinks of
      a slip that way; it is a developer's handle, not a reader's.</li>
  </ul>

  <h2>What would change the answer?</h2>
  <p>A reader who cannot hold the press steady enough for the loupe would rule it out; a reader who does
  not know the names would rule out the named row; a device with no hover or no fine pointer changes
  which is comfortable. The honest test is a hafiz doing it on a phone a few times — which is what this
  page is for.</p>
  <p>One thing would sharpen the winner rather than replace it. The precision picker already reaches a
  mark, a run of marks, a single <em>letter</em>, or the whole word — point at a letter and the rest of
  the word fades back, so that one letter stands alone in colour without the joined ink being cut. Which
  colour belongs to which letter is read from the ink: joined Arabic letters meet at a thin stroke, so
  the picker draws the colour boundary at those thin places. On most words it lands cleanly; on a few
  crowded clusters the colour can spill a hair into a neighbour, because the thin place it reads is a
  good guess at the join, not a certainty. The exact fix is the step this grows into — shaping the word
  with its own font, which reports where each letter truly begins — and it would change nothing about the
  gesture, so it is a reason to build on the picker, not a reason to wait.</p>

  <h2>What is this not settling?</h2>
  <p>Not what a caught part then lets you write — the four kinds of note are already decided, and the
  menu that opens on a selection is shown here only as a hint of where the gesture leads. Not the finer
  line-by-line straightening of the sign boxes, which is a separate polish still waiting on the owner's
  eye. And not the exact edge of the colour that picks out one letter on a crowded cluster: a reader can
  pick each letter on its own today, but where one letter's colour gives way to the next is read from the
  ink and is a close guess, not a certainty; on a few dense clusters it sits a hair off. Making it exact
  waits on shaping the word with its own font — the next step the picker grows into, and the page is
  honest about it where the letters are drawn.</p>

  <p class="foot">Built by <code>scripts/build-harakah-pick-options.mjs</code> from the vendored print
  (page ${PAGE}), its shipped word and per-sign boxes, and the app's design tokens — committed bytes
  only. The print is outlined paths; this page carries no Qur'an text. Which signs a tapped word opens
  into, and which sign a press lands on, are worked out by the same three pieces of code the app runs
  (<code>packages/core/src/decision-options/harakah-pick.ts</code>), so what you feel here is what the
  app would do. The app's mistake tool already mounts the first way, as a stand-in until this is
  decided; the winning way takes its place and the other two are deleted.</p>
</main>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="leaf" viewBox="0 0 ${VBW} ${VBH}">${leafInner}</symbol>
</svg>

<script>
"use strict";
var DATA = ${JSON.stringify(DATA)};
var stage = document.getElementById("stage");
var page = document.getElementById("page");
var gWords = document.getElementById("words");
var gSigns = document.getElementById("signs");
var loupe = document.getElementById("loupe");
var loupeSvg = document.getElementById("loupeSvg");
var loupeSigns = document.getElementById("loupeSigns");
var tray = document.getElementById("tray");
var chips = document.getElementById("chips");
var hint = document.getElementById("hint");
var emptyEl = document.getElementById("empty");
var caughtEl = document.getElementById("caught");
var kindsEl = document.getElementById("kinds");
var SVGNS = "http://www.w3.org/2000/svg";
var opt = "A";
var caughtId = null;

${PICKERS_JS}
var HINTS = {
  A: "Tap a word. Its signs lift into a tray, each one enlarged from the print and named; tap the one you mean. This is the one the app uses until you choose.",
  A_FULL: "Tap a word. It opens whole, each letter and mark its own target; point at one to pick it out in colour, and a tally beside the word names what you took.",
  B: "Press and hold on the page, slide to the sign, let go to take it.",
  C: "Tap a word, then pick its sign from the named row."
};

function el(tag, attrs){ var e=document.createElementNS(SVGNS,tag); for(var k in attrs){ e.setAttribute(k, attrs[k]); } return e; }

// Draw the word hit-areas (transparent, tappable) once.
DATA.words.forEach(function(b){
  var r = el("rect",{x:b.x,y:b.y,width:b.bw,height:b.bh,class:"wordhit","data-w":b.w});
  gWords.appendChild(r);
});
// Draw every sign box (faint) once.
DATA.signs.forEach(function(s){
  var r = el("rect",{x:s.x,y:s.y,width:s.mw,height:s.mh,rx:.6,class:"sign","data-id":s.id});
  gSigns.appendChild(r);
});

function signEls(){ return gSigns.querySelectorAll(".sign"); }
function clearClasses(){ signEls().forEach(function(r){ r.setAttribute("class","sign"); });
  gWords.querySelectorAll(".wordhit").forEach(function(r){ r.setAttribute("class","wordhit"); }); }

function pretty(name){ return name; }

function setCaught(id){
  caughtId = id;
  signEls().forEach(function(r){
    var cls = "sign";
    if(Number(r.getAttribute("data-id"))===id) cls="sign caught";
    r.setAttribute("class", cls);
  });
  tray.querySelectorAll(".sgn").forEach(function(b){ b.classList.toggle("sel", Number(b.getAttribute("data-id"))===id); });
  var s = DATA.signs[id];
  emptyEl.hidden = true;
  caughtEl.hidden = false;
  caughtEl.innerHTML = "Caught <b>"+pretty(s.name)+"</b> \\u2014 sign "+(nthOnWord(s)+1)+" on word "+s.w+".";
  kindsEl.classList.add("show");
}
// Which sign this is among the ones on its own word, in on-page reading order.
function nthOnWord(s){
  var same = DATA.signs.filter(function(o){ return o.w===s.w; })
    .sort(function(a,b){ return b.x - a.x; }); // right-to-left
  for(var i=0;i<same.length;i++){ if(same[i].id===s.id) return i; }
  return 0;
}

// ── Option A + C: the word's signs, from the shared pickers ─────────────────
function litWord(w){
  gWords.querySelectorAll(".wordhit").forEach(function(r){
    r.setAttribute("class", Number(r.getAttribute("data-w"))===w ? "wordhit lit":"wordhit");
  });
}
function openTray(w){
  litWord(w);
  tray.innerHTML="";
  PICKERS.A.choices(DATA.signs, w).forEach(function(c){
    var s=DATA.signs[c.id];
    var btn=document.createElement("button");
    btn.className="sgn"; btn.type="button"; btn.setAttribute("data-id", s.id);
    btn.setAttribute("aria-label","sign "+s.name);
    // The same window on the print the app's tray shows: sixteen page units
    // square, centred on the sign, so its letter and neighbours come with it.
    var win=16, cx=s.x+s.mw/2, cy=s.y+s.mh/2;
    var svg=document.createElementNS(SVGNS,"svg");
    svg.setAttribute("viewBox",(cx-win/2)+" "+(cy-win/2)+" "+win+" "+win);
    var use=el("use",{href:"#leaf",x:0,y:0,width:DATA.vbw,height:DATA.vbh,class:"leaf"});
    var box=el("rect",{x:s.x-.8,y:s.y-.8,width:s.mw+1.6,height:s.mh+1.6,rx:.5,fill:"none",stroke:"var(--accent)","stroke-width":.35});
    svg.appendChild(use); svg.appendChild(box);
    var cap=document.createElement("small"); cap.textContent=c.label;
    btn.appendChild(svg); btn.appendChild(cap);
    btn.addEventListener("click",function(){ setCaught(s.id); });
    tray.appendChild(btn);
  });
  tray.classList.add("show");
}
function openChips(w){
  litWord(w);
  chips.innerHTML="";
  PICKERS.C.choices(DATA.signs, w).forEach(function(c){
    var b=document.createElement("button");
    b.className="chip"; b.type="button";
    b.textContent=c.label;
    b.addEventListener("click",function(){ setCaught(c.id); });
    chips.appendChild(b);
  });
  chips.classList.add("show");
}

// ── Option A, shaped into a precision picker ─────────────────────────────────
// Tap a word and it opens whole, the way it sits in the print — each letter and
// each mark its own target. Point at one to pick it out in colour while the rest
// fades back; a tally beside the word names what you took. Every part is
// selectable, several at once; the whole word (with or without its marks) is
// one tap; and a live selection opens the four things a reader can do with it.
var panel=document.getElementById("panel");
var ppStrip=document.getElementById("ppStrip");
var ppAside=document.getElementById("ppAside");
var ppActions=document.getElementById("ppActions");
var wWith=document.getElementById("wWith"), wWithout=document.getElementById("wWithout");
var sel={}, curNames={};

// Which shaped word a tapped print-box opens. The print cuts the verse into more
// boxes than the font makes words: one box is the pause mark, and a word can be
// split across two boxes — those map to no new word, or to the same word.
function shapedFor(w){ var si=DATA.printToShaped[w]; return (si==null||si===undefined)?null:DATA.shaped[si]; }

// The padded frame that fits the whole word, in the font's own units. Every cell
// draws the same word in this same frame, so the letters sit in the same place
// copy to copy — only which one is inked changes.
function wordFrame(word){
  var x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  word.letters.concat(word.marks).forEach(function(s){
    x0=Math.min(x0,s.bb[0]); y0=Math.min(y0,s.bb[1]);
    x1=Math.max(x1,s.bb[2]); y1=Math.max(y1,s.bb[3]);
  });
  var pad=(x1-x0)*0.04+20;
  return [x0-pad, y0-pad, (x1-x0)+2*pad, (y1-y0)+2*pad];
}

// The letter a mark sits on: the one whose horizontal span best contains the mark's
// centre, else the nearest by centre. A mark's own y already puts it above or below
// (that is the font placing it by kind), so the anchor only needs the column right.
function baseLetterOf(word, mark){
  if(!word.letters.length) return null;
  var mx=(mark.bb[0]+mark.bb[2])/2, best=null, bestD=Infinity;
  word.letters.forEach(function(L){
    var lo=L.bb[0], hi=L.bb[2];
    var d=(mx>=lo&&mx<=hi)?0:Math.min(Math.abs(mx-lo),Math.abs(mx-hi));
    if(d<bestD){ bestD=d; best=L; }
  });
  return best;
}

// One cell: its own copy of the whole word, every part drawn in invisible ink
// except the one part this cell is for, which is solid. Tap the cell to take that
// part. Because each part is its own font outline, the solid one never drags a
// neighbour's ink with it — the ta comes without the ya.
function cell(word, frame, key, name, targetPart, anchor){
  // The button and its label are HTML; only the drawing is SVG. el() makes
  // SVG-namespaced nodes, so an el("button") is an inert SVG element with no HTML
  // layout — make the wrappers with createElement and keep el() for svg/path.
  var b=document.createElement("button");
  b.type="button"; b.className="pp-cell"; b.setAttribute("data-key",key); b.setAttribute("aria-label",name);
  // Fix the copy's width from the word's aspect ratio: inside a flex button an SVG
  // with width:auto can collapse, so give it an explicit width for the height.
  var ratio=frame[2]/frame[3];
  var svg=el("svg",{viewBox:frame.join(" "),preserveAspectRatio:"xMidYMid meet",class:"cellword",
    style:"height:5.6rem;width:"+(5.6*ratio).toFixed(2)+"rem"});
  // Solid the target part; hold the letter it sits on a shade up from invisible
  // (the "anchor"), so a mark reads as stacked on that letter; the rest stays faint.
  var inkClass=function(part){ return part===targetPart?"tk":(part===anchor?"ctx":"gh"); };
  word.letters.forEach(function(L){ svg.appendChild(el("path",{d:L.d,class:inkClass(L)})); });
  word.marks.forEach(function(m){ svg.appendChild(el("path",{d:m.d,class:inkClass(m)})); });
  b.appendChild(svg);
  var lab=document.createElement("span"); lab.className="pp-cn"; lab.textContent=name; b.appendChild(lab);
  b.addEventListener("click",function(){ toggle(key); });
  curNames[key]=name;
  return b;
}

function openPanel(w){
  litWord(w); sel={}; curNames={};
  var word=shapedFor(w);
  if(!word){ panel.classList.remove("show"); renderSel(); return; }
  var frame=wordFrame(word);
  ppStrip.innerHTML="";
  // Letters in visual order, left→right: the font lays glyphs out left-to-right,
  // so word.letters[0] is the leftmost letter in the print. Walk front-to-back and
  // the leftmost card is the leftmost letter — the strip mirrors the word on the page.
  for(var li=0; li<word.letters.length; li++){
    ppStrip.appendChild(cell(word,frame,"L:"+li,word.letters[li].name,word.letters[li]));
  }
  // Then each mark, in the order it sits across the word — each shown stacked on the
  // letter it belongs to (nearest by horizontal centre), above or below by its own kind.
  word.marks.forEach(function(m,mi){
    ppStrip.appendChild(cell(word,frame,"m:"+mi,m.name,m,baseLetterOf(word,m)));
  });
  renderSel();
  panel.classList.add("show");
}
function toggle(key){ if(sel[key]) delete sel[key]; else sel[key]=true; renderSel(); }
function summary(){
  var keys=Object.keys(sel);
  var nl=keys.filter(function(k){ return k.charAt(0)==="L"; }).length;
  var nm=keys.filter(function(k){ return k.indexOf("m:")===0; }).length;
  var parts=[];
  if(nl) parts.push(nl+(nl===1?" letter":" letters"));
  if(nm){
    var names=keys.filter(function(k){ return k.indexOf("m:")===0; }).map(function(k){ return curNames[k]; });
    parts.push((nm===1?"the ":nm+" marks (")+names.join(", ")+(nm===1?" mark":")"));
  }
  if(sel["word"]) parts.push("the whole word");
  if(sel["wordbare"]) parts.push("the letters (no marks)");
  return parts.join(" + ");
}
// The tally beside the word: one row per *specific* thing by name — the letters
// first ("1 waw, 1 ha"), then the marks ("1 kasra, 2 fatha") — so the reader sees
// what they took even when the tap-box could not trace the letter cleanly. Both
// letters and marks carry ASCII names (held-copy safe); each name is counted.
function tallyBy(keys,pred){
  var byName={}, order=[];
  keys.filter(pred).forEach(function(k){
    var nm=curNames[k]||"part";
    if(byName[nm]==null){ byName[nm]=0; order.push(nm); }
    byName[nm]++;
  });
  return order.map(function(nm){ return {nm:nm, n:byName[nm]}; });
}
// A plural that is right for these names: "kasras", "waws", but "ta marbutas".
function plural(nm,n){ return n>1 ? nm+"s" : nm; }
function renderAside(){
  var keys=Object.keys(sel);
  if(!keys.length){
    ppAside.innerHTML='<h4>Your pick</h4><p class="none">Point at a letter or a mark and it is named here, so you can check the box caught what you meant.</p>';
    return;
  }
  var lets=tallyBy(keys,function(k){ return k.charAt(0)==="L"; });
  var marks=tallyBy(keys,function(k){ return k.indexOf("m:")===0; });
  var html='<h4>Your pick</h4><ul>';
  lets.forEach(function(r){
    html+='<li><span class="n">'+r.n+'</span><span class="nm">'+plural(r.nm,r.n)+'</span></li>';
  });
  marks.forEach(function(r){
    html+='<li class="mark"><span class="n">'+r.n+'</span><span class="nm">'+plural(r.nm,r.n)+'</span></li>';
  });
  html+='</ul>';
  if(sel["word"]) html+='<div class="whole">the whole word, with marks</div>';
  if(sel["wordbare"]) html+='<div class="whole">the letters, no marks</div>';
  ppAside.innerHTML=html;
}
function renderSel(){
  ppStrip.querySelectorAll(".pp-cell").forEach(function(c){ c.classList.toggle("sel", !!sel[c.getAttribute("data-key")]); });
  wWithout.classList.toggle("sel", !!sel["wordbare"]);
  wWith.classList.toggle("sel", !!sel["word"]);
  var keys=Object.keys(sel);
  ppActions.classList.toggle("show", keys.length>0);
  renderAside();
  if(!keys.length){ emptyEl.hidden=false; emptyEl.textContent="Tap the letters and marks you want — one, or several at once."; caughtEl.hidden=true; }
  else { emptyEl.hidden=true; caughtEl.hidden=false; caughtEl.innerHTML="Selected: <b>"+summary()+"</b>. Choose what to do with it below."; }
}
function doAction(kind){
  if(!Object.keys(sel).length) return;
  emptyEl.hidden=true; caughtEl.hidden=false;
  caughtEl.innerHTML="<b>"+kind+"</b> pinned to <b>"+summary()+"</b>. In the app this opens the note editor.";
}
wWith.addEventListener("click",function(){ toggle("word"); });
wWithout.addEventListener("click",function(){ toggle("wordbare"); });
[].forEach.call(ppActions.querySelectorAll("button"),function(b){
  b.addEventListener("click",function(){ doAction(b.getAttribute("data-kind")); });
});

// ── Option B: press and loupe ────────────────────────────────────────────────
DATA.signs.forEach(function(s){
  var r = el("rect",{x:s.x,y:s.y,width:s.mw,height:s.mh,rx:.6,class:"sign","data-id":s.id});
  loupeSigns.appendChild(r);
});
function svgPoint(clientX, clientY){
  var pt=page.createSVGPoint(); pt.x=clientX; pt.y=clientY;
  return pt.matrixTransform(page.getScreenCTM().inverse());
}
var pressing=false, snapId=null;
function loupeShow(clientX, clientY){
  loupe.style.display="block";
  loupe.style.left=clientX+"px";
  loupe.style.top=(clientY-90)+"px"; // float above the fingertip, clear of the stage clip
  var p=svgPoint(clientX, clientY);
  snapId = PICKERS.B.snap(DATA.signs, p.x, p.y);
  var s = snapId==null ? null : DATA.signs[snapId];
  // Frame the loupe on the sign the reader is about to take, not the raw
  // fingertip: a magnifier is only useful if it shows the target, centred,
  // with enough of the surrounding letters to tell which sign it is.
  var win=15; // page units across the loupe
  var fx = s ? s.x+s.mw/2 : p.x, fy = s ? s.y+s.mh/2 : p.y;
  loupeSvg.setAttribute("viewBox",(fx-win/2)+" "+(fy-win/2)+" "+win+" "+win);
  loupeSigns.querySelectorAll(".sign").forEach(function(r){
    r.setAttribute("class", Number(r.getAttribute("data-id"))===snapId?"sign snap":"sign");
  });
  signEls().forEach(function(r){
    var on=Number(r.getAttribute("data-id"))===snapId;
    r.setAttribute("class", on?"sign snap":(Number(r.getAttribute("data-id"))===caughtId?"sign caught":"sign"));
  });
}
function loupeHide(){ loupe.style.display="none"; }

function onDown(e){
  if(opt==="B"){
    pressing=true; stage.setPointerCapture&&stage.setPointerCapture(e.pointerId);
    loupeShow(e.clientX, e.clientY); e.preventDefault();
  } else {
    var t=e.target;
    if(t && t.classList && t.classList.contains("wordhit")){
      var w=Number(t.getAttribute("data-w"));
      if(opt==="A") { if(fuller.checked) openPanel(w); else openTray(w); } else openChips(w);
    }
  }
}
function onMove(e){ if(opt==="B"&&pressing){ loupeShow(e.clientX, e.clientY); e.preventDefault(); } }
function onUp(e){
  if(opt==="B"&&pressing){
    pressing=false; loupeHide();
    if(snapId!=null) setCaught(snapId);
  }
}
stage.addEventListener("pointerdown", onDown);
stage.addEventListener("pointermove", onMove);
stage.addEventListener("pointerup", onUp);
stage.addEventListener("pointercancel", function(){ pressing=false; loupeHide(); });

// ── Switching options ────────────────────────────────────────────────────────
var fuller=document.getElementById("fuller");
var fullerWrap=document.getElementById("fullerWrap");
fuller.addEventListener("change",function(){ setOpt("A"); });
function setOpt(o){
  opt=o;
  fullerWrap.style.display = (o==="A") ? "" : "none";
  [].forEach.call(document.querySelectorAll(".seg button"),function(b){
    b.setAttribute("aria-pressed", b.getAttribute("data-opt")===o?"true":"false");
  });
  hint.textContent=(o==="A"&&fuller.checked)?HINTS.A_FULL:HINTS[o];
  tray.classList.remove("show"); chips.classList.remove("show");
  if(panel){ panel.classList.remove("show"); sel={}; ppActions.classList.remove("show"); }
  loupeHide(); pressing=false;
  clearClasses();
  if(caughtId!=null) setCaught(caughtId);
  // signs are only drawn faint on the page for B (reach-for-ink); for A/C the
  // page stays clean until a word is tapped, so the small boxes do not clutter.
  gSigns.style.display = (o==="B") ? "block" : "none";
}
[].forEach.call(document.querySelectorAll(".seg button"),function(b){
  b.addEventListener("click",function(){ setOpt(b.getAttribute("data-opt")); });
});
setOpt(DEFAULT_PICKER);
</script>
</body>
</html>
`;

if (/[؀-ۿ]/.test(html)) die("output carries an Arabic codepoint");
// The only <text is inside our own prose ("text-align" etc. are fine); the print
// symbol must carry no <text> element — assert on the inlined leaf specifically.
if (/<text\b/.test(leafInner)) die("leaf symbol carries <text>");

writeFileSync(OUT, html);
console.log(
  `build-harakah-pick-options: wrote ${OUT} — page ${PAGE} verse ${AYAH}, ` +
    `${signs.length} signs, ${wordBoxes.length} words, crop ${crop.w.toFixed(0)}x${crop.h.toFixed(0)}`,
);
