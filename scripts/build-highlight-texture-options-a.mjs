#!/usr/bin/env node
/**
 * Render docs/design/highlight-texture-options-a.html — researcher A's page of
 * shapes, textures and overlap rules for the highlighter, drawn on the real
 * page 42 (2:254–2:256) at the width a phone gives the page.
 *
 * The earlier pages settled that the mark is drawn per line and blended into
 * the print (docs/decisions/highlight-style.md, docs/design/highlight-options.md).
 * This page does not re-ask that. It asks what the owner asked for next: how
 * the mark is SHAPED (the pen's outline), how it is TEXTURED (what the ink
 * does inside that outline), and how two marks COMPOSE where they overlap —
 * a verse inside a swept passage, and a run of words inside a verse.
 *
 *   Shapes      S1 today's swipe   S2 rough band (seeded)   S3 ragged edge (filter)
 *               S4 patch per line  S5 pressure stroke       S6 chisel tip
 *   Textures    T1 flat   T2 grain (filter)   T3 two-pass streak   T4 pooled and dry
 *   Overlaps    C1 plain see-through stacking   C2 multiply, today's two pens
 *               C3 one pen, every mark a pass   C4 strength levels, strongest wins
 *               C5 two hues multiplied          C6 cut-out with a paper gap
 *               C7 counted passes: depth, not count
 *   Live        L1 the wipe, today and rough    L2 lay another pass
 *   Contrast    A1 when the reader asks for more contrast
 *   Together    R  the recommended combination
 *
 * Every rough edge is seeded from the verse and line it belongs to, so the
 * same verse wobbles the same way on every visit — never a fresh wobble per
 * draw. The wobble is hand-rolled here (a few hundred bytes of logic), not
 * Rough.js, whose 9 KB would eat over half the app's remaining size budget.
 *
 * The swipes come from the app's OWN pen (packages/core/dist/ink.js), the
 * colours from its tokens — imported, so S1 is the app.
 *
 * ── What it reads (committed bytes only) ────────────────────────────────────
 *   apps/web/public/assets/manifest.json                 the print's viewBox
 *   apps/web/public/assets/pages/hafs-kfqc/42.svg        the outlined leaf and its verse boxes
 *   apps/web/public/assets/words/hafs-kfqc/42.json       the shipped word boxes
 *   apps/web/src/styles/tokens.css                       the app's real colours and timings
 *   packages/core/dist/ink.js                            the app's pen (build core first)
 *
 * ── No Qur'an ───────────────────────────────────────────────────────────────
 * The print is outlined paths with zero Arabic codepoints; every mark is an SVG
 * shape over the leaf, never text. The writer refuses if the output carries an
 * Arabic codepoint or a <text> element.
 *
 *   node scripts/build-highlight-texture-options-a.mjs
 *   node scripts/shoot-highlight-texture-options-a.mjs     the PNGs the record embeds
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const ASSETS = join(ROOT, "apps/web/public/assets");
const MANIFEST = join(ASSETS, "manifest.json");
const PAGE_SVG = (n) => join(ASSETS, "pages/hafs-kfqc", `${n}.svg`);
const WORDS = join(ASSETS, "words/hafs-kfqc/42.json");
const TOKENS_CSS = join(ROOT, "apps/web/src/styles/tokens.css");
const INK = join(ROOT, "packages/core/dist/ink.js");
const OUT = join(ROOT, "docs/design/highlight-texture-options-a.html");
const SITE = "https://blog.bytesofpurpose.com/hifth/docs/design/highlight-texture-options-a.html";

const die = (msg) => { console.error(`build-highlight-texture-options-a: ${msg}`); process.exit(1); };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f1 = (n) => Number(n).toFixed(1);

if (!existsSync(INK)) die(`the pen is not built — ${INK} is missing. Run \`pnpm --filter @hifth/core build\` first.`);
const { swipesFromPath, rectsFromPath, pageLineHeight } = await import(INK);

// ── The page ──────────────────────────────────────────────────────────────────
const PAGE = 42;
const VERSE = "2:255";
const RANGE = ["2:254", "2:255", "2:256"];

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const [, , VBW, VBH] = manifest.viewBox.split(/\s+/).map(Number);
if (!(VBW > 0 && VBH > 0)) die("manifest viewBox");

function loadPage(n) {
  const raw = readFileSync(PAGE_SVG(n), "utf8");
  if (/[؀-ۿ]/.test(raw)) die(`page ${n} carries Arabic codepoints`);
  if (/<text\b/.test(raw)) die(`page ${n} carries <text>`);
  const inner = raw.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const polygons = new Map();
  for (const m of raw.matchAll(/<path\b[^>]*\bid="verse-\d+"[^>]*>/g)) {
    const d = m[0].match(/\bd="([^"]*)"/)?.[1];
    const ayah = m[0].match(/\bayah="(\d+)"/)?.[1];
    const surah = m[0].match(/\bsurah="(\d+)"/)?.[1];
    if (d && ayah && surah) polygons.set(`${surah}:${ayah}`, d);
  }
  const lineH = pageLineHeight(polygons.values()) ?? die(`page ${n}: no line height`);
  const dOf = (ref) => polygons.get(ref) ?? die(`no verse box for ${ref} on page ${n}`);
  const lines = (ref) => (rectsFromPath(dOf(ref)) ?? die(`${ref} is not a rectangle run`)).flatMap((r) => {
    const k = Math.max(1, Math.round(r.height / lineH));
    const h = r.height / k;
    return Array.from({ length: k }, (_, i) => ({ x: r.x, y: r.y + i * h, w: r.width, h }));
  });
  const swipes = (ref) => swipesFromPath(dOf(ref), lineH) ?? die(`${ref}: the pen declined`);
  return { n, inner, lineH, dOf, lines, swipes };
}
const P42 = loadPage(PAGE);
const LINE_H = P42.lineH;

// Each swipe carries a key (verse and line) so its wobble is seeded from what
// it marks, never from the order it happened to be drawn in.
const keyed = (ref, list) => list.map((s, i) => ({ ...s, key: `${ref}#${i}` }));
const VERSE_SW = keyed(VERSE, P42.swipes(VERSE));

// A passage is swept one line at a time: where two of its verses share a line
// the pen does not lift, so their pieces are joined into one stroke per line.
const PASSAGE_SW = (() => {
  const byLine = new Map();
  for (const ref of RANGE) for (const s of P42.swipes(ref)) {
    const k = Math.round(s.y);
    const cur = byLine.get(k);
    const lo = Math.min(s.x1, s.x2), hi = Math.max(s.x1, s.x2);
    if (!cur) byLine.set(k, { x1: lo, x2: hi, y: s.y, width: s.width });
    else { cur.x1 = Math.min(cur.x1, lo); cur.x2 = Math.max(cur.x2, hi); }
  }
  return [...byLine.values()].sort((a, b) => a.y - b.y).map((s, i) => ({ ...s, key: `passage#${i}` }));
})();

// The verse's words, pause marks left out. A run of six words that crosses a
// line break — the last three of the verse's second line and the first three
// of its third — stands in for a word-level mark (a slip, a hesitation).
const wordShard = JSON.parse(readFileSync(WORDS, "utf8"));
const entry = wordShard.words?.[VERSE] ?? die(`no word boxes for ${VERSE}`);
const pauses = new Set(entry.marks ?? []);
const WORD_BOXES = entry.boxes.map(([x, y, w, h], i) => ({ x, y, w, h, i: entry.from + i })).filter((b) => !pauses.has(b.i));
const lineOf = (b) => {
  const cy = b.y + b.h / 2;
  let best = 0;
  VERSE_SW.forEach((s, i) => { if (Math.abs(s.y - cy) < Math.abs(VERSE_SW[best].y - cy)) best = i; });
  return best;
};
const RUN_SW = (() => {
  const on = (L) => WORD_BOXES.filter((b) => lineOf(b) === L);
  const run = [...on(1).slice(-3), ...on(2).slice(0, 3)];
  if (run.length !== 6) die("the word run needs three words on each of the verse's second and third lines");
  const byLine = new Map();
  for (const b of run) {
    const L = lineOf(b);
    const cur = byLine.get(L) ?? { x1: Infinity, x2: -Infinity, y: VERSE_SW[L].y, width: VERSE_SW[L].width };
    cur.x1 = Math.min(cur.x1, b.x + cur.width / 2 - 1);
    cur.x2 = Math.max(cur.x2, b.x + b.w - cur.width / 2 + 1);
    byLine.set(L, cur);
  }
  return [...byLine.entries()].map(([L, s]) => ({ ...s, x1: Math.min(s.x1, s.x2 - 2), key: `run#${L}` }));
})();

// ── The app's own colours ─────────────────────────────────────────────────────
const tokensCss = readFileSync(TOKENS_CSS, "utf8");
const token = (name) => tokensCss.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim() ?? die(`token --${name}`);
const px = (v) => (v.endsWith("rem") ? Number(v.slice(0, -3)) * 16 : v.endsWith("px") ? Number(v.slice(0, -2)) : die(`unit ${v}`));
const T = {
  space2: px(token("space-2")), space3: px(token("space-3")), space4: px(token("space-4")),
  textMd: token("text-md"), radiusMd: token("radius-md"),
  paper: token("paper"), paperRaised: token("paper-raised"),
  ink: token("ink"), inkSoft: token("ink-soft"), inkFaint: token("ink-faint"), hairline: token("hairline"),
  durInk: token("dur-ink"), staggerInk: token("stagger-ink"), easeInk: token("ease-ink"),
};
const INK_SEL = token("ink-sel");       // the pen at full strength
const INK_RANGE = token("ink-range");   // the same pen held lighter, for a passage
const ACCENT = token("accent");         // verdigris
const MISTAKE = token("diff-mark");     // indigo, standing in for a word-level mark
const THIN = 0.45;                      // a dark hue thinned so the letters survive (the earlier record's figure)
const PASS = 0.6;                       // one pass of the pen in the pass-counting rules (C3, C7, R)
const OFFSET = 1.3;                     // how far apart two passes of one verse land (page units), so the second reads as a streak
const GLYPH = "#231f20";                // the print's ink
const FIRM_EDGE = "#8a5410";            // a burnt amber for the high-contrast edge (A1)

// ── Measured ──────────────────────────────────────────────────────────────────
const parse = (s) => {
  const m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat([1]);
  const r = s.match(/^rgba?\(([^)]+)\)$/);
  if (!r) die(`colour ${s}`);
  const [R, G, B, A = 1] = r[1].split(",").map((v) => Number(v.trim()));
  return [R, G, B, A];
};
const rgb = (s) => parse(s).slice(0, 3);
const alphaOf = (s) => parse(s)[3];
const lum = ([r, g, b]) => {
  const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((p, q) => q - p); return (l1 + 0.05) / (l2 + 0.05); };
const over = (top, a, under) => top.map((t, i) => t * a + under[i] * (1 - a));
const multiply = (pen, a, under) => under.map((u, i) => u * (1 - a) + (u * pen[i] / 255) * a);
const passes = (pen, a, n, under) => { let c = under; for (let k = 0; k < n; k++) c = multiply(pen, a, c); return c; };
const r1 = (n) => `${n.toFixed(1)}:1`;

const PAPER = rgb(T.paperRaised);
const GLYPH_RGB = rgb(GLYPH);
const AMBER = rgb(INK_SEL);
const VERD = rgb(ACCENT);
const INDIGO = rgb(MISTAKE);
const RANGE_A = alphaOf(INK_RANGE);
const onInk = (bg) => contrast(GLYPH_RGB, bg);
const onPaper = (bg) => contrast(bg, PAPER);
const both = (bg, label = "") => `${label}letters ${r1(onInk(bg))} · against paper ${r1(onPaper(bg))}`;

const bg = {
  swipe: multiply(AMBER, 1, PAPER),
  range: multiply(AMBER, RANGE_A, PAPER),
  pass1: passes(AMBER, PASS, 1, PAPER),
  pass2: passes(AMBER, PASS, 2, PAPER),
  pass3: passes(AMBER, PASS, 3, PAPER),
  pass4: passes(AMBER, PASS, 4, PAPER),
};
bg.today2 = multiply(AMBER, 1, bg.range);          // today: verse inside a passage
bg.today3 = multiply(AMBER, 1, bg.today2);         // today's rule, a word run on top
// C1 — plain see-through stacking: the colour is laid over the letters too.
const ALPHA = { passage: 0.3, verse: 0.55, run: 0.55 };
const alphaStack = (layers) => ({
  paper: layers.reduce((c, a) => over(AMBER, a, c), PAPER),
  glyph: layers.reduce((c, a) => over(AMBER, a, c), GLYPH_RGB),
});
const C1 = { one: alphaStack([ALPHA.verse]), two: alphaStack([ALPHA.passage, ALPHA.verse]), three: alphaStack([ALPHA.verse, ALPHA.run]) };
// C4 — strength levels: each kind of mark has its own strength and the strongest one present wins.
const LEVEL = { passage: 0.4, verse: 0.7, run: 1 };
// C5 / C6 — two hues.
bg.verd = multiply(VERD, THIN, PAPER);
bg.amberOnVerd = multiply(AMBER, 1, bg.verd);
bg.indigo = multiply(INDIGO, THIN, PAPER);
bg.indigoOnAmber = multiply(INDIGO, THIN, bg.swipe);
// T2 — grain thins the ink to between GRAIN_LO and 1 of its strength.
const GRAIN_LO = 0.6;
const FIBRE_LO = 0.7;
// T3 — two narrower passes at STREAK_A, overlapping in a centre stripe.
const STREAK_A = 0.75;
// T4 — the pen starts pooled and runs drier to DRY; its rim is laid a second time at RIM.
const DRY = 0.62, RIM = 0.5;

// ── Seeded wobble ─────────────────────────────────────────────────────────────
const hash = (str) => { let h = 2166136261; for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 2147483647 || 1; };
const rng = (key) => { let s = hash(key); return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 - 0.5; }; };

// A closed Catmull-Rom curve through the points: a smooth outline, no corners.
function smooth(pts) {
  const n = pts.length;
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return `${d}Z`;
}

/**
 * The outline of one pen stroke along a swipe, as a filled path.
 *   amp    how far the edge wanders, in page units (0 = a clean edge)
 *   step   how far apart the edge's wobble points are
 *   tilt   how far the whole stroke rises or falls across its length
 *   over   how far the pen may overshoot each end
 *   tall   the stroke's height as a share of the swipe's
 *   cap    how round the ends are (1 = a half circle, 0.4 = nearly square)
 *   width  a profile t → share of the height, t running from the pen's start (right) to its end (left)
 *   dy     shift the stroke up or down (for a second pass)
 *   seed   extra seed text, so a second pass over the same line wobbles differently
 */
