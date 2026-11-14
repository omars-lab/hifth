#!/usr/bin/env node
/**
 * Render docs/design/phone-note-options.html — the decision page for how The
 * Study Quran's note sits on a phone (docs/decisions/phone-note.md).
 *
 * The note exists only in the private pitch build, so this public page cannot
 * mount it. It draws each option instead: a phone, the page with the verse's
 * lines washed, and the note card with grey bars where its words go. The
 * difference between the options is where things sit and how much of the
 * commentary is in sight, which a drawing carries; the feel of each is tried in
 * the pitch build itself, where every option is a setting in the info panel.
 *
 * ── No Qur'an, no held text ─────────────────────────────────────────────────
 * Every word here is English chrome; the note's words are drawn as bars. The
 * writer refuses if its own output carries an Arabic codepoint.
 *
 * Registered in docs/decisions.json as the `builtBy` for phone-note-lead and
 * phone-note-sideways.
 *
 *   node scripts/build-phone-note-options.mjs
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const OUT = join(ROOT, "docs/design/phone-note-options.html");

// ── The drawings. Units are the phone's own points, scaled down by the viewBox.
const C = {
  frame: "var(--ink)",
  screen: "var(--paper)",
  bar: "var(--paper-sunk)",
  page: "#fffdf7",
  wash: "#f0b85a",
  card: "var(--paper-raised)",
  words: "var(--ink-faint)",
  commentary: "var(--accent)",
};

const rect = (x, y, w, h, fill, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;

/** Lines of grey bars standing in for words, `n` of them from `y`, `gap` apart. */
const words = (x, y, w, n, gap, fill = C.words, h = 6) =>
  Array.from({ length: n }, (_, i) => rect(x, y + i * gap, i === n - 1 ? w * 0.6 : w, h, fill, 'rx="3"')).join("");

/** The page: plain lines, with the verse's six lines washed from line `from`. */
function page(x, y, w, h, from) {
  const rows = Math.floor((h - 8) / 22);
  let out = rect(x, y, w, h, C.page, 'stroke="var(--paper-sunk)"');
  for (let i = 0; i < rows; i++) {
    const ly = y + 8 + i * 22;
    if (i >= from && i < from + 6) out += rect(x + 6, ly - 4, w - 12, 18, C.wash, 'rx="4" opacity=".75"');
    out += rect(x + 10, ly + 2, w - 20, 5, "#b9ad9a", 'rx="2"');
  }
  return out;
}

/**
 * One phone. `up` is upright (402 × 874) or on its side (874 × 402); `card` is
 * where the note sits; `lead` is how many lines of translation it shows before
 * the commentary; `commentary` how many lines of commentary are in sight.
 */
function phone({ up, card, lead, commentary, pageBox, verseFrom }) {
  const [W, H] = up ? [402, 874] : [874, 402];
  const head = 64;
  let svg = `<svg viewBox="-10 -10 ${W + 20} ${H + 20}" role="img" xmlns="http://www.w3.org/2000/svg">`;
  svg += rect(-8, -8, W + 16, H + 16, C.frame, 'rx="44"');
  svg += rect(0, 0, W, H, C.screen, 'rx="38"');
  svg += rect(0, 0, W, head, C.bar, 'rx="0"');
  svg += page(...pageBox, verseFrom);
  // The note card.
  const [cx, cy, cw, ch] = card;
  svg += rect(cx, cy, cw, ch, C.card, 'rx="18" stroke="var(--paper-sunk)" stroke-width="2"');
  let y = cy + 24;
  svg += rect(cx + 20, y, cw * 0.45, 10, "var(--ink)", 'rx="4"');
  y += 34;
  svg += words(cx + 30, y, cw - 60, lead, 20);
  y += lead * 20 + 8;
  if (lead === 2) {
    svg += rect(cx + 30, y, 110, 8, "var(--accent-strong)", 'rx="3"');
    y += 34;
  }
  const room = cy + ch - y - 10;
  const shown = Math.max(0, Math.min(commentary, Math.floor(room / 22)));
  svg += words(cx + 20, y, cw - 40, shown, 22, C.commentary, 7);
  svg += "</svg>";
  return svg;
}

