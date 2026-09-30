#!/usr/bin/env node
/**
 * Render docs/design/highlight-options.html — the wider menu of ways the app
 * could mark the verse you are on, drawn on the real page 42 (the Throne Verse,
 * 2:255) at the width a phone gives the page, so a reader decides by looking.
 *
 * The earlier record (docs/decisions/highlight-style.md, page 7, 2:48) settled
 * that a reader may choose among the swipe, a fill and an outline, and tune the
 * strength in named steps. This page does not re-ask that. It draws what that
 * record did not: the strokes it never drew, colours other than amber, the
 * tajweed skin underneath, and the *behaviours* — per line or one shape, blend
 * mode, wipe or static, a verse across two pages, marks colliding, fading or
 * staying. Where the difference is felt rather than seen (the wipe, the fade,
 * the half-second find) the option is mounted live with a button.
 *
 * Strokes, A–K (the same verse, the same crop, only the mark changes):
 *   A swipe (today)      B one polygon wash   C underline    D dashed underline
 *   E outline            F margin bar         G badge only   H per-word pills
 *   I hand-drawn swipe   J verdigris and grey K on the tajweed skin
 * Approaches, P1–P7:
 *   P1 per line vs one polygon   P2 multiply vs plain alpha   P3 wipe vs static (live)
 *   P4 a verse across two pages  P5 next to other marks       P6 fades vs stays (live)
 *   P7 the half-second test (live)
 *
 * The swipes are made by the app's OWN pen (packages/core/dist/ink.js) and the
 * tajweed washes by its own rule order (packages/core/dist/skins.js) —
 * imported, not copied, so nothing here can drift from the app. Same approach
 * as scripts/build-highlight-style-options.mjs: the print's outlined leaf as a
 * <symbol>, its shipped verse and word boxes, and the app's colour tokens.
 *
 * ── What it reads (committed bytes only) ────────────────────────────────────
 *   apps/web/public/assets/manifest.json                    the print's viewBox
 *   apps/web/public/assets/pages/hafs-kfqc/{42,43}.svg      the outlined leaves and their verse boxes
 *   apps/web/public/assets/pages/hafs-kfqc/*.svg            counted once: does any verse span two pages?
 *   apps/web/public/assets/words/hafs-kfqc/42.json          the shipped word boxes
 *   apps/web/public/assets/skins/hafs-kfqc/tajweed/{rules,2}.json   the tajweed rules on these verses
 *   apps/web/src/styles/tokens.css                          the app's real colours and timings
 *   packages/core/dist/{ink,skins}.js                       the app's pen and rule order (build core first)
 *
 * ── No Qur'an ───────────────────────────────────────────────────────────────
 * The print is outlined paths with zero Arabic codepoints; every mark is an SVG
 * shape over the leaf, never text. The writer refuses if the output carries an
 * Arabic codepoint or a <text> element.
 *
 *   node scripts/build-highlight-options.mjs
 *   node scripts/shoot-highlight-options.mjs        the PNGs the record embeds
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const ASSETS = join(ROOT, "apps/web/public/assets");
const MANIFEST = join(ASSETS, "manifest.json");
const PAGE_SVG = (n) => join(ASSETS, "pages/hafs-kfqc", `${n}.svg`);
const WORDS = join(ASSETS, "words/hafs-kfqc/42.json");
const TJ_RULES = join(ASSETS, "skins/hafs-kfqc/tajweed/rules.json");
const TJ_SHARD = join(ASSETS, "skins/hafs-kfqc/tajweed/2.json");
const TOKENS_CSS = join(ROOT, "apps/web/src/styles/tokens.css");
const INK = join(ROOT, "packages/core/dist/ink.js");
const SKINS = join(ROOT, "packages/core/dist/skins.js");
const OUT = join(ROOT, "docs/design/highlight-options.html");
const SITE = "https://blog.bytesofpurpose.com/hifth/docs/design/highlight-options.html";

const die = (msg) => { console.error(`build-highlight-options: ${msg}`); process.exit(1); };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f1 = (n) => Number(n).toFixed(1);

for (const f of [INK, SKINS]) if (!existsSync(f)) die(`the pen is not built — ${f} is missing. Run \`pnpm --filter @hifth/core build\` first.`);
const { swipesFromPath, rectsFromPath, pageLineHeight } = await import(INK);
const { TAJWEED_RULES } = await import(SKINS);

// ── The pages ─────────────────────────────────────────────────────────────────
const PAGE = 42;
const NEXT = 43;
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
  // One <path id="verse-N" d="…" ayah="…" surah="…"> per verse on the page.
  const polygons = new Map();
  for (const m of raw.matchAll(/<path\b[^>]*\bid="verse-\d+"[^>]*>/g)) {
    const d = m[0].match(/\bd="([^"]*)"/)?.[1];
    const ayah = m[0].match(/\bayah="(\d+)"/)?.[1];
    const surah = m[0].match(/\bsurah="(\d+)"/)?.[1];
    if (d && ayah && surah) polygons.set(`${surah}:${ayah}`, d);
  }
  const lineH = pageLineHeight(polygons.values()) ?? die(`page ${n}: no line height`);
  const dOf = (ref) => polygons.get(ref) ?? die(`no verse box for ${ref} on page ${n}`);
  // One rectangle per printed line the verse occupies — the app's own split of
  // a box the print fused across several lines.
  const lines = (ref) => (rectsFromPath(dOf(ref)) ?? die(`${ref} is not a rectangle run`)).flatMap((r) => {
    const k = Math.max(1, Math.round(r.height / lineH));
    const h = r.height / k;
    return Array.from({ length: k }, (_, i) => ({ x: r.x, y: r.y + i * h, w: r.width, h }));
  });
  const swipes = (ref) => swipesFromPath(dOf(ref), lineH) ?? die(`${ref}: the pen declined`);
  return { n, inner, polygons, lineH, dOf, lines, swipes, refs: [...polygons.keys()] };
}
const P42 = loadPage(PAGE);
const P43 = loadPage(NEXT);
const LINE_H = P42.lineH;

// The verse's words, pause marks left out (they are boxes too, but not words).
const wordShard = JSON.parse(readFileSync(WORDS, "utf8"));
const entry = wordShard.words?.[VERSE] ?? die(`no word boxes for ${VERSE}`);
const marks = new Set(entry.marks ?? []);
const WORD_BOXES = entry.boxes
  .map(([x, y, w, h], i) => ({ x, y, w, h, i: entry.from + i }))
  .filter((b) => !marks.has(b.i));

// Is any verse printed on two pages? Counted over the whole print, so the
// two-page question is answered by the corpus rather than assumed.
const PLACEMENTS = (() => {
  const seen = new Map();
  for (let n = 1; n <= 604; n++) {
    const f = PAGE_SVG(n);
    if (!existsSync(f)) continue;
    for (const m of readFileSync(f, "utf8").matchAll(/\bid="verse-(\d+)"/g)) seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
  }
  const split = [...seen.values()].filter((c) => c > 1).length;
  return { verses: seen.size, split };
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
const INK_SEL = token("ink-sel");           // the pen at full strength (multiplied)
const INK_RANGE = token("ink-range");       // the same pen held lighter (multiplied)
const WASH = token("highlight-wash");       // the 24% wash, composited over
const RING = token("highlight-ring");       // the outline colour
const ACCENT = token("accent");             // verdigris — navigation, and the hop crumb
const MISTAKE = token("diff-mark");         // the comparison panel's indigo, standing in for a mistake mark
const MISTAKE_WASH = token("diff-mark-wash");
const GREY = "#8f877b";                     // a stand-in: no grey pen exists in the tokens
const THIN = 0.45;                          // how far a dark hue must be thinned to leave the letters readable
const GLYPH = "#231f20";                    // the print's ink, read off the page's paths
const TJ = {
  wash: Number(token("tj-wash")), stroke: Number(token("tj-stroke")),
  colour: Object.fromEntries(TAJWEED_RULES.map((r) => [r.id, token(`tj-${r.id}`)])),
  dash: Object.fromEntries(TAJWEED_RULES.map((r) => [r.id, token(`tj-dash-${r.id}`)])),
};

// The tajweed skin's leading family per verse: the most distinctive rule present.
const tjRules = JSON.parse(readFileSync(TJ_RULES, "utf8"));
const familyOf = new Map(tjRules.rules.map((r) => [r.id, r.family]));
const salience = new Map(TAJWEED_RULES.map((r) => [r.id, r.salience]));
const tjShard = JSON.parse(readFileSync(TJ_SHARD, "utf8"));
function leadingFamily(ref) {
  const ayah = ref.split(":")[1];
  const rules = tjShard[ayah] ?? {};
  let best = null;
  for (const id of Object.keys(rules)) {
    const fam = familyOf.get(id);
    if (fam && (best === null || salience.get(fam) > salience.get(best))) best = fam;
  }
  return best;
}

// ── Measured: what the letters read at, on each mark ─────────────────────────
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
const over = (top, a, under) => top.map((t, i) => Math.round(t * a + under[i] * (1 - a)));
const multiply = (pen, a, under) => under.map((u, i) => Math.round(u * (1 - a) + (u * pen[i] / 255) * a));
const r1 = (n) => `${n.toFixed(1)}:1`;

const PAPER = rgb(T.paperRaised);
const GLYPH_RGB = rgb(GLYPH);
const amber = rgb(INK_SEL);
const bg = {
  swipe: multiply(amber, 1, PAPER),
  range: multiply(amber, alphaOf(INK_RANGE), PAPER),
  wash: over(rgb(WASH), alphaOf(WASH), PAPER),
  verdigris: multiply(rgb(ACCENT), THIN, PAPER),
  grey: multiply(rgb(GREY), THIN, PAPER),
  alpha: over(amber, 0.55, PAPER),
  tjIdgham: over(rgb(TJ.colour.idgham), TJ.wash, PAPER),
};
const M = {
  inkOnPaper: contrast(GLYPH_RGB, PAPER),
  inkOnSwipe: contrast(GLYPH_RGB, bg.swipe),
  swipeOnPaper: contrast(bg.swipe, PAPER),
  inkOnRange: contrast(GLYPH_RGB, bg.range),
  inkOnBoth: contrast(GLYPH_RGB, multiply(amber, 1, bg.range)),
  rangeOnPaper: contrast(bg.range, PAPER),
  inkOnWash: contrast(GLYPH_RGB, bg.wash),
  washOnPaper: contrast(bg.wash, PAPER),
  ringOnPaper: contrast(over(rgb(RING), alphaOf(RING), PAPER), PAPER),
  inkOnVerdigris: contrast(GLYPH_RGB, bg.verdigris),
  verdigrisOnPaper: contrast(bg.verdigris, PAPER),
  inkOnVerdigrisFull: contrast(GLYPH_RGB, multiply(rgb(ACCENT), 1, PAPER)),
  inkOnGrey: contrast(GLYPH_RGB, bg.grey),
  greyOnPaper: contrast(bg.grey, PAPER),
  inkOnAlpha: contrast(over(amber, 0.55, GLYPH_RGB), bg.alpha),
  alphaOnPaper: contrast(bg.alpha, PAPER),
  inkOnSwipeOverTajweed: contrast(GLYPH_RGB, multiply(amber, 1, bg.tjIdgham)),
  washOverTajweedOnTajweed: contrast(over(rgb(WASH), alphaOf(WASH), bg.tjIdgham), bg.tjIdgham),
};

// ── The crop: the verse and its neighbours ────────────────────────────────────
// The verse starts mid-line after 2:254 ends and 2:256 begins on its last line,
// so the crop keeps both neighbours whole enough to see what each mark does to
// them. x reaches into the outer margin so the margin bar has somewhere to sit.
const verseLines = P42.lines(VERSE);
const verseSwipes = P42.swipes(VERSE);
const CROP = (() => {
  const top = Math.min(...P42.lines("2:254").map((l) => l.y)) - 4;
  const bottom = Math.max(...P42.lines("2:256").map((l) => l.y + l.h)) + 4;
  return { x: -16, y: top, w: VBW + 20, h: bottom - top };
})();
const WIDTH = 358; // the page's width on a 390 px phone with the app's gutters — reading size on a phone

const swipe = (s, stroke, extra = "") =>
  `<line x1="${f1(s.x2)}" y1="${f1(s.y)}" x2="${f1(s.x1)}" y2="${f1(s.y)}" stroke="${stroke}" stroke-width="${f1(s.width)}" stroke-linecap="round" style="mix-blend-mode:multiply"${extra}/>`;
const verseD = P42.dOf(VERSE);
const lastLine = verseLines[verseLines.length - 1];
// The verse-number ornament sits at the far (left) end of the verse's last
// line, between the verse's leftmost word and where the next verse begins.
const BADGE = (() => {
  const onLast = WORD_BOXES.filter((b) => b.y + b.h / 2 > lastLine.y && b.y + b.h / 2 < lastLine.y + lastLine.h);
  const leftmostWord = Math.min(...onLast.map((b) => b.x));
  return { cx: (lastLine.x + leftmostWord) / 2, cy: lastLine.y + lastLine.h / 2, r: (leftmostWord - lastLine.x) / 2 + 1 };
})();
// A deterministic wobble for the hand-drawn swipe — the same picture every build.
const wobble = (() => { let s = 7; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 - 0.5; }; })();
const tajweedLayer = (page, refs) => refs.map((ref) => {
  const fam = leadingFamily(ref);
  if (!fam) return "";
  const c = TJ.colour[fam];
  return `<path d="${page.dOf(ref)}" fill="${c}" fill-opacity="${TJ.wash}" stroke="${c}" stroke-width="${TJ.stroke}" stroke-dasharray="${TJ.dash[fam]}" stroke-linejoin="round"/>`;
}).join("");

const draw = {
  // A — today. The app's own swipes, the app's own colour, the app's own blend.
  swipe: (stroke = INK_SEL) => verseSwipes.map((s) => swipe(s, stroke)).join(""),
  // B — the verse's own box, as one shape, washed and ringed: the app's fallback rule.
  polygon: () => `<path d="${verseD}" fill="${WASH}" stroke="${RING}" stroke-width="1.2" stroke-linejoin="round"/>`,
  // C / D — a rule under each line, solid or dashed.
  underline: (dash = "") => verseLines.map((l) =>
    `<line x1="${f1(l.x + 1.5)}" y1="${f1(l.y + l.h - 3)}" x2="${f1(l.x + l.w - 1.5)}" y2="${f1(l.y + l.h - 3)}" stroke="${INK_SEL}" stroke-width="1.6" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ""} style="mix-blend-mode:multiply"/>`).join(""),
  // E — the verse's own box, outlined, nothing inside.
  outline: () => `<path d="${verseD}" fill="none" stroke="${RING}" stroke-width="1.2" stroke-linejoin="round"/>`,
  // F — a bar in the outer margin, spanning the verse's lines.
  margin: () => {
    const top = Math.min(...verseLines.map((l) => l.y)) + 3;
    const bottom = Math.max(...verseLines.map((l) => l.y + l.h)) - 3;
    return `<rect x="-10.5" y="${f1(top)}" width="3.6" height="${f1(bottom - top)}" rx="1.8" fill="${INK_SEL}"/>`;
  },
  // G — the verse-number ornament tinted, nothing on the words.
  badge: () => `<circle cx="${f1(BADGE.cx)}" cy="${f1(BADGE.cy)}" r="${f1(BADGE.r)}" fill="${INK_SEL}" style="mix-blend-mode:multiply"/>`,
  // H — each word its own pill.
  pills: () => WORD_BOXES.map((b) =>
    `<rect x="${f1(b.x - 1)}" y="${f1(b.y - 1)}" width="${f1(b.w + 2)}" height="${f1(b.h + 2)}" rx="4" fill="${WASH}"/>`).join(""),
  // I — a hand-drawn swipe: the same bands, with a wobbling edge and a tapered start.
  hand: () => verseSwipes.map((s) => {
    const half = s.width / 2, step = 7;
    const left = Math.min(s.x1, s.x2), right = Math.max(s.x1, s.x2);
    const top = [], bottom = [];
    for (let x = right; x >= left; x -= step) {
      const t = (right - x) / (right - left);
      const taper = 1 - 0.22 * Math.abs(t - 0.5) * 2;   // fuller in the middle, thinner at the ends
      top.push(`${f1(x)} ${f1(s.y - half * taper + wobble() * 2.2)}`);
      bottom.push(`${f1(x)} ${f1(s.y + half * taper + wobble() * 2.2)}`);
    }
    return `<path d="M${top.join("L")}L${bottom.reverse().join("L")}Z" fill="${INK_SEL}" fill-opacity="0.92" stroke="${INK_SEL}" stroke-width="0.6" stroke-linejoin="round" style="mix-blend-mode:multiply"/>`;
  }).join(""),
  // J — the same swipe in verdigris and in grey, thinned so the letters survive.
  verdigris: () => draw.swipe(`rgba(${rgb(ACCENT).join(", ")}, ${THIN})`),
  grey: () => draw.swipe(`rgba(${rgb(GREY).join(", ")}, ${THIN})`),
  // K — the tajweed skin underneath (its own colours, its own dash rings), then the mark.
  tajweedSwipe: () => tajweedLayer(P42, ["2:253", "2:254", "2:255", "2:256"]) + draw.swipe(),
  tajweedWash: () => tajweedLayer(P42, ["2:253", "2:254", "2:255", "2:256"]) + draw.polygon(),
  // P1 — the pen as one slab: the verse's box filled with the same ink, no lines.
  slab: () => `<path d="${verseD}" fill="${INK_SEL}" style="mix-blend-mode:multiply"/>`,
  // P2 — the swipe laid over the print with plain transparency instead of multiply.
  alpha: () => verseSwipes.map((s) =>
    `<line x1="${f1(s.x2)}" y1="${f1(s.y)}" x2="${f1(s.x1)}" y2="${f1(s.y)}" stroke="rgba(${amber.join(", ")}, 0.55)" stroke-width="${f1(s.width)}" stroke-linecap="round"/>`).join(""),
  // P3 — the swipe wired for the app's wipe: dash = length, offset animated to 0, right to left.
  wipe: () => verseSwipes.map((s, i) => {
    const len = Math.abs(s.x2 - s.x1);
    return swipe(s, INK_SEL, ` class="pen" style="mix-blend-mode:multiply;--len:${f1(len)};--i:${i}"`);
  }).join(""),
  // P5 — the marks the app already draws, all at once: the crumb (where you
  // hopped from), a passage, the selected verse, and a mistake mark on one word.
  // Today the passage's pen is laid under the selected verse too (they stack).
  // With a second hue that stacking multiplies to mud, so the passage leaves
  // the selected verse out — which is what the app would have to do.
  collide: (passage, aroundSel = false) => {
    const crumb = `<path d="${P42.dOf("2:253")}" fill="none" stroke="${ACCENT}" stroke-width="1" stroke-dasharray="3 2" opacity="0.8" stroke-linejoin="round"/>`;
    const swept = aroundSel ? RANGE.filter((r) => r !== VERSE) : RANGE;
    const range = swept.flatMap((r) => P42.swipes(r).map((s) => swipe(s, passage))).join("");
    const w = WORD_BOXES[Math.floor(WORD_BOXES.length * 0.45)];
    const mistake = `<rect x="${f1(w.x - 1)}" y="${f1(w.y - 1)}" width="${f1(w.w + 2)}" height="${f1(w.h + 2)}" rx="1.5" fill="${MISTAKE_WASH}" stroke="${MISTAKE}" stroke-width="0.9"/>`;
    return crumb + range + draw.swipe() + mistake;
  },
};

function crop(overlay, { width = WIDTH, label = "", box = CROP, page = P42 } = {}) {
  const height = Math.round((width * box.h) / box.w);
  return `<svg viewBox="${f1(box.x)} ${f1(box.y)} ${f1(box.w)} ${f1(box.h)}" width="${width}" height="${height}" role="img" aria-label="${esc(label)}" class="leaf"><use href="#p${page.n}" width="${VBW}" height="${VBH}"/><g>${overlay}</g></svg>`;
}

// P4 — a passage across the gutter: 2:255 selected, 2:256–2:258 swept, on two leaves.
// Each leaf at the same phone width as every other crop: on a phone the two
// leaves are never side by side, you turn the page between them.
const SPREAD = (() => {
  const l42 = [VERSE, "2:256"].flatMap((r) => P42.lines(r));
  const a = { x: -16, y: Math.min(...l42.map((l) => l.y)) - 4, w: VBW + 20, h: 0 };
  a.h = Math.max(...l42.map((l) => l.y + l.h)) + 4 - a.y;
  const l43 = ["2:257", "2:258"].flatMap((r) => P43.lines(r));
  const b = { x: -16, y: Math.min(...l43.map((l) => l.y)) - 4, w: VBW + 20, h: 0 };
  b.h = Math.max(...l43.map((l) => l.y + l.h)) + 4 - b.y;
  const left = crop(P42.swipes("2:256").map((s) => swipe(s, INK_RANGE)).join("") + draw.swipe(), { box: a, label: "page 42: the verse and the passage's start" });
  const right = crop(["2:257", "2:258"].flatMap((r) => P43.swipes(r)).map((s) => swipe(s, INK_RANGE)).join(""), { box: b, page: P43, label: "page 43: the passage continues" });
  return `<div class="pics"><div class="pic">${right}<div class="piclabel">page 43 (the left leaf) — the passage continues through 2:257 and 2:258</div></div><div class="pic">${left}<div class="piclabel">page 42 (the right leaf) — the verse, and the passage's start in 2:256</div></div></div>`;
})();

// ── The strokes ───────────────────────────────────────────────────────────────
const STROKES = [
  {
    id: "A", title: "The marker swipe — what the app draws today",
    how: "One round-capped amber band along each line of the verse, blended into the print like a felt-tip. The letters stay black.",
    hafiz: "Found in well under half a second. The amber sits on the letters and their vowel marks, but they stay black under it.",
    pros: "Loudest mark on the page; already built, tested and animated.",
    cons: "Covers the vowel marks with a tint; the amber alone is under the 3:1 indicator floor and is seen by its size.",
    commits: "Nothing new. The settings' wash description should be corrected to match.",
    measured: `letters on the mark ${r1(M.inkOnSwipe)} · mark against paper ${r1(M.swipeOnPaper)}`,
    pics: [["swipe", "A — today"]],
  },
  {
    id: "B", title: "One translucent wash over the verse's own shape",
    how: "The verse's box — the shape the print gives it, spanning its lines — filled at about a quarter strength with a thin ring. This is exactly what the app falls back to on a page it cannot read as lines.",
    hafiz: "Gentle; the verse reads through it. The lines merge into one pale slab, and it is easy to miss at arm's length.",
    pros: "What most other apps do; one shape, cheap to draw; already exists as the fallback.",
    cons: "Barely visible against the paper (1.2:1); the slab hides the line rhythm.",
    commits: "Promoting the fallback to the default and making the swipe the fallback instead.",
    measured: `letters on the wash ${r1(M.inkOnWash)} · wash against paper ${r1(M.washOnPaper)}`,
    pics: [["polygon", "B — one wash, one shape"]],
  },
  {
    id: "C", title: "A rule under each line",
    how: "A thin amber line beneath each line of the verse, at the foot of the line. Nothing is laid over the letters.",
    hafiz: "Quiet; the letters are untouched. You have to look for it, and six lines is six rules to count.",
    pros: "Nothing on the letters or vowel marks.",
    cons: "Runs where the tails of the letters and the lower vowel marks already are; hard to find at a glance.",
    commits: "A new drawing branch and a re-thought wipe; it would likely need to be bolder to be found, which undoes its quietness.",
    measured: `letters on the paper ${r1(M.inkOnPaper)} · rule against paper ${r1(M.swipeOnPaper)}`,
    pics: [["underline", "C — a rule under each line"]],
  },
  {
    id: "D", title: "A dashed rule under each line",
    how: "The same rule, broken into dashes — the way the app already draws the crumb of where you hopped from.",
    hafiz: "Even quieter than the solid rule; reads as a note rather than a mark.",
    pros: "Lightest touch that still shows the extent; a dashed line is already the app's vocabulary for a secondary mark.",
    cons: "Easier still to miss; dashes under a dotted script add visual noise.",
    commits: "Only sensible as a secondary mark (a passage, a crumb), not as the mark for the verse you are on.",
    measured: `letters on the paper ${r1(M.inkOnPaper)} · rule against paper ${r1(M.swipeOnPaper)}`,
    pics: [["underline:3 2.2", "D — a dashed rule"]],
  },
  {
    id: "E", title: "An outline around the verse",
    how: "The verse's own shape, outlined in amber, nothing inside.",
    hafiz: "The letters are untouched and the extent is exact, but the frame cuts across the neighbours' words on the shared first and last lines and is faint on its own.",
    pros: "Exact extent; nothing on the text.",
    cons: "A stepped frame around a mid-line verse looks odd; the ring is 1.8:1 against the paper — hard to find at arm's length.",
    commits: "Already one of the three shapes the earlier record lets a reader pick; nothing new to build.",
    measured: `letters on the paper ${r1(M.inkOnPaper)} · frame against paper ${r1(M.ringOnPaper)}`,
    pics: [["outline", "E — an outline"]],
  },
  {
    id: "F", title: "A bar in the margin",
    how: "A short amber bar in the outer margin, beside the lines the verse occupies. Nothing on the text at all.",
    hafiz: "The lightest touch — and it cannot say where the verse begins or ends: the first and last lines are shared with the neighbours, and the bar marks the whole line.",
    pros: "Nothing on the text; never collides with tajweed or word marks.",
    cons: "Cannot show a mid-line start or end; easy to miss; the margin is also where the page number and juz marks sit.",
    commits: "Only ever a companion to another mark, never alone.",
    measured: `letters on the paper ${r1(M.inkOnPaper)} · bar against paper ${r1(M.swipeOnPaper)}`,
    pics: [["margin", "F — a bar in the margin"]],
  },
  {
    id: "G", title: "Only the verse number, tinted",
    how: "The verse-number ornament at the end of the verse tinted amber; the words untouched.",
    hafiz: "You find where the verse ends, then have to read back to find where it starts. On a six-line verse that is most of the page.",
    pros: "Nothing on the text; tiny; fits any skin.",
    cons: "Marks the end, not the verse; on a long verse the start is a page away; the ornament is already the busiest glyph on the line.",
    commits: "A companion only — it would pair well with the margin bar; alone it does not answer 'where am I'.",
    measured: `letters on the paper ${r1(M.inkOnPaper)} · badge against paper ${r1(M.swipeOnPaper)}`,
    pics: [["badge", "G — the number only"]],
  },
  {
    id: "H", title: "Each word its own pill",
    how: "A soft rounded wash on each word of the verse, pause marks left out; the gaps between words stay paper.",
    hafiz: "On this print the words sit so close that the pills all but fuse into one notched band — at phone size it reads as the wash (B) with a ragged edge, not as beads. The extent is exact to the word.",
    pros: "Exact to the word; the same drawing the word-comparison panel already uses.",
    cons: "Fifty-odd shapes on one verse that look like one; the notches land on the vowel marks between words; depends on the word boxes being right, which the word sweep still flags on some pages.",
    commits: "Ties the verse mark to the word boxes and their gate; a per-word wipe.",
    measured: `letters on the wash ${r1(M.inkOnWash)} · wash against paper ${r1(M.washOnPaper)}`,
    pics: [["pills", "H — a pill per word"]],
  },
  {
    id: "I", title: "A hand-drawn swipe",
    how: "The same bands, with a wobbling edge and thinner ends, as a marker held by a hand would leave.",
    hafiz: "Reads as 'someone marked this' rather than 'the app selected this'. Same size, same amber, same find time.",
    pros: "Warmer; plays to the 'a printed page, a real pen' feel the pitch wants.",
    cons: "A wobble that is the same every time looks fake; a random one changes under the reader; the wipe is harder to draw along a wobbly shape.",
    commits: "A generated path per line instead of a stroke, and a decision on whether the wobble is fixed or fresh.",
    measured: `letters on the mark ${r1(M.inkOnSwipe)} · mark against paper ${r1(M.swipeOnPaper)}`,
    pics: [["hand", "I — hand-drawn"]],
  },
  {
    id: "J", title: "The swipe in verdigris, and in grey",
    how: `The same swipe in the app's verdigris (its navigation colour) and in a neutral grey. Both had to be thinned to ${Math.round(THIN * 100)}% — at full strength a dark hue blended into the print leaves the letters at ${r1(M.inkOnVerdigrisFull)}, unreadable.`,
    hafiz: "Once thinned, both are quieter than the amber and closer to the print's own tones; the verdigris one looks like a crumb or a link, not a selection.",
    pros: "A grey mark never fights the tajweed colours; verdigris is already the app's colour.",
    cons: "Only a light hue can be a full-strength marker; darker hues thinned become pale washes. Verdigris already means 'where you hopped from'.",
    commits: "Amber stays the selection colour; any other hue on the page is a secondary mark.",
    measured: `verdigris — letters ${r1(M.inkOnVerdigris)}, mark against paper ${r1(M.verdigrisOnPaper)} · grey — letters ${r1(M.inkOnGrey)}, mark against paper ${r1(M.greyOnPaper)}`,
    pics: [["verdigris", "J — verdigris, thinned"], ["grey", "J — grey, thinned"]],
  },
  {
    id: "K", title: "On the tajweed skin",
    how: "The tajweed skin washes each verse in the colour of its most distinctive rule and rings it with that rule's dash. First: today's swipe over it. Second: the translucent wash (B) over it — the case that fights.",
    hafiz: "The swipe still finds the verse at once; its amber darkens over the rule's tint but stays amber. The wash turns into a third colour — a salmon that is neither the skin's pink nor the app's amber — and only its ring says where the verse ends; without the ring it would vanish into the skin.",
    pros: "The swipe survives the skin; blending, not covering, is what makes that work.",
    cons: "Any translucent fill mixes with the skin's own fills into a colour nobody chose; on the skin, only a stroke or an outline stays legible as 'selected'.",
    commits: "If the skin is kept, the selection mark must be a stroke, not a fill — which rules B and H out as defaults.",
    measured: `swipe over the skin — letters ${r1(M.inkOnSwipeOverTajweed)} · wash over the skin — wash against the skin's tint ${r1(M.washOverTajweedOnTajweed)}`,
    pics: [["tajweedSwipe", "K — the swipe on the tajweed skin"], ["tajweedWash", "K — the wash on the tajweed skin"]],
  },
];

// ── The approaches ────────────────────────────────────────────────────────────
const APPROACHES = [
  {
    id: "P1", title: "One stroke per line, or one shape for the verse?",
    how: "First: the pen, one band per line — what the app does. Second: the same ink as one shape, the verse's box filled. Same colour, same blend.",
    hafiz: "Per line, the page keeps its line rhythm and the gaps between lines stay paper, so a six-line verse still reads as six lines. As one shape it is a slab that swallows the gaps.",
    pros: "Per line: the mark follows the print's own structure; the extent on the shared first and last lines is exact.",
    cons: "Per line needs the pen to read the verse's box as lines — which it cannot on two decorated pages, where it falls back to one shape.",
    commits: "Per line is settled by the earlier record and by the comparison panel; this figure is here so a reader sees why, not to reopen it.",
    measured: `letters on either ${r1(M.inkOnSwipe)}`,
    pics: [["swipe", "one band per line"], ["slab", "one shape"]],
  },
  {
    id: "P2", title: "Blended into the print, or laid over it?",
    how: "First: the swipe multiplied into the print, the way ink on paper works — the paper lightens the amber and the black letters stay black. Second: the same swipe laid over the print with plain transparency, at 55% so the letters survive at all.",
    hafiz: "Blended, the verse is as readable as the plain page. Laid over, the letters go grey-brown under the amber and the vowel marks fade first.",
    pros: `Multiply: letters at ${r1(M.inkOnSwipe)}; a full-strength colour with no loss of legibility.`,
    cons: `Plain transparency: letters drop to ${r1(M.inkOnAlpha)} at 55%, and at full strength they vanish; the only way to keep the mark visible is to keep it thin.`,
    commits: "Any mark that touches the letters is blended, never laid over — which is what the app already does for every inked mark.",
    measured: `blended — letters ${r1(M.inkOnSwipe)}, mark against paper ${r1(M.swipeOnPaper)} · laid over at 55% — letters ${r1(M.inkOnAlpha)}, mark against paper ${r1(M.alphaOnPaper)}`,
    pics: [["swipe", "blended (multiply)"], ["alpha", "laid over (55% transparency)"]],
  },
  {
    id: "P3", title: "Does the mark wipe in, or is it just there?", live: "wipe",
    how: `Press the button and watch. First: the app's wipe — the ink lays down right to left, one line after the next (${T.durInk} per line, ${T.staggerInk} between lines). Second: the same mark, simply there.`,
    hafiz: "The wipe tells your eye where to look before the mark has finished; you find the verse by the motion. Static, you find it by the colour — a beat slower, but nothing to wait for.",
    pros: "Wipe: a pen crossing Arabic the right way; a strong cue to the eye; already built. Static: nothing to get wrong, and what readers who turn motion off get.",
    cons: "Wipe: half a second in which you cannot read the whole verse; a stroke shape that cannot wipe (a wobble, a fill) loses it.",
    commits: "Keeping the wipe commits the mark to being a stroke; the reduced-motion setting already turns it off.",
    measured: "not a contrast question — press the button",
    pics: [["wipe", "the wipe (press to replay)"], ["swipe", "static"]],
  },
  {
    id: "P4", title: "What happens when a verse runs across two pages?",
    how: `In this print it never does: every one of the ${PLACEMENTS.verses.toLocaleString("en")} verses is printed whole on one page (${PLACEMENTS.split} are split). What can cross the gutter is a passage. Here 2:255 is selected on page 42 and the swept passage runs on through 2:256 and across to page 43. Right-to-left, so page 43 is the left leaf.`,
    hafiz: "The verse you are on is always whole on its page. A passage continues on the next leaf in the same lighter pen, and on a phone you turn the page to see the rest.",
    pros: "The hard case — a mark split by a page turn — does not exist for the verse; the print did that work.",
    cons: "A passage that crosses pages needs its mark drawn on both leaves and kept through a turn; on a phone the continuation is off screen.",
    commits: "The passage mark has to be per page and survive a page turn; today's range-from-a-link bug means it is not drawn at all from a link.",
    measured: "not a contrast question",
    spread: true, pics: [],
  },
  {
    id: "P5", title: "How does it read next to the app's other marks?",
    how: "Everything the app can draw at once, on one crop: the dashed verdigris crumb around 2:253 (where you hopped from), a swept passage 2:254–2:256, the selected verse inside it, and a mistake mark on one word (the comparison panel's indigo stands in). First: the passage in today's lighter amber. Second: the passage in thinned verdigris.",
    hafiz: "In the first, passage and verse are two strengths of one colour and the verse inside the passage goes a deep brown — the darkest thing on the page. In the second, the passage is a different thing from the verse at a glance, but now shares a hue with the crumb; and it only works because the passage stops where the verse starts — two hues stacked multiply to mud (drawn that way first; it went olive).",
    pros: "A second hue separates 'the passage' from 'the verse I am on'. The word-level ring stays readable on top of every wash tried.",
    cons: "The page's palette is nearly full: amber (selection), verdigris (crumb, links), indigo (a vowel mark), green and ochre (shared and differing words), seven tajweed hues. A passage hue must be picked against all of them.",
    commits: "One more colour token; a rule that a mark's hue is unique to its meaning; passages drawn around the selected verse, not under it; and the word-level mark stays a ring so it survives on any wash.",
    measured: `passage today — letters ${r1(M.inkOnRange)}, verse inside it ${r1(M.inkOnBoth)}, passage against paper ${r1(M.rangeOnPaper)} · passage in verdigris — letters ${r1(M.inkOnVerdigris)}, against paper ${r1(M.verdigrisOnPaper)}`,
    pics: [[`collide:${INK_RANGE}`, "today's passage, lighter amber, laid under the verse too"], [`collideAround:rgba(${rgb(ACCENT).join(", ")}, ${THIN})`, "the passage in verdigris, leaving the verse out"]],
  },
  {
    id: "P6", title: "Does the mark fade after a few seconds, or stay?", live: "fade",
    how: "Press the button. First: the mark appears, holds for three seconds, then fades away and leaves the page clean. Second: it stays until you press elsewhere.",
    hafiz: "Fading is the mark getting out of the way on its own: you find the verse, then read on with nothing over the text. Staying is a bookmark you can look back to after reading on.",
    pros: "Fade: the reading page ends up clean without a tap. Stay: you can look away and back; the tools for the verse have something to point at.",
    cons: "Fade: the mark is gone when the verse's tools open, and a reader who looks up loses their place. Stay: every mark is a tint over the letters for as long as you read.",
    commits: "Fade would need a rule for when the mark comes back (opening the drawer, a hop) and a way to keep it; stay is what the app does.",
    measured: "not a contrast question — press the button",
    pics: [["swipe", "fades after three seconds (press to replay)"], ["swipe", "stays"]],
  },
  {
    id: "P7", title: "Can you find it in half a second?", live: "flash",
    how: "Pick a stroke, press Flash: the page shows for half a second, then goes blank. Did you know which verse it was? This is the one test a hafiz mid-revision actually runs, and the page cannot run it for you.",
    hafiz: "A mark that passes this at a glance and then stays out of the way of reading is the whole brief.",
    pros: "The test that decides between the quiet strokes (C, D, E, F, G) and the loud ones (A, I).",
    cons: "Half a second on a phone in daylight is harsher than this page on a desk; try it on a phone.",
    commits: "Whatever wins here sets the floor for how loud the mark has to be.",
    measured: "not a contrast question — press the button",
    pics: [],
  },
];

const drawKey = (key) => {
  const [fn, arg] = key.split(/:(.*)/s);
  if (fn === "collideAround") return draw.collide(arg, true);
  return draw[fn](arg);
};
const flashStage = () => `<div class="flash"><label>Stroke <select>${STROKES.filter((s) => s.pics.length === 1).map((s) => `<option value="${s.id}">${s.id} — ${esc(s.title)}</option>`).join("")}</select></label> <button type="button">Flash for half a second</button><div class="stage">${crop(draw.swipe(), { label: "the flash test" })}<div class="blank">press Flash</div></div></div>`;
const card = (o) => `
  <figure class="opt" data-option="${o.id}" id="option-${o.id}"${o.live ? ` data-live="${o.live}"` : ""}>
    <figcaption class="head"><span class="id">${o.id}</span><b>${esc(o.title)}</b></figcaption>
    ${o.spread ? SPREAD : ""}
    ${o.live === "flash" ? flashStage() : ""}
    <div class="pics">${o.pics.map(([k, label], i) => `<div class="pic${o.live && i === 0 ? " live" : ""}">${crop(drawKey(k), { label })}<div class="piclabel">${esc(label)}</div></div>`).join("")}</div>
    ${o.live && o.live !== "flash" ? `<button type="button" class="press">Press the verse again</button>` : ""}
    <div class="text">
      <p>${esc(o.how)}</p>
      <p><span>For a hafiz</span> ${esc(o.hafiz)}</p>
      <p><span>Pros</span> ${esc(o.pros)}</p>
      <p><span>Cons</span> ${esc(o.cons)}</p>
      <p><span>Commits us to</span> ${esc(o.commits)}</p>
      <p class="measured"><span>Measured</span> ${esc(o.measured)}</p>
    </div>
  </figure>`;

// ── Page ──────────────────────────────────────────────────────────────────────
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>How should the app mark the verse you are on?</title>
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
  button, select { font: inherit; font-size: 0.9rem; padding: 6px 12px; border-radius: 8px; border: 1px solid ${T.hairline};
    background: ${T.paper}; color: ${T.ink}; cursor: pointer; }
  button:hover { border-color: ${INK_SEL}; }
  .press { align-self: center; }
  .flash { display: flex; flex-direction: column; gap: 8px; align-items: center; }
  .flash label { font-size: 0.9rem; color: ${T.inkSoft}; }
  .flash .stage { position: relative; }
  .flash .blank { position: absolute; inset: 0; background: ${T.paperRaised}; border-radius: 4px; display: grid; place-items: center;
    color: ${T.inkFaint}; font-size: 0.85rem; }
  .flash .stage.showing .blank { display: none; }
  /* The app's wipe, verbatim: dash = the stroke's length, offset animated to 0, one line after the next. */
  .live .pen { stroke-dasharray: var(--len) var(--len); stroke-dashoffset: 0; }
  .live.go .pen { animation: wipe ${T.durInk} ${T.easeInk} backwards; animation-delay: calc(var(--i) * ${T.staggerInk}); }
  @keyframes wipe { from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
  @media (prefers-reduced-motion: reduce) { .live.go .pen { animation: none; } }
  [data-live="fade"] .live g { transition: opacity 600ms ease; }
  [data-live="fade"] .live.gone g { opacity: 0; }
  table { border-collapse: collapse; font-size: 0.9rem; margin: ${T.space2}px 0; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid ${T.hairline}; vertical-align: top; }
  th { color: ${T.inkSoft}; font-weight: 600; }
  td.n { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .note { color: ${T.inkSoft}; font-size: 0.92rem; border-left: 3px solid ${T.hairline};
    padding-left: ${T.space3}px; margin: ${T.space3}px 0; max-width: 760px; }
  footer { margin-top: 64px; padding-top: ${T.space3}px; border-top: 1px solid ${T.hairline};
    color: ${T.inkFaint}; font-size: 0.8rem; }
  footer code { color: ${T.inkSoft}; }
  @media (max-width: 600px) { main { padding: ${T.space3}px 16px 64px; } }
</style>
</head>
<body>
<svg class="defs" aria-hidden="true" width="0" height="0" style="position:absolute"><symbol id="p${PAGE}" viewBox="0 0 ${VBW} ${VBH}">${P42.inner}</symbol><symbol id="p${NEXT}" viewBox="0 0 ${VBW} ${VBH}">${P43.inner}</symbol></svg>
<main>
  <h1>How should the app mark the verse you are on?</h1>
  <p class="lede">The app lights the verse you have chosen so you can see where you are. Here is what
    that mark is today, ten other strokes it could be, and seven ways it could behave — all on the same
    real page (page 42, the Throne Verse, 2:255), at the width a phone gives the page, so you decide by
    looking and, where looking is not enough, by pressing.</p>
  <p class="site">This page on the site: <a href="${SITE}">${SITE.replace("https://", "")}</a></p>

  <div class="short">
    <b>The short version</b>
    <ol>
      <li>Every picture is the same page and the same verse; only the mark changes.</li>
      <li>Read each at arm's length first — can you find the verse? — then up close: can you still read it?
        Then run the half-second test at the bottom.</li>
      <li>Under each picture: what it changes for a hafiz mid-revision, pros, cons, what it commits us to,
        and two measured numbers — how well the letters read on the mark (4.5:1 is the reading floor) and
        how visible the mark is against the paper (3:1 is the floor for a "you are here" sign).</li>
      <li>The reasons, the constraints and the recommendation are in the record this page belongs to.</li>
    </ol>
  </div>

  <div class="note"><b>What was settled before, and what this page adds.</b> An earlier decision (2 September)
    settled that a reader may <em>choose</em> among the swipe, a fill and an outline, and tune the mark's strength
    in a few named steps; it drew those three on page 7. That stands and is not re-asked here. This page draws
    the strokes that record never drew — a rule, a dashed rule, a margin bar, the number only, a pill per word,
    a hand-drawn swipe, other colours, the tajweed skin underneath — and the behaviours it did not touch: per
    line or one shape, blended or laid over, wiped in or static, a verse across two pages, marks colliding,
    fading or staying. Every mark here is drawn per line (or per word) where it follows lines; that grammar is
    settled by the comparison panel and the earlier record.</div>

  <h2>The strokes: how the mark looks</h2>
  <div class="grid">
    ${STROKES.map(card).join("")}
  </div>

  <h2>The approaches: how it is done and how it behaves</h2>
  <div class="grid wide">
    ${APPROACHES.map(card).join("")}
  </div>

  <h2>What was measured</h2>
  <p class="lede">The print's ink is ${GLYPH}; the paper is ${T.paperRaised}. On plain paper the letters read
    at ${r1(M.inkOnPaper)}. The amber is ${INK_SEL}, blended into the paper the way a marker is. Figures are
    computed from the app's own colour values, not sampled from screenshots.</p>
  <table>
    <tr><th>Mark</th><th>Letters on the mark</th><th>Mark against the paper</th><th>What that means</th></tr>
    <tr><td>A · today's swipe (also I, and P1 either way)</td><td class="n">${r1(M.inkOnSwipe)}</td><td class="n">${r1(M.swipeOnPaper)}</td><td>Letters clear the 4.5:1 floor easily; the amber itself is under the 3:1 indicator floor and is seen by its size rather than its contrast.</td></tr>
    <tr><td>B · one wash (also H)</td><td class="n">${r1(M.inkOnWash)}</td><td class="n">${r1(M.washOnPaper)}</td><td>Letters fine; the wash is barely a tint against the paper.</td></tr>
    <tr><td>C, D · rules under the line; F · margin bar; G · badge</td><td class="n">${r1(M.inkOnPaper)}</td><td class="n">${r1(M.swipeOnPaper)}</td><td>Nothing on the letters; a thin amber line is the least visible amber thing on this page.</td></tr>
    <tr><td>E · outline</td><td class="n">${r1(M.inkOnPaper)}</td><td class="n">${r1(M.ringOnPaper)}</td><td>Nothing on the letters; the ring is seen by its shape, not its colour.</td></tr>
    <tr><td>J · verdigris, thinned to ${Math.round(THIN * 100)}%</td><td class="n">${r1(M.inkOnVerdigris)}</td><td class="n">${r1(M.verdigrisOnPaper)}</td><td>At full strength the letters would read at ${r1(M.inkOnVerdigrisFull)}; thinned, it is a wash.</td></tr>
    <tr><td>J · grey, thinned to ${Math.round(THIN * 100)}%</td><td class="n">${r1(M.inkOnGrey)}</td><td class="n">${r1(M.greyOnPaper)}</td><td>Same story: a dark hue cannot be a full-strength marker.</td></tr>
    <tr><td>K · swipe over the tajweed skin</td><td class="n">${r1(M.inkOnSwipeOverTajweed)}</td><td class="n">—</td><td>The letters survive the two tints stacked.</td></tr>
    <tr><td>K · wash over the tajweed skin</td><td class="n">—</td><td class="n">${r1(M.washOverTajweedOnTajweed)} (wash against the skin's tint)</td><td>The wash is all but invisible on the skin.</td></tr>
    <tr><td>P2 · swipe laid over at 55%</td><td class="n">${r1(M.inkOnAlpha)}</td><td class="n">${r1(M.alphaOnPaper)}</td><td>Plain transparency greys the letters; multiply does not.</td></tr>
    <tr><td>P5 · passage today / verse inside it</td><td class="n">${r1(M.inkOnRange)} / ${r1(M.inkOnBoth)}</td><td class="n">${r1(M.rangeOnPaper)}</td><td>The verse inside a passage is the darkest thing on the page.</td></tr>
  </table>
  <p class="note">The floors are the web accessibility guideline's: 4.5:1 for text on its background (1.4.3)
    and 3:1 for the visual sign of a selected state (1.4.11). The letter figures are the ones a reader
    feels; the indicator figures say whether the mark would still be seen by someone who sees amber
    poorly.</p>

  <footer>
    Drawn by <code>scripts/build-highlight-options.mjs</code> from pages ${PAGE} and ${NEXT}'s shipped verse boxes,
    page ${PAGE}'s word boxes and outlined print, the tajweed shard for surah 2, and the app's own pen
    (<code>packages/core/dist/ink.js</code>), rule order (<code>packages/core/dist/skins.js</code>) and colours
    (<code>apps/web/src/styles/tokens.css</code>); the line height the pen used is ${LINE_H} units. The record
    it belongs to is <code>docs/design/highlight-options.md</code>; the pictures the record embeds are cut from
    this page by <code>scripts/shoot-highlight-options.mjs</code>. No Qur'an text: the print is outlined paths
    and the marks are shapes, never words.
  </footer>
</main>
<script>
(() => {
  // The wipe: restart the app's own animation on the live crop.
  for (const fig of document.querySelectorAll('[data-live="wipe"]')) {
    const live = fig.querySelector(".live");
    const go = () => { live.classList.remove("go"); void live.offsetWidth; live.classList.add("go"); };
    fig.querySelector(".press").addEventListener("click", go);
    go();
  }
  // The fade: the mark appears, holds three seconds, fades over 600 ms.
  for (const fig of document.querySelectorAll('[data-live="fade"]')) {
    const live = fig.querySelector(".live");
    let t = 0;
    const go = () => { clearTimeout(t); live.classList.remove("gone"); t = setTimeout(() => live.classList.add("gone"), 3000); };
    fig.querySelector(".press").addEventListener("click", go);
    go();
  }
  // The half-second test: show the chosen stroke's crop for 500 ms, then blank paper.
  for (const fig of document.querySelectorAll('[data-live="flash"]')) {
    const stage = fig.querySelector(".stage"), select = fig.querySelector("select"), blank = fig.querySelector(".blank");
    const pick = () => {
      const src = document.querySelector('figure[data-option="' + select.value + '"] .pic svg');
      stage.querySelector("svg").replaceWith(src.cloneNode(true));
    };
    select.addEventListener("change", pick);
    pick();
    let t = 0;
    fig.querySelector("button").addEventListener("click", () => {
      clearTimeout(t);
      stage.classList.add("showing");
      t = setTimeout(() => { stage.classList.remove("showing"); blank.textContent = "which verse was it?"; }, 500);
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
console.log(`build-highlight-options: wrote ${OUT} (${kb} KB, 0 Arabic, ${STROKES.length} strokes, ${APPROACHES.length} approaches, line height ${LINE_H})`);
console.log(`  verses ${PLACEMENTS.verses}, printed on two pages ${PLACEMENTS.split} · letters on swipe ${r1(M.inkOnSwipe)} · swipe on paper ${r1(M.swipeOnPaper)} · verdigris full ${r1(M.inkOnVerdigrisFull)} · alpha 55% ${r1(M.inkOnAlpha)}`);