function band(s, o = {}) {
  const { amp = 0, step = 20, tilt = 0, over: ov = 0, tall = 1, cap = 1, width = () => 1, dy = 0, seed = "" } = o;
  const R = rng(`${s.key}${seed}`);
  const lo = Math.min(s.x1, s.x2), hi = Math.max(s.x1, s.x2);
  const half = (s.width / 2) * tall;
  const oStart = Math.abs(R()) * 2 * ov, oEnd = Math.abs(R()) * 2 * ov;
  const rise = R() * 2 * tilt;
  const x0 = hi + oStart, x9 = lo - oEnd, len = Math.max(1, x0 - x9);
  const n = Math.max(3, Math.round(len / step));
  const yAt = (t) => s.y + dy + rise * (t - 0.5);
  const top = [], bottom = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 - t * len, w = half * width(t);
    top.push([x, yAt(t) - w + R() * 2 * amp]);
    bottom.push([x, yAt(t) + w + R() * 2 * amp]);
  }
  const capPts = (x, t, dir) => {
    const w = half * width(t), cy = yAt(t);
    return [0.7, 1, 0.7].map((k, j) => [x + dir * w * cap * k, cy + [-0.7, 0, 0.7][j] * w + R() * amp]);
  };
  return smooth([...top, ...capPts(x9, 1, -1), ...bottom.reverse(), ...capPts(x0, 0, 1).reverse()]);
}
// Today's swipe as a filled capsule (for the textures that need a filled shape).
const capsule = (s, { dy = 0, tall = 1, grow = 0 } = {}) => {
  const lo = Math.min(s.x1, s.x2) - grow, hi = Math.max(s.x1, s.x2) + grow, h = (s.width / 2) * tall;
  return `M${f1(hi)} ${f1(s.y + dy - h)}A${f1(h)} ${f1(h)} 0 0 1 ${f1(hi)} ${f1(s.y + dy + h)}L${f1(lo)} ${f1(s.y + dy + h)}A${f1(h)} ${f1(h)} 0 0 1 ${f1(lo)} ${f1(s.y + dy - h)}Z`;
};
// A chisel-tip marker: square to the page, ends cut on the slant of the tip.
const chisel = (s) => {
  const R = rng(`${s.key}chisel`);
  const lo = Math.min(s.x1, s.x2) - s.width / 2, hi = Math.max(s.x1, s.x2) + s.width / 2, h = s.width / 2;
  const slant = s.width * 0.42, rise = R() * 1.2;
  return `M${f1(hi)} ${f1(s.y - h - rise)}L${f1(lo + slant)} ${f1(s.y - h + rise)}L${f1(lo)} ${f1(s.y + h + rise)}L${f1(hi - slant)} ${f1(s.y + h - rise)}Z`;
};

