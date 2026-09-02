#!/usr/bin/env node
/**
 * Render docs/design/mistake-marking-options.html — the options for letting a
 * reader pin their own note to a spot on the page, drawn on a real page of the
 * print at the zoom each would be used, so the decision record
 * `docs/decisions/mistake-marking.md` argues about a picture a reader can open.
 *
 * ── What it reads (committed bytes only) ────────────────────────────────────
 *   apps/web/public/assets/manifest.json            the print's viewBox
 *   apps/web/public/assets/pages/hafs-kfqc/7.svg    the leaf the marks sit on
 *   apps/web/public/assets/words/hafs-kfqc/7.json   the shipped word + mark boxes
 *   apps/web/src/components/PageStage.tsx            ZOOM_STEPS, MIN/MAX zoom
 *   apps/web/src/styles/tokens.css                  the app's sizes and colours
 *
 * Every anchor drawn is a box the app already ships — a verse polygon, a word
 * box, or the pause-mark box flagged inside a word. The one anchor the request
 * asks for that the app does NOT ship — a single letter or a harakah — is drawn
 * dashed and labelled, because the shipped page is anonymous outlined <path>s
 * with no per-glyph geometry (see docs/design/sub-word-marks.md §①).
 *
 * ── There is no reader's note in this file, and no Qur'an ───────────────────
 * The print is outlined paths with zero Arabic codepoints; page 7 is inlined
 * once as a <symbol> and <use>d per crop. A note's text is drawn as a short
 * bar, never as words. The writer refuses if the output carries an Arabic
 * codepoint or a <text> element.
 *
 *   node scripts/build-mistake-marking-options.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import { readPolygons } from "./lib/box-sweep.mjs";

const MANIFEST = join(ROOT, "apps/web/public/assets/manifest.json");
const PAGES = join(ROOT, "apps/web/public/assets/pages/hafs-kfqc");
const WORDS = join(ROOT, "apps/web/public/assets/words/hafs-kfqc/7.json");
const STAGE = join(ROOT, "apps/web/src/components/PageStage.tsx");
const TOKENS_CSS = join(ROOT, "apps/web/src/styles/tokens.css");
const OUT = join(ROOT, "docs/design/mistake-marking-options.html");

const die = (msg) => {
  console.error(`build-mistake-marking-options: ${msg}`);
  process.exit(1);
};
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── The leaf, the verse, the boxes ───────────────────────────────────────────
const PAGE = 7; // the leaf every drawing uses
const SURAH = 2;
const AYAH = 38; // the top verse on page 7, the one the crops zoom into

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const [, , VBW, VBH] = manifest.viewBox.split(/\s+/).map(Number);
if (!(VBW > 0 && VBH > 0)) die("manifest viewBox");

const rawSvg = readFileSync(join(PAGES, `${PAGE}.svg`), "utf8");
if (/[\u0600-\u06FF]/.test(rawSvg)) die(`page ${PAGE} carries Arabic codepoints`);
if (/<text\b/.test(rawSvg)) die(`page ${PAGE} carries <text>`);
const leafInner = rawSvg.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");

// The verse polygon (shipped, per-ayah) — the coarsest anchor.
const polygons = readPolygons(rawSvg);
const poly = polygons.find((p) => p.surah === SURAH && p.ayah === AYAH) ?? die(`no polygon for ${SURAH}:${AYAH}`);
const ayahBox = (() => {
  let x = 0, y = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const m of poly.d.matchAll(/([MmHhVvZz])\s*([-\d.\s]*)/g)) {
    const c = m[1];
    const a = m[2].trim().split(/\s+/).filter(Boolean).map(Number);
    if (c === "M") [x, y] = a;
    else if (c === "m") { x += a[0]; y += a[1]; }
    else if (c === "H") x = a[0];
    else if (c === "h") x += a[0];
    else if (c === "V") y = a[0];
    else if (c === "v") y += a[0];
    else continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
})();
if (!(ayahBox.w > 0 && ayahBox.h > 0)) die(`could not read ${SURAH}:${AYAH}'s box`);

// The word boxes (shipped) — the middle anchor. Each is [x, y, w, h] in viewBox
// units; a word flagged in `marks` is a pause sign, the finest anchor that ships.
const wordShard = JSON.parse(readFileSync(WORDS, "utf8"));
const wentry = wordShard.words?.[`${SURAH}:${AYAH}`] ?? die(`no word boxes for ${SURAH}:${AYAH} on page ${PAGE}`);
const asBox = ([x, y, w, h]) => ({ x, y, w, h });
const wordBoxes = wentry.boxes.map(asBox);
const markIdx = (wentry.marks ?? [])[0];
if (markIdx == null) die(`${SURAH}:${AYAH} has no shipped pause-mark box to draw`);
const markBox = wordBoxes[markIdx];
// The opening word of the verse (rightmost box on the first line): the one a
// reader would most plausibly note. Pick the largest-x box in the top band.
const topBand = wordBoxes.filter((b) => b.y < ayahBox.y + ayahBox.h * 0.28 && b !== markBox);
const wordBox = topBand.reduce((a, b) => (b.x > a.x ? b : a), topBand[0]);

// ── The zoom ladder, from the stage that owns it ─────────────────────────────
const stage = readFileSync(STAGE, "utf8");
const ZOOM_STEPS = (stage.match(/ZOOM_STEPS[^=]*=\s*\[([^\]]+)\]/)?.[1] ?? die("ZOOM_STEPS")).
  split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
const MAX_ZOOM = Number(stage.match(/MAX_ZOOM\s*=\s*([\d.]+)/)?.[1] ?? die("MAX_ZOOM"));
if (ZOOM_STEPS.length < 3) die("ZOOM_STEPS parse");
// The rung at which per-glyph pins first become legible: the first step that at
// least doubles the fit size. Icons cluster below it, separate above.
const ICON_RUNG = ZOOM_STEPS.find((z) => z >= 2) ?? MAX_ZOOM;

// ── Tokens ───────────────────────────────────────────────────────────────────
const tokensCss = readFileSync(TOKENS_CSS, "utf8");
const token = (name) => tokensCss.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim() ?? die(`token --${name}`);
const px = (v) => (v.endsWith("rem") ? Number(v.slice(0, -3)) * 16 : v.endsWith("px") ? Number(v.slice(0, -2)) : die(`unit ${v}`));
const T = {
  space2: px(token("space-2")), space3: px(token("space-3")), space4: px(token("space-4")), space5: px(token("space-5")),
  textXs: token("text-xs"), textSm: token("text-sm"), textMd: token("text-md"), textLg: token("text-lg"),
  touch: px(token("touch-min")), radiusLg: token("radius-lg"), radiusMd: token("radius-md"), radiusPill: token("radius-pill"),
  paper: token("paper"), paperRaised: token("paper-raised"), paperSunk: token("paper-sunk"),
  ink: token("ink"), inkSoft: token("ink-soft"), inkFaint: token("ink-faint"), hairline: token("hairline"),
  accent: token("accent"), accentStrong: token("accent-strong"), accentTint: token("accent-tint"),
  highlightWash: token("highlight-wash"), highlightRing: token("highlight-ring"), shadow2: token("shadow-2"), fontLatin: token("font-latin"),
};

// ── The phone, and the crop ──────────────────────────────────────────────────
const PHONE = { w: 390, h: 844 };
const phoneScale = PHONE.w / VBW; // the print filling the phone width, 1× zoom

/**
 * A zoomed crop of page 7. `sub` is a viewBox subrect in print units; `zoom` is
 * the app's zoom level, so the crop is drawn `zoom` times the 1× phone size.
 * `overlays` are SVG elements in the crop's own coordinate system.
 */
