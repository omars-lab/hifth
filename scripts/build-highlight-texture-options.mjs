#!/usr/bin/env node
/**
 * Render docs/design/highlight-texture-options.html — the consolidated page of
 * shape, ink and overlap options for the highlighter, built by the checker from
 * the two independent researcher pages (build-highlight-texture-options-a.mjs
 * and -b.mjs). Every surviving option is drawn on the real page 42 (the Throne
 * Verse, 2:255, inside the passage 2:254–2:256) at the width a phone gives the
 * page, and the differences a still picture cannot carry are mounted live.
 *
 *   The app today   the real app, screenshotted (docs/design/highlight-texture-options/app-today*.png,
 *                   taken with apps/web/e2e/tools/drive.mjs against the built app), and the same
 *                   thing drawn here — a passage inked verse by verse, so the ink breaks at every
 *                   verse number.
 *   Shapes  S1–S2   today's swipe · a rough band with a fixed hand per verse
 *   Ink     T1–T3   flat · a second pass laid a little apart · streaks along the line (a filter)
 *   Overlap O1–O5   today's two pens · one pen, one more pass per mark (half strength) ·
 *                   counted passes at 60%, capped at three · another colour blended in ·
 *                   another colour cut out — each drawn three times: the verse alone, the verse
 *                   inside a passage, a run of words inside the verse
 *   Live    L1–L3   the wipe, today's and the rough band's (same hand or a new one) ·
 *                   another pass, counted against uncounted, at either pen strength ·
 *                   another colour, blended or cut out, toggled in place
 *
 * What both researchers found and what only the checker's re-run settled is in
 * docs/design/highlight-texture-options.md. Two of their findings shape the
 * markup here: a blend nested INSIDE a clipped, masked or filtered group paints
 * solid over the letters (A; reproduced in Chromium for clip and filter, in both
 * engines for a mask), so every blend sits on the SAME element as its mask or
 * clip, or outside the filtered group; and a filter on a level line vanishes
 * unless its region is given in page units (B; reproduced in both engines).
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
 *   node scripts/build-highlight-texture-options.mjs
 *   node scripts/shoot-highlight-texture-options.mjs     the PNGs the record embeds
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
const OUT = join(ROOT, "docs/design/highlight-texture-options.html");
const SITE = "https://blog.bytesofpurpose.com/hifth/docs/design/highlight-texture-options.html";
const PICS = "highlight-texture-options"; // the folder beside the page, where the app's screenshots live

const die = (msg) => { console.error(`build-highlight-texture-options: ${msg}`); process.exit(1); };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f1 = (n) => Number(n).toFixed(1);
const pct = (a) => `${Math.round(a * 100)}%`;

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
// Every band carries a key (what it marks, and which of its lines) so a rough
// edge is seeded from what it marks, never from the order it was drawn in.
const keyed = (ref, list) => list.map((s, i) => ({ ...s, key: `${ref}#${i}` }));
const swipesOf = (ref) => keyed(ref, swipesFromPath(dOf(ref), LINE_H) ?? die(`${ref}: the pen declined`));

const verseLines = linesOf(VERSE);
const verseSwipes = swipesOf(VERSE);
// Today: a passage is inked verse by verse, so where two verses share a line
// there are two bands with a gap of paper between their round ends.
const passageToday = RANGE.flatMap(swipesOf);
// Joined: one band per line, the pen never lifting between two verses on a line.
const joinLines = (list, name) => {
  const byLine = new Map();
  for (const s of list) {
    const k = Math.round(s.y), lo = Math.min(s.x1, s.x2), hi = Math.max(s.x1, s.x2);
    const cur = byLine.get(k);
    if (!cur) byLine.set(k, { x1: lo, x2: hi, y: s.y, width: s.width });
    else { cur.x1 = Math.min(cur.x1, lo); cur.x2 = Math.max(cur.x2, hi); }
  }
  return keyed(name, [...byLine.values()].sort((a, b) => a.y - b.y));
};
const passageSwipes = joinLines(passageToday, "passage");

// A run of six words inside the verse, chosen to cross the break between its
// second and third lines, so the inner mark is itself two bands.
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
const runSwipes = keyed("run", swipesFromRects(runRects, LINE_H));

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
const INK_SEL = token("ink-sel");      // the pen at full strength (the verse, and a word run, today)
const INK_RANGE = token("ink-range");  // the same pen held lighter (a passage, today)
const ACCENT = token("accent");        // verdigris — a stand-in second colour for a passage
const MISTAKE = token("diff-mark");    // indigo — a stand-in second colour for a word run
const GLYPH = "#231f20";               // the print's ink, read off the page's paths

// ── Measured contrast — one method for every figure on the page ──────────────
// Researcher A measured black letters against the mark's colour; researcher B
// measured the letters as they sit UNDER the mark (multiplied by it) against
// the paper under the same mark. B's is what a reader's eye meets, so it is the
// one used here, for every option and both pen strengths.
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
const INDIGO = rgb(MISTAKE);
const PAPER = rgb(T.paperRaised);
const INK_RGB = rgb(GLYPH);
// A stack of layers, bottom first, each ["mul", pen, strength]: the page shows
// through and is darkened, the way ink soaks into paper. Letters sit under the
// same layers as the paper does.
const stack = (base, layers) => layers.reduce((u, [op, pen, a]) => u.map((c, i) =>
  op === "mul" ? c * (1 - a) + (c * pen[i] / 255) * a : pen[i] * a + c * (1 - a)), base);
const letters = (layers) => contrast(stack(INK_RGB, layers), stack(PAPER, layers));
const vsPaper = (layers) => contrast(stack(PAPER, layers), PAPER);
const both = (layers) => `letters ${r1(letters(layers))} · against paper ${r1(vsPaper(layers))}`;
const mul = (pen, a) => ["mul", pen, a];
const times = (n, layer) => Array.from({ length: n }, () => layer);

const HALF = alphaOf(INK_RANGE);   // today's passage pen, and researcher B's one pen: 50%
const PASS = 0.6;                  // researcher A's one pen: 60%
const THIN = 0.45;                 // a dark second colour thinned so the letters survive (the earlier options record)
const OFFSET = 1.3;                // how far apart two passes of one verse land, in page units
const FIBRE_LO = 0.7;              // the streaked ink never thins below this share of a pass
const GAP = 1.6;                   // the paper seam left around a mark that cuts its hole

const FULL = [mul(AMBER, 1)];
const M = {
  paper: contrast(INK_RGB, PAPER),
  full: FULL,
  passage: [mul(AMBER, HALF)],
  todayIn: [mul(AMBER, HALF), mul(AMBER, 1)],
  todayRun: [mul(AMBER, 1), mul(AMBER, 1)],
  half: (n) => times(n, mul(AMBER, HALF)),
  pass: (n) => times(n, mul(AMBER, PASS)),
  fibreLow: [mul(AMBER, FIBRE_LO)],
  verd: [mul(VERD, THIN)],
  amberOnVerd: [mul(VERD, THIN), mul(AMBER, PASS), mul(AMBER, PASS)],
  indigo: [mul(INDIGO, THIN)],
  indigoOnAmber: [mul(AMBER, PASS), mul(AMBER, PASS), mul(INDIGO, THIN)],
};

// ── Seeded randomness: the same verse gets the same hand, every time ──────────
const hash = (str) => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => { let a = hash(seed); return () => {
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
const Pt = ([x, y]) => `${f1(x)} ${f1(y)}`;
// A closed curve through the points (Catmull-Rom, as cubic Béziers).
const smooth = (pts) => {
  const n = pts.length; let d = `M${Pt(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
    d += `C${Pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${Pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${Pt(p2)}`;
  }
  return `${d}Z`;
};
// A band's full reach: the round caps land on the line box's ends.
const reach = (s) => ({ L: Math.min(s.x1, s.x2) - s.width / 2, R: Math.max(s.x1, s.x2) + s.width / 2, h: s.width / 2 });

// ── The two surviving shapes ──────────────────────────────────────────────────
// Today's swipe as a filled capsule: identical to the app's round-capped line.
const capsule = (s, dy = 0) => {
  const lo = Math.min(s.x1, s.x2), hi = Math.max(s.x1, s.x2), h = s.width / 2, y = s.y + dy;
  return `M${f1(hi)} ${f1(y - h)}A${f1(h)} ${f1(h)} 0 0 1 ${f1(hi)} ${f1(y + h)}L${f1(lo)} ${f1(y + h)}A${f1(h)} ${f1(h)} 0 0 1 ${f1(lo)} ${f1(y - h)}Z`;
};
// The rough band (researcher B's): the pen's band with edges that drift, a
// slight sag and tilt, a slanted start where the tip lands (the right, where a
// line of Arabic begins) and a rounded lift at the far end. Seeded from the
// band's key and the pass, so a verse always gets the same hand.
function roughBand(s, { pass = 0, dy = 0 } = {}) {
  const { L, R, h } = reach(s); const r = rng(`${s.key}#${pass}`);
  const top = drift(r, L, R, 22), bot = drift(r, L, R, 22);
  const sag = (r() * 2 - 1) * h * 0.16, tilt = (r() * 2 - 1) * h * 0.12, A = 0.14 * h;
  const yAt = (x) => { const t = (R - x) / (R - L); return s.y + dy + sag * Math.sin(Math.PI * t) + tilt * (t - 0.5); };
  const slant = 0.55 * h, lift = 0.35 * h, pts = [];
  for (let x = R; x >= L + lift; x -= 8) pts.push([x, yAt(x) - h - A * top(x)]);
  for (let k = 1; k < 6; k++) { const a = Math.PI / 2 + (k / 6) * Math.PI; pts.push([L + lift + Math.cos(a) * lift, yAt(L) - Math.sin(a) * h]); }
  for (let x = L; x <= R - slant; x += 8) pts.push([x, yAt(x) + h + A * bot(x)]);
  return smooth(pts);
}
const SHAPE = { swipe: (s, o = {}) => capsule(s, o.dy ?? 0), rough: (s, o) => roughBand(s, o) };
const paths = (list, shape, o) => list.map((s) => `<path d="${SHAPE[shape](s, o)}"/>`).join("");

// ── Drawing helpers ───────────────────────────────────────────────────────────
let uid = 0;
const next = (p) => `${p}${++uid}`;
const MUL = ` style="mix-blend-mode:multiply"`;
// One mark as one layer: its bands drawn solid, then the whole layer made
// translucent and blended in once — so where its own bands touch, nothing
// doubles. The blend sits on the SAME element as any mask or clip (`extra`):
// nested inside a masked or clipped group it blends with nothing and paints
// solid over the letters (researcher A's finding, reproduced).
const layer = (inner, colour, a = 1, extra = "") =>
  `<g${MUL}${extra}><g fill="${colour}" opacity="${a}">${inner}</g></g>`;
// A filter needs its region in page units, or a level line's own box has no
// height and the browser draws nothing (researcher B's finding, reproduced).
// The blend goes on the outer group and the filter on the inner one, which is
// the arrangement both engines get right.
const REGION = `filterUnits="userSpaceOnUse" x="-24" y="0" width="${VBW + 48}" height="${VBH}" color-interpolation-filters="sRGB"`;
const FILTERS = `
  <filter id="fibre" ${REGION}>
    <feTurbulence type="fractalNoise" baseFrequency="0.018 0.42" numOctaves="2" seed="17" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.4 0 0 0 0.2" result="a"/>
    <feComposite in="SourceGraphic" in2="a" operator="in"/>
  </filter>`;
const filtered = (id, inner, colour, a = 1) => `<g${MUL}${a < 1 ? ` opacity="${a}"` : ""}><g filter="url(#${id})" fill="${colour}">${inner}</g></g>`;
// The inner mark's shape, plus a thin seam of paper, cut out of the outer.
const knock = (outer, holes, colour, a) => {
  const id = next("ko");
  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="-24" y="0" width="${VBW + 48}" height="${VBH}"><rect x="-24" y="0" width="${VBW + 48}" height="${VBH}" fill="#fff"/><g fill="#000" stroke="#000" stroke-width="${GAP * 2}" stroke-linejoin="round">${holes}</g></mask>`
    + layer(outer, colour, a, ` mask="url(#${id})"`);
};
// The app's own stroke, for the wipe that only a dashed line can do.
const line = (s, stroke, extra = "") =>
  `<line x1="${f1(Math.max(s.x1, s.x2))}" y1="${f1(s.y)}" x2="${f1(Math.min(s.x1, s.x2))}" y2="${f1(s.y)}" stroke="${stroke}" stroke-width="${f1(s.width)}" stroke-linecap="round"${extra}/>`;

// ── The crops ─────────────────────────────────────────────────────────────────
const WIDTH = 358; // the page's width on a 390 px phone with the app's gutters
const boxOf = (sw, pad = 4) => {
  const top = Math.min(...sw.map((s) => s.y - s.width / 2)) - (LINE_H - verseSwipes[0].width) / 2 - pad;
  const bottom = Math.max(...sw.map((s) => s.y + s.width / 2)) + (LINE_H - verseSwipes[0].width) / 2 + pad;
  return { x: -12, y: top, w: VBW + 24, h: bottom - top };
};
const CROP_VERSE = boxOf(verseSwipes);
const CROP_PASSAGE = boxOf(passageSwipes);
// A close look at one line — the verse's third — at about two and a half times reading size.
const CLOSE = (() => { const s = verseSwipes[2]; return { x: 150, y: s.y - LINE_H * 0.62, w: 150, h: LINE_H * 1.24 }; })();
// The row where the passage's first verse ends and the verse begins, close up.
const SEAM = (() => { const s = verseSwipes[0]; return { x: 110, y: s.y - LINE_H * 0.62, w: 150, h: LINE_H * 1.24 }; })();

function crop(overlay, { width = WIDTH, label = "", box = CROP_VERSE } = {}) {
  const height = Math.round((width * box.h) / box.w);
  return `<svg viewBox="${f1(box.x)} ${f1(box.y)} ${f1(box.w)} ${f1(box.h)}" width="${width}" height="${height}" role="img" aria-label="${esc(label)}" class="leaf"><use href="#p${PAGE}" width="${VBW}" height="${VBH}"/><g>${overlay}</g></svg>`;
}
const pic = (overlay, label, box) => [overlay, label, box];

// ── What each option draws ────────────────────────────────────────────────────
const R = "rough";
const amber = (list, shape, a = 1, o) => layer(paths(list, shape, o), INK_SEL, a);
// Two passes of one verse, laid a little apart with their own hands — the
// second pass is the texture (researcher A's C7), no filter needed.
const twoPasses = (list, a = PASS, extra = "") =>
  layer(paths(list, R, { dy: -OFFSET }), INK_SEL, a, extra) + layer(paths(list, R, { pass: 1, dy: OFFSET }), INK_SEL, a, extra);

const draw = {
  // Shapes: the verse alone, one pass of full amber; only the outline changes.
  S1: () => amber(verseSwipes, "swipe"),
  S2: () => amber(verseSwipes, R),
  // Ink: the rough band throughout; only what the ink does inside it changes.
  T1: () => amber(verseSwipes, R),
  T2: () => twoPasses(verseSwipes),
  T3: () => filtered("fibre", paths(verseSwipes, R), INK_SEL),
  // Today, as the app draws it: the passage verse by verse at half strength,
  // the verse and a word run at full, every band blended on its own.
  todayPassage: () => amber(passageToday, "swipe", HALF) + amber(verseSwipes, "swipe"),
};

// The overlap rules. Each gives [the verse alone, the verse inside a passage,
// a run of words inside the verse]. The rough band throughout, since two rough
// edges never line up exactly and that is what a rule has to survive.
const P = (list, o) => paths(list, R, o);
const O = {
  // O1 — today: two pens, the passage inked verse by verse.
  O1: () => [
    amber(verseSwipes, "swipe"),
    draw.todayPassage(),
    amber(verseSwipes, "swipe") + amber(runSwipes, "swipe"),
  ],
  // O2 — one pen at half strength; every mark is one more pass (researcher B).
  O2: () => [
    amber(verseSwipes, R, HALF),
    amber(passageSwipes, R, HALF) + amber(verseSwipes, R, HALF, { pass: 1 }),
    amber(verseSwipes, R, HALF) + amber(runSwipes, R, HALF, { pass: 1 }),
  ],
  // O3 — counted passes at 60%: a passage is one, a verse always two (inside a
  // passage, the passage's pass is its first), a word run three, never a fourth (researcher A).
  O3: () => [
    twoPasses(verseSwipes),
    amber(passageSwipes, R, PASS, { dy: -OFFSET }) + amber(verseSwipes, R, PASS, { pass: 1, dy: OFFSET }),
    twoPasses(verseSwipes) + amber(runSwipes, R, PASS, { pass: 2 }),
  ],
  // O4 — another colour, blended in: verdigris for a passage, indigo for a word run.
  O4: () => [
    twoPasses(verseSwipes),
    layer(P(passageSwipes), ACCENT, THIN) + twoPasses(verseSwipes),
    twoPasses(verseSwipes) + layer(P(runSwipes, { pass: 2 }), MISTAKE, THIN),
  ],
  // O5 — another colour, cut out: the inner mark cuts its shape and a paper seam out of the outer.
  O5: () => [
    twoPasses(verseSwipes),
    knock(P(passageSwipes), P(verseSwipes, { dy: -OFFSET }) + P(verseSwipes, { pass: 1, dy: OFFSET }), ACCENT, THIN) + twoPasses(verseSwipes),
    (() => { const id = next("ko"); const holes = P(runSwipes, { pass: 2 });
      return `<mask id="${id}" maskUnits="userSpaceOnUse" x="-24" y="0" width="${VBW + 48}" height="${VBH}"><rect x="-24" y="0" width="${VBW + 48}" height="${VBH}" fill="#fff"/><g fill="#000" stroke="#000" stroke-width="${GAP * 2}" stroke-linejoin="round">${holes}</g></mask>`
        + twoPasses(verseSwipes, PASS, ` mask="url(#${id})"`) + layer(holes, MISTAKE, THIN); })(),
  ],
};

// ── Live ──────────────────────────────────────────────────────────────────────
// L1 — the wipe. Today's: the app's dash trick on a stroked line. A filled shape
// has no dash, so the rough band is wiped through a mask: a thick invisible
// line, dashed and wiped exactly as today, reveals the shape under it. Four
// hands are drawn; "a new hand each time" steps through them.
const todayWipe = () => `<g${MUL}>${verseSwipes.map((s, i) =>
  line(s, INK_SEL, ` class="pen" style="--len:${f1(Math.abs(s.x2 - s.x1))};--i:${i}"`)).join("")}</g>`;
const HANDS = 4;
const roughWipe = (n) => verseSwipes.map((s, i) => {
  const { L, R: Rr, h } = reach(s); const id = next("wipe"); const len = Rr - L + 2 * h;
  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="-24" y="0" width="${VBW + 48}" height="${VBH}"><line class="pen" x1="${f1(Rr + h)}" y1="${f1(s.y)}" x2="${f1(L - h)}" y2="${f1(s.y)}" stroke="#fff" stroke-width="${f1(s.width * 2)}" style="--len:${f1(len)};--i:${i}"/></mask><path d="${roughBand(s, { pass: n * 10 })}" fill="${INK_SEL}" mask="url(#${id})"${MUL}/>`;
}).join("");
// L2 — lay another pass. Four passes are drawn, each wiped in by a clip that
// grows from the right; the page shows them one by one. The pen's strength is
// a CSS variable, so one card serves both 50% and 60%.
const clipWipe = (list, inner, extra = "") => list.map((s, i) => {
  const id = next("clip");
  const lo = Math.min(s.x1, s.x2) - s.width, hi = Math.max(s.x1, s.x2) + s.width;
  return `<clipPath id="${id}"><rect class="grow" x="${f1(lo)}" y="${f1(s.y - s.width)}" width="${f1(hi - lo)}" height="${f1(s.width * 2)}" style="--i:${i}"/></clipPath>`
    + `<g${MUL} clip-path="url(#${id})"${extra}><g fill="${INK_SEL}" style="opacity:var(--pen)">${inner(s)}</g></g>`;
}).join("");
const passLayer = (k) => `<g class="pass" data-pass="${k}">${clipWipe(verseSwipes, (s) => `<path d="${roughBand(s, { pass: k, dy: k === 1 ? -OFFSET : k === 2 ? OFFSET : k === 3 ? -0.4 : 0.5 })}"/>`)}</g>`;
const passStack = () => [1, 2, 3, 4].map(passLayer).join("");
// L3 — another colour: the same two scenes as O4 and O5, swapped in place by a button.
const liveHue = () => ({
  blended: [O.O4()[1], O.O4()[2]],
  cut: [O.O5()[1], O.O5()[2]],
});

// ── The options ───────────────────────────────────────────────────────────────
const SHAPES = [
  { id: "S1", title: "Today's swipe: a clean, round-ended band",
    how: "The app's own pen: one round-capped band per line, constant height, straight edges.",
    pics: [pic(draw.S1(), "at reading size"), pic(draw.S1(), "close up", CLOSE)],
    measured: both(M.full) },
  { id: "S2", title: "A rough band, the same hand for the same verse",
    how: "The same band redrawn as a filled shape whose edges drift a little, with a slight sag and tilt, a slanted start where the tip lands (the right, where a line begins) and a soft lift at the far end. The drift is seeded from the verse and its line, so a verse is drawn by the same hand on every visit and never shimmers. No library: a few hundred bytes of our own code.",
    pics: [pic(draw.S2(), "at reading size"), pic(draw.S2(), "close up", CLOSE)],
    measured: both(M.full) },
];
const INKS = [
  { id: "T1", title: "Flat ink",
    how: "One even amber inside the band, as today. On the rough band here, since that is the shape both researchers recommend; only the ink changes across these three.",
    pics: [pic(draw.T1(), "at reading size"), pic(draw.T1(), "close up", CLOSE)],
    measured: both(M.full) },
  { id: "T2", title: `Two passes of a ${pct(PASS)} pen, laid a little apart`,
    how: `The verse is always drawn twice: one pass a little high, one a little low, each with its own hand. Where they overlap the ink doubles, and the edges where they do not are the texture — the way a hand going over a line twice never lands exactly on the first stroke. No filter, so nothing for a phone to labour over, and nothing on the mark the size of a dot or a vowel sign.`,
    pics: [pic(draw.T2(), "at reading size"), pic(draw.T2(), "close up", CLOSE)],
    measured: `one pass ${both(M.pass(1))} · where the passes overlap ${both(M.pass(2))}` },
  { id: "T3", title: "Streaks along the line, made by a filter",
    how: `A fixed noise pattern, stretched along the line, thins the ink in long streaks the way a felt tip drags, never below ${pct(FIBRE_LO)} of a pass. The best-looking ink on a desk screen — and a browser filter, which both researchers' sources say is slow on a phone and which nobody has yet seen drawn on a real iPhone.`,
    pics: [pic(draw.T3(), "at reading size"), pic(draw.T3(), "close up", CLOSE)],
    measured: `fullest ${both(M.full)} · thinnest streak ${both(M.fibreLow)}` },
];
const OVERLAPS = [
  { id: "O1", title: "Today: two pens, the passage inked verse by verse",
    how: `What the app does now. A passage is the pen held at ${pct(HALF)}, drawn one verse at a time; the verse you are on, and a run of words, are the pen at full. Every band is blended in on its own, so a verse inside a passage goes a warm brown, and a word run inside a verse goes darker still. Where two verses of a passage share a line, their round ends meet and leave a notch of paper at the verse number.`,
    measured: `verse alone ${both(M.full)} · passage ${both(M.passage)} · verse in passage ${both(M.todayIn)} · words in verse ${both(M.todayRun)}` },
  { id: "O2", title: `One pen at ${pct(HALF)}, and every mark is one more pass`,
    how: `Researcher B's rule. There is one pen, held at half strength, and every mark is one pass of it: a passage is one pass, a verse inside it a second, a run of words inside that a third. Within one mark its own bands never double — only another mark does. A verse on its own is therefore one pass: lighter than today's verse, as light as today's passage.`,
    measured: `one pass ${both(M.half(1))} · two ${both(M.half(2))} · three ${both(M.half(3))}` },
  { id: "O3", title: `Counted passes at ${pct(PASS)}: the shade says how deep you are`,
    how: `Researcher A's rule. One pen at ${pct(PASS)}, and the number of passes is fixed by what a place is, not by how many marks happen to cross it. A passage is one pass. A verse is always two — on its own, and inside a passage, where the passage's pass counts as its first. A run of words inside the verse is a third. There is never a fourth, so pressing a verse again, or opening it from a link inside a passage you already swept, never darkens it further. The verse's two passes are laid a little apart, which is the texture of T2.`,
    measured: `passage (one pass) ${both(M.pass(1))} · verse (two) ${both(M.pass(2))} · words (three) ${both(M.pass(3))} · a fourth, if it were allowed ${both(M.pass(4))}` },
  { id: "O4", title: "A mark of another colour, blended in",
    how: `The passage in a second colour (verdigris, thinned to ${pct(THIN)}), the verse in amber over it; a word run in a third colour (indigo, thinned) over the amber verse. Where they cross, the colours mix as two inks would. The colours are stand-ins; which ones is not decided here.`,
    measured: `verdigris passage ${both(M.verd)} · amber verse on it ${both(M.amberOnVerd)} · indigo words on the verse ${both(M.indigoOnAmber)}` },
  { id: "O5", title: "A mark of another colour cuts itself out",
    how: "The same two colours, but the inner mark cuts its own shape, plus a hairline of paper, out of the outer. Nothing stacks, so every colour stays its own and the letters keep the contrast of a single mark. The join shows only as a thin line of paper, and only at the ends of lines.",
    measured: `verdigris passage ${both(M.verd)} · amber verse ${both(M.pass(2))} · indigo words ${both(M.indigo)}` },
];
const SCENES = ["the verse alone", "the verse inside a passage", "a run of six words inside the verse"];
const SCENE_BOX = [CROP_VERSE, CROP_PASSAGE, CROP_VERSE];
for (const o of OVERLAPS) o.pics = O[o.id]().map((overlay, i) => pic(overlay, SCENES[i], SCENE_BOX[i]));

const LIVE = [
  { id: "L1", live: "wipe", title: "The wipe: today's pen, and the rough band laid down the same way",
    how: "Press to lay the mark down again. Left: today's swipe, wiped in by the app's own animation. Right: the rough band, wiped in at the same speed. Leave it on 'the same hand' and the band redraws exactly; switch to 'a new hand each time' and every press is a different outline — the thing both researchers found a reader must never see.",
    measured: `the same timing on both: ${T.durInk} per line, ${T.staggerInk} between lines; off for readers who ask for less motion` },
  { id: "L2", live: "passes", title: "Another pass over the verse: counted against uncounted",
    how: "Each press lays one more pass of the pen over the verse. Left: counted — the verse stops at its depth of two. Right: uncounted — every press goes darker. Switch the pen between 50% and 60% to see the two researchers' strengths. Watch where the letters stop reading easily.",
    measured: `letters on the mark at 50%: one pass ${r1(letters(M.half(1)))} · two ${r1(letters(M.half(2)))} · three ${r1(letters(M.half(3)))} · four ${r1(letters(M.half(4)))} — at 60%: ${r1(letters(M.pass(1)))} · ${r1(letters(M.pass(2)))} · ${r1(letters(M.pass(3)))} · ${r1(letters(M.pass(4)))}` },
  { id: "L3", live: "hue", title: "A mark of another colour: blended in, or cut out",
    how: "The same two scenes as O4 and O5. Press to swap between the colours blending where they cross and the inner mark cutting itself out, without moving your eyes.",
    measured: `where they cross, blended: ${both(M.amberOnVerd)} · cut out, the verse keeps ${both(M.pass(2))}` },
];

// ── Cards ─────────────────────────────────────────────────────────────────────
const cardPics = (o) => o.pics.map(([overlay, label, box]) =>
  `<div class="pic">${crop(overlay, { label: `${o.id}: ${label}`, box })}<div class="piclabel">${esc(label)}</div></div>`).join("");
const card = (o, { wide = false } = {}) => `
  <figure class="opt${wide ? " wide" : ""}" data-option="${o.id}" id="option-${o.id}">
    <figcaption class="head"><span class="id">${o.id}</span><b>${esc(o.title)}</b></figcaption>
    <div class="pics">${cardPics(o)}</div>
    <div class="text"><p>${esc(o.how)}</p><p class="measured"><span>Measured</span> ${esc(o.measured)}</p></div>
  </figure>`;
const liveCard = (o) => {
  let pics = "", controls = "";
  if (o.live === "wipe") {
    pics = `<div class="pic live">${crop(todayWipe(), { label: "today's swipe, wiped in" })}<div class="piclabel">today's swipe</div></div>`
      + `<div class="pic live"><div class="variants">${Array.from({ length: HANDS }, (_, n) => `<div class="variant${n ? "" : " on"}">${crop(roughWipe(n), { label: `the rough band, hand ${n + 1}` })}</div>`).join("")}</div><div class="piclabel">the rough band</div></div>`;
    controls = `<div class="controls"><button type="button" class="press">Lay the mark down again</button><label><select class="hand"><option value="same">the same hand</option><option value="new">a new hand each time</option></select></label></div>`;
  } else if (o.live === "passes") {
    pics = ["counted (stops at the verse's depth)", "uncounted (every press darkens)"].map((label, i) =>
      `<div class="pic live" data-mode="${i ? "uncounted" : "counted"}">${crop(passStack(), { label })}<div class="piclabel">${label}</div></div>`).join("");
    controls = `<div class="controls"><button type="button" class="press">Another pass</button><button type="button" class="reset">Start again</button><label><select class="pen"><option value="${HALF}">pen at ${pct(HALF)}</option><option value="${PASS}" selected>pen at ${pct(PASS)}</option></select></label><span class="count" aria-live="polite"></span></div>`;
  } else {
    const v = liveHue();
    pics = [1, 2].map((i) => `<div class="pic"><div class="variants">${["blended", "cut"].map((k, j) =>
      `<div class="variant${j ? "" : " on"}" data-kind="${k}">${crop(v[k][i - 1], { label: `${SCENES[i]}, ${k === "cut" ? "cut out" : "blended"}`, box: SCENE_BOX[i] })}</div>`).join("")}</div><div class="piclabel">${SCENES[i]}</div></div>`).join("");
    controls = `<div class="controls"><button type="button" class="press">Show it cut out</button></div>`;
  }
  return `
  <figure class="opt wide" data-option="${o.id}" id="option-${o.id}" data-live="${o.live}" style="--pen:${PASS}">
    <figcaption class="head"><span class="id">${o.id}</span><b>${esc(o.title)}</b></figcaption>
    <div class="pics">${pics}</div>
    ${controls}
    <div class="text"><p>${esc(o.how)}</p><p class="measured"><span>Measured</span> ${esc(o.measured)}</p></div>
  </figure>`;
};

// ── The page ──────────────────────────────────────────────────────────────────
const row = (name, layers) => `<tr><td>${esc(name)}</td><td class="n">${r1(letters(layers))}</td><td class="n">${r1(vsPaper(layers))}</td></tr>`;
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
  .grid.wide { grid-template-columns: 1fr; }
  .opt { margin: 0; background: ${T.paperRaised}; border: 1px solid ${T.hairline}; border-radius: ${T.radiusMd};
    padding: 12px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .head { display: flex; align-items: center; gap: 10px; }
  .head b { font-size: 1.02rem; }
  .id { flex: 0 0 auto; min-width: 28px; height: 28px; padding: 0 6px; border-radius: 14px; background: ${INK_SEL}; color: #3a2a08;
    font-weight: 700; font-size: 0.85rem; display: grid; place-items: center; }
  .pics { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
  .pic { max-width: 100%; }
  .leaf { display: block; background: ${T.paperRaised}; border: 1px solid ${T.hairline}; border-radius: 4px; max-width: 100%; height: auto; }
  .shot { display: block; max-width: 100%; height: auto; border: 1px solid ${T.hairline}; border-radius: 4px; }
  .piclabel { font-size: 0.78rem; color: ${T.inkFaint}; margin-top: 4px; text-align: center; }
  .text p { margin: 4px 0; color: ${T.inkSoft}; font-size: 0.92rem; }
  .text span { font-weight: 600; color: ${T.ink}; }
  .measured { font-variant-numeric: tabular-nums; }
  .controls { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
  .count { font-size: 0.85rem; color: ${T.inkSoft}; font-variant-numeric: tabular-nums; }
  button, select { font: inherit; font-size: 0.9rem; padding: 6px 12px; border-radius: 8px; border: 1px solid ${T.hairline};
    background: ${T.paper}; color: ${T.ink}; cursor: pointer; }
  button:hover { border-color: ${INK_SEL}; }
  .variant { display: none; } .variant.on { display: block; }
  /* The app's wipe: dash = the stroke's length, offset animated to 0, one line after the next. */
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
  /* Asked for more contrast: the one filtered ink goes flat. */
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
  @media (max-width: 600px) { main { padding: ${T.space3}px 16px 64px; } .grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<svg class="defs" aria-hidden="true" width="0" height="0" style="position:absolute"><defs>${FILTERS}</defs><symbol id="p${PAGE}" viewBox="0 0 ${VBW} ${VBH}">${INNER}</symbol></svg>
<main>
  <h1>Could the mark look like a real highlighter: rough at the edges, and darker where two marks stack?</h1>
  <p class="lede">Two shapes, three inks and five rules for where one mark lands inside another, drawn on the same real
    page (page 42: the end of 2:254, the Throne Verse 2:255, the start of 2:256) at the width a phone gives the
    page. Where the difference only shows in motion, it is live, with a button. This page was built from two
    independent researchers' pages after their claims were re-checked; the losers from both are folded into the
    record, one line each.</p>
  <p class="site">This page on the site: <a href="${SITE}">${SITE.replace("https://", "")}</a></p>

  <div class="short">
    <b>The short version</b>
    <ol>
      <li><b>Shape</b> is the outline the pen leaves. <b>Ink</b> is what happens inside it. <b>Overlap</b> is what
        happens where a verse sits inside a passage, or a run of words inside a verse.</li>
      <li>Every overlap rule is drawn three times: the verse alone, the verse inside a passage, six words inside the
        verse. The verse alone is where the two researchers' rules part company.</li>
      <li>Under each: how well the letters read on the mark (4.5:1 is the reading floor) and how the mark stands
        against the paper (3:1 is the floor for a "you are here" sign) — one method for every figure on this page.</li>
      <li>The record says which is recommended and why, with the pros, the cons and what each commits us to.</li>
    </ol>
  </div>

  <div class="note"><b>What was settled before.</b> Marks are drawn per line, never as one box around the run; the
    mark is blended into the print so the letters stay black; a reader may choose swipe, fill or outline and a
    strength in a few named steps. None of that is re-asked here.</div>

  <h2>What does the app do today?</h2>
  <p class="lede">The real app, on a phone, with the passage 2:254 to 2:256 open from a link and the passage menu
    still up. The passage is inked one verse at a time, so where one verse ends and the next begins on the same
    line, the two bands' round ends leave a notch of paper at the verse number. The picture on the right is the
    same screen, close up on that row. Below them, the same thing drawn by this page.</p>
  <div class="pics">
    <div class="pic"><img class="shot" src="${PICS}/app-today.png" width="390" alt="The real app on a phone: page 42 with the passage 2:254 to 2:256 in light amber, the passage menu open at the bottom"/><div class="piclabel">the app, phone width</div></div>
    <div class="pic"><img class="shot" src="${PICS}/app-today-close.png" width="390" alt="Close up of one row of the same screen: the passage band stops to the right of the verse number and starts again to its left, leaving paper around the number"/><div class="piclabel">the same screen, close up on the row where 2:254 ends</div></div>
    <div class="pic">${crop(draw.todayPassage(), { label: "today, drawn: the passage verse by verse with the verse on top", box: CROP_PASSAGE })}<div class="piclabel">today, drawn by this page</div></div>
    <div class="pic">${crop(draw.todayPassage(), { label: "today, drawn, close up on the notch", box: SEAM, width: 300 })}<div class="piclabel">the notch, drawn, close up</div></div>
  </div>

  <h2>What shape does the pen leave?</h2>
  <p class="lede">Same verse, same amber, one pass, flat ink. Only the outline changes.</p>
  <div class="grid">${SHAPES.map((o) => card(o)).join("")}</div>

  <h2>What does the ink do inside the shape?</h2>
  <p class="lede">Same verse, the rough band. Only the ink changes.</p>
  <div class="grid">${INKS.map((o) => card(o)).join("")}</div>

  <h2>What happens where two marks overlap?</h2>
  <p class="lede">The rough band throughout (except O1, which is the app as it is). Left: the verse alone. Middle: the
    verse inside a passage swept across all three verses. Right: six words across a line break inside the verse.</p>
  <div class="grid wide">${OVERLAPS.map((o) => card(o, { wide: true })).join("")}</div>

  <h2>What does it feel like when the mark goes down?</h2>
  <div class="grid wide">${LIVE.map(liveCard).join("")}</div>

  <h2>What was measured?</h2>
  <p class="lede">The print's ink is ${GLYPH}; the paper is ${T.paperRaised}; on plain paper the letters read at
    ${r1(M.paper)}. The amber is ${INK_SEL}, the verdigris ${ACCENT}, the indigo ${MISTAKE}. Every figure is computed
    from the app's own colour values and the blend each option uses, not sampled from screenshots — and every figure
    uses one method: the letters as they sit under the mark, against the paper under the same mark.</p>
  <table>
    <tr><th>Mark</th><th>Letters on it</th><th>It against paper</th></tr>
    ${row("Today's verse (one full pass)", M.full)}
    ${row("Today's passage (half strength)", M.passage)}
    ${row("Today's verse inside a passage", M.todayIn)}
    ${row("Today's word run inside the verse", M.todayRun)}
    ${row(`One pass at ${pct(HALF)}`, M.half(1))}
    ${row(`Two passes at ${pct(HALF)}`, M.half(2))}
    ${row(`Three passes at ${pct(HALF)}`, M.half(3))}
    ${row(`Four passes at ${pct(HALF)}`, M.half(4))}
    ${row(`One pass at ${pct(PASS)}`, M.pass(1))}
    ${row(`Two passes at ${pct(PASS)}`, M.pass(2))}
    ${row(`Three passes at ${pct(PASS)}`, M.pass(3))}
    ${row(`Four passes at ${pct(PASS)}`, M.pass(4))}
    ${row("Thinnest streak of the filtered ink", M.fibreLow)}
    ${row(`Verdigris passage at ${pct(THIN)}`, M.verd)}
    ${row("Amber verse on the verdigris passage, blended", M.amberOnVerd)}
    ${row(`Indigo word run at ${pct(THIN)}`, M.indigo)}
    ${row("Indigo word run on the amber verse, blended", M.indigoOnAmber)}
  </table>
  <p class="note">The floors are the web accessibility guideline's: 4.5:1 for text on its background, and 3:1 for the
    visual sign of a selected state against what is next to it. No wash on this page reaches 3:1 against the paper —
    today's included — and every one is found by its size, not its contrast. Where an ink varies, the figure is its
    worst point. If a device asks for more contrast, the one filtered ink goes flat; if it asks for less motion,
    nothing wipes or moves.</p>

  <footer>
    Drawn by <code>scripts/build-highlight-texture-options.mjs</code> from page ${PAGE}'s shipped verse boxes, word
    boxes and outlined print, the app's own pen (<code>packages/core/dist/ink.js</code>) and colours
    (<code>apps/web/src/styles/tokens.css</code>); line height ${LINE_H} units. The record it belongs to is
    <code>docs/design/highlight-texture-options.md</code>; the two researcher pages it was built from are
    <code>highlight-texture-options-a.html</code> and <code>highlight-texture-options-b.html</code> beside it. The
    pictures the record embeds are cut from this page by <code>scripts/shoot-highlight-texture-options.mjs</code>; the
    two screenshots of the app were taken with <code>apps/web/e2e/tools/drive.mjs</code> against the built app. No
    Qur'an text: the print is outlined paths and the marks are shapes, never words.
  </footer>
</main>
<script>
(() => {
  const wipe = (el) => { el.classList.remove("go"); void el.getBoundingClientRect(); el.classList.add("go"); };
  // L1: lay the mark down again — the rough band with the same hand, or the next one.
  for (const fig of document.querySelectorAll('[data-live="wipe"]')) {
    const lives = [...fig.querySelectorAll(".live")], vs = [...fig.querySelectorAll(".variant")], sel = fig.querySelector(".hand");
    let n = 0;
    fig.querySelector(".press").addEventListener("click", () => {
      if (sel.value === "new") { vs[n].classList.remove("on"); n = (n + 1) % vs.length; vs[n].classList.add("on"); }
      lives.forEach(wipe);
    });
    lives.forEach(wipe);
  }
  // L2: another pass, counted (capped at the verse's depth) or uncounted; the pen at either strength.
  for (const fig of document.querySelectorAll('[data-live="passes"]')) {
    const pics = [...fig.querySelectorAll(".live")], count = fig.querySelector(".count"), pen = fig.querySelector(".pen");
    const DEPTH = 2, MAX = 4;
    let n = 0;
    const show = () => {
      for (const p of pics) {
        const shown = p.dataset.mode === "counted" ? Math.min(n, DEPTH) : Math.min(n, MAX);
        p.querySelectorAll(".pass").forEach((g) => {
          const k = Number(g.dataset.pass), was = g.classList.contains("on");
          g.classList.toggle("on", k <= shown);
          if (k <= shown && !was) wipe(p);
        });
      }
      count.textContent = n + (n === 1 ? " press" : " presses") + " · counted shows " + Math.min(n, DEPTH) + ", uncounted " + Math.min(n, MAX);
    };
    fig.querySelector(".press").addEventListener("click", () => { n = Math.min(MAX, n + 1); show(); });
    fig.querySelector(".reset").addEventListener("click", () => { n = 0; show(); });
    pen.addEventListener("change", () => { fig.style.setProperty("--pen", pen.value); });
    n = 3; show();
  }
  // L3: blended or cut out, swapped in place.
  for (const fig of document.querySelectorAll('[data-live="hue"]')) {
    const btn = fig.querySelector(".press");
    let cut = false;
    btn.addEventListener("click", () => {
      cut = !cut;
      fig.querySelectorAll(".variant").forEach((v) => v.classList.toggle("on", (v.dataset.kind === "cut") === cut));
      btn.textContent = cut ? "Show it blended" : "Show it cut out";
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
console.log(`build-highlight-texture-options: wrote ${OUT} (${kb} KB, 0 Arabic, ${SHAPES.length} shapes, ${INKS.length} inks, ${OVERLAPS.length} overlap rules, ${LIVE.length} live; line height ${LINE_H})`);
console.log(`  passage today ${passageToday.length} bands, joined ${passageSwipes.length} · run of ${RUN.length} words over ${runSwipes.length} lines`);
for (const o of [...OVERLAPS, ...INKS]) console.log(`  ${o.id} ${o.measured}`);