const SHAPE = {
  swipe: (s) => capsule(s),
  rough: (s, o = {}) => band(s, { amp: 1.4, step: 22, tilt: 1.4, over: 2.6, cap: 0.85, ...o }),
  patch: (s, o = {}) => band(s, { amp: 1.1, step: 26, tilt: 0.4, over: 1.2, tall: 1.28, cap: 0.5, ...o }),
  pressure: (s, o = {}) => band(s, { amp: 0, step: 10, cap: 0.9, width: (t) => 0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, Math.max(0, t * 0.92 + 0.04))) ** 0.55, ...o }),
  chisel: (s) => chisel(s),
};

// ── Drawing helpers ───────────────────────────────────────────────────────────
let uid = 0;
const next = (p) => `${p}${++uid}`;
const MUL = `style="mix-blend-mode:multiply"`;
const paths = (list, shape, o) => list.map((s) => `<path d="${SHAPE[shape](s, o)}"/>`).join("");
// One multiplied layer: every path in it is one pass of a pen; paths inside the
// same layer overlap as one pass (drawn opaque inside, then thinned as a whole).
// The blend sits on the SAME element as any mask, clip or filter (`extra`): a
// mask, clip or filter on an outer group cuts everything inside it off from the
// print, and a multiply nested inside then blends with nothing and paints solid.
const layer = (inner, colour, a = 1, extra = "") =>
  `<g ${MUL}${extra}><g fill="${colour}" opacity="${a}">${inner}</g></g>`;
const FILTER_BOX = `filterUnits="userSpaceOnUse" x="-24" y="0" width="${VBW + 48}" height="${VBH}" color-interpolation-filters="sRGB"`;
const DEFS = `
  <filter id="ragged" ${FILTER_BOX}>
    <feTurbulence type="fractalNoise" baseFrequency="0.22 0.09" numOctaves="2" seed="5" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="5.5" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="grain" ${FILTER_BOX}>
    <feTurbulence type="fractalNoise" baseFrequency="0.45" numOctaves="2" seed="11" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.6 0 0 0 0.02" result="a"/>
    <feComposite in="SourceGraphic" in2="a" operator="in"/>
  </filter>
  <filter id="fibre" ${FILTER_BOX}>
    <feTurbulence type="fractalNoise" baseFrequency="0.018 0.42" numOctaves="2" seed="17" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.4 0 0 0 0.2" result="a"/>
    <feComposite in="SourceGraphic" in2="a" operator="in"/>
  </filter>
  <linearGradient id="dry" x1="1" y1="0" x2="0" y2="0">
    <stop offset="0" stop-color="${INK_SEL}" stop-opacity="1"/>
    <stop offset="0.06" stop-color="${INK_SEL}" stop-opacity="0.94"/>
    <stop offset="0.55" stop-color="${INK_SEL}" stop-opacity="0.8"/>
    <stop offset="1" stop-color="${INK_SEL}" stop-opacity="${DRY}"/>
  </linearGradient>`;

// ── The crops ─────────────────────────────────────────────────────────────────
const WIDTH = 358; // the page's width on a 390 px phone with the app's gutters
const boxOf = (sw, pad = 4) => {
  const top = Math.min(...sw.map((s) => s.y - s.width / 2)) - (LINE_H - VERSE_SW[0].width) / 2 - pad;
  const bottom = Math.max(...sw.map((s) => s.y + s.width / 2)) + (LINE_H - VERSE_SW[0].width) / 2 + pad;
  return { x: -12, y: top, w: VBW + 24, h: bottom - top };
};
const CROP_VERSE = boxOf(VERSE_SW);
const CROP_PASSAGE = boxOf(PASSAGE_SW);
const CROP_RUN = boxOf(VERSE_SW.slice(0, 4));
// A close look at one line — the verse's third — at about two and a half times reading size.
const CLOSE = (() => { const s = VERSE_SW[2]; return { x: 150, y: s.y - LINE_H * 0.62, w: 150, h: LINE_H * 1.24 }; })();

function crop(overlay, { width = WIDTH, label = "", box = CROP_VERSE, cls = "" } = {}) {
  const height = Math.round((width * box.h) / box.w);
  return `<svg viewBox="${f1(box.x)} ${f1(box.y)} ${f1(box.w)} ${f1(box.h)}" width="${width}" height="${height}" role="img" aria-label="${esc(label)}" class="leaf${cls ? ` ${cls}` : ""}"><use href="#p${PAGE}" width="${VBW}" height="${VBH}"/><g>${overlay}</g></svg>`;
}