const crop = (sub, zoom, overlays = "", { w = null, label = "" } = {}) => {
  const outW = w ?? Math.round(sub.w * phoneScale * zoom);
  const outH = Math.round((outW * sub.h) / sub.w);
  return `<svg class="crop" viewBox="${sub.x} ${sub.y} ${sub.w} ${sub.h}" width="${outW}" height="${outH}" role="img" aria-label="${esc(label || `page ${PAGE}, zoomed ${zoom}×`)}"><use href="#p${PAGE}" width="${VBW}" height="${VBH}"/>${overlays}</svg>`;
};
const pad = (b, p) => ({ x: Math.max(0, b.x - p), y: Math.max(0, b.y - p), w: b.w + 2 * p, h: b.h + 2 * p });

// Overlays, drawn in print units so a non-scaling stroke stays crisp at any zoom.
const box = (b, { fill = "none", stroke, dash = "", sw = 1.4 } = {}) =>
  `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ""} vector-effect="non-scaling-stroke"/>`;
const ayahWash = `<path d="${esc(poly.d)}" fill="${T.highlightWash}" stroke="${T.highlightRing}" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`;
// A numbered pin anchored to a box's upper-outer corner (RTL: upper-right).
const pin = (b, n, kind = "correction") => {
  const cx = b.x + b.w, cy = b.y;
  return `<g class="pin pin-${kind}"><line x1="${cx}" y1="${cy}" x2="${cx + 6}" y2="${cy - 6}" stroke="var(--k-${kind})" stroke-width="1.4" vector-effect="non-scaling-stroke"/><circle cx="${cx + 9}" cy="${cy - 9}" r="6.4" fill="var(--k-${kind})" stroke="#fff" stroke-width="1" vector-effect="non-scaling-stroke"/><text x="${cx + 9}" y="${cy - 6.6}" text-anchor="middle" font-size="8" fill="#fff" font-family="ui-monospace,monospace">${n}</text></g>`;
};

// A note editor card — a short label (a bar, never words) and the three kinds.
const KINDS = [
  { id: "comment", label: "a comment", hint: "a private thought for yourself" },
  { id: "correction", label: "a correction", hint: "where you slip, so you can drill it" },
  { id: "dev", label: "to the developers", hint: "the print here looks wrong" },
];
const kindChips = (active = "correction") =>
  KINDS.map((k) => `<span class="chip k-${k.id}${k.id === active ? " on" : ""}"><span class="dot"></span>${k.label}</span>`).join("");
const noteCard = ({ active = "correction", anchorLabel } = {}) => `
  <div class="note-card">
    <div class="nc-head"><span class="nc-anchor">${esc(anchorLabel)}</span><span class="nc-x">✕</span></div>
    <div class="nc-kinds">${kindChips(active)}</div>
    <div class="nc-field"><span class="bar" style="width:82%"></span><span class="bar" style="width:56%"></span></div>
    <div class="nc-foot"><span class="nc-hint">${esc(KINDS.find((k) => k.id === active).hint)}</span><span class="nc-save">Save</span></div>
  </div>`;