const OPTIONS_LEAD = [
  {
    id: "clamp",
    name: "A · Two lines of the translation, then the commentary",
    gist: "The translation is cut to two lines with a button for the rest; the commentary starts inside the short note.",
    draw: { up: true, card: [0, 542, 402, 332], lead: 2, commentary: 3, pageBox: [16, 80, 370, 450], verseFrom: 6 },
    measured: "3 lines of the commentary in sight, the verse whole above the note.",
    pros: [
      "The reader sees the book's own words on the verse at once, without a scroll.",
      "The verse stays whole and clear above the note.",
      "The whole translation is one tap away, and the tap is undone the same way.",
    ],
    cons: [
      "The translation is cut mid-sentence until the reader asks for it.",
      "One more button in the note.",
    ],
    then: "The note leads with the commentary on a phone, while the iPad keeps leading with the whole translation.",
  },
  {
    id: "whole",
    name: "B · The whole translation first, as it was",
    gist: "The note shows the whole translation, and the commentary starts below it.",
    draw: { up: true, card: [0, 542, 402, 332], lead: 9, commentary: 0, pageBox: [16, 80, 370, 450], verseFrom: 6 },
    measured: "0 lines of the commentary in sight on a long verse; it starts about 200 points below the screen's foot.",
    pros: ["Nothing is cut: the translation reads whole.", "The same order as on the iPad."],
    cons: [
      "On a long verse the commentary is out of sight until the reader scrolls, so a first look shows no commentary at all.",
    ],
    then: "A phone reader has to learn to scroll the note before the book's commentary appears.",
  },
  {
    id: "tall",
    name: "C · The note opens grown to the full height",
    gist: "The note rises over the whole screen at once, showing the translation and much of the commentary.",
    draw: { up: true, card: [0, 72, 402, 802], lead: 9, commentary: 18, pageBox: [16, 80, 370, 450], verseFrom: 6 },
    measured: "Most of the commentary in sight, and the verse covered.",
    pros: ["The most commentary in sight at once.", "Nothing is cut."],
    cons: [
      "The verse it is about is hidden under it, so the reader loses the page while reading about it.",
      "Closing the note is needed to see the page again.",
    ],
    then: "A phone reads the note as a page of its own, not beside the verse.",
  },
];

