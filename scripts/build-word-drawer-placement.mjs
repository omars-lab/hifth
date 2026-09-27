#!/usr/bin/env node
/**
 * Render docs/design/word-drawer-placement-options.html — the live page for
 * where the word drawer stands when it would cover the word it is about.
 *
 * In Word mode a tap on a word opens its parts (the whole word, each vowel-sign,
 * each letter) in the verse drawer's place on the bottom of the window. That
 * drawer is taller than the verse's, so on a computer it covers the page's last
 * lines. Three answers, each built live on the real page 7 in a window the size
 * of a real screen:
 *
 *   A  keep it on the bottom, always (what the app does today)
 *   B  the same drawer, but at the top of the window when the word is low
 *   C  one short row on the bottom, signs and letters behind two tabs
 *
 * The drawer is real HTML laid out at the app's own sizes inside the window, so
 * its height is measured, not assumed, and the page counts the words it hides.
 *
 * ── What it reads (committed bytes only) ────────────────────────────────────
 *   apps/web/public/assets/pages/hafs-kfqc/7.svg      the leaf
 *   apps/web/public/assets/words/hafs-kfqc/7.json     the shipped word boxes
 *   apps/web/public/assets/marks/hafs-kfqc/7.json     the shipped per-sign boxes
 *   apps/web/public/assets/letters/hafs-kfqc/7.json   where each word is cut into letters
 *
 * ── No Qur'an, no held copy ─────────────────────────────────────────────────
 * The print is outlined <path>s with zero Arabic codepoints; it is inlined once
 * as an SVG <symbol> and <use>d for the page and for every copy of a word. Every
 * label is English. The writer refuses if its own output breaks either rule.
 *
 *   node scripts/build-word-drawer-placement.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const PAGE = 7;
const LEAF = join(ROOT, `apps/web/public/assets/pages/hafs-kfqc/${PAGE}.svg`);
const WORDS = join(ROOT, `apps/web/public/assets/words/hafs-kfqc/${PAGE}.json`);
const MARKS = join(ROOT, `apps/web/public/assets/marks/hafs-kfqc/${PAGE}.json`);
const LETTERS = join(ROOT, `apps/web/public/assets/letters/hafs-kfqc/${PAGE}.json`);
const OUT = join(ROOT, "docs/design/word-drawer-placement-options.html");

const die = (m) => {
  console.error(`build-word-drawer-placement: ${m}`);
  process.exit(1);
};

const rawLeaf = readFileSync(LEAF, "utf8");
if (/[؀-ۿ]/.test(rawLeaf)) die(`page ${PAGE} carries Arabic codepoints`);
if (/<text\b/.test(rawLeaf)) die(`page ${PAGE} carries <text>`);
const leafInner = rawLeaf.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");

const words = JSON.parse(readFileSync(WORDS, "utf8")).words;
const marks = JSON.parse(readFileSync(MARKS, "utf8")).marks;
const letters = JSON.parse(readFileSync(LETTERS, "utf8")).words;

// Every tappable word on the page: its verse, its number, its box, its signs'
// names and boxes, and how many letters the cut gives it (0 when none).
const WORDLIST = [];
for (const [ayah, entry] of Object.entries(words)) {
  const pause = new Set(entry.marks ?? []);
  entry.boxes.forEach((b, i) => {
    const n = entry.from + i;
    if (pause.has(n)) return;
    const signs = (marks[ayah] ?? []).filter((m) => m.w === n).map((m) => [m.n, ...m.r]);
    const cuts = letters[ayah]?.[String(n)];
    WORDLIST.push({ a: ayah, n, b, s: signs, l: cuts ? cuts.length + 1 : 0 });
  });
}
if (WORDLIST.length < 50) die("too few words on the page");
// Opens on the case the question is about: a word on the page's last line, the
// one with the most parts (signs, then letters), so the drawer is at its tallest.
const lowest = Math.max(...WORDLIST.map((w) => w.b[1]));
const START = WORDLIST.filter((w) => w.b[1] > lowest - 15).sort(
  (p, q) => q.s.length - p.s.length || q.l - p.l,
)[0];
if (!START) die("no word of 2:48 on the page");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Where the word drawer stands</title>
<!-- Built by scripts/build-word-drawer-placement.mjs; edit that, not this. -->
<style>
  :root{
    --paper:#f4efe6; --paper-raised:#fbf8f2; --paper-sunk:#ece4d6; --desk:#c9ab8a;
    --ink:#26201a; --ink-soft:#5c5347; --ink-faint:#6b6255;
    --accent:#1f6f66; --accent-strong:#17544d; --accent-tint:#d7e7e3;
    --warn:#b4471f; --warn-tint:#f6dfd3;
    --radius-sm:6px; --radius-md:10px; --radius-lg:16px; --radius-pill:999px;
    --shadow:0 1px 2px rgba(38,32,26,.10),0 6px 20px rgba(38,32,26,.10);
    --maxw:60rem;
  }
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{margin:0;background:var(--paper);color:var(--ink);
    font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
  main{max-width:var(--maxw);margin:0 auto;padding:2rem 1rem 5rem;}
  h1{font-size:1.9rem;line-height:1.2;margin:.2rem 0 .4rem;text-wrap:balance;}
  h2{font-size:1.28rem;margin:2.4rem 0 .5rem;text-wrap:balance;}
  p,li{max-width:40rem;} .lead{font-size:1.12rem;color:var(--ink-soft);}
  a{color:var(--accent-strong);text-underline-offset:2px;}
  .hafiz{background:#fff4d6;border-left:3px solid #d49a1c;padding:.6rem .9rem;border-radius:0 var(--radius-sm) var(--radius-sm) 0;max-width:40rem;}
  .glossary{background:var(--paper-raised);border:1px solid var(--paper-sunk);
    border-radius:var(--radius-md);padding:.8rem 1rem;margin:1.2rem 0;font-size:.95rem;max-width:40rem;}
  .glossary dt{font-weight:650;} .glossary dd{margin:0 0 .5rem;color:var(--ink-soft);}
  table{border-collapse:collapse;width:100%;font-size:.93rem;margin:1rem 0;}
  th,td{text-align:left;vertical-align:top;padding:.5rem .6rem;border-bottom:1px solid var(--paper-sunk);}
  th{color:var(--ink-soft);font-weight:600;}
  .tablewrap{overflow-x:auto;}

  /* ── The controls ── */
  .controls{display:flex;flex-wrap:wrap;gap:.6rem 1rem;align-items:center;margin:1rem 0 .6rem;}
  .seg{display:flex;gap:.2rem;background:var(--paper-sunk);border-radius:var(--radius-pill);padding:.2rem;}
  .seg button{appearance:none;border:0;background:transparent;color:var(--ink-soft);font:inherit;font-size:.9rem;
    padding:.35rem .8rem;border-radius:var(--radius-pill);cursor:pointer;}
  .seg button[aria-pressed="true"]{background:var(--paper-raised);color:var(--ink);box-shadow:var(--shadow);font-weight:600;}
  .readout{font-size:.92rem;padding:.5rem .8rem;border-radius:var(--radius-md);background:var(--accent-tint);max-width:none;}
  .readout.bad{background:var(--warn-tint);}

  /* ── The window: a real screen's size, scaled to fit the column ── */
  .screenwrap{position:relative;width:100%;border-radius:var(--radius-md);overflow:hidden;box-shadow:var(--shadow);
    border:1px solid var(--paper-sunk);}
  .screen{position:absolute;left:0;top:0;transform-origin:0 0;background:var(--desk);overflow:hidden;
    font-family:Georgia,"Times New Roman",serif;}
  .bar{position:absolute;left:0;right:0;background:var(--paper);display:flex;align-items:center;padding:0 22px;color:var(--ink-soft);}
  .bar.top{top:0;height:70px;border-bottom:1px solid #e3dccf;}
  .bar.top b{font-size:28px;color:var(--accent-strong);}
  .bar.tools{top:70px;height:57px;justify-content:center;}
  .bar.tools span{border:1px solid #e3dccf;border-radius:8px;padding:8px 14px;background:var(--paper-raised);font-size:15px;}
  .bar.foot{bottom:0;height:120px;border-top:1px solid #e3dccf;flex-direction:column;justify-content:center;gap:10px;}
  .slider{width:60%;height:6px;border-radius:3px;background:#d8d0c2;}
  .leaf{position:absolute;background:#fffdf8;border-radius:10px;box-shadow:0 0 0 2px #7a5c3e;}
  .leaf svg{position:absolute;inset:0;width:100%;height:100%;display:block;}
  .hit{fill:transparent;cursor:pointer;}
  .hit:hover{fill:rgba(31,111,102,.14);}
  .hit.on{fill:rgba(232,161,58,.45);}
  .hit.hidden{fill:rgba(180,71,31,.16);}

  /* ── The drawer, at the app's own sizes ── */
  .drawer{position:absolute;left:50%;transform:translateX(-50%);width:640px;max-height:50%;overflow:auto;
    background:var(--paper-raised);box-shadow:0 -2px 10px rgba(38,32,26,.10),0 -12px 40px rgba(38,32,26,.22);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px;
    padding:8px 16px 16px;}
  .drawer.bottom{bottom:0;border-radius:16px 16px 0 0;}
  .drawer.top{top:127px;border-radius:0 0 16px 16px;box-shadow:0 2px 10px rgba(38,32,26,.10),0 12px 40px rgba(38,32,26,.22);}
  .dhead{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--ink-soft);font-size:13px;min-height:32px;}
  .dx{border:0;background:none;font-size:18px;color:var(--ink-soft);width:32px;height:32px;border-radius:999px;cursor:pointer;}
  .dhint{color:var(--ink-faint);font-size:12px;margin-top:2px;}
  .tabs{display:flex;gap:2px;background:var(--paper-sunk);border-radius:999px;padding:2px;}
  .tabs button{border:0;background:none;font:inherit;font-size:12px;padding:2px 10px;border-radius:999px;cursor:pointer;color:var(--ink-soft);}
  .tabs button[aria-pressed="true"]{background:var(--paper-raised);color:var(--ink);}
  .row{display:flex;direction:rtl;gap:8px;margin-top:8px;overflow-x:auto;padding-bottom:2px;}
  .part{flex:none;display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;border:1px solid rgba(0,0,0,.12);
    border-radius:8px;background:var(--paper-raised);cursor:pointer;}
  .part:hover{border-color:var(--accent);}
  .part svg{display:block;background:#fff;border-radius:4px;}
  .part .nm{direction:ltr;font-size:12px;color:var(--ink-soft);}
  .part.slim{flex-direction:row;gap:6px;padding:3px 6px;}
</style>
</head>
<body>
<main>
<p style="margin:0;color:var(--ink-faint);font-size:.9rem">Hifth · a question about the word drawer</p>
<h1>When the word drawer would cover the word, where should it go?</h1>
<p class="lead">In Word mode a tap on a word opens its parts in a drawer at the bottom of the window. That
drawer is tall, so on a computer it covers the page's last lines, and the word you tapped with them
when it sits on the bottom line. Tap any word on the page below to see where each answer puts it.</p>

<p class="hafiz"><b>For a hafiz:</b> you tap a word to note a slip on one of its vowel-signs. If the
drawer covers that word, you pick the sign from an enlarged copy but lose sight of the verse around
it, which is where you check what you actually recited.</p>

<dl class="glossary">
  <dt>Vowel-sign (harakah)</dt><dd>The small marks above or below a letter that say how it is voiced: fatha, damma, kasra, sukun and the rest.</dd>
  <dt>The word's parts</dt><dd>What the drawer holds: an enlarged copy of the whole word, one copy per vowel-sign with that sign in full ink, and one per letter.</dd>
  <dt>Word mode</dt><dd>One of the modes on the tool bar over the page. In it a tap opens a word; in Verse mode a tap opens the verse.</dd>
</dl>

<h2>Try it: tap a word, then switch the answer</h2>
<div class="controls">
  <div class="seg" role="group" aria-label="Answer">
    <button type="button" data-opt="A" aria-pressed="true">A · keep it at the bottom</button>
    <button type="button" data-opt="B" aria-pressed="false">B · top when the word is low</button>
    <button type="button" data-opt="C" aria-pressed="false">C · one short row</button>
  </div>
  <div class="seg" role="group" aria-label="Screen">
    <button type="button" data-size="1440x900" aria-pressed="true">Big laptop</button>
    <button type="button" data-size="1280x720" aria-pressed="false">Small laptop</button>
  </div>
</div>
<p class="readout" id="readout" aria-live="polite"></p>
<div class="screenwrap" id="wrap"><div class="screen" id="screen">
  <div class="bar top"><b>Hifth</b><span style="margin-left:auto">Page 7</span></div>
  <div class="bar tools"><span>Word mode · tap a word to open it into its parts</span></div>
  <div class="leaf" id="leaf">
    <svg viewBox="0 0 345 550" aria-label="Page 7 of the print"><use href="#print"/><g id="hits"></g></svg>
  </div>
  <div class="bar foot"><div class="slider"></div><span style="font-size:14px">Page slider</span></div>
  <div class="drawer bottom" id="drawer" hidden></div>
</div></div>
<p style="font-size:.85rem;color:var(--ink-faint)">Red-tinted words are the ones the drawer is covering right now. The yellow one is the word you tapped.
The copies of each letter are drawn here as the whole word with its number; the app cuts each to its letter, at the same size.</p>

<h2>Why is this being asked now?</h2>
<p>The word drawer was just moved to the bottom of the window, so that the word's tools and the verse's
tools open in one place (the decision on how a reader opens the word's tools and the verse's). Building
it showed a cost the drawings had not: the verse's drawer is short and sits over the bar under the page,
but the word's drawer holds enlarged copies of the word, so it stands taller and reaches up over the page.</p>

<h2>What happens if nobody decides?</h2>
<p>A stays: the drawer opens on the bottom every time and covers the last two or three lines on a
computer. Nothing breaks; a slip on the bottom lines is noted from the enlarged copy, not from the page.</p>

<h2>What does the app do today, and what does it cost?</h2>
<p>Answer A. On a big laptop window (1440 by 900) with a word on the last line of page 7, the drawer
covers the page's last three lines, the tapped word among them. On a smaller window more of the page goes.
The counter above measures it for whichever word you tap.</p>

<h2>What do other reading apps do?</h2>
<p>We did not look this up for this page. It is worth a look before deciding: how a reading app pops a
word's dictionary card near the bottom of the screen is the same problem.</p>

<h2>What have we already decided that limits the answer?</h2>
<ul>
  <li><b>One drawer, from the bottom, on every screen</b> (how a reader opens the word's tools and the verse's, decided D). A moves nothing; B bends it for low words only; C keeps it.</li>
  <li><b>The word's parts are enlarged copies of the print</b>, one per sign and one per letter (how a reader picks one vowel-sign, decided D). C shrinks those copies, which that choice was made at a larger size.</li>
</ul>

<h2>What are the answers?</h2>
<div class="tablewrap"><table>
  <tr><th></th><th>What it buys</th><th>What it costs</th><th>What it commits us to</th><th>For a hafiz</th></tr>
  <tr><td><b>A · keep it at the bottom</b></td>
    <td>One place, always. Nothing more to build. The word is still shown, large, in the drawer.</td>
    <td>The last two or three lines are hidden while it is open, the tapped word too when it is on the bottom line.</td>
    <td>Settles it as built. Every page's bottom lines are checked from the copy, not the page.</td>
    <td>A slip near the end of a page is marked without seeing the verse around it.</td></tr>
  <tr><td><b>B · top when the word is low</b></td>
    <td>The tapped word and its line always stay in sight. Same drawer, same parts, same size.</td>
    <td>Two homes instead of one: a reader who taps a low word finds the drawer at the top, a surprise the first time. And it hides more, not less: at the top there is no bar for it to sit over, so it covers the page's first six lines where at the bottom it covered three.</td>
    <td>A small rule in the app (which half the word is in) and one more test. Bends "one place" for low words.</td>
    <td>The verse they are checking is always visible while they pick the sign.</td></tr>
  <tr><td><b>C · one short row</b></td>
    <td>One place, and it sits over the bar under the page and no further: on page 7's last line it hides no words at all, on either screen.</td>
    <td>Smaller copies: the tiniest signs get harder to tell apart and to hit. Signs and letters behind two tabs, one more tap to reach letters.</td>
    <td>A redesign of the parts' rows, and the sign-picking decision was made at the bigger size, so it may want a second look.</td>
    <td>The page stays whole while a slip is marked. A small sign like a sukun is smaller to pick, though with a mouse it is still a clear target.</td></tr>
</table></div>
<p><b>Recommended: C.</b> Before building this page B looked best. Measured, B keeps the tapped word
but hides twice the page A does, while C hides nothing and keeps the one place; its cost is a smaller
copy of each sign, which a mouse on a computer (the only place Word mode runs) handles well.</p>

<h2>What did building it show?</h2>
<ul>
  <li><b>B hides more of the page than A.</b> At the bottom the drawer first covers the bar under the page; at the top there is only a thin gap before the page's first line, so the same drawer reaches six lines down.</li>
  <li><b>C costs nothing on the page</b>: 108 pixels tall, about the bar's own height.</li>
  <li><b>C's row scrolls sideways</b> on a word with many signs, so the last signs start out of view; the row's cut edge shows there is more.</li>
</ul>

<h2>What else could be considered, and why is it not here?</h2>
<ul>
  <li><b>Slide the page up under the drawer</b>, so the tapped line rises above it. Left out for now: the page moving under a reader's hand when they tap is its own surprise, and it fights the page-turn gestures. Worth building if B's jump to the top feels wrong.</li>
  <li><b>A panel at the side on a computer.</b> The earlier decision ruled out a second shape to learn.</li>
  <li><b>Back beside the word.</b> That is what the app did before; the earlier decision chose one place over it.</li>
</ul>

<h2>What would change the answer?</h2>
<ul>
  <li>A hafiz who finds the drawer jumping to the top confusing points to A or to sliding the page.</li>
  <li>A hafiz who picks signs easily at the smaller size makes C the cleanest.</li>
</ul>

<h2>What is this not settling?</h2>
<ul>
  <li>What the drawer holds or how a part is picked; only where it stands.</li>
  <li>Phones: Word mode's tool bar is on computers only for now.</li>
</ul>
</main>

<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><symbol id="print" viewBox="0 0 345 550">${leafInner}</symbol></defs></svg>

<script>
const WORDS = ${JSON.stringify(WORDLIST)};
const START = ${JSON.stringify({ a: START.a, n: START.n })};
const NS = "http://www.w3.org/2000/svg";
const $ = (s) => document.querySelector(s);
let opt = "A", size = [1440, 900], tapped = null, tab = "signs";

const screen = $("#screen"), wrap = $("#wrap"), leaf = $("#leaf"), drawer = $("#drawer"), hits = $("#hits");

// One transparent box per word, tinted by state.
for (const w of WORDS) {
  const r = document.createElementNS(NS, "rect");
  const [x, y, bw, bh] = w.b;
  r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", bw); r.setAttribute("height", bh);
  r.setAttribute("class", "hit");
  r.addEventListener("click", () => { tapped = w; tab = "signs"; render(); });
  w.el = r; hits.appendChild(r);
}

function layout() {
  const [W, H] = size;
  screen.style.width = W + "px"; screen.style.height = H + "px";
  const k = wrap.clientWidth / W;
  screen.style.transform = "scale(" + k + ")";
  wrap.style.height = H * k + "px";
  // The leaf fills the space between the bars, at the print's shape.
  const top = 137, bottom = H - 130, h = bottom - top, w = h * 345 / 550;
  leaf.style.top = top + "px"; leaf.style.height = h + "px";
  leaf.style.width = w + "px"; leaf.style.left = (W - w) / 2 + "px";
}

/** A copy of the word, cut from the print; with a sign's box inked when given. */
function copy(w, px, sign) {
  const pad = 2.5, [x, y, bw, bh] = w.b;
  const vx = x - pad, vy = y - pad, vw = bw + pad * 2, vh = bh + pad * 2;
  const z = px / vh;
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", vx + " " + vy + " " + vw + " " + vh);
  s.setAttribute("width", (vw * z).toFixed(1)); s.setAttribute("height", px);
  const id = "c" + Math.random().toString(36).slice(2);
  let inner = '<use href="#print" width="345" height="550" opacity="' + (sign ? 0.22 : 1) + '"/>';
  if (sign) {
    const [, sx, sy, sw, sh] = sign;
    inner += '<clipPath id="' + id + '"><rect x="' + (sx - .6) + '" y="' + (sy - .6) + '" width="' + (sw + 1.2) + '" height="' + (sh + 1.2) + '"/></clipPath>' +
      '<use href="#print" width="345" height="550" clip-path="url(#' + id + ')"/>' +
      '<rect x="' + (sx - 1) + '" y="' + (sy - 1) + '" width="' + (sw + 2) + '" height="' + (sh + 2) + '" fill="none" stroke="#1f6f66" stroke-width="' + (1.5 / z) + '" rx="' + (3 / z) + '"/>';
  }
  s.innerHTML = inner;
  return s;
}

function part(w, px, name, sign, slim) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "part" + (slim ? " slim" : "");
  b.appendChild(copy(w, px, sign));
  const n = document.createElement("span"); n.className = "nm"; n.textContent = name;
  b.appendChild(n);
  return b;
}

function row(nodes) {
  const r = document.createElement("div"); r.className = "row";
  nodes.forEach((n) => r.appendChild(n));
  return r;
}

function fillDrawer(w) {
  drawer.innerHTML = "";
  const head = document.createElement("div"); head.className = "dhead";
  const t = document.createElement("span"); t.textContent = "The parts of a word in Al-Baqarah " + w.a;
  head.appendChild(t);
  const letters = Array.from({ length: w.l }, (_, i) => i);
  if (opt === "C" && w.l > 1) {
    const tabs = document.createElement("div"); tabs.className = "tabs";
    for (const [k, label] of [["signs", "Signs"], ["letters", "Letters"]]) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label;
      b.setAttribute("aria-pressed", String(tab === k));
      b.addEventListener("click", () => { tab = k; render(); });
      tabs.appendChild(b);
    }
    head.appendChild(tabs);
  }
  const x = document.createElement("button"); x.className = "dx"; x.type = "button"; x.textContent = "\\u00d7";
  x.setAttribute("aria-label", "Close");
  x.addEventListener("click", () => { tapped = null; render(); });
  head.appendChild(x);
  drawer.appendChild(head);
  if (opt === "C") {
    // One row: 34-pixel copies, the name beside rather than under.
    const px = 34;
    drawer.appendChild(row(tab === "letters" && w.l > 1
      ? letters.map((i) => part(w, px, "Letter " + (i + 1), null, true))
      : [part(w, px, "The whole word", null, true), ...w.s.map((s) => part(w, px, s[0], s, true))]));
    return;
  }
  const hint = document.createElement("div"); hint.className = "dhint"; hint.textContent = "Pick a part to write a note on it";
  drawer.appendChild(hint);
  // The app's docked size: 52-pixel copies, each row on one line.
  const px = 52;
  drawer.appendChild(row([part(w, px, "The whole word"), ...w.s.map((s) => part(w, px, s[0], s))]));
  if (w.l > 1) drawer.appendChild(row(letters.map((i) => part(w, px, "Letter " + (i + 1)))));
}

function render() {
  layout();
  document.querySelectorAll("[data-opt]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.opt === opt)));
  document.querySelectorAll("[data-size]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.size === size.join("x"))));
  for (const w of WORDS) w.el.setAttribute("class", "hit");
  const out = $("#readout");
  if (!tapped) {
    drawer.hidden = true;
    out.className = "readout"; out.textContent = "Tap any word on the page to open its drawer.";
    return;
  }
  drawer.hidden = false;
  fillDrawer(tapped);
  // Where the word is, in the window's own pixels.
  const lt = parseFloat(leaf.style.top), ll = parseFloat(leaf.style.left), k = parseFloat(leaf.style.height) / 550;
  const box = (w) => ({ top: lt + w.b[1] * k, bottom: lt + (w.b[1] + w.b[3]) * k });
  const [, H] = size;
  drawer.className = "drawer bottom";
  const dh = drawer.offsetHeight;
  if (opt === "B" && box(tapped).bottom > H - dh - 8) drawer.className = "drawer top";
  const dTop = drawer.offsetTop, dBottom = dTop + drawer.offsetHeight;
  // Covered: the word's middle is under the drawer.
  const under = (w) => { const b = box(w), m = (b.top + b.bottom) / 2; return m > dTop && m < dBottom; };
  const lines = new Set();
  let hidden = 0;
  for (const w of WORDS) {
    if (!under(w)) continue;
    hidden++; lines.add(Math.floor((w.b[1] + w.b[3] / 2 - 8) / (534 / 15)));
    w.el.setAttribute("class", "hit hidden");
  }
  tapped.el.setAttribute("class", "hit on");
  const lost = under(tapped);
  out.className = "readout" + (lost ? " bad" : "");
  out.textContent = "The drawer is " + dh + " pixels tall and hides " + hidden + " words on " + lines.size +
    " line" + (lines.size === 1 ? "" : "s") + " of the page. The word you tapped is " +
    (lost ? "hidden under it." : "in sight.");
}

document.querySelectorAll("[data-opt]").forEach((b) => b.addEventListener("click", () => { opt = b.dataset.opt; render(); }));
document.querySelectorAll("[data-size]").forEach((b) => b.addEventListener("click", () => { size = b.dataset.size.split("x").map(Number); render(); }));
addEventListener("resize", render);
tapped = WORDS.find((w) => w.a === START.a && w.n === START.n);
render();
</script>
</body>
</html>
`;

if (/[؀-ۿ]/.test(html)) die("the page carries Arabic codepoints");
writeFileSync(OUT, html);
console.log(`wrote docs/design/word-drawer-placement-options.html (${WORDLIST.length} words)`);