const phone = (body, caption, { chrome = `Page ${PAGE} · Al-Baqarah` } = {}) => `
  <figure class="frame phone">
    <div class="screen" style="width:${PHONE.w}px;height:${PHONE.h}px">
      <div class="phone-top">${chrome}</div>
      <div class="stage">${body}</div>
    </div>
    <figcaption>${caption}</figcaption>
  </figure>`;

// ── The drawings ─────────────────────────────────────────────────────────────
// Today: the whole page at 1×, a verse tapped (washed), nothing the reader wrote.
const today = phone(
  `${crop({ x: 0, y: 0, w: VBW, h: VBH }, 1, ayahWash, { w: PHONE.w, label: "page 7 at fit, verse 2:38 selected" })}`,
  `A phone at life size, the page at fit. Tapping a verse lights it; a long press drops to a word and never turns the page. Nothing the reader writes is kept — there is no note here to keep.`,
);

// A · nothing new. Same as today.
const optA = today;

// B · a note on the whole verse.
const bSub = pad(ayahBox, 8);
const optB = phone(
  `<div class="split"><div class="print-col">${crop(bSub, ZOOM_STEPS[1], `${ayahWash}${pin(ayahBox, 1, "correction")}`, { w: 214, label: "verse 2:38, a note pinned to it" })}</div>${noteCard({ anchorLabel: "The whole verse" })}</div>`,
  `A note pinned to the whole verse — the coarsest anchor, and the one the app already draws. The pin sits in the margin; the wash is the verse. This is the confusion map's own grain: one mark per verse.`,
);

// C · a note on a word or a run.
const cSub = pad({ x: wordBox.x, y: wordBox.y, w: ayahBox.x + ayahBox.w - wordBox.x, h: wordBox.h }, 6);
const optC = phone(
  `<div class="split"><div class="print-col">${crop(cSub, ICON_RUNG, `${box(wordBox, { fill: T.highlightWash, stroke: T.highlightRing })}${pin(wordBox, 1, "correction")}`, { w: 214, label: "one word of 2:38, a note pinned to it" })}</div>${noteCard({ anchorLabel: "One word" })}</div>`,
  `A note pinned to a single word, reached by the long press that already selects words and never turns the page. Word boxes ship for all 604 pages, so this anchor is exact today. A drag would carry the note across a run of words.`,
);

// D · a note on a letter, a harakah, or a mark. The mark box ships; the letter
// box does not — it is drawn dashed and labelled.
// An approximate letter box: a slice of a neighbouring word, to stand for the
// per-glyph anchor the shipped bytes cannot give.
const glyphApprox = { x: wordBox.x + wordBox.w * 0.28, y: wordBox.y + wordBox.h * 0.12, w: wordBox.w * 0.32, h: wordBox.h * 0.72 };
const dWide = pad({ x: Math.min(markBox.x, glyphApprox.x), y: Math.min(markBox.y, glyphApprox.y), w: Math.max(markBox.x + markBox.w, glyphApprox.x + glyphApprox.w) - Math.min(markBox.x, glyphApprox.x), h: Math.max(markBox.h, glyphApprox.h) }, 10);
const optD = phone(
  `<div class="split"><div class="print-col">${crop(dWide, MAX_ZOOM, `${box(markBox, { fill: T.accentTint, stroke: T.accentStrong })}${pin(markBox, 1, "correction")}${box(glyphApprox, { stroke: "var(--k-dev)", dash: "3 2", sw: 1.2 })}${pin(glyphApprox, 2, "dev")}</span>`, { w: 214, label: "a pause sign and an approximate letter box, zoomed to the maximum" })}</div><div class="note-col"><div class="d-legend"><div><span class="sw solid"></span> Pin 1 — a pause sign. A box the app <b>ships</b> (it is flagged inside the word data), so this anchor is exact.</div><div><span class="sw dashed"></span> Pin 2 — a single letter. <b>Approximate:</b> the shipped page is anonymous outlined shapes with no per-letter box, so a letter or a vowel mark cannot be anchored from what the app carries today.</div></div>${noteCard({ anchorLabel: "A mark", active: "correction" })}</div></div>`,
  `Zoomed to the maximum the app allows (${MAX_ZOOM}×). A pause sign can be pinned exactly. A single letter or a harakah — what the request asks for — cannot: the finer geometry is built but deliberately unshipped, so option D at letter grain reopens that question.`,
);

// The zoom threshold: pins cluster below the rung, separate above it.
const clusterBadge = (bx, by, n) =>
  `<g class="cluster"><circle cx="${bx}" cy="${by}" r="8" fill="var(--k-correction)" stroke="#fff" stroke-width="1.2" vector-effect="non-scaling-stroke"/><text x="${bx}" y="${by + 3}" text-anchor="middle" font-size="9" fill="#fff" font-family="ui-monospace,monospace">${n}</text></g>`;