// ── What each option draws ────────────────────────────────────────────────────
const amber = (list, shape = "swipe", a = 1, o) => layer(paths(list, shape, o), INK_SEL, a);
const draw = {
  // Shapes: the verse alone, today's full amber, one pass — only the outline changes.
  S1: () => amber(VERSE_SW, "swipe"),
  S2: () => amber(VERSE_SW, "rough"),
  S3: () => `<g filter="url(#ragged)" ${MUL}><g fill="${INK_SEL}">${paths(VERSE_SW, "swipe")}</g></g>`,
  S4: () => amber(VERSE_SW, "patch"),
  S5: () => amber(VERSE_SW, "pressure"),
  S6: () => amber(VERSE_SW, "chisel"),
  // Textures: today's outline, only the ink inside changes.
  T1: () => amber(VERSE_SW, "swipe"),
  T2: () => `<g filter="url(#grain)" ${MUL}><g fill="${INK_SEL}">${paths(VERSE_SW, "swipe")}</g></g>`,
  T5: () => `<g filter="url(#fibre)" ${MUL}><g fill="${INK_SEL}">${paths(VERSE_SW, "swipe")}</g></g>`,
  T3: () => VERSE_SW.map((s) => {
    const R = rng(`${s.key}streak`);
    const a = { ...s, x1: s.x1 - 1 + R() * 3, x2: s.x2 + 1.5 + R() * 2 };
    const b = { ...s, x1: s.x1 + 1.5 + R() * 3, x2: s.x2 - 1 + R() * 2 };
    return layer(`<path d="${capsule(a, { dy: -s.width * 0.19, tall: 0.62 })}"/>`, INK_SEL, STREAK_A)
      + layer(`<path d="${capsule(b, { dy: s.width * 0.19, tall: 0.62 })}"/>`, INK_SEL, STREAK_A);
  }).join(""),
  T4: () => `<g ${MUL}>${VERSE_SW.map((s) => `<path d="${capsule(s)}" fill="url(#dry)"/>`).join("")}</g>`
    + `<g ${MUL}><g fill="none" stroke="${INK_SEL}" stroke-width="1.3" opacity="${RIM}">${paths(VERSE_SW, "swipe")}</g></g>`,
};