const OPTIONS_SIDEWAYS = [
  {
    id: "beside",
    name: "A · Standing beside the page, the full height of the screen",
    gist: "Held on its side, the note stands at the side of the screen and the page moves over to make room.",
    draw: { up: false, card: [566, 77, 300, 317], lead: 2, commentary: 5, pageBox: [175, 72, 238, 200], verseFrom: 1 },
    measured: "4 lines of the commentary in sight on a 6.3-inch phone, 5 on the largest, 3 on the smallest; no line of the verse under the note.",
    pros: [
      "The verse and the commentary are both in sight, side by side, as on the iPad.",
      "The note is as tall as the screen allows, which on its side is the scarce direction.",
    ],
    cons: [
      "It covers the right-hand end of the page strip and the chip at the foot while it is open.",
      "On the smallest phones (375 points tall) the bars at the foot still cover the end of a long verse.",
    ],
    then: "A phone on its side behaves like a small iPad: the note beside the page, not over it.",
  },
  {
    id: "foot",
    name: "B · Lying across the foot of the screen, as it was",
    gist: "The note lies across the bottom of the screen, under the page.",
    draw: { up: false, card: [0, 233, 874, 169], lead: 2, commentary: 0, pageBox: [318, 72, 238, 160], verseFrom: 1 },
    measured: "0 lines of the commentary in sight: a strip about 150 points tall holds the title and the translation.",
    pros: ["The same place as when the phone is upright.", "The whole page strip at the foot is covered alike, so nothing is half hidden."],
    cons: ["No commentary in sight until the reader scrolls the strip.", "The strip is too short to read in."],
    then: "A phone reader turns the phone upright to read a note.",
  },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const list = (xs) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;

const cards = (options, wide) =>
  `<div class="phones${wide ? " wide" : ""}">\n${options
    .map(
      (o, i) => `  <section class="opt${i === 0 ? " rec" : ""}">
    <h3>${esc(o.name)}${i === 0 ? '<span class="rec-tag">the default</span>' : ""}</h3>
    <p class="gist">${esc(o.gist)}</p>
    <figure>${phone(o.draw)}<figcaption><b>Measured:</b> ${esc(o.measured)}</figcaption></figure>
  </section>`,
    )
    .join("\n")}\n</div>`;

const table = (options) => `<div class="scroll"><table>
  <tr><th></th><th>What it buys</th><th>What it costs</th><th>What it commits us to</th></tr>
${options.map((o) => `  <tr><th>${esc(o.name)}</th><td>${list(o.pros)}</td><td>${list(o.cons)}</td><td>${esc(o.then)}</td></tr>`).join("\n")}
</table></div>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The note on a phone</title>
<style>
  :root{
    --paper:#f4efe6; --paper-raised:#fbf8f2; --paper-sunk:#e2d8c6;
    --ink:#26201a; --ink-soft:#5c5347; --ink-faint:#9a8f80;
    --accent:#1f6f66; --accent-strong:#17544d; --accent-tint:#d7e7e3;
    --radius-md:10px; --radius-lg:16px;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --paper:#1c1915; --paper-raised:#25211c; --paper-sunk:#3a332b;
      --ink:#efe8dc; --ink-soft:#c9bfb0; --ink-faint:#7d7466;
      --accent:#5fb3a8; --accent-strong:#8fd0c6; --accent-tint:#23403c;
    }
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
    font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
  main{max-width:78rem;margin:0 auto;padding:2rem 1rem 5rem;}
  h1{font-size:1.9rem;line-height:1.2;margin:.2rem 0 .4rem;}
  h2{font-size:1.28rem;margin:2.4rem 0 .5rem;}
  p,li{max-width:40rem;} .lead{font-size:1.12rem;color:var(--ink-soft);}
  a{color:var(--accent-strong);}
  .hafiz{background:var(--accent-tint);border-radius:var(--radius-md);padding:.7rem 1rem;max-width:40rem;}
  .glossary{background:var(--paper-raised);border:1px solid var(--paper-sunk);
    border-radius:var(--radius-md);padding:.8rem 1rem;margin:1.2rem 0;font-size:.95rem;max-width:40rem;}
  .glossary dt{font-weight:650;} .glossary dd{margin:0 0 .5rem;color:var(--ink-soft);}
  .phones{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr));gap:1.4rem;margin:1.4rem 0;}
  .phones.wide{grid-template-columns:repeat(auto-fit,minmax(min(100%,26rem),1fr));}
  .opt{display:flex;flex-direction:column;background:var(--paper-raised);border:1px solid var(--paper-sunk);border-radius:var(--radius-lg);padding:1rem;}
  .opt h3{margin:0 0 .2rem;font-size:1.05rem;}
  .opt .gist{margin:0 0 .8rem;color:var(--ink-soft);font-size:.95rem;}
  .opt.rec{border-color:var(--accent);}
  .rec-tag{display:inline-block;font-size:.75rem;font-weight:650;color:var(--accent-strong);
    background:var(--accent-tint);border-radius:999px;padding:.05rem .55rem;margin-left:.4rem;}
  figure{margin:auto 0 0;} figure svg{display:block;width:100%;max-height:30rem;}
  figcaption{font-size:.88rem;color:var(--ink-soft);margin-top:.5rem;}
  table{border-collapse:collapse;width:100%;font-size:.93rem;margin:1rem 0;}
  th,td{border:1px solid var(--paper-sunk);padding:.5rem .6rem;vertical-align:top;text-align:left;}
  th{background:var(--paper-raised);}
  td ul{margin:0;padding-left:1.1rem;}
  .scroll{overflow-x:auto;}
</style>
</head>
<body>
<main>
<h1>How should The Study Quran's note sit on a phone?</h1>
<p class="lead">On an iPad the note sits beside the verse it is about. A phone has no room beside, so the note rises as a
card from the foot of the screen. Measured on the longest verse on the demo's path, that card showed the note's title and
the translation, and not one line of the book's commentary, whether the phone was upright or on its side. Each way of
fixing it was built into the app. The first of each pair is the default; the others are a setting in the info panel.</p>

<p class="hafiz"><b>What it changes for a hafiz:</b> tapping a verse on a phone shows the book's commentary on it at once,
with the verse still whole in sight, instead of a translation that has to be scrolled past first.</p>

<dl class="glossary">
  <dt>The note</dt><dd>The Study Quran's translation of a verse and its commentary on it, opened by tapping the verse.</dd>
  <dt>The commentary</dt><dd>the book's explanation of the verse, under the translation.</dd>
  <dt>Upright, on its side</dt><dd>the phone held tall (portrait) or wide (landscape).</dd>
</dl>
<p>In the drawings the orange bands are the verse's lines on the page, the grey bars are the translation's words, and the
green bars are the commentary's. No words are drawn.</p>

<h2>What should the note lead with, held upright?</h2>
${cards(OPTIONS_LEAD, false)}
${table(OPTIONS_LEAD)}

<h2>Where should the note stand with the phone on its side?</h2>
${cards(OPTIONS_SIDEWAYS, true)}
${table(OPTIONS_SIDEWAYS)}

<h2>Who decides, and what happens if nobody does?</h2>
<p>The owner, by trying each in the pitch build on a phone (the info panel: "What a note on a phone shows first" and "Where a note stands on a phone on its side"). Until then the app
shows the first of each, and nothing else changes: the iPad and the computer are not touched by either choice.</p>

<h2>Where are the reasons?</h2>
<p>In <a href="../decisions/phone-note.md">the decision record</a>, with how each was measured, what else was looked at,
and what would change the answer.</p>
</main>
</body>
</html>
`;

// Arabic letters, by number, so no invisible character sits in the source.
const ARABIC = new RegExp(`[${[[0x600, 0x6ff], [0x750, 0x77f], [0x8a0, 0x8ff], [0xfb50, 0xfdff], [0xfe70, 0xfeff]].map(([a, b]) => String.fromCharCode(a) + "-" + String.fromCharCode(b)).join("")}]`);
if (ARABIC.test(html))
  throw new Error("build-phone-note-options: the page carries an Arabic codepoint");
writeFileSync(OUT, html);
console.log(`wrote ${OUT}`);