const threeMarks = [wordBox, markBox, { x: ayahBox.x + ayahBox.w * 0.2, y: ayahBox.y + ayahBox.h * 0.62, w: 20, h: 16 }];
const zoomLow = crop({ x: 0, y: 0, w: VBW, h: VBH }, 1, clusterBadge(ayahBox.x + ayahBox.w * 0.5, ayahBox.y + ayahBox.h * 0.4, 3), { w: 150, label: "page at fit — three notes collapsed to one badge" });
const zoomHigh = crop(pad({ x: Math.min(...threeMarks.map((m) => m.x)), y: Math.min(...threeMarks.map((m) => m.y)), w: ayahBox.w, h: ayahBox.h }, 6), ICON_RUNG,
  threeMarks.map((m, i) => pin(m, i + 1, ["correction", "comment", "dev"][i])).join(""), { w: 214, label: "zoomed in — the three notes shown on their own spots" });
const zoomFig = `
  <figure class="frame bare">
    <div class="zoom-row"><div class="zc"><div class="zc-cap">At fit (1×)</div>${zoomLow}</div><div class="zc"><div class="zc-cap">Past ${ICON_RUNG}×</div>${zoomHigh}</div></div>
    <figcaption>Below ${ICON_RUNG}× the marks would sit on top of each other, so they collapse to one badge that says how many are here; a tap zooms in. Past ${ICON_RUNG}× each shows on its own spot, and a hover reveals the span it covers. The rungs are the app's own zoom ladder (${ZOOM_STEPS.join(", ")}).</figcaption>
  </figure>`;

// Q2 — the three kinds and what leaves the phone.
const kindsFig = phone(
  `<div class="kinds-demo">
     <div class="kd-row"><span class="kd-pin k-comment"></span><div class="kd-t"><b>A comment</b> — a private thought.</div><span class="kd-where lock">on the phone</span></div>
     <div class="kd-row"><span class="kd-pin k-correction"></span><div class="kd-t"><b>A correction</b> — where memory slips.</div><span class="kd-where lock">on the phone</span></div>
     <div class="kd-row out"><span class="kd-pin k-dev"></span><div class="kd-t"><b>A note to the developers</b> — the print looks wrong here.</div><span class="kd-where send">leaves the phone →</span></div>
     <div class="kd-edge">the edge of the phone</div>
   </div>`,
  `The request names three kinds. Two are a reader's private business and stay on the phone, like everything the app remembers. The third is a message to someone else — a print-defect report — and a message has to leave the phone to arrive. That crossing is the second question.`,
  { chrome: "Three kinds of note" },
);

// ── The options, as prose ────────────────────────────────────────────────────
const anchor = [
  { id: "grain-a", key: "A", today: true, title: "Nothing: the reader writes no note",
    gist: "The app stays a place to find verses, not to annotate them. A reader can select a verse or a word, but nothing they write is kept.",
    takes: "Nothing.", gets: "No new private record to hold safe, and no way for a personal layer to ever ride along in a shared link.",
    costs: "A reader who wants to remember a hard spot, or to say the print looks wrong, has nowhere in the app to put it. The confusion map — the designed, unbuilt home for “where I go wrong” — bars free text anyway, so this is the honest status quo.", draw: () => optA },
  { id: "grain-b", key: "B", title: "A note on the whole verse",
    gist: "Tap a verse and pin a short note to it; a mark shows in the margin. This is the grain the app already draws and the confusion map already assumes.",
    takes: "A place to keep one note per verse, and a mark in the margin.",
    gets: "The exact anchor ships today for every verse, and it matches the one record the app was already going to keep.",
    costs: "It cannot say which word, still less which letter. A verse-wide note is the coarsest thing the request did not ask for.", draw: () => optB },
  { id: "grain-c", key: "C", title: "A note on a word or a run of words",
    gist: "The long press that already drops to a word — and pointedly does not turn the page — carries the note down to the word under the finger. A drag extends it across a run.",
    takes: "A note keyed to a word or a span of words, on top of the word geometry the app already ships and the selection gesture it already has.",
    gets: "An exact anchor, on all 604 pages, reached by a gesture readers already use; the drag-selects-not-turns rule is already settled and built.",
    costs: "Still not a letter or a harakah. A word is as fine as the shipped bytes go, and for many slips that is the right grain.", draw: () => optC },
  { id: "grain-d", key: "D", title: "A note on a letter, a vowel mark, or a pause sign",
    gist: "Zoom in and pin the note to the exact mark, which is what the triage asked for. Pause signs can be reached today; a single letter or harakah cannot.",
    takes: "For a pause sign: the mark boxes the word data already flags. For a letter or a harakah: geometry finer than a word, which the app does not ship — the named-mark vocabulary is built and measured but held back on purpose.",
    gets: "The finest anchor the request imagines, and for pause signs it is reachable now.",
    costs: "The letter-and-harakah half reopens a settled position: the shipped page is anonymous outlined shapes, so pinning to a glyph means shipping the finer corpus, whose bytes were judged not yet worth it. It is a bigger decision wearing this one's clothes.", draw: () => optD },
];