// The overlap rules. Each returns [verse inside a passage, word run inside a verse].
// The outline is the rough band throughout, since a rough edge is what makes
// two marks' edges fail to line up — the thing an overlap rule has to survive.
const R_SHAPE = "rough";
const P = (list, o) => paths(list, R_SHAPE, o);
const knock = (outerInner, holes, colour, a, gap = 1.6) => {
  const id = next("ko");
  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="-24" y="0" width="${VBW + 48}" height="${VBH}"><rect x="-24" y="0" width="${VBW + 48}" height="${VBH}" fill="#fff"/><g fill="#000" stroke="#000" stroke-width="${gap * 2}" stroke-linejoin="round">${holes}</g></mask>`
    + layer(outerInner, colour, a, ` mask="url(#${id})"`);
};
const C = {
  // C1 — plain see-through, no blend: colour laid over paper AND letters.
  C1: () => [
    `<g fill="${INK_SEL}"><g opacity="${ALPHA.passage}">${P(PASSAGE_SW)}</g><g opacity="${ALPHA.verse}">${P(VERSE_SW)}</g></g>`,
    `<g fill="${INK_SEL}"><g opacity="${ALPHA.verse}">${P(VERSE_SW)}</g><g opacity="${ALPHA.run}">${P(RUN_SW)}</g></g>`,
  ],
  // C2 — today: the passage pen at half strength, the verse at full, both multiplied.
  C2: () => [
    layer(P(PASSAGE_SW), INK_SEL, RANGE_A) + layer(P(VERSE_SW), INK_SEL, 1),
    layer(P(VERSE_SW), INK_SEL, 1) + layer(P(RUN_SW), INK_SEL, 1),
  ],
  // C3 — one pen for every mark; each mark is one more pass; overlaps add up.
  C3: () => [
    layer(P(PASSAGE_SW), INK_SEL, PASS) + layer(P(VERSE_SW), INK_SEL, PASS),
    layer(P(VERSE_SW), INK_SEL, PASS) + layer(P(RUN_SW), INK_SEL, PASS),
  ],
  // C5 — two hues, multiplied: verdigris passage, amber verse; indigo word run on amber.
  C5: () => [
    layer(P(PASSAGE_SW), ACCENT, THIN) + layer(P(VERSE_SW), INK_SEL, 1),
    layer(P(VERSE_SW), INK_SEL, 1) + layer(P(RUN_SW), MISTAKE, THIN),
  ],
  // C6 — the inner mark cuts its shape (and a thin gap of paper) out of the outer; nothing stacks.
  C6: () => [
    knock(P(PASSAGE_SW), P(VERSE_SW), ACCENT, THIN) + layer(P(VERSE_SW), INK_SEL, 1),
    knock(P(VERSE_SW), P(RUN_SW), INK_SEL, 1) + layer(P(RUN_SW), MISTAKE, THIN),
  ],
  // C7 — counted passes. The verse is always two passes; inside a passage the
  // passage's own pass is its first. A word run is one more pass on top.
  // So the shade says how deep you are, never how many marks happen to overlap.
  // The two passes of one verse are laid a little apart (one high, one low,
  // each with its own wobble), so the second pass shows as a streak, the way a
  // hand going over a line twice never lands exactly on the first stroke.
  C7: () => [
    layer(P(PASSAGE_SW, { dy: -OFFSET }), INK_SEL, PASS) + layer(P(VERSE_SW, { seed: "second", dy: OFFSET }), INK_SEL, PASS),
    versePasses() + layer(P(RUN_SW, { seed: "third" }), INK_SEL, PASS),
  ],
};
function versePasses(extra = "", extra2 = extra) {
  return layer(P(VERSE_SW, { dy: -OFFSET }), INK_SEL, PASS, extra) + layer(P(VERSE_SW, { seed: "second", dy: OFFSET }), INK_SEL, PASS, extra2);
}
// C4 is built by hand: levels inside one isolated, multiplied group, each level
// a union (its own paths never double up), the stronger laid over the weaker.
const levels = (groups) => `<g ${MUL}>${groups.map(([inner, a]) => `<g opacity="${a}"><g fill="${INK_SEL}">${inner}</g></g>`).join("")}</g>`;
C.C4 = () => [
  levels([[P(PASSAGE_SW), LEVEL.passage], [P(VERSE_SW), LEVEL.verse]]),
  levels([[P(VERSE_SW), LEVEL.verse], [P(RUN_SW), LEVEL.run]]),
];

// The recommendation, drawn together: rough band, counted passes whose second
// pass is the texture, and a cut-out for a mark of another colour. No filter:
// the texture comes from the passes themselves.
const REC = {
  alone: () => versePasses(),
  passage: () => C.C7()[0],
  run: () => C.C7()[1],
  twoHue: () => {
    const id = next("ko");
    const mask = `<mask id="${id}" maskUnits="userSpaceOnUse" x="-24" y="0" width="${VBW + 48}" height="${VBH}"><rect x="-24" y="0" width="${VBW + 48}" height="${VBH}" fill="#fff"/><g fill="#000" stroke="#000" stroke-width="3.2" stroke-linejoin="round">${P(RUN_SW, { seed: "third" })}</g></mask>`;
    return mask + versePasses(` mask="url(#${id})"`) + layer(P(RUN_SW, { seed: "third" }), MISTAKE, THIN);
  },
};

// A1 — asked for more contrast: the same band, plus a firm edge under each line.
const firmEdge = (list) => `<g ${MUL} fill="none" stroke="${FIRM_EDGE}" stroke-width="1.4" stroke-linecap="round">${list.map((s) => {
  const lo = Math.min(s.x1, s.x2) - s.width * 0.35, hi = Math.max(s.x1, s.x2) + s.width * 0.35, y = s.y + s.width / 2 + 0.6;
  return `<path d="M${f1(hi)} ${f1(y)}L${f1(lo)} ${f1(y)}"/>`;
}).join("")}</g>`;

// L1 — the wipe. Today's: the app's dash trick on a stroked line. A filled
// shape has no dash, so the rough band is wiped by a clip that grows from the
// right, one line after the next.
const todayWipe = () => `<g ${MUL}>${VERSE_SW.map((s, i) => {
  const len = Math.abs(s.x2 - s.x1);
  return `<line class="pen" x1="${f1(s.x2)}" y1="${f1(s.y)}" x2="${f1(s.x1)}" y2="${f1(s.y)}" stroke="${INK_SEL}" stroke-width="${f1(s.width)}" stroke-linecap="round" style="--len:${f1(len)};--i:${i}"/>`;
}).join("")}</g>`;
const clipWipe = (list, inner, a, colour = INK_SEL) => list.map((s, i) => {
  const id = next("wipe");
  const lo = Math.min(s.x1, s.x2) - s.width, hi = Math.max(s.x1, s.x2) + s.width;
  return `<clipPath id="${id}"><rect class="grow" x="${f1(lo)}" y="${f1(s.y - s.width)}" width="${f1(hi - lo)}" height="${f1(s.width * 2)}" style="--i:${i}"/></clipPath>`
    + layer(inner(s), colour, a, ` clip-path="url(#${id})"`);
}).join("");
const roughWipe = () => clipWipe(VERSE_SW, (s) => `<path d="${SHAPE.rough(s)}"/>`, 1);

// L2 — lay another pass. Four passes are drawn; the page shows them one by one.
// Counted, the verse stops at its depth (two passes, three with a word run);
// uncounted, every press is one more pass.
const passLayer = (k) => `<g class="pass" data-pass="${k}">${clipWipe(VERSE_SW, (s) => `<path d="${SHAPE.rough(s, { seed: k === 1 ? "" : `pass${k}`, dy: k === 1 ? 0 : (k % 2 ? -0.7 : 0.8) })}"/>`, PASS)}</g>`;
const passStack = () => [1, 2, 3, 4].map(passLayer).join("");

// ── The options ───────────────────────────────────────────────────────────────
const SHAPES = [
  {
    id: "S1", title: "Today's swipe: a clean, round-ended band",
    how: "The app's own pen: one round-capped band per line, constant height, perfectly straight edges.",
    pics: [[draw.S1(), "S1 at reading size"], [draw.S1(), "S1 close up", CLOSE]],
    measured: both(bg.swipe),
  },
  {
    id: "S2", title: "A rough band, its wobble fixed to the verse",
    how: "The same band with an edge that wanders by about one and a half units (a twentieth of the band), a slight rise across the line and a small overshoot at each end. The wobble is seeded from the verse and line, so it is the same on every visit and never shimmers.",
    pics: [[draw.S2(), "S2 at reading size"], [draw.S2(), "S2 close up", CLOSE]],
    measured: both(bg.swipe),
  },
  {
    id: "S3", title: "A ragged edge made by a browser filter",
    how: "Today's band pushed around by a fixed noise pattern, so its edge frays like felt on rough paper. Made by the browser at draw time rather than by the shape itself.",
    pics: [[draw.S3(), "S3 at reading size"], [draw.S3(), "S3 close up", CLOSE]],
    measured: both(bg.swipe),
  },
  {
    id: "S4", title: "A patch per line",
    how: "A taller, squarer, softly irregular patch that fills almost the whole line, like a square-tipped marker dragged slowly.",
    pics: [[draw.S4(), "S4 at reading size"], [draw.S4(), "S4 close up", CLOSE]],
    measured: both(bg.swipe),
  },
  {
    id: "S5", title: "A pressure stroke: thin at the ends, full in the middle",
    how: "A smooth band that starts thin, swells to full height and tapers off, the way a stroke drawn with a pressure-sensitive pen looks.",
    pics: [[draw.S5(), "S5 at reading size"], [draw.S5(), "S5 close up", CLOSE]],
    measured: both(bg.swipe),
  },
  {
    id: "S6", title: "A chisel tip: square band, slanted ends",
    how: "What a real highlighter's wedge tip leaves: straight top and bottom, both ends cut on the same slant.",
    pics: [[draw.S6(), "S6 at reading size"], [draw.S6(), "S6 close up", CLOSE]],
    measured: both(bg.swipe),
  },
];
const TEXTURES = [
  {
    id: "T1", title: "Flat ink",
    how: "One even colour inside the band. What the app does today.",
    pics: [[draw.T1(), "T1 at reading size"], [draw.T1(), "T1 close up", CLOSE]],
    measured: both(bg.swipe),
  },
  {
    id: "T2", title: "Grain: the ink thins in a fine, fixed speckle",
    how: `A fixed noise pattern thins the ink to between ${Math.round(GRAIN_LO * 100)}% and full strength, as a marker leaves paper fibre showing through.`,
    pics: [[draw.T2(), "T2 at reading size"], [draw.T2(), "T2 close up", CLOSE]],
    measured: `thinnest: ${both(multiply(AMBER, GRAIN_LO, PAPER))} · fullest: ${both(bg.swipe)}`,
  },
  {
    id: "T3", title: "Two passes, streaked",
    how: "Each line drawn as two narrower passes, one a little high and one a little low, slightly out of step at the ends. Where they cross, a darker stripe runs along the middle of the line.",
    pics: [[draw.T3(), "T3 at reading size"], [draw.T3(), "T3 close up", CLOSE]],
    measured: `one pass: ${both(multiply(AMBER, STREAK_A, PAPER))} · the stripe: ${both(passes(AMBER, STREAK_A, 2, PAPER))}`,
  },
  {
    id: "T4", title: "Pooled and dry: heavy where the pen lands, thinner as it runs",
    how: `Full ink where the pen starts (the right end), fading to ${Math.round(DRY * 100)}% by the left end, with a darker rim all round where the ink dries at the edge.`,
    pics: [[draw.T4(), "T4 at reading size"], [draw.T4(), "T4 close up", CLOSE]],
    measured: `start: ${both(bg.swipe)} · dry end: ${both(multiply(AMBER, DRY, PAPER))} · rim: ${both(multiply(AMBER, RIM, multiply(AMBER, DRY, PAPER)))}`,
  },
  {
    id: "T5", title: "Fibre: the ink thins in long streaks along the line",
    how: `The same idea as the grain, but the noise is stretched along the line, so the ink thins in long streaks the way a felt tip drags, down to about ${Math.round(FIBRE_LO * 100)}%.`,
    pics: [[draw.T5(), "T5 at reading size"], [draw.T5(), "T5 close up", CLOSE]],
    measured: `thinnest: ${both(multiply(AMBER, FIBRE_LO, PAPER))} · fullest: ${both(bg.swipe)}`,
  },
];
const COMPOSE = [
  {
    id: "C1", title: "Plain see-through stacking",
    how: `No blending: each mark is laid over the page at a fixed see-through amount (passage ${Math.round(ALPHA.passage * 100)}%, verse ${Math.round(ALPHA.verse * 100)}%), over the letters as much as the paper.`,
    measured: `verse alone: letters ${r1(contrast(C1.one.glyph, C1.one.paper))} · verse in passage: letters ${r1(contrast(C1.two.glyph, C1.two.paper))}, against paper ${r1(onPaper(C1.two.paper))} · word run in verse: letters ${r1(contrast(C1.three.glyph, C1.three.paper))}`,
  },
  {
    id: "C2", title: "Multiply, with today's two pens",
    how: "What the app does today: a passage in the pen held at half strength, the verse at full, both blended into the print. The verse inside a passage is the two multiplied together.",
    measured: `passage: ${both(bg.range)} · verse in passage: ${both(bg.today2)} · word run in verse: ${both(bg.today3)}`,
  },
  {
    id: "C3", title: "One pen, and every mark is one more pass",
    how: `The physical highlighter taken literally: every mark is one pass of the same pen (${Math.round(PASS * 100)}% strength) and overlaps simply add up. A verse alone is one pass; inside a passage it is two.`,
    measured: `one pass: ${both(bg.pass1)} · two: ${both(bg.pass2)} · three: ${both(bg.pass3)}`,
  },
  {
    id: "C4", title: "Strength levels: the strongest mark wins, nothing multiplies",
    how: `Each kind of mark has its own strength (passage ${Math.round(LEVEL.passage * 100)}%, verse ${Math.round(LEVEL.verse * 100)}%, word run ${Math.round(LEVEL.run * 100)}%). Where they overlap, the stronger replaces the weaker; the whole is blended into the print once. Nothing ever gets darker than its own level.`,
    measured: `passage: ${both(multiply(AMBER, LEVEL.passage, PAPER))} · verse: ${both(multiply(AMBER, LEVEL.verse, PAPER))} · word run: ${both(multiply(AMBER, LEVEL.run, PAPER))}`,
  },
  {
    id: "C5", title: "Two hues, multiplied",
    how: `The passage in verdigris (thinned to ${Math.round(THIN * 100)}%), the verse in amber over it; the word run in indigo (thinned) over the amber verse. Where they cross, the colours mix as inks would.`,
    measured: `verdigris passage: ${both(bg.verd)} · amber on verdigris: ${both(bg.amberOnVerd)} · indigo on amber: ${both(bg.indigoOnAmber)}`,
  },
  {
    id: "C6", title: "The inner mark cuts a hole in the outer, with a thin gap of paper",
    how: "The same two-hue marks, but the inner one cuts its own shape, plus a hairline of paper, out of the outer. Nothing ever stacks, so every colour stays its own.",
    measured: `verdigris passage: ${both(bg.verd)} · amber verse: ${both(bg.swipe)} · indigo word run: ${both(bg.indigo)}`,
  },
  {
    id: "C7", title: "Counted passes: the shade says how deep you are",
    how: `One pen at ${Math.round(PASS * 100)}%, and the number of passes is fixed by what a place is, not by how many marks happen to cross it. A passage is one pass. The verse is two — and inside a passage, the passage's pass counts as its first. A word run inside the verse is a third. There is never a fourth.`,
    measured: `passage (one pass): ${both(bg.pass1)} · verse (two): ${both(bg.pass2)} · word run (three): ${both(bg.pass3)}`,
  },
];
for (const o of COMPOSE) {
  const [inPassage, inVerse] = C[o.id]();
  o.pics = [[inPassage, `${o.id}: the verse inside a swept passage`, CROP_PASSAGE], [inVerse, `${o.id}: a run of six words inside the verse`, CROP_RUN]];
}
const LIVE = [
  {
    id: "L1", title: "The wipe: today's pen, and the rough band laid down the same way", live: "wipe",
    how: "Press to lay the mark down again. Left: today's swipe, wiped in by the app's own animation. Right: the rough band, wiped in by a clip that grows from the right edge, line by line, at the same speed.",
    pics: [[todayWipe(), "today's swipe, wiped in"], [roughWipe(), "the rough band, wiped in"]],
    measured: `the same timing on both: ${T.durInk} per line, ${T.staggerInk} between lines; off for readers who ask for less motion`,
  },
  {
    id: "L2", title: "Lay another pass over the verse", live: "passes",
    how: "Each press lays one more pass of the pen over the verse. Left: counted — the verse stops at its depth. Right: uncounted — every press goes darker. Watch where the letters stop reading easily.",
    pics: [[passStack(), "counted (stops at the verse's depth)"], [passStack(), "uncounted (every press darkens)"]],
    measured: `one pass ${r1(onInk(bg.pass1))} · two ${r1(onInk(bg.pass2))} · three ${r1(onInk(bg.pass3))} · four ${r1(onInk(bg.pass4))} (letters on the mark)`,
  },
];
const EXTRA = [
  {
    id: "A1", title: "When the reader asks the phone for more contrast",
    how: "The phone's accessibility setting for more contrast adds a firm, burnt-amber edge under each line. The wash stays as it is; the edge is what clears the bar for being seen.",
    pics: [[draw.S2(), "as usual"], [draw.S2() + firmEdge(VERSE_SW), "with more contrast asked for"]],
    measured: `the edge against paper ${r1(onPaper(multiply(rgb(FIRM_EDGE), 1, PAPER)))} · the wash, unchanged: ${both(bg.swipe)}`,
  },
  {
    id: "R", title: "Together: the recommendation",
    how: "The rough band (S2) for the shape. Counted passes (C7) for marks of one colour, with the verse's two passes laid a little apart so the second pass is the texture: no filter needed. A mark of another colour cuts itself out (C6) rather than mixing.",
    pics: [
      [REC.alone(), "the verse on its own: two passes", CROP_VERSE],
      [REC.passage(), "the verse inside a passage", CROP_PASSAGE],
      [REC.run(), "a word run inside the verse, same colour", CROP_RUN],
      [REC.twoHue(), "a word run in another colour, cut out", CROP_RUN],
    ],
    measured: `passage ${both(bg.pass1)} · verse ${both(bg.pass2)} · word run ${both(bg.pass3)} · another-colour word run ${both(bg.indigo)}`,
  },
];

