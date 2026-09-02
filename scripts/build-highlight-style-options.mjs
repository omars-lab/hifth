#!/usr/bin/env node
/**
 * Render docs/design/highlight-style-options.html — the options for letting a
 * reader change how the highlight over an ayah looks: its shape (the marker
 * swipe the app draws today, a translucent fill, or an outline) and its
 * strength (fixed, or a control). Drawn on real ayahs of a real page at reading
 * size, so the decision record `docs/decisions/highlight-style.md` argues about
 * a picture a reader can open rather than a paragraph.
 *
 * Two questions:
 *   1. Does a reader choose the highlight's shape, and among which — the one
 *      house swipe, a swipe-or-fill pair, or swipe/fill/outline?
 *   2. Does a reader tune its strength, or is it fixed as it is today?
 *
 * Every treatment is drawn per line, never as one box around a multi-line run —
 * because that grammar is already settled elsewhere, and the picture has to
 * honour it. A single-line ayah and a three-line ayah are both shown, since the
 * shapes read differently across lines.
 *
 * ── What it reads (committed bytes only) ────────────────────────────────────
 *   apps/web/public/assets/manifest.json            the print's viewBox
 *   apps/web/public/assets/pages/hafs-kfqc/7.svg    the outlined leaf, as backdrop
 *   apps/web/public/assets/words/hafs-kfqc/7.json   the shipped word boxes
 *   apps/web/src/styles/tokens.css                  the app's real mark colours
 *
 * ── No Qur'an ───────────────────────────────────────────────────────────────
 * The print is outlined paths with zero Arabic codepoints; the highlights are
 * SVG shapes over the leaf, never text. The writer refuses if the output carries
 * an Arabic codepoint or a <text> element.
 *
 *   node scripts/build-highlight-style-options.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const MANIFEST = join(ROOT, "apps/web/public/assets/manifest.json");
const PAGES = join(ROOT, "apps/web/public/assets/pages/hafs-kfqc");
const WORDS = join(ROOT, "apps/web/public/assets/words/hafs-kfqc/7.json");
const TOKENS_CSS = join(ROOT, "apps/web/src/styles/tokens.css");
const OUT = join(ROOT, "docs/design/highlight-style-options.html");

const die = (msg) => { console.error(`build-highlight-style-options: ${msg}`); process.exit(1); };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PAGE = 7;
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const [, , VBW, VBH] = manifest.viewBox.split(/\s+/).map(Number);
if (!(VBW > 0 && VBH > 0)) die("manifest viewBox");

const rawSvg = readFileSync(join(PAGES, `${PAGE}.svg`), "utf8");
if (/[؀-ۿ]/.test(rawSvg)) die(`page ${PAGE} carries Arabic codepoints`);
if (/<text\b/.test(rawSvg)) die(`page ${PAGE} carries <text>`);
const leafInner = rawSvg.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");

const wordShard = JSON.parse(readFileSync(WORDS, "utf8"));
const boxesOf = (ref) => (wordShard.words?.[ref]?.boxes ?? die(`no word boxes for ${ref}`));

// ── Tokens (the app's own mark colours, so the picture is not a re-invention) ──
const tokensCss = readFileSync(TOKENS_CSS, "utf8");
const token = (name) => tokensCss.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim() ?? die(`token --${name}`);
const px = (v) => (v.endsWith("rem") ? Number(v.slice(0, -3)) * 16 : v.endsWith("px") ? Number(v.slice(0, -2)) : die(`unit ${v}`));
const T = {
  space2: px(token("space-2")), space3: px(token("space-3")), space4: px(token("space-4")),
  textXs: token("text-xs"), textSm: token("text-sm"), textMd: token("text-md"),
  radiusMd: token("radius-md"),
  paper: token("paper"), paperRaised: token("paper-raised"),
  ink: token("ink"), inkSoft: token("ink-soft"), inkFaint: token("ink-faint"), hairline: token("hairline"),
};
const INK_SEL = token("ink-sel");        // #e8a13a — the pen at full strength
const RING = token("highlight-ring");    // rgba(232,161,58,0.85) — the app's own outline colour

// The app's own numbers, quoted so the picture matches the code and the record
// can re-derive them: a swipe covers BAND of the line, leaving the rest clear.
const BAND = 0.72;

// ── Per-line geometry from the real boxes ─────────────────────────────────────
// Group an ayah's word boxes into lines by their vertical centre, then take each
// line's own bounding run. This is the same "one swipe per line, never a box
// round the whole run" shape the app draws.
function linesOf(ref) {
  const boxes = boxesOf(ref).map(([x, y, w, h]) => ({ x, y, w, h }));
  const rows = [];
  for (const b of boxes.slice().sort((a, c) => a.y - c.y)) {
    const yc = b.y + b.h / 2;
    let row = rows.find((r) => Math.abs(r.yc - yc) < 14);
    if (!row) { row = { yc, items: [] }; rows.push(row); }
    row.items.push(b);
    row.yc = row.items.reduce((s, it) => s + it.y + it.h / 2, 0) / row.items.length;
  }
  return rows.map((r) => {
    const x0 = Math.min(...r.items.map((b) => b.x));
    const y0 = Math.min(...r.items.map((b) => b.y));
    const x1 = Math.max(...r.items.map((b) => b.x + b.w));
    const y1 = Math.max(...r.items.map((b) => b.y + b.h));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }).sort((a, b) => a.y - b.y);
}

// The overlay for one treatment over one ayah's per-line runs.
//  swipe   — a round-capped band, BAND of the line, blended (today's mark)
//  fill    — a soft rounded rect filling each line's run, no outline
//  outline — a rounded rect outline round each line's run, no fill
function overlay(refs, treatment, strength = 1) {
  const parts = [];
  for (const ref of refs) {
    for (const ln of linesOf(ref)) {
      const pad = 1.4;
      const x = ln.x - pad, w = ln.w + 2 * pad;
      if (treatment === "swipe") {
        const th = ln.h * BAND;
        const yc = ln.y + ln.h / 2;
        parts.push(`<line x1="${x.toFixed(1)}" y1="${yc.toFixed(1)}" x2="${(x + w).toFixed(1)}" y2="${yc.toFixed(1)}" stroke="${INK_SEL}" stroke-width="${th.toFixed(1)}" stroke-linecap="round" opacity="${strength}" style="mix-blend-mode:multiply"/>`);
      } else if (treatment === "fill") {
        const y = ln.y - pad, h = ln.h + 2 * pad;
        parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" fill="${INK_SEL}" fill-opacity="${(0.22 * strength).toFixed(3)}" style="mix-blend-mode:multiply"/>`);
      } else if (treatment === "outline") {
        const y = ln.y - pad, h = ln.h + 2 * pad;
        parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" fill="none" stroke="${RING}" stroke-width="1.3" opacity="${strength}" vector-effect="non-scaling-stroke"/>`);
      }
    }
  }
  return parts.join("");
}

// A reading-size crop of the leaf, cropped to the given ayahs, with a treatment
// drawn over them. width is the on-page px; height follows the crop's aspect.
function crop(refs, treatment, { strength = 1, width = 300, label = "" } = {}) {
  const runs = refs.flatMap((r) => linesOf(r));
  const m = 8;
  const x0 = Math.min(...runs.map((r) => r.x)) - m;
  const y0 = Math.min(...runs.map((r) => r.y)) - m;
  const x1 = Math.max(...runs.map((r) => r.x + r.w)) + m;
  const y1 = Math.max(...runs.map((r) => r.y + r.h)) + m;
  const cw = x1 - x0, ch = y1 - y0;
  const height = Math.round((width * ch) / cw);
  const cap = label ? `<figcaption class="cap">${esc(label)}</figcaption>` : "";
  return `<figure class="crop"><svg viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${cw.toFixed(1)} ${ch.toFixed(1)}" width="${width}" height="${height}" role="img" aria-label="${esc(label || treatment)} highlight on page ${PAGE}"><use href="#p${PAGE}" width="${VBW}" height="${VBH}"/><g>${overlay(refs, treatment, strength)}</g></svg>${cap}</figure>`;
}

const SINGLE = ["2:45"];         // one line
const MULTI = ["2:41"];          // three lines

// ── Q1 · shape ────────────────────────────────────────────────────────────────
const shapeRow = (treatment, title, sub) => `
  <div class="shape">
    <div class="shape-head"><b>${esc(title)}</b><span>${esc(sub)}</span></div>
    <div class="shape-pics">
      ${crop(SINGLE, treatment, { width: 264, label: "one line" })}
      ${crop(MULTI, treatment, { width: 264, label: "three lines" })}
    </div>
  </div>`;

const Q1_SHAPES = [
  ["swipe", "The marker swipe", "what the app draws today — a round-capped band, blended into the ink"],
  ["fill", "A translucent fill", "a soft wash filling each line, the ink still readable through it"],
  ["outline", "An outline", "a thin frame round each line, nothing over the words at all"],
];

// ── Q2 · strength ─────────────────────────────────────────────────────────────
const strengthStep = (treatment, s, name) => `
  <div class="step">
    ${crop(SINGLE, treatment, { width: 210, strength: s })}
    <div class="step-cap">${esc(name)}</div>
  </div>`;

// ── Option prose ──────────────────────────────────────────────────────────────
const shapeOptions = [
  { id: "A", h: "One house style, no choice",
    body: "Every reader gets the marker swipe the app draws today. Nothing to set, nothing to learn, and the mark means the same thing on every phone and in every screenshot shared with a teacher.",
    cost: "A reader who finds the swipe too heavy over a dense line, or who simply wants a lighter mark, has no way to change it." },
  { id: "B", h: "A choice of two: the swipe or a fill",
    body: "The reader picks between today's swipe and a translucent fill. Two shapes, one decision, and both keep the words readable — the fill because it stays translucent, the swipe because it always has.",
    cost: "A second style to draw, test and keep honest across single and multi-line ayahs, for a choice some readers will never open." },
  { id: "C", h: "A choice of three: swipe, fill, or outline",
    body: "The full menu — the swipe, the fill, and an outline that puts nothing over the words. The outline is the gentlest possible mark and the one a reader bothered by any wash would reach for.",
    cost: "Three treatments to maintain, and an outline round every line of a long ayah can read as busier than the thing it marks." },
];

const strengthOptions = [
  { id: "A", h: "Fixed, as it is today",
    body: "The mark's strength is chosen once, for everyone, and never moves. The app already tuned it to survive over ink at reading size; a fixed strength is one less thing that can be set wrong.",
    cost: "The single most common complaint about any wash — too loud, or too faint — has no answer but 'that is how it is'." },
  { id: "B", h: "One strength control",
    body: "A single slider from faint to firm, and nothing else. Cheap, and quite possibly the whole of what is being asked for: most objections to a mark are about how loud it is, not its shape.",
    cost: "A slider is a setting to store, and a reader can set it so faint the mark disappears — which needs a floor, and a way back to the default." },
  { id: "C", h: "A few named steps",
    body: "Not a continuous slider but three steps — light, medium, firm — so the choice is legible and the ends are safe by construction. The middle is today's strength.",
    cost: "Three steps is a guess at the right granularity; a reader who wants the gap between two of them cannot have it." },
];

const optionCard = (o) => `
  <div class="opt">
    <div class="opt-id">${o.id}</div>
    <div class="opt-body">
      <b>${esc(o.h)}</b>
      <p>${esc(o.body)}</p>
      <p class="opt-cost"><span>What it costs</span> ${esc(o.cost)}</p>
    </div>
  </div>`;

// ── Page ──────────────────────────────────────────────────────────────────────
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>The highlight: what shape, and how strong?</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: ${T.paper}; color: ${T.ink};
    font: ${T.textMd}/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: ${T.space4}px ${T.space3}px 96px; }
  h1 { font-size: 1.5rem; line-height: 1.25; margin: 0 0 ${T.space2}px; }
  h2 { font-size: 1.18rem; margin: ${T.space4}px 0 ${T.space2}px; }
  .lede { color: ${T.inkSoft}; margin: 0 0 ${T.space3}px; }
  .site { font-size: ${T.textSm ?? "0.85rem"}; color: ${T.inkSoft}; margin: 0 0 ${T.space4}px; }
  .site a { color: inherit; }
  .card { background: ${T.paperRaised}; border: 1px solid ${T.hairline};
    border-radius: ${T.radiusMd}; padding: ${T.space3}px; margin: ${T.space3}px 0; }
  .shape { margin: ${T.space3}px 0; }
  .shape-head b { font-size: 1.02rem; }
  .shape-head span { color: ${T.inkSoft}; margin-left: 8px; }
  .shape-pics { display: flex; flex-wrap: wrap; gap: ${T.space3}px; margin-top: 8px; }
  .crop { margin: 0; }
  .crop svg { display: block; background: #fff; border: 1px solid ${T.hairline}; border-radius: 6px; }
  .cap, .step-cap { font-size: 0.78rem; color: ${T.inkFaint}; margin-top: 4px; text-align: center; }
  .steps { display: flex; flex-wrap: wrap; gap: ${T.space3}px; align-items: flex-start; }
  .step { text-align: center; }
  .opt { display: flex; gap: ${T.space3}px; padding: ${T.space3}px 0; border-top: 1px solid ${T.hairline}; }
  .opt:first-child { border-top: 0; }
  .opt-id { flex: 0 0 28px; height: 28px; border-radius: 50%; background: ${INK_SEL};
    color: #3a2a08; font-weight: 700; display: grid; place-items: center; }
  .opt-body b { display: block; }
  .opt-body p { margin: 4px 0; color: ${T.inkSoft}; }
  .opt-cost span { font-weight: 600; color: ${T.ink}; }
  .note { color: ${T.inkSoft}; font-size: 0.92rem; border-left: 3px solid ${T.hairline};
    padding-left: ${T.space3}px; margin: ${T.space3}px 0; }
  footer { margin-top: 64px; padding-top: ${T.space3}px; border-top: 1px solid ${T.hairline};
    color: ${T.inkFaint}; font-size: 0.8rem; }
  footer code { color: ${T.inkSoft}; }
</style>
</head>
<body>
<svg class="defs" aria-hidden="true" width="0" height="0" style="position:absolute"><symbol id="p${PAGE}" viewBox="0 0 ${VBW} ${VBH}">${leafInner}</symbol></svg>
<main>
  <h1>The highlight over an ayah: what shape should it be, and how strong?</h1>
  <p class="lede">The app marks the ayah you are on. A reader has asked to change how that
    mark looks — box or fill, and how see-through. Here is what the mark is today, and the
    real range of what it could be, drawn on a real page at the size you read it.</p>
  <p class="site">The picture on the site:
    <a href="https://blog.bytesofpurpose.com/hifth/docs/design/highlight-style-options.html">blog.bytesofpurpose.com/hifth/docs/design/highlight-style-options.html</a></p>

  <div class="note">Every mark below is drawn <b>per line</b>, never as one box around a whole
    multi-line ayah. That is not a choice this page is making — it is settled already, for
    the same reason the printed tradition does it: a single box swallows the lines above and
    below. So "box vs fill" here means a frame or a wash <em>around each line</em>, and the
    three-line ayah is drawn beside the one-line one so you can see the difference.</div>

  <h2>What is the mark today?</h2>
  <p class="lede">A round-capped amber band along each line, blended into the ink like a real
    marker — not a box, not a fill, not an outline. It covers about seven-tenths of the line's
    height and leaves the rest clear, so stacked lines still read as separate passes.</p>
  <div class="card">
    <div class="shape-pics">
      ${crop(SINGLE, "swipe", { width: 300, label: "the ayah you are on — one line" })}
      ${crop(MULTI, "swipe", { width: 300, label: "— and across three lines" })}
    </div>
  </div>

  <h2>Question one — does a reader choose the highlight's shape?</h2>
  <p class="lede">Each shape drawn on the same one-line and three-line ayah, at reading size.</p>
  <div class="card">
    ${Q1_SHAPES.map(([t, title, sub]) => shapeRow(t, title, sub)).join("")}
  </div>
  ${shapeOptions.map(optionCard).join("")}

  <h2>Question two — does a reader tune the mark's strength?</h2>
  <p class="lede">Drawn at the extremes so the range is visible. The swipe today is already at
    full ink, so a control mostly makes it <em>fainter</em>; a fill has room in both directions.
    Which shape wins question one changes how useful a strength control even is.</p>
  <div class="card">
    <div class="steps">
      ${strengthStep("swipe", 0.4, "swipe · faint")}
      ${strengthStep("swipe", 1.0, "swipe · today (full ink)")}
    </div>
    <div class="steps" style="margin-top:12px">
      ${strengthStep("fill", 0.5, "fill · light")}
      ${strengthStep("fill", 1.0, "fill · medium (today)")}
      ${strengthStep("fill", 1.7, "fill · firm")}
    </div>
    <p class="cap" style="text-align:left;margin-top:12px">The strength control, if there is one,
      moves whichever shape a reader chose — and it is the fill, not the already-solid swipe, that
      has the headroom to be turned up.</p>
  </div>
  ${strengthOptions.map(optionCard).join("")}

  <footer>
    Drawn by <code>scripts/build-highlight-style-options.mjs</code> from page ${PAGE}'s shipped
    word boxes and outlined print, and the app's own mark colours. The record it belongs to is
    <code>docs/decisions/highlight-style.md</code>; its siblings are <code>docs/decisions/comparison-crop.md</code>
    (which settled the per-line grammar) and <code>docs/decisions/tajweed-colours.md</code>
    (which first floated a strength control). No Qur'an text: the print is outlined paths and the
    marks are shapes, never words.
  </footer>
</main>
</body>
</html>`;

// ── Guards: no Qur'an text may reach the file ─────────────────────────────────
if (/[؀-ۿ]/.test(html)) die("output carries Arabic codepoints");
if (/<text\b/.test(html)) die("output carries a <text> element");

writeFileSync(OUT, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`build-highlight-style-options: wrote ${OUT} (${kb} KB, 0 Arabic)`);