const kinds = [
  { id: "kinds-a", key: "A", title: "Private notes only, kept on the phone",
    gist: "A comment and a correction, kept in the phone's own private storage like everything else the app remembers, never leaving, never encoded in a shared link.",
    takes: "The private-record stance the app already holds, and the settled rule that a personal layer never rides along in a shared link.",
    gets: "The strongest privacy: a record of where a person's memory of the Qur'an slips cannot leak, because it never leaves the one phone.",
    costs: "The “note to the developers” kind is dropped. A reader who spots a real print defect has no way to tell anyone from inside the app." },
  { id: "kinds-b", key: "B", title: "Private notes, plus a report the reader chooses to send",
    gist: "The comment and the correction stay on the phone. The “to the developers” kind is a deliberate send — a file or a message the reader hands over — reusing the export question already open for the confusion map.",
    takes: "The two private kinds as in A, plus one reader-driven way out for the report kind, under the rule that a thing may leave only when it serves the reader and stays in their hands.",
    gets: "A channel for real print defects without a private log ever leaving by reflex; each report is a thing the reader decided to send.",
    costs: "One more surface to build and to keep honest about what it sends, and it leans on a backup-and-export decision that is itself still open." },
  { id: "kinds-c", key: "C", title: "Every note is a report that syncs",
    gist: "Every note the reader makes is treated as feedback and copied off the phone automatically.",
    takes: "A server, an account, and the always-on copy the rest of the app deliberately avoids.",
    gets: "The developers see everything, with no reader effort.",
    costs: "It turns a private study aid into a feedback funnel and crosses the privacy line the whole app rests on. Drawn for the edge of the space, not because it fits it." },
];