// ── Card ──────────────────────────────────────────────────────────────────────
const card = (o, { wide = false } = {}) => `
  <figure class="opt${wide ? " wide" : ""}" data-option="${o.id}" id="option-${o.id}"${o.live ? ` data-live="${o.live}"` : ""}>
    <figcaption class="head"><span class="id">${o.id}</span><b>${esc(o.title)}</b></figcaption>
    <div class="pics">${o.pics.map(([overlay, label, box], i) => `<div class="pic${o.live ? " live" : ""}"${o.live === "passes" ? ` data-mode="${i === 0 ? "counted" : "uncounted"}"` : ""}>${crop(overlay, { label, box: box ?? CROP_VERSE })}<div class="piclabel">${esc(label)}</div></div>`).join("")}</div>
    ${o.live === "wipe" ? `<button type="button" class="press">Lay the mark down again</button>` : ""}
    ${o.live === "passes" ? `<div class="row"><button type="button" class="press">Another pass</button><button type="button" class="reset">Start again</button><span class="count" aria-live="polite"></span></div>` : ""}
    <div class="text">
      <p>${esc(o.how)}</p>
      <p class="measured"><span>Measured</span> ${esc(o.measured)}</p>
    </div>
  </figure>`;

// ── Page ──────────────────────────────────────────────────────────────────────
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Highlighter shape and texture (A)</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: ${T.paper}; color: ${T.ink};
    font: ${T.textMd}/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 1240px; margin: 0 auto; padding: ${T.space4}px ${T.space3}px 96px; }
  h1 { font-size: 1.5rem; line-height: 1.25; margin: 0 0 ${T.space2}px; }
  h2 { font-size: 1.18rem; margin: ${T.space4}px 0 ${T.space2}px; }
  .lede { color: ${T.inkSoft}; margin: 0 0 ${T.space3}px; max-width: 760px; }
  .site { font-size: 0.85rem; color: ${T.inkSoft}; margin: 0 0 ${T.space3}px; }
  .site a { color: inherit; }
  .short { background: ${T.paperRaised}; border: 1px solid ${T.hairline}; border-radius: ${T.radiusMd};
    padding: ${T.space3}px ${T.space3}px ${T.space2}px; margin: ${T.space3}px 0; max-width: 760px; }
  .short ol { margin: 6px 0 0; padding-left: 22px; }
  .short li { margin: 3px 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(${WIDTH + 26}px, 1fr)); gap: ${T.space3}px; align-items: start; }
  .grid.wide { grid-template-columns: repeat(auto-fill, minmax(${WIDTH * 2 + 40}px, 1fr)); }
  .opt { margin: 0; background: ${T.paperRaised}; border: 1px solid ${T.hairline}; border-radius: ${T.radiusMd};
    padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .head { display: flex; align-items: center; gap: 10px; }
  .head b { font-size: 1.02rem; }
  .id { flex: 0 0 auto; min-width: 28px; height: 28px; padding: 0 6px; border-radius: 14px; background: ${INK_SEL}; color: #3a2a08;
    font-weight: 700; font-size: 0.85rem; display: grid; place-items: center; }
  .pics { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
  .pic { max-width: 100%; }
  .leaf { display: block; background: ${T.paperRaised}; border: 1px solid ${T.hairline}; border-radius: 4px;
    max-width: 100%; height: auto; }
  .piclabel { font-size: 0.78rem; color: ${T.inkFaint}; margin-top: 4px; text-align: center; }
  .text p { margin: 4px 0; color: ${T.inkSoft}; font-size: 0.92rem; }
  .text span { font-weight: 600; color: ${T.ink}; }
  .measured { font-variant-numeric: tabular-nums; }
  .row { display: flex; gap: 10px; align-items: center; justify-content: center; flex-wrap: wrap; }
  .count { font-size: 0.85rem; color: ${T.inkSoft}; font-variant-numeric: tabular-nums; }
  button { font: inherit; font-size: 0.9rem; padding: 6px 12px; border-radius: 8px; border: 1px solid ${T.hairline};
    background: ${T.paper}; color: ${T.ink}; cursor: pointer; }
  button:hover { border-color: ${INK_SEL}; }
  .press { align-self: center; }
  /* Today's wipe, as the app does it: dash = the stroke's length, offset animated to 0. */
  .live .pen { stroke-dasharray: var(--len) var(--len); stroke-dashoffset: 0; }
  .live.go .pen { animation: wipe ${T.durInk} ${T.easeInk} backwards; animation-delay: calc(var(--i) * ${T.staggerInk}); }
  @keyframes wipe { from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
  /* A filled shape has no dash: a clip grows from the right edge instead. */
  .live .grow { transform-box: fill-box; transform-origin: right center; }
  .live.go .grow { animation: grow ${T.durInk} ${T.easeInk} backwards; animation-delay: calc(var(--i) * ${T.staggerInk}); }
  @keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  [data-live="passes"] .pass { display: none; }
  [data-live="passes"] .pass.on { display: inline; }
  @media (prefers-reduced-motion: reduce) { .live.go .pen, .live.go .grow { animation: none; } }
  table { border-collapse: collapse; font-size: 0.9rem; margin: ${T.space2}px 0; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid ${T.hairline}; vertical-align: top; }
  th { color: ${T.inkSoft}; font-weight: 600; }
  td.n { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .note { color: ${T.inkSoft}; font-size: 0.92rem; border-left: 3px solid ${T.hairline};
    padding-left: ${T.space3}px; margin: ${T.space3}px 0; max-width: 760px; }
  footer { margin-top: 64px; padding-top: ${T.space3}px; border-top: 1px solid ${T.hairline};
    color: ${T.inkFaint}; font-size: 0.8rem; }
  footer code { color: ${T.inkSoft}; }
  @media (max-width: 600px) { main { padding: ${T.space3}px 16px 64px; } .grid, .grid.wide { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<svg class="defs" aria-hidden="true" width="0" height="0" style="position:absolute"><defs>${DEFS}</defs><symbol id="p${PAGE}" viewBox="0 0 ${VBW} ${VBH}">${P42.inner}</symbol></svg>
<main>
  <h1>What should the highlighter look like, and what happens where two marks overlap?</h1>
  <p class="lede">Six shapes, four textures and seven rules for overlapping marks, all drawn on the same
    real page (page 42: the end of 2:254, the Throne Verse 2:255, the start of 2:256) at the width a phone
    gives the page. Where the difference only shows in motion — the mark being laid down, a second pass
    going over the first — it is live, with a button.</p>
  <p class="site">This page on the site: <a href="${SITE}">${SITE.replace("https://", "")}</a></p>

  <div class="short">
    <b>The short version</b>
    <ol>
      <li><b>Shape</b> is the outline the pen leaves. <b>Texture</b> is what the ink does inside it.
        <b>Overlap</b> is what happens where a verse sits inside a passage, or a word run inside a verse.</li>
      <li>Each shape and texture is drawn twice: at reading size, then close up. Judge at reading size;
        the close-up only shows what you are looking at.</li>
      <li>Each overlap rule is drawn on two real overlaps: the verse inside a swept passage, and six words
        inside the verse.</li>
      <li>Under each: how well the letters read on the mark (4.5:1 is the reading floor), and how the mark
        stands against the paper (3:1 is the floor for a "you are here" sign).</li>
      <li>The recommendation is the last card: a rough band, a light grain, and a pass count that says how
        deep you are, never how many marks happen to cross.</li>
    </ol>
  </div>

  <div class="note"><b>What was settled before.</b> Marks are drawn per line, never as one box around the
    run; nothing opaque goes over the letters; a reader may choose swipe, fill or outline and a strength in a
    few named steps; and the mark is blended into the print so the letters stay black. None of that is
    re-asked here. This page asks the next thing: the pen's own character, and what two marks do together.</div>

  <h2>What shape does the pen leave?</h2>
  <p class="lede">Same verse, same amber, one pass, flat ink. Only the outline changes.</p>
  <div class="grid">${SHAPES.map((o) => card(o)).join("")}</div>

  <h2>What does the ink do inside the shape?</h2>
  <p class="lede">Same verse, today's clean outline. Only the ink changes.</p>
  <div class="grid">${TEXTURES.map((o) => card(o)).join("")}</div>

  <h2>What happens where two marks overlap?</h2>
  <p class="lede">The rough band throughout, since two rough edges never line up exactly and that is what an
    overlap rule has to survive. Left: the verse inside a passage swept across all three verses. Right: six
    words across a line break inside the verse.</p>
  <div class="grid wide">${COMPOSE.map((o) => card(o, { wide: true })).join("")}</div>

  <h2>What does it feel like when the mark goes down?</h2>
  <div class="grid wide">${LIVE.map((o) => card(o, { wide: true })).join("")}</div>

  <h2>What about a reader who needs more contrast, and what does it all look like together?</h2>
  <div class="grid wide">${EXTRA.map((o) => card(o, { wide: true })).join("")}</div>

  <h2>What was measured?</h2>
  <p class="lede">The print's ink is ${GLYPH}; the paper is ${T.paperRaised}; on plain paper the letters read at
    ${r1(onInk(PAPER))}. The amber is ${INK_SEL}. Figures are computed from the app's own colour values and the
    blend each option uses, not sampled from screenshots.</p>
  <table>
    <tr><th>Mark</th><th>Letters on it</th><th>It against paper</th></tr>
    <tr><td>Today's verse (one full pass)</td><td class="n">${r1(onInk(bg.swipe))}</td><td class="n">${r1(onPaper(bg.swipe))}</td></tr>
    <tr><td>Today's passage (half strength)</td><td class="n">${r1(onInk(bg.range))}</td><td class="n">${r1(onPaper(bg.range))}</td></tr>
    <tr><td>Today's verse inside a passage</td><td class="n">${r1(onInk(bg.today2))}</td><td class="n">${r1(onPaper(bg.today2))}</td></tr>
    <tr><td>Today's rule, a third full mark on top</td><td class="n">${r1(onInk(bg.today3))}</td><td class="n">${r1(onPaper(bg.today3))}</td></tr>
    <tr><td>One pass at ${Math.round(PASS * 100)}%</td><td class="n">${r1(onInk(bg.pass1))}</td><td class="n">${r1(onPaper(bg.pass1))}</td></tr>
    <tr><td>Two passes at ${Math.round(PASS * 100)}%</td><td class="n">${r1(onInk(bg.pass2))}</td><td class="n">${r1(onPaper(bg.pass2))}</td></tr>
    <tr><td>Three passes at ${Math.round(PASS * 100)}%</td><td class="n">${r1(onInk(bg.pass3))}</td><td class="n">${r1(onPaper(bg.pass3))}</td></tr>
    <tr><td>Four passes at ${Math.round(PASS * 100)}%</td><td class="n">${r1(onInk(bg.pass4))}</td><td class="n">${r1(onPaper(bg.pass4))}</td></tr>
    <tr><td>Plain see-through, verse in passage</td><td class="n">${r1(contrast(C1.two.glyph, C1.two.paper))}</td><td class="n">${r1(onPaper(C1.two.paper))}</td></tr>
    <tr><td>Amber verse on a verdigris passage</td><td class="n">${r1(onInk(bg.amberOnVerd))}</td><td class="n">${r1(onPaper(bg.amberOnVerd))}</td></tr>
    <tr><td>Indigo word run on the amber verse</td><td class="n">${r1(onInk(bg.indigoOnAmber))}</td><td class="n">${r1(onPaper(bg.indigoOnAmber))}</td></tr>
    <tr><td>The firm edge (more contrast)</td><td class="n">—</td><td class="n">${r1(onPaper(multiply(rgb(FIRM_EDGE), 1, PAPER)))}</td></tr>
  </table>
  <p class="note">The floors are the web accessibility guideline's: 4.5:1 for text on its background, and 3:1
    for the visual sign of a selected state against what is next to it. Today's amber band is under 3:1
    against the paper and is found by its size; that is true of every wash on this page, which is why A1
    answers "more contrast" with an edge rather than a darker wash.</p>

  <footer>
    Drawn by <code>scripts/build-highlight-texture-options-a.mjs</code> from page ${PAGE}'s shipped verse boxes,
    word boxes and outlined print, the app's own pen (<code>packages/core/dist/ink.js</code>) and colours
    (<code>apps/web/src/styles/tokens.css</code>); line height ${LINE_H} units. The record it belongs to is
    <code>docs/design/highlight-texture-options-a.md</code>, and the sources behind it are in
    <code>docs/design/highlight-texture-research-a.md</code>. The pictures the record embeds are cut from this
    page by <code>scripts/shoot-highlight-texture-options-a.mjs</code>. No Qur'an text: the print is outlined
    paths and the marks are shapes, never words.
  </footer>
</main>
<script>
(() => {
  for (const fig of document.querySelectorAll('[data-live="wipe"]')) {
    const pics = fig.querySelectorAll(".live");
    const go = () => pics.forEach((p) => { p.classList.remove("go"); void p.getBoundingClientRect(); p.classList.add("go"); });
    fig.querySelector(".press").addEventListener("click", go);
    go();
  }
  for (const fig of document.querySelectorAll('[data-live="passes"]')) {
    const pics = [...fig.querySelectorAll(".live")];
    const count = fig.querySelector(".count");
    const DEPTH = 2, MAX = 4;
    let n = 0;
    const show = () => {
      for (const p of pics) {
        const shown = p.dataset.mode === "counted" ? Math.min(n, DEPTH) : Math.min(n, MAX);
        p.querySelectorAll(".pass").forEach((g) => {
          const k = Number(g.dataset.pass);
          const was = g.classList.contains("on");
          g.classList.toggle("on", k <= shown);
          if (k <= shown && !was) { p.classList.remove("go"); void p.getBoundingClientRect(); p.classList.add("go"); }
        });
      }
      count.textContent = n + (n === 1 ? " press" : " presses") + " · counted shows " + Math.min(n, DEPTH) + ", uncounted " + Math.min(n, MAX);
    };
    fig.querySelector(".press").addEventListener("click", () => { n = Math.min(MAX, n + 1); show(); });
    fig.querySelector(".reset").addEventListener("click", () => { n = 0; show(); });
    n = 3; show();
  }
})();
</script>
</body>
</html>`;

// ── Guards: no Qur'an text may reach the file ─────────────────────────────────
if (/[؀-ۿ]/.test(html)) die("output carries Arabic codepoints");
if (/<text\b/.test(html)) die("output carries a <text> element");

writeFileSync(OUT, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`build-highlight-texture-options-a: wrote ${OUT} (${kb} KB, 0 Arabic, ${SHAPES.length} shapes, ${TEXTURES.length} textures, ${COMPOSE.length} overlap rules, ${LIVE.length} live, line height ${LINE_H})`);
console.log(`  swipe ${r1(onInk(bg.swipe))} · passes at ${PASS}: ${[bg.pass1, bg.pass2, bg.pass3, bg.pass4].map((c) => r1(onInk(c))).join(" / ")} · today in passage ${r1(onInk(bg.today2))} · today x3 ${r1(onInk(bg.today3))} · firm edge ${r1(onPaper(multiply(rgb(FIRM_EDGE), 1, PAPER)))}`);
