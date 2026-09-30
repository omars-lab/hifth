#!/usr/bin/env node
/**
 * Render docs/design/highlight-texture-options-b.html — shapes, textures and
 * rules for overlapping marks, drawn on the real page 42 (the Throne Verse,
 * 2:255, inside the passage 2:254–2:256) at the width a phone gives the page.
 *
 * The owner asked to see "different shape and texture options — rough,
 * patches of translucency that can compose double highlighted sections like a
 * real highlighter". The earlier menu (docs/design/highlight-options.md) drew
 * which stroke to use; this page draws what the ink itself looks like, and
 * what happens where two marks land on the same words.
 *
 *   Shapes,   S1–S5   today's swipe · a rough band · a ragged edge (a filter) ·
 *                     a patch per line · a chisel stroke that changes width
 *   Textures, T1–T4   flat · grain · two passes with streaks · uneven, drying ink
 *   Overlaps, C1–C6   plain transparency · multiply (today) · each mark one more
 *                     pass · the stronger wins · two colours · the inner mark cuts
 *                     a hole — each drawn twice: a verse inside a passage, and a
 *                     run of words inside a verse
 *   Live,     L1–L3   the rough band wiped in (and redrawn: same hand or a new one) ·
 *                     a second pass laid down · an edge that moves ("boiling")
 *
 * The app's own pen (packages/core/dist/ink.js) makes every band; the rough,
 * patch and chisel outlines are grown from those bands with seeded noise, so
 * the same verse gets the same hand on every build and every visit. No
 * library is added: each shape is a few lines here, which is the point being
 * tested (see the record's note on bundle cost).
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
 *   node scripts/build-highlight-texture-options-b.mjs
 *   node scripts/shoot-highlight-texture-options-b.mjs     the PNGs the record embeds
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
const OUT = join(ROOT, "docs/design/highlight-texture-options-b.html");
const SITE = "https://blog.bytesofpurpose.com/hifth/docs/design/highlight-texture-options-b.html";

const die = (msg) => { console.error(`build-highlight-texture-options-b: ${msg}`); process.exit(1); };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f1 = (n) => Number(n).toFixed(1);

if (!existsSync(INK)) die(`the pen is not built — ${INK} is missing. Run \`pnpm --filter @hifth/core build\` first.`);
const { swipesFromPath, swipesFromRects, rectsFromPath, pageLineHeight } = await import(INK);

// ── The page ──────────────────────────────────────────────────────────────────
const PAGE = 42;
const VERSE = "2:255";
const RANGE = ["2:254", "2:255", "2:256"];

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const [, , VBW, VBH] = manifest.viewBox.split(/\s+/).map(Number);
if (!(VBW > 0 && VBH > 0)) die("manifest viewBox");

const raw = readFileSync(PAGE_SVG(PAGE), "utf8");
if (/[؀-ۿ]/.test(raw)) die(`page ${PAGE} carries Arabic codepoints`);
if (/<text\b/.test(raw)) die(`page ${PAGE} carries <text>`);
const INNER = raw.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const polygons = new Map();
for (const m of raw.matchAll(/<path\b[^>]*\bid="verse-\d+"[^>]*>/g)) {
  const d = m[0].match(/\bd="([^"]*)"/)?.[1];
  const ayah = m[0].match(/\bayah="(\d+)"/)?.[1];
  const surah = m[0].match(/\bsurah="(\d+)"/)?.[1];
  if (d && ayah && surah) polygons.set(`${surah}:${ayah}`, d);
}
const LINE_H = pageLineHeight(polygons.values()) ?? die("no line height");
const dOf = (ref) => polygons.get(ref) ?? die(`no verse box for ${ref}`);
const linesOf = (ref) => (rectsFromPath(dOf(ref)) ?? die(`${ref} is not a rectangle run`)).flatMap((r) => {
  const k = Math.max(1, Math.round(r.height / LINE_H));
  const h = r.height / k;
  return Array.from({ length: k }, (_, i) => ({ x: r.x, y: r.y + i * h, w: r.width, h }));
});
const swipesOf = (ref) => swipesFromPath(dOf(ref), LINE_H) ?? die(`${ref}: the pen declined`);

const verseLines = linesOf(VERSE);
const verseSwipes = swipesOf(VERSE);
const passageSwipes = RANGE.flatMap(swipesOf);

// A run of words inside the verse, chosen to cross a line break, so the inner
// mark is itself two bands — the case that shows whether a rule holds per line.
const wordShard = JSON.parse(readFileSync(WORDS, "utf8"));
const entry = wordShard.words?.[VERSE] ?? die(`no word boxes for ${VERSE}`);
const pauses = new Set(entry.marks ?? []);
const WORD_BOXES = entry.boxes.map(([x, y, w, h], i) => ({ x, y, w, h, i: entry.from + i })).filter((b) => !pauses.has(b.i));
const lineOfWord = (b) => verseLines.findIndex((l) => b.y + b.h / 2 >= l.y && b.y + b.h / 2 <= l.y + l.h);
const RUN = (() => {
  const idx = WORD_BOXES.map(lineOfWord);
  const brk = idx.findIndex((li, k) => k > 0 && li === 2 && idx[k - 1] === 1);
  if (brk < 3) die("no line break between the verse's second and third lines");
  return WORD_BOXES.slice(brk - 3, brk + 3);
})();
const runRects = [...new Set(RUN.map(lineOfWord))].map((li) => {
  const on = RUN.filter((b) => lineOfWord(b) === li);
  const l = verseLines[li];
  const x = Math.min(...on.map((b) => b.x)) - 1.5;
  const right = Math.max(...on.map((b) => b.x + b.w)) + 1.5;
  return { x, y: l.y, width: right - x, height: l.h };
});
const runSwipes = swipesFromRects(runRects, LINE_H);

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
const INK_SEL = token("ink-sel");
const INK_RANGE = token("ink-range");
const ACCENT = token("accent");
const GLYPH = "#231f20";            // the print's ink, read off the page's paths

// ── Measured contrast ─────────────────────────────────────────────────────────
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
const r1 = (n) => `${n.toFixed(1)}:1`;
const AMBER = rgb(INK_SEL);
const VERD = rgb(ACCENT);
const PAPER = rgb(T.paperRaised);
const INK_RGB = rgb(GLYPH);
// A stack of layers, bottom first: ["mul", pen, a] blends like a marker (the
// page shows through, darkened); ["over", pen, a] lays colour on top (plain
// transparency). The letters sit under the same layers as the paper does.
const stack = (base, layers) => layers.reduce((u, [op, pen, a]) => u.map((c, i) =>
  op === "mul" ? c * (1 - a) + (c * pen[i] / 255) * a : pen[i] * a + c * (1 - a)), base);
const letters = (layers) => contrast(stack(INK_RGB, layers), stack(PAPER, layers));
const vsPaper = (layers) => contrast(stack(PAPER, layers), PAPER);
const between = (inner, outer) => contrast(stack(PAPER, inner), stack(PAPER, outer));

const RANGE_A = alphaOf(INK_RANGE);   // the passage pen: the same amber, held at half
const THIN = 0.45;                    // a dark hue has to be thinned this far to leave letters readable (earlier record)
const PATCH_A = 0.72;                 // the patch covers more of the line, so it is held lighter
const GRAIN_FLOOR = 0.5;              // the grain never lets the ink fall below half
const PASS_A = 0.72;                  // each of the two passes in the streaked stroke
const STREAK_FLOOR = 0.45;            // a streak never lets a pass fall below this
const DRY_END = 0.45;                 // where the uneven stroke dries out, at its far end

const FULL = [["mul", AMBER, 1]];
const M = {
  paper: contrast(INK_RGB, PAPER),
  swipeLetters: letters(FULL), swipePaper: vsPaper(FULL),
  patchLetters: letters([["mul", AMBER, PATCH_A]]), patchPaper: vsPaper([["mul", AMBER, PATCH_A]]),
  grainPaper: vsPaper([["mul", AMBER, GRAIN_FLOOR]]),
  twoPassLetters: letters([["mul", AMBER, PASS_A], ["mul", AMBER, PASS_A]]),
  onePassPaper: vsPaper([["mul", AMBER, PASS_A]]),
  streakPaper: vsPaper([["mul", AMBER, PASS_A * STREAK_FLOOR]]),
  dryPaper: vsPaper([["mul", AMBER, DRY_END]]),
};

// ── Seeded randomness: the same verse gets the same hand, every time ──────────
const hash = (str) => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => { let a = seed >>> 0; return () => {
  a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
// Smooth noise along a line: random heights every `step` units, eased between —
// a hand drifts, it does not jitter.
const drift = (r, from, to, step) => {
  const n = Math.ceil((to - from) / step) + 2;
  const k = Array.from({ length: n }, () => r() * 2 - 1);
  return (x) => {
    const u = (x - from) / step; const i = Math.max(0, Math.min(n - 2, Math.floor(u)));
    const w = (1 - Math.cos(Math.PI * (u - i))) / 2; return k[i] * (1 - w) + k[i + 1] * w;
  };
};
const P = ([x, y]) => `${f1(x)} ${f1(y)}`;
// A closed curve through the points (Catmull-Rom, as cubic Béziers).
const smooth = (pts) => {
  const n = pts.length; let d = `M${P(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
    d += `C${P([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${P([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${P(p2)}`;
  }
  return `${d}Z`;
};
// A band's full reach: the round caps land on the line box's ends.
const reach = (s) => ({ L: Math.min(s.x1, s.x2) - s.width / 2, R: Math.max(s.x1, s.x2) + s.width / 2, h: s.width / 2 });

// ── The shapes ────────────────────────────────────────────────────────────────
// S2 — a rough band. The pen's band, with edges that drift, a slight sag and
// tilt, a slanted start where the tip lands (right, where a line of Arabic
// begins) and a rounded lift at the far end.
function roughBand(s, seed) {
  const { L, R, h } = reach(s); const r = rng(seed);
  const top = drift(r, L, R, 22), bot = drift(r, L, R, 22);
  const sag = (r() * 2 - 1) * h * 0.16, tilt = (r() * 2 - 1) * h * 0.12, A = 0.14 * h;
  const yAt = (x) => { const t = (R - x) / (R - L); return s.y + sag * Math.sin(Math.PI * t) + tilt * (t - 0.5); };
  const slant = 0.55 * h, lift = 0.35 * h, pts = [];
  for (let x = R; x >= L + lift; x -= 3) pts.push([x, yAt(x) - h - A * top(x)]);
  // The lift: half an ellipse round the far end, from the top edge to the bottom.
  for (let k = 1; k < 6; k++) { const a = Math.PI / 2 + (k / 6) * Math.PI; pts.push([L + lift + Math.cos(a) * lift, yAt(L) - Math.sin(a) * h]); }
  for (let x = L; x <= R - slant; x += 3) pts.push([x, yAt(x) + h + A * bot(x)]);
  return smooth(pts);
}
// S4 — a patch: a soft, lumpy shape covering most of the line's height.
function patch(s, seed) {
  const { L, R } = reach(s); const r = rng(seed);
  const half = (s.width / 0.72) * 0.43, top = s.y - half, bottom = s.y + half, j = () => (r() * 2 - 1) * 1.8;
  const pts = [];
  for (let x = R - 5; x > L + 5; x -= 13) pts.push([x, top + j()]);
  pts.push([L + 2, top + 3 + j()], [L - 1 + j(), s.y], [L + 2, bottom - 3 + j()]);
  for (let x = L + 5; x < R - 5; x += 13) pts.push([x, bottom + j()]);
  pts.push([R - 2, bottom - 3 + j()], [R + 1 + j(), s.y], [R - 2, top + 3 + j()]);
  return smooth(pts);
}
// S5 — a chisel stroke: a flat nib held at an angle, pressing on as it lands
// and easing off as it lifts, so the width swells and thins along the line.
function chisel(s, seed) {
  const { L, R, h } = reach(s); const r = rng(seed); const wob = drift(r, L, R, 30);
  const th = (30 * Math.PI) / 180, nx = Math.sin(th), ny = Math.cos(th);
  const x0 = R - nx * h, x1 = L + nx * h, up = [], down = [];
  for (let x = x0; x >= x1; x -= 2.5) {
    const t = (x0 - x) / (x0 - x1);
    const land = Math.min(1, t / 0.05), off = t > 0.8 ? 1 - 0.5 * ((t - 0.8) / 0.2) ** 1.6 : 1;
    const half = (h / ny) * (0.55 + 0.45 * land) * off * (1 + 0.08 * wob(x));
    up.push([x + nx * half, s.y - ny * half]); down.push([x - nx * half, s.y + ny * half]);
  }
  return `M${up.map(P).join("L")}L${down.reverse().map(P).join("L")}Z`;
}
const seedOf = (ref, i, n = 0) => hash(`${ref}#${i}#${n}`);

// ── Drawing helpers ───────────────────────────────────────────────────────────
const line = (s, stroke, extra = "") =>
  `<line x1="${f1(Math.max(s.x1, s.x2))}" y1="${f1(s.y)}" x2="${f1(Math.min(s.x1, s.x2))}" y2="${f1(s.y)}" stroke="${stroke}" stroke-width="${f1(s.width)}" stroke-linecap="round"${extra}/>`;
const MUL = ` style="mix-blend-mode:multiply"`;
const swipes = (list, stroke) => list.map((s) => line(s, stroke, MUL)).join("");
const rgba = (c, a) => `rgba(${c.join(", ")}, ${a})`;
// One mark as one layer: its bands drawn solid, then the whole layer made
// translucent and blended in once — so where its own bands touch, nothing doubles.
const layer = (list, colour, a, extra = "") =>
  `<g opacity="${a}"${MUL}${extra}>${list.map((s) => line(s, colour)).join("")}</g>`;

const CROP = (() => {
  const all = RANGE.flatMap(linesOf);
  const top = Math.min(...all.map((l) => l.y)) - 4;
  const bottom = Math.max(...all.map((l) => l.y + l.h)) + 4;
  return { x: -4, y: top, w: VBW + 8, h: bottom - top };
})();
const WIDTH = 358; // the page's width on a 390 px phone with the app's gutters
const REGION = `filterUnits="userSpaceOnUse" x="${f1(CROP.x)}" y="${f1(CROP.y)}" width="${f1(CROP.w)}" height="${f1(CROP.h)}" color-interpolation-filters="sRGB"`;
const toAlpha = `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0"/>`;
const FILTERS = `
  <filter id="ragged" ${REGION}><feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" xChannelSelector="R" yChannelSelector="G"/></filter>
  <filter id="boil" ${REGION}><feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" xChannelSelector="R" yChannelSelector="G"/></filter>
  <filter id="grain" ${REGION}><feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="4"/>${toAlpha}<feComponentTransfer result="g"><feFuncA type="table" tableValues="${GRAIN_FLOOR} 0.62 0.86 1 1"/></feComponentTransfer><feComposite in="SourceGraphic" in2="g" operator="in"/></filter>
  <filter id="streak" ${REGION}><feTurbulence type="fractalNoise" baseFrequency="0.01 0.55" numOctaves="2" seed="9"/>${toAlpha}<feComponentTransfer result="g"><feFuncA type="table" tableValues="${STREAK_FLOOR} 0.7 1 1"/></feComponentTransfer><feComposite in="SourceGraphic" in2="g" operator="in"/></filter>
  <filter id="streak2" ${REGION}><feTurbulence type="fractalNoise" baseFrequency="0.01 0.55" numOctaves="2" seed="23"/>${toAlpha}<feComponentTransfer result="g"><feFuncA type="table" tableValues="${STREAK_FLOOR} 0.7 1 1"/></feComponentTransfer><feComposite in="SourceGraphic" in2="g" operator="in"/></filter>`;
// A filtered mark: the filter shapes the ink in its own layer, and only then is
// the layer blended into the page. Filter and blend on two nested groups, not
// one element — see the record on what Safari does with both on one.
const filtered = (id, inner, a = 1) => `<g${MUL}${a < 1 ? ` opacity="${a}"` : ""}><g filter="url(#${id})">${inner}</g></g>`;

const draw = {
  swipe: () => swipes(verseSwipes, INK_SEL),
  rough: (n = 0) => verseSwipes.map((s, i) => `<path d="${roughBand(s, seedOf(VERSE, i, n))}" fill="${INK_SEL}"${MUL}/>`).join(""),
  ragged: () => filtered("ragged", verseSwipes.map((s) => line(s, INK_SEL)).join("")),
  patch: () => verseSwipes.map((s, i) => `<path d="${patch(s, seedOf(VERSE, i))}" fill="${INK_SEL}" fill-opacity="${PATCH_A}"${MUL}/>`).join(""),
  chisel: () => verseSwipes.map((s, i) => `<path d="${chisel(s, seedOf(VERSE, i))}" fill="${INK_SEL}"${MUL}/>`).join(""),
  grain: () => filtered("grain", verseSwipes.map((s) => line(s, INK_SEL)).join("")),
  // Two passes of a narrower nib, each its own streaked layer, overlapping in
  // the middle of the line — where they overlap the ink is doubled.
  twoPass: () => [["streak", -1], ["streak2", 1]].map(([id, sgn], k) => {
    const r = rng(hash(`pass${k}`));
    const inner = verseSwipes.map((s) => {
      const w = s.width * 0.64, dy = sgn * s.width * 0.18, a = (r() - 0.5) * 6, b = (r() - 0.5) * 8;
      return line({ x1: Math.min(s.x1, s.x2) + b, x2: Math.max(s.x1, s.x2) + a, y: s.y + dy, width: w }, INK_SEL);
    }).join("");
    return filtered(id, inner, PASS_A);
  }).join(""),
  // Full where the tip lands (right), easing off, drying out at the far end.
  uneven: () => verseSwipes.map((s, i) => {
    const { L, R } = reach(s); const r = rng(seedOf(VERSE, i, 7)); const v = () => (r() - 0.5) * 0.1;
    const stops = [[0, 1], [0.08, 0.96], [0.35, 0.86 + v()], [0.6, 0.82 + v()], [0.85, 0.64 + v()], [1, DRY_END]];
    const id = `dry-${i}`;
    return `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f1(R)}" y1="0" x2="${f1(L)}" y2="0">${stops.map(([o, a]) =>
      `<stop offset="${o}" stop-color="${INK_SEL}" stop-opacity="${a.toFixed(2)}"/>`).join("")}</linearGradient></defs>${line(s, `url(#${id})`, MUL)}`;
  }).join(""),
};

// ── The overlap rules, each as (outer, inner) → markup ────────────────────────
// Scene "passage": the outer mark is the passage 2:254–2:256, the inner the verse.
// Scene "words": the outer mark is the verse, the inner a run of words across a line break.
const SCENES = {
  passage: { outer: passageSwipes, inner: verseSwipes, outerName: "passage", innerName: "verse" },
  words: { outer: verseSwipes, inner: runSwipes, outerName: "verse", innerName: "words" },
};
const GAP = 1.6; // the paper seam left around an inner mark that cuts its hole
let holeN = 0;
const RULES = {
  // C1 — plain transparency: each mark is colour laid on top at a fixed see-through.
  alpha: ({ outer, inner }) => outer.map((s) => line(s, rgba(AMBER, 0.35))).join("") + inner.map((s) => line(s, rgba(AMBER, 0.55))).join(""),
  // C2 — today: every band multiplied on its own; the passage at half, the verse at full.
  today: ({ outer, inner }, scene) => swipes(outer, scene === "passage" ? INK_RANGE : INK_SEL) + swipes(inner, INK_SEL),
  // C3 — each mark is one more pass of the same half-strength pen.
  passes: ({ outer, inner }) => layer(outer, INK_SEL, RANGE_A) + layer(inner, INK_SEL, RANGE_A),
  // C4 — same hue, the stronger wins: both marks in one layer, inner solid, outer half.
  wins: ({ outer, inner }) => `<g${MUL}><g opacity="${RANGE_A}">${outer.map((s) => line(s, INK_SEL)).join("")}</g>${inner.map((s) => line(s, INK_SEL)).join("")}</g>`,
  // C5 — two colours: verdigris for the outer in the passage scene, for the inner in the words scene.
  hues: ({ outer, inner }, scene) => scene === "passage"
    ? layer(outer, rgba(VERD, 1), THIN) + layer(inner, INK_SEL, 1)
    : layer(outer, INK_SEL, 1) + layer(inner, rgba(VERD, 1), THIN),
  // C6 — the inner mark cuts its own shape (and a thin seam) out of the outer, so nothing stacks.
  hole: ({ outer, inner }) => {
    const id = `hole-${holeN++}`;
    const mask = `<mask id="${id}" maskUnits="userSpaceOnUse" x="${f1(CROP.x)}" y="${f1(CROP.y)}" width="${f1(CROP.w)}" height="${f1(CROP.h)}"><rect x="${f1(CROP.x)}" y="${f1(CROP.y)}" width="${f1(CROP.w)}" height="${f1(CROP.h)}" fill="#fff"/>${inner.map((s) => line({ ...s, width: s.width + 2 * GAP }, "#000")).join("")}</mask>`;
    return `<defs>${mask}</defs>${layer(outer, INK_SEL, RANGE_A, ` mask="url(#${id})"`)}${layer(inner, INK_SEL, 1)}`;
  },
};
const HALF = [["mul", AMBER, RANGE_A]];
const measureRule = {
  alpha: { passage: [[["over", AMBER, 0.35]], [["over", AMBER, 0.35], ["over", AMBER, 0.55]]], words: [[["over", AMBER, 0.55]], [["over", AMBER, 0.55], ["over", AMBER, 0.55]]] },
  today: { passage: [HALF, [...HALF, ...FULL]], words: [FULL, [...FULL, ...FULL]] },
  passes: { passage: [HALF, [...HALF, ...HALF]], words: [HALF, [...HALF, ...HALF]] },
  wins: { passage: [HALF, FULL], words: [HALF, FULL] },
  hues: { passage: [[["mul", VERD, THIN]], [["mul", VERD, THIN], ...FULL]], words: [FULL, [...FULL, ["mul", VERD, THIN]]] },
  hole: { passage: [HALF, FULL], words: [HALF, FULL] },
};
// C1 alpha: the words scene draws the verse at 0.35 too — keep the drawing and
// the numbers the same rule.
measureRule.alpha.words = [[["over", AMBER, 0.35]], [["over", AMBER, 0.35], ["over", AMBER, 0.55]]];
const measureLine = (rule) => ["passage", "words"].map((sc) => {
  const [outer, inner] = measureRule[rule][sc]; const { outerName, innerName } = SCENES[sc];
  return `${outerName}: letters ${r1(letters(outer))}, against paper ${r1(vsPaper(outer))} · ${innerName} inside it: letters ${r1(letters(inner))}, against the ${outerName} ${r1(between(inner, outer))}`;
}).join(" | ");

function crop(overlay, { width = WIDTH, label = "" } = {}) {
  const height = Math.round((width * CROP.h) / CROP.w);
  return `<svg viewBox="${f1(CROP.x)} ${f1(CROP.y)} ${f1(CROP.w)} ${f1(CROP.h)}" width="${width}" height="${height}" role="img" aria-label="${esc(label)}" class="leaf"><use href="#p${PAGE}" width="${VBW}" height="${VBH}"/><g>${overlay}</g></svg>`;
}

// ── Live overlays ─────────────────────────────────────────────────────────────
// L1 — the rough band wiped in. A filled shape cannot be dashed, so the app's
// own wipe moves into a mask: a thick invisible line, dashed and wiped exactly
// as today, reveals whatever shape sits under it.
const ROUGH_VARIANTS = 4;
const liveRough = (n) => verseSwipes.map((s, i) => {
  const { L, R, h } = reach(s); const id = `wipe-${n}-${i}`;
  const len = R - L + 2 * h;
  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="${f1(CROP.x)}" y="${f1(CROP.y)}" width="${f1(CROP.w)}" height="${f1(CROP.h)}"><line class="pen" x1="${f1(R + h)}" y1="${f1(s.y)}" x2="${f1(L - h)}" y2="${f1(s.y)}" stroke="#fff" stroke-width="${f1(s.width * 2)}" style="--len:${f1(len)};--i:${i}"/></mask><path d="${roughBand(s, seedOf(VERSE, i, n))}" fill="${INK_SEL}" mask="url(#${id})"${MUL}/>`;
}).join("");
// L2 — the passage is down; the verse's pass is laid over it, wiped in.
const liveSecondPass = () => layer(passageSwipes, INK_SEL, RANGE_A) +
  `<g opacity="${RANGE_A}"${MUL}>${verseSwipes.map((s, i) => line(s, INK_SEL, ` class="pen" style="--len:${f1(Math.abs(s.x2 - s.x1))};--i:${i}"`)).join("")}</g>`;
// L3 — the ragged edge with its noise re-seeded ten times a second.
const liveBoil = () => filtered("boil", verseSwipes.map((s) => line(s, INK_SEL)).join(""));

// ── The options ───────────────────────────────────────────────────────────────
const sw = `letters on the mark ${r1(M.swipeLetters)} · mark against paper ${r1(M.swipePaper)}`;
const SHAPES = [
  { id: "S1", title: "Today's swipe", key: "swipe",
    how: "The app's own pen: one round-capped band along each line, a flat amber, blended into the print like a felt-tip.",
    measured: sw },
  { id: "S2", title: "A rough band, the same hand every time", key: "rough",
    how: "The same band, redrawn as a filled shape whose edges drift a little, with a slight sag, a slanted start where the tip lands and a soft lift at the far end. The drift is seeded by the verse and the line, so a verse always gets the same hand.",
    measured: sw },
  { id: "S3", title: "A ragged edge, made by a filter", key: "ragged",
    how: "Today's bands, left as they are, with the browser pushing each edge pixel a little way by a noise pattern. No new shapes — the roughness is a filter laid over the ink.",
    measured: sw },
  { id: "S4", title: "A patch per line", key: "patch",
    how: `A soft lumpy patch over most of each line's height instead of a band through its middle, held lighter (${Math.round(PATCH_A * 100)}%) because it covers more of the letters.`,
    measured: `letters on the patch ${r1(M.patchLetters)} · patch against paper ${r1(M.patchPaper)}` },
  { id: "S5", title: "A chisel stroke that changes width", key: "chisel",
    how: "A flat nib held at an angle: the ends are cut on a slant, the stroke swells as the nib presses on and thins as it lifts off at the far (left) end.",
    measured: sw },
];
const TEXTURES = [
  { id: "T1", title: "Flat ink (today)", key: "swipe",
    how: "One even amber, the same at every point.", measured: sw },
  { id: "T2", title: "Grain", key: "grain",
    how: `A fine noise knocks the ink back in specks, as if the paper's tooth caught it — never below ${Math.round(GRAIN_FLOOR * 100)}% ink.`,
    measured: `letters on the darkest ink ${r1(M.swipeLetters)} · the lightest speck against paper ${r1(M.grainPaper)}` },
  { id: "T3", title: "Two passes, streaked", key: "twoPass",
    how: "Two passes of a narrower nib, a little offset, each with lengthwise streaks where the felt ran dry; where the passes overlap in the middle of the line the ink is doubled.",
    measured: `letters where the passes overlap ${r1(M.twoPassLetters)} · one pass against paper ${r1(M.onePassPaper)} · a streak against paper ${r1(M.streakPaper)}` },
  { id: "T4", title: "Uneven, drying ink", key: "uneven",
    how: `Full where the tip lands (the right, where the line begins), easing off along the line and drying to ${Math.round(DRY_END * 100)}% at the far end.`,
    measured: `letters at the start ${r1(M.swipeLetters)} · the dry end against paper ${r1(M.dryPaper)}` },
];
const COMPOSITIONS = [
  { id: "C1", rule: "alpha", title: "Plain transparency",
    how: "Each mark is colour laid on top at a fixed see-through (35% for the outer, 55% for the inner). This is how most drawing apps and PDF readers stack highlights." },
  { id: "C2", rule: "today", title: "Multiply, as the app does today",
    how: "Every band is blended into the print on its own, the passage at half strength and the verse at full. Where they overlap, the ink doubles — a verse inside a passage goes brown." },
  { id: "C3", rule: "passes", title: "Each mark is one more pass of the same pen",
    how: `One pen at half strength. A passage is one pass; a verse inside it is a second pass; a word run inside that would be a third. Within one mark, its own bands never double — only a second mark does. A real highlighter's rule, made deliberate.`,
    live: "second" },
  { id: "C4", rule: "wins", title: "Same colour, the stronger one wins",
    how: "Both marks in one layer, like wet ink running together: the outer mark at half, the inner at full, and nothing darker than full anywhere. No brown — the verse looks exactly as it does alone." },
  { id: "C5", rule: "hues", title: "Two colours overlapping",
    how: `The outer and inner marks in different colours (verdigris thinned to ${Math.round(THIN * 100)}%, and amber), both blended in. Where they overlap, the colours mix the way two inks would.` },
  { id: "C6", rule: "hole", title: "The inner mark cuts a hole in the outer",
    how: "The outer mark is drawn with the inner mark's shape cut out of it, plus a thin paper seam; the inner mark sits in the hole at full strength. Nothing stacks, and the join is visible as a line of paper." },
];
const LIVE = [
  { id: "L1", live: "rough", title: "The rough band, wiped in — and redrawn",
    how: "The rough band arrives the way today's swipe does, right to left, one line after the next. Press again with 'the same hand' and it redraws exactly; switch to 'a new hand each time' and every press is a different outline." },
  { id: "L2", live: "second", title: "A second pass, laid down over the passage",
    how: "The passage is already there. Press to lay the verse's pass over it and watch the overlap darken as the pen crosses — the double highlight, happening." },
  { id: "L3", live: "boil", title: "An edge that moves",
    how: "The ragged edge with its noise changed ten times a second — the 'hand-drawn and alive' look some drawing apps use. Press to start or stop. It stays still for anyone who has asked their device for less motion." },
];

const plain = (o) => `
  <figure class="opt" data-option="${o.id}" id="option-${o.id}">
    <figcaption class="head"><span class="id">${o.id}</span><b>${esc(o.title)}</b></figcaption>
    <div class="pics"><div class="pic">${crop(draw[o.key](), { label: o.title })}</div></div>
    <div class="text"><p>${esc(o.how)}</p><p class="measured"><span>Measured</span> ${esc(o.measured)}</p></div>
  </figure>`;
const comp = (o) => `
  <figure class="opt" data-option="${o.id}" id="option-${o.id}">
    <figcaption class="head"><span class="id">${o.id}</span><b>${esc(o.title)}</b></figcaption>
    <div class="pics">${["passage", "words"].map((sc) => `<div class="pic">${crop(RULES[o.rule](SCENES[sc], sc), { label: `${o.title}: ${SCENES[sc].innerName} inside the ${SCENES[sc].outerName}` })}<div class="piclabel">${sc === "passage" ? "a verse inside a passage" : "a run of words inside the verse"}</div></div>`).join("")}</div>
    <div class="text"><p>${esc(o.how)}</p><p class="measured"><span>Measured</span> ${esc(measureLine(o.rule))}</p></div>
  </figure>`;
const live = (o) => {
  let pic = "", controls = "";
  if (o.live === "rough") {
    pic = `<div class="variants">${Array.from({ length: ROUGH_VARIANTS }, (_, n) => `<div class="variant${n ? "" : " on"}">${crop(liveRough(n), { label: `rough band, hand ${n + 1}` })}</div>`).join("")}</div>`;
    controls = `<div class="controls"><button type="button" class="press">Press the verse again</button><label><select><option value="same">the same hand</option><option value="new">a new hand each time</option></select></label></div>`;
  } else if (o.live === "second") {
    pic = crop(liveSecondPass(), { label: "the verse's pass laid over the passage" });
    controls = `<div class="controls"><button type="button" class="press">Lay the second pass</button></div>`;
  } else {
    pic = crop(liveBoil(), { label: "a moving edge" });
    controls = `<div class="controls"><button type="button" class="press">Start or stop</button><span class="rm">Stopped: your device asks for less motion.</span></div>`;
  }
  return `
  <figure class="opt" data-option="${o.id}" id="option-${o.id}" data-live="${o.live}">
    <figcaption class="head"><span class="id">${o.id}</span><b>${esc(o.title)}</b></figcaption>
    <div class="pics"><div class="pic live">${pic}</div></div>
    ${controls}
    <div class="text"><p>${esc(o.how)}</p></div>
  </figure>`;
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Highlighter shape and texture</title>
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
  .grid.wide { grid-template-columns: repeat(auto-fill, minmax(${WIDTH * 2 + 50}px, 1fr)); }
  .opt { margin: 0; background: ${T.paperRaised}; border: 1px solid ${T.hairline}; border-radius: ${T.radiusMd};
    padding: 12px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .head { display: flex; align-items: center; gap: 10px; }
  .head b { font-size: 1.02rem; }
  .id { flex: 0 0 auto; min-width: 28px; height: 28px; padding: 0 6px; border-radius: 14px; background: ${INK_SEL}; color: #3a2a08;
    font-weight: 700; font-size: 0.85rem; display: grid; place-items: center; }
  .pics { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
  .pic { max-width: 100%; }
  .leaf { display: block; background: ${T.paperRaised}; border: 1px solid ${T.hairline}; border-radius: 4px; max-width: 100%; height: auto; }
  .piclabel { font-size: 0.78rem; color: ${T.inkFaint}; margin-top: 4px; text-align: center; }
  .text p { margin: 4px 0; color: ${T.inkSoft}; font-size: 0.92rem; }
  .text span { font-weight: 600; color: ${T.ink}; }
  .measured { font-variant-numeric: tabular-nums; }
  .controls { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
  button, select { font: inherit; font-size: 0.9rem; padding: 6px 12px; border-radius: 8px; border: 1px solid ${T.hairline};
    background: ${T.paper}; color: ${T.ink}; cursor: pointer; }
  button:hover { border-color: ${INK_SEL}; }
  .variant { display: none; } .variant.on { display: block; }
  .rm { display: none; font-size: 0.85rem; color: ${T.inkFaint}; }
  /* The app's wipe: dash = the stroke's length, offset animated to 0, one line after the next. */
  .live .pen { stroke-dasharray: var(--len) var(--len); stroke-dashoffset: 0; }
  .live.go .pen { animation: wipe ${T.durInk} ${T.easeInk} backwards; animation-delay: calc(var(--i) * ${T.staggerInk}); }
  @keyframes wipe { from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .live.go .pen { animation: none; }
    .rm { display: inline; }
  }
  /* Asked for more contrast: drop every texture and edge filter; the ink goes flat. */
  @media (prefers-contrast: more) { .leaf g[filter] { filter: none; } }
  table { border-collapse: collapse; font-size: 0.9rem; margin: ${T.space2}px 0; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid ${T.hairline}; vertical-align: top; }
  th { color: ${T.inkSoft}; font-weight: 600; }
  td.n { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .note { color: ${T.inkSoft}; font-size: 0.92rem; border-left: 3px solid ${T.hairline};
    padding-left: ${T.space3}px; margin: ${T.space3}px 0; max-width: 760px; }
  footer { margin-top: 64px; padding-top: ${T.space3}px; border-top: 1px solid ${T.hairline};
    color: ${T.inkFaint}; font-size: 0.8rem; }
  footer code { color: ${T.inkSoft}; }
  @media (max-width: 600px) { main { padding: ${T.space3}px 16px 64px; } .grid.wide { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<svg class="defs" aria-hidden="true" width="0" height="0" style="position:absolute"><defs>${FILTERS}</defs><symbol id="p${PAGE}" viewBox="0 0 ${VBW} ${VBH}">${INNER}</symbol></svg>
<main>
  <h1>What should the highlighter's ink look like, and what happens where two marks overlap?</h1>
  <p class="lede">Five shapes for the mark, four textures for its ink, six rules for what happens where one mark
    lands inside another, and three that only make sense moving — all on the same real page (page 42, the
    Throne Verse, 2:255, inside the passage 2:254 to 2:256), at the width a phone gives the page.</p>
  <p class="site">This page on the site: <a href="${SITE}">${SITE.replace("https://", "")}</a></p>

  <div class="short">
    <b>The short version</b>
    <ol>
      <li>Every picture is the same page. The shapes and textures change only the verse's own mark; the overlap
        rules are each drawn twice — a verse inside a passage, and a run of words inside the verse.</li>
      <li>Look at arm's length first (can you find it?), then close (can you still read the letters and their
        vowel marks?). The live ones at the bottom need a press.</li>
      <li>Under each picture: how it is made, and measured contrast — the letters on the mark (4.5:1 is the
        reading floor) and the mark against the paper (3:1 is the floor for a "you are here" sign). For overlaps,
        also the inner mark against the outer one: can you tell them apart?</li>
      <li>The pros, the cons, what each commits us to, and a recommendation are in the record this page belongs to.</li>
    </ol>
  </div>

  <div class="note"><b>What is already settled.</b> A reader may choose among the swipe, a fill and an outline, and
    tune strength in a few named steps (2 September). Marks are drawn per line, never one box around a whole
    verse. This page does not re-ask either; every shape here is still one mark per line.</div>

  <h2>What shape could the mark be?</h2>
  <div class="grid">${SHAPES.map(plain).join("")}</div>

  <h2>What could the ink itself look like?</h2>
  <div class="grid">${TEXTURES.map(plain).join("")}</div>

  <h2>What happens where one mark lands inside another?</h2>
  <div class="grid wide">${COMPOSITIONS.map(comp).join("")}</div>

  <h2>Which of these only show themselves moving?</h2>
  <div class="grid">${LIVE.map(live).join("")}</div>

  <p class="note">Contrast figures are computed from the app's own colour values (print ink ${GLYPH}, paper
    ${T.paperRaised}, amber ${INK_SEL}, verdigris ${ACCENT}), not sampled from screenshots. Letters on plain
    paper read at ${r1(M.paper)}. For a texture, the figure given is the worst point of it — the lightest speck,
    the dry end — which is what the web accessibility guideline asks for when a background varies. If a device
    asks for more contrast, this page drops every filter and the ink goes flat; if it asks for less motion,
    nothing wipes or moves.</p>

  <footer>
    Drawn by <code>scripts/build-highlight-texture-options-b.mjs</code> from page ${PAGE}'s shipped verse and word
    boxes and outlined print, the app's own pen (<code>packages/core/dist/ink.js</code>) and colours
    (<code>apps/web/src/styles/tokens.css</code>); line height ${LINE_H} units. The record is
    <code>docs/design/highlight-texture-options-b.md</code>; its pictures are cut from this page by
    <code>scripts/shoot-highlight-texture-options-b.mjs</code>. No Qur'an text: the print is outlined paths and the
    marks are shapes, never words.
  </footer>
</main>
<script>
(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wipe = (el) => { el.classList.remove("go"); void el.getBoundingClientRect(); el.classList.add("go"); };
  // L1: redraw the rough band — the same hand, or the next one.
  for (const fig of document.querySelectorAll('[data-live="rough"]')) {
    const live = fig.querySelector(".live"), vs = [...fig.querySelectorAll(".variant")], sel = fig.querySelector("select");
    let n = 0;
    fig.querySelector(".press").addEventListener("click", () => {
      if (sel.value === "new") { vs[n].classList.remove("on"); n = (n + 1) % vs.length; vs[n].classList.add("on"); }
      wipe(live);
    });
    wipe(live);
  }
  // L2: lay the verse's pass over the passage.
  for (const fig of document.querySelectorAll('[data-live="second"]')) {
    const live = fig.querySelector(".live");
    fig.querySelector(".press").addEventListener("click", () => wipe(live));
    wipe(live);
  }
  // L3: re-seed the edge's noise ten times a second, only when asked, never under reduced motion.
  const turb = document.querySelector("#boil feTurbulence");
  let timer = 0, seed = 11;
  for (const fig of document.querySelectorAll('[data-live="boil"]')) {
    const btn = fig.querySelector(".press");
    if (still) { btn.disabled = true; continue; }
    btn.addEventListener("click", () => {
      if (timer) { clearInterval(timer); timer = 0; return; }
      timer = setInterval(() => { seed = (seed % 5) + 11; turb.setAttribute("seed", String(seed)); }, 100);
    });
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
console.log(`build-highlight-texture-options-b: wrote ${OUT} (${kb} KB, 0 Arabic, ${SHAPES.length} shapes, ${TEXTURES.length} textures, ${COMPOSITIONS.length} overlap rules, ${LIVE.length} live; line height ${LINE_H})`);
console.log(`  run of ${RUN.length} words over ${runSwipes.length} lines · swipe ${r1(M.swipeLetters)} / ${r1(M.swipePaper)} · grain floor ${r1(M.grainPaper)} · dry end ${r1(M.dryPaper)}`);
for (const c of COMPOSITIONS) console.log(`  ${c.id} ${measureLine(c.rule)}`);