const optHtml = (o) => `
  <section class="opt${o.today ? " today" : ""}" id="${o.id}">
    <div class="opt-head"><span class="opt-key">${o.key}</span><h3>${esc(o.title)}</h3>${o.today ? `<span class="badge-today">today</span>` : ""}</div>
    <div class="opt-body">
      <p class="gist">${o.gist}</p>
      <dl><dt>takes</dt><dd>${o.takes}</dd><dt>gets</dt><dd>${o.gets}</dd><dt>costs</dt><dd>${o.costs}</dd></dl>
      ${o.draw ? `<div class="drawings">${o.draw()}</div>` : ""}
    </div>
  </section>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Should a reader be able to pin their own note to the page?</title>
<style>
  :root{
    --bg:#f6f4ef; --panel:#fffdf9; --ink:#211d17; --ink-2:#6a6156; --line:#e3ddd1;
    --line-soft:#efeae0; --accent:#8a6d3b; --accent-soft:#f0e7d6; --lean:#3f6f5f; --lean-soft:#e2efe9;
    --k-comment:#4f6d8a; --k-correction:#b06d1f; --k-dev:#8a4f7d;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --bg:#17150f; --panel:#201d16; --ink:#efe9dd; --ink-2:#a79c8a; --line:#332e23;
      --line-soft:#2a261d; --accent:#c8a565; --accent-soft:#332a1a; --lean:#7fb59f; --lean-soft:#1e2b26;
      --k-comment:#8fb0cf; --k-correction:#d99a4e; --k-dev:#c690b8;
    }
  }
  :root[data-theme="dark"]{
    --bg:#17150f; --panel:#201d16; --ink:#efe9dd; --ink-2:#a79c8a; --line:#332e23;
    --line-soft:#2a261d; --accent:#c8a565; --accent-soft:#332a1a; --lean:#7fb59f; --lean-soft:#1e2b26;
    --k-comment:#8fb0cf; --k-correction:#d99a4e; --k-dev:#c690b8;
  }
  *{box-sizing:border-box}
  body{margin:0; background:var(--bg); color:var(--ink); font:16px/1.6 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; -webkit-font-smoothing:antialiased}
  .wrap{max-width:1000px; margin:0 auto; padding:3rem 1.4rem 4rem}
  .eyebrow{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.72rem; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); margin:0 0 .5rem}
  h1{font-size:2rem; line-height:1.2; margin:0 0 .8rem; text-wrap:balance}
  h2{font-size:1.35rem; margin:2.6rem 0 .6rem; text-wrap:balance}
  h2.q{font-size:1.7rem; margin-top:3.6rem; padding-top:2rem; border-top:1px solid var(--line)}
  p, li{max-width:68ch}
  .lede{font-size:1.12rem; color:var(--ink-2)}
  a{color:var(--lean)}
  dl.gloss{max-width:68ch; display:grid; grid-template-columns:auto 1fr; gap:.3rem 1rem}
  dl.gloss dt{font-weight:600}
  dl.gloss dd{margin:0}
  .options{display:flex; flex-direction:column; gap:1.4rem; margin-top:1rem}
  .opt{border:1px solid var(--line); border-radius:16px; background:var(--panel); overflow:hidden}
  .opt.today{border-color:var(--lean)}
  .opt-head{display:flex; align-items:center; gap:.7rem; padding:1rem 1.2rem .2rem}
  .opt-key{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-weight:700; color:#fff; background:var(--accent); width:1.7rem; height:1.7rem; border-radius:50%; display:grid; place-items:center; flex:none}
  .opt-head h3{margin:0; font-size:1.15rem}
  .badge-today{margin-left:auto; font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.66rem; letter-spacing:.08em; text-transform:uppercase; color:var(--lean); background:var(--lean-soft); border-radius:999px; padding:.28rem .6rem; white-space:nowrap}
  .opt-body{padding:.6rem 1.2rem 1.4rem}
  .gist{margin:.2rem 0 .8rem}
  dl{margin:0 0 1rem; display:grid; grid-template-columns:auto 1fr; gap:.3rem .9rem; max-width:68ch}
  dt{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.72rem; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-2); padding-top:.2rem}
  dd{margin:0}
  .drawings{display:flex; flex-wrap:wrap; gap:1.6rem; align-items:flex-start; margin-top:1rem}
  figure.frame{margin:0; max-width:100%}
  figcaption{font-size:.86rem; color:var(--ink-2); max-width:${PHONE.w}px; margin-top:.6rem; line-height:1.45}
  figure.bare figcaption{max-width:44ch}
  .screen{position:relative; overflow:hidden; background:${T.paper}; border:1px solid var(--line); border-radius:22px; box-shadow:0 10px 30px rgba(0,0,0,.12)}
  .phone-top{height:52px; display:flex; align-items:center; padding:0 ${T.space4}px; font:600 ${T.textSm}/1 ${T.fontLatin}; color:${T.inkSoft}; background:${T.paperRaised}; border-bottom:1px solid ${T.hairline}}
  .stage{position:relative}
  .crop{display:block; background:${T.paper}}
  .split{display:flex; flex-direction:column; gap:${T.space3}px; padding:${T.space3}px; align-items:center}
  .print-col{border:1px solid ${T.hairline}; border-radius:${T.radiusMd}; overflow:hidden; background:${T.paper}}
  .note-col{width:100%; display:flex; flex-direction:column; gap:${T.space3}px}
  .crop text{font-family:ui-monospace,monospace}

  .note-card{width:100%; background:${T.paperRaised}; border:1px solid ${T.hairline}; border-radius:${T.radiusLg}; box-shadow:${T.shadow2}; padding:${T.space3}px ${T.space3}px ${T.space3}px; font-family:${T.fontLatin}; color:${T.ink}}
  .nc-head{display:flex; align-items:center; justify-content:space-between; font-size:${T.textSm}; color:${T.inkSoft}; padding-bottom:${T.space2}px; border-bottom:1px solid ${T.hairline}}
  .nc-anchor{font-weight:600; color:${T.ink}}
  .nc-kinds{display:flex; gap:${T.space2}px; flex-wrap:wrap; padding:${T.space2}px 0}
  .chip{display:inline-flex; align-items:center; gap:5px; font-size:${T.textXs}; border:1px solid ${T.hairline}; border-radius:${T.radiusPill}; padding:3px 8px; color:${T.inkSoft}}
  .chip .dot{width:8px; height:8px; border-radius:50%; background:${T.inkFaint}}
  .chip.k-comment.on{border-color:var(--k-comment); color:var(--k-comment)} .chip.k-comment.on .dot{background:var(--k-comment)}
  .chip.k-correction.on{border-color:var(--k-correction); color:var(--k-correction)} .chip.k-correction.on .dot{background:var(--k-correction)}
  .chip.k-dev.on{border-color:var(--k-dev); color:var(--k-dev)} .chip.k-dev.on .dot{background:var(--k-dev)}
  .nc-field{display:flex; flex-direction:column; gap:6px; padding:${T.space2}px ${T.space3}px; background:${T.paperSunk}; border-radius:${T.radiusMd}; min-height:44px; justify-content:center}
  .bar{display:block; height:8px; border-radius:4px; background:${T.inkSoft}; opacity:.28}
  .nc-foot{display:flex; align-items:center; justify-content:space-between; padding-top:${T.space2}px; font-size:${T.textXs}}
  .nc-hint{color:${T.inkFaint}} .nc-save{color:${T.accentStrong}; font-weight:600}

  .d-legend{font-size:${T.textSm}; color:${T.inkSoft}; display:flex; flex-direction:column; gap:${T.space2}px; line-height:1.4}
  .d-legend b{color:${T.ink}}
  .sw{display:inline-block; width:16px; height:11px; border-radius:2px; vertical-align:-1px; margin-right:4px}
  .sw.solid{background:${T.accentTint}; border:1.4px solid ${T.accentStrong}}
  .sw.dashed{border:1.2px dashed var(--k-dev)}

  .zoom-row{display:flex; gap:1.4rem; align-items:flex-start; flex-wrap:wrap}
  .zc{display:flex; flex-direction:column; gap:.4rem}
  .zc-cap{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.7rem; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-2)}
  .zc .crop{border:1px solid ${T.hairline}; border-radius:${T.radiusMd}}

  .kinds-demo{position:relative; padding:${T.space4}px ${T.space3}px ${T.space5}px; display:flex; flex-direction:column; gap:${T.space3}px}
  .kd-row{display:flex; align-items:center; gap:${T.space3}px; background:${T.paperRaised}; border:1px solid ${T.hairline}; border-radius:${T.radiusMd}; padding:${T.space3}px}
  .kd-row.out{border-style:dashed; border-color:var(--k-dev)}
  .kd-pin{width:14px; height:14px; border-radius:50%; border:2px solid #fff; flex:none; box-shadow:0 0 0 1px ${T.hairline}}
  .kd-pin.k-comment{background:var(--k-comment)} .kd-pin.k-correction{background:var(--k-correction)} .kd-pin.k-dev{background:var(--k-dev)}
  .kd-t{flex:1; font-size:${T.textSm}; font-family:${T.fontLatin}} .kd-t b{color:${T.ink}}
  .kd-where{font-size:${T.textXs}; font-family:ui-monospace,monospace; white-space:nowrap}
  .kd-where.lock{color:${T.inkSoft}} .kd-where.lock::before{content:"🔒 "}
  .kd-where.send{color:var(--k-dev)}
  .kd-edge{text-align:center; font-size:${T.textXs}; color:${T.inkFaint}; border-top:1px dashed ${T.hairline}; padding-top:${T.space2}px; font-family:ui-monospace,monospace}

  table{border-collapse:collapse; font-size:.9rem; margin:.6rem 0 1rem; width:100%}
  th,td{border-bottom:1px solid var(--line); padding:.5rem .7rem; text-align:left; vertical-align:top}
  th{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.68rem; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-2)}
  .tbl{overflow-x:auto}
  .num{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.9em}
  .aside{border-left:3px solid var(--accent); padding:.2rem 0 .2rem 1rem; color:var(--ink-2); margin:1rem 0}
  footer{margin-top:3rem; padding-top:1rem; border-top:1px solid var(--line); font-size:.85rem; color:var(--ink-2)}
  .defs{position:absolute; width:0; height:0; overflow:hidden}
</style>
</head>
<body>
<svg class="defs" aria-hidden="true"><symbol id="p${PAGE}" viewBox="0 0 ${VBW} ${VBH}">${leafInner}</symbol></svg>
<div class="wrap">
  <p class="eyebrow">Hifth · a decision, drawn</p>
  <h1>Should a reader be able to pin their own note to a spot on the page, and to what?</h1>
  <p class="lede">Two questions, both open. Every drawing below is the real page 7 of the print, zoomed the way the app zooms, with the note drawn as a short bar — there is no reader's text in this repository, and none is invented here.</p>

  <h2>A few words, defined once</h2>
  <dl class="gloss">
    <dt>Verse</dt><dd>One numbered sentence of the Qur'an. 2:38 is the thirty-eighth verse of the second surah, and the verse every drawing zooms into.</dd>
    <dt>Word box</dt><dd>The app knows a rectangle for every word of every page, and uses it when a reader long-presses to select words. It does not know a rectangle for a single letter.</dd>
    <dt>Harakah</dt><dd>A small vowel mark written above or below a letter. There are a handful of kinds; naming which one sits where is what the finer, unshipped work does.</dd>
    <dt>Pause sign</dt><dd>A mark in the line that tells a reciter where they may stop. Unlike a letter, it is counted in the word data, so the app can point at it.</dd>
    <dt>The margin</dt><dd>The space beside the text where a pinned note's marker sits, so it never covers the print it is about.</dd>
    <dt>Private</dt><dd>Kept in the phone's own storage, sent nowhere. This is how everything the app remembers works today.</dd>
  </dl>

  <h2>Why is this being asked now?</h2>
  <p>The desktop triage of 2026-09-01 asked for comment-style mistake marking: zoom in, tap a letter, a vowel mark or a pause sign, and drop a note anchored to that spot, coloured by kind — a comment, a correction, a note to the developers — with the markers appearing only once the page is zoomed in, and a hover revealing the span. It is a good idea, and it asks for three things the project has already taken a position on: a note the reader <em>types</em>, an anchor <em>finer than a word</em>, and a note that can <em>leave the phone</em>. So this is a decision before it is code, and each of those three is drawn below at the size it would really be used.</p>

  <h2>What happens if nobody decides?</h2>
  <p>Nothing breaks. Today a reader can light a verse or a word but keeps no note; that carries on. The designed home for “where I go wrong” — a private confusion map — is written down but not built, and it deliberately keeps no free text either, so this decision is partly about whether to go further than that design chose to. No other feature waits behind this one.</p>

  <h2>What does the app do today?</h2>
  <div class="drawings">${today}</div>
  <p>A tap lights a verse; a long press drops to the word under the finger and, pointedly, does not turn the page. Both are ways of <em>pointing</em>, and neither writes anything down. The record the app does keep — which parts of the book you have opened — is made for the reader by their taps, not typed by them.</p>

  <h2>What have we already decided that touches this?</h2>
  <ul>
    <li><b>A drag across text already selects rather than turns the page.</b> The long press that drops to a word was built to never move the page under a finger that is choosing words. A note anchored to a word or a run inherits that gesture whole; it does not invent one.</li>
    <li><b>The page ships as anonymous shapes.</b> Every page is outlined paths with no letter identity, and the finer work that names each mark — a vocabulary of a few dozen shapes, measured over all 604 pages — is built but held back, judged not yet worth its bytes. Anchoring a note to a letter or a harakah means shipping that, which is a larger decision than this one.</li>
    <li><b>A private record stays private by construction.</b> The revision record's privacy is a gate, not a good intention, because “add it to the share sheet” is always one convenient import away. Any note the reader keeps inherits that stance.</li>
    <li><b>A personal layer never rides along in a shared link.</b> It was already settled that a beta annotation layer stays out of the link, so opening someone else's shared verse can never switch a personal layer on for a reader who never chose it. A note layer is exactly such a layer.</li>
    <li><b>Nothing leaves unless it serves the reader, and stays in their hands.</b> The rule the app is sharpening for the confusion map's backup: a thing may leave the phone only when the reader's own interest points outward and they hold the controls. The “note to the developers” kind is the first thing here that would test it.</li>
    <li><b>A rectangle is how a region is named.</b> An earlier decision already reached for the standard way to record “a note is about this rectangle of this page”, with a finer selector when the region is not a rectangle. The anchor here is that same shape.</li>
  </ul>

  <h2 class="q" id="what-can-a-reader-pin-a-note-to">What can a reader pin a note to?</h2>
  <p>From the coarsest anchor the app already draws to the finest the request imagines. The gesture and the margin are the same in all four; what changes is how small a thing the note can point at, and whether the app ships the geometry to point that precisely.</p>
  <div class="options">
    ${anchor.map(optHtml).join("\n    ")}
  </div>
  <h2>When do the markers show?</h2>
  <p>The triage asked for markers that appear only once the page is zoomed in, so they do not clutter the page at reading size. The app's zoom is a fixed ladder of steps, so “zoomed in” has an exact meaning: below a chosen rung the markers on one small area collapse into a single badge counting them, and above it each shows on its own spot.</p>
  <div class="drawings">${zoomFig}</div>

  <h2 class="q" id="what-kinds-of-note-and-does-any-of-them-leave-the-phone">What kinds of note are there, and does any of them leave the phone?</h2>
  <p>This only matters if a note layer is added at all. The request names three kinds, and they split cleanly: two are a reader's private business, and the third is a message to someone else. A message has to leave the phone to arrive, which is the line the whole app has been careful about.</p>
  <div class="drawings">${kindsFig}</div>
  <div class="options">
    ${kinds.map(optHtml).join("\n    ")}
  </div>

  <h2>What do people outside this project do?</h2>
  <p><b>A fresh external scan was not done for this page.</b> The session's research assistant hit its limit before it returned, so rather than pretend otherwise: what is drawn here rests on prior art already inside this project. An earlier decision reached for the standard web way of recording “a note is about this rectangle”, and the tajweed-mark work is itself a study of how finely this print can be addressed. The comparable practices worth a proper look before this is settled — how a hafiz marks a slip in a paper mus'haf, and how Tarteel, Figma, document comments and web-annotation tools handle a marker that hides at low zoom, reveals on hover, and is coloured by kind — are owed that look and have not had it here.</p>

  <h2>What else could be considered, and why is it not here?</h2>
  <ul>
    <li><b>A free-text journal.</b> A long note, not a short label. The confusion map's design already ruled this out — at most a short optional label, never a journal — because the data cannot see recitation and a page of prose over it would claim more than it knows. Kept to a short label here for the same reason.</li>
    <li><b>Feeding a reader's marks back into the shared hop rail.</b> Turning one person's private slips into navigation everyone sees. That blurs a private log into the public routing table and is its own privacy and provenance decision, not a default of this one.</li>
    <li><b>A teacher seeing a student's marks.</b> Genuinely useful, and genuinely a different question — sending the record to another person, not a reader keeping their own. Its own page if it is ever wanted.</li>
    <li><b>Shipping the finer mark corpus just to enable letter anchoring.</b> Left off because it is the larger decision option D leans on; this page draws its cost rather than pre-empting it.</li>
  </ul>

  <h2>What would change the answer?</h2>
  <ul>
    <li>A hafiz saying, after using a word-grain note for a month, that they keep wanting to point at one letter. That is the measurement that would justify shipping the finer geometry option D needs.</li>
    <li>The finer mark corpus being shipped for another reason — a per-rule tajweed colour, say — after which letter anchoring is a rendering change rather than a new payload.</li>
    <li>The confusion map's backup question being settled, which decides the machinery the “note to the developers” kind would reuse.</li>
    <li>A real print defect a reader could only report by leaving the app, which would weigh the second question toward B.</li>
  </ul>

  <h2>What is this not settling?</h2>
  <ul>
    <li>How a note is stored, or how long it is kept. That is the private-record machinery, and the backup question owns part of it.</li>
    <li>Whether the confusion map and this note layer are one feature or two. They share a grain and a privacy stance; whether they share a store is a later question.</li>
    <li>The exact zoom rung the markers appear at, or the colours of the three kinds. Drawn here from the app's ladder and a first palette; both are tuning, not the decision.</li>
    <li>Anything about the maintainer's own mark-review instrument, which is a separate tool with its own record and is not a reader feature.</li>
  </ul>

  <h2>So what is being decided?</h2>
  <p>Two things, in order. First, whether a reader can pin their own note to the page and to what: nothing (A), a verse (B), a word or a run (C), or a single letter, harakah or pause sign (D) — where the last reopens the settled choice to ship the page as anonymous shapes. Second, only if a note layer is added: which kinds there are and whether any leaves the phone — private only (A), private plus a report the reader sends (B), or everything synced (C). The finer anchor and the note that leaves the phone are the two the app has already taken a position on, so both are the owner's to reopen.</p>

  <footer>Rebuilt by <span class="num">scripts/build-mistake-marking-options.mjs</span> from the print's page 7, its shipped word and pause-mark boxes, the stage's zoom ladder and the app's design tokens. The record is <span class="num">docs/decisions/mistake-marking.md</span>.</footer>
</div>
</body>
</html>
`;

const arabic = html.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g);
if (arabic) die(`refusing to write: the page carries ${arabic.length} Arabic codepoint(s)`);
if (/<text\b[^>]*>[^<]*[\u0600-\u06FF]/.test(html)) die("refusing to write: a <text> element carries Arabic");
writeFileSync(OUT, html);
console.log(
  `wrote ${OUT.replace(ROOT, "")} (${(html.length / 1024).toFixed(0)} KB) — zoom ladder ${ZOOM_STEPS.join("/")}, icon rung ${ICON_RUNG}×, max ${MAX_ZOOM}×; anchors: verse+word+mark ship, letter does not`,
);
