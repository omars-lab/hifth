#!/usr/bin/env node
/**
 * Render docs/design/tafseer-options.html — the options for a tafseer of the
 * selected verse, drawn on a real page of the print at the size each would be
 * used, so the decision record `docs/decisions/tafseer.md` argues about a
 * picture a reader can open.
 *
 * ── What it reads (committed bytes only) ────────────────────────────────────
 *   apps/web/public/assets/manifest.json          the print's viewBox
 *   apps/web/public/assets/pages/hafs-kfqc/7.svg  the leaf 2:48 is on
 *   apps/web/public/assets/pages/hafs-kfqc/8.svg  the leaf facing it
 *   apps/web/public/assets/adj/hafs-kfqc/2.json   the hops 2:48 has today
 *   apps/web/src/components/HopPopover.module.css the sheet's own stylesheet
 *   apps/web/src/styles/tokens.css                the app's sizes and colours
 *
 * Every size on the page is read out of those files, so a change to the sheet
 * changes the picture, and any number in the prose can be re-derived by running
 * this. The leaf size (382 × 609 px on a 1440 × 900 window) was measured in the
 * running app on 2026-09-02 and is the one constant typed in below.
 *
 * ── There is no tafseer in this file, and no Qur'an ─────────────────────────
 * The repo holds no tafseer text, so the section is drawn as measured lines —
 * the amount of text that FITS, which is what the placement question turns on;
 * how much text there IS for a verse is a fact about the source, and the page
 * says so. The print is outlined paths with zero Arabic codepoints; each leaf
 * is inlined once as a <symbol> and <use>d per drawing. The writer refuses if
 * the output carries an Arabic codepoint, so the one Arabic note in 2:48's hop
 * data is drawn as a bar, not copied.
 *
 *   node scripts/build-tafseer-options.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import { readPolygons } from "./lib/box-sweep.mjs";

const MANIFEST = join(ROOT, "apps/web/public/assets/manifest.json");
const PAGES = join(ROOT, "apps/web/public/assets/pages/hafs-kfqc");
const ADJ = join(ROOT, "apps/web/public/assets/adj/hafs-kfqc/2.json");
const SHEET_CSS = join(ROOT, "apps/web/src/components/HopPopover.module.css");
const TOKENS_CSS = join(ROOT, "apps/web/src/styles/tokens.css");
const OUT = join(ROOT, "docs/design/tafseer-options.html");

const die = (msg) => {
  console.error(`build-tafseer-options: ${msg}`);
  process.exit(1);
};
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── The verse, the leaves, the hops ──────────────────────────────────────────
const SURAH = 2;
const AYAH = 48;
const KEY = `${SURAH}:${AYAH}`;
const RIGHT_PAGE = 7; // odd page: the right leaf of the spread 7|8
const LEFT_PAGE = 8;

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const [, , VBW, VBH] = manifest.viewBox.split(/\s+/).map(Number);
if (!(VBW > 0 && VBH > 0)) die("manifest viewBox");
if (manifest.ayahPages?.[globalIndex(SURAH, AYAH)] !== RIGHT_PAGE)
  die(`${KEY} is not on page ${RIGHT_PAGE} in the manifest`);

function globalIndex(surah, ayah) {
  // ayahPages is indexed by the verse's position in the whole book; surah 1 has 7 verses.
  if (surah !== 2) die("globalIndex is only written for surah 2 here");
  return 7 + (ayah - 1);
}

const leafSvg = (n) => {
  const raw = readFileSync(join(PAGES, `${n}.svg`), "utf8");
  if (/[\u0600-\u06FF]/.test(raw)) die(`page ${n} carries Arabic codepoints`);
  if (/<text\b/.test(raw)) die(`page ${n} carries <text>`);
  const inner = raw.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return inner;
};
const right = leafSvg(RIGHT_PAGE);
const left = leafSvg(LEFT_PAGE);

const polygons = readPolygons(readFileSync(join(PAGES, `${RIGHT_PAGE}.svg`), "utf8"));
const poly = polygons.find((p) => p.surah === SURAH && p.ayah === AYAH) ?? die(`no polygon for ${KEY}`);
const nums = [...poly.d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
// The polygon is written as absolute rects: M x y h w v h H x Z … — read its bounding box.
const box = (() => {
  let x = 0,
    y = 0,
    minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const m of poly.d.matchAll(/([MmHhVvZz])\s*([-\d.\s]*)/g)) {
    const c = m[1];
    const a = m[2].trim().split(/\s+/).filter(Boolean).map(Number);
    if (c === "M") [x, y] = a;
    else if (c === "m") {
      x += a[0];
      y += a[1];
    }
    else if (c === "H") x = a[0];
    else if (c === "h") x += a[0];
    else if (c === "V") y = a[0];
    else if (c === "v") y += a[0];
    else continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
})();
if (!(box.w > 0 && box.h > 0) || nums.length === 0) die(`could not read ${KEY}'s box`);

const adj = JSON.parse(readFileSync(ADJ, "utf8"));
const edges = adj[String(AYAH)]?.edges ?? die(`no hops for ${KEY}`);
const inSurah = edges.filter((e) => e.type === "mutashabih" && e.to.includes(`/${SURAH}:`));
const elsewhere = edges.filter((e) => !inSurah.includes(e));
const ayahOf = (to) => to.split("/").pop();

// ── The sheet's own sizes ────────────────────────────────────────────────────
const tokensCss = readFileSync(TOKENS_CSS, "utf8");
const sheetCss = readFileSync(SHEET_CSS, "utf8");
const token = (name) => {
  const m = tokensCss.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) die(`no token --${name}`);
  return m[1].trim();
};
const px = (v) =>
  v.endsWith("rem") ? Number(v.slice(0, -3)) * 16 : v.endsWith("px") ? Number(v.slice(0, -2)) : die(`unit: ${v}`);
const T = {
  space2: px(token("space-2")),
  space3: px(token("space-3")),
  space4: px(token("space-4")),
  space5: px(token("space-5")),
  textXs: token("text-xs"),
  textSm: token("text-sm"),
  textMd: token("text-md"),
  textLg: token("text-lg"),
  touch: px(token("touch-min")),
  radiusLg: token("radius-lg"),
  radiusMd: token("radius-md"),
  radiusPill: token("radius-pill"),
  paper: token("paper"),
  paperRaised: token("paper-raised"),
  paperSunk: token("paper-sunk"),
  ink: token("ink"),
  inkSoft: token("ink-soft"),
  inkFaint: token("ink-faint"),
  hairline: token("hairline"),
  accent: token("accent"),
  accentStrong: token("accent-strong"),
  accentTint: token("accent-tint"),
  highlightWash: token("highlight-wash"),
  highlightRing: token("highlight-ring"),
  shadow2: token("shadow-2"),
  fontLatin: token("font-latin"),
};
const sheetMax = sheetCss.match(/max-block-size:\s*(\d+)vh/)?.[1] ?? die("sheet max-block-size");
// The card's width is the `.sheet` rule inside the wide-window media block, not
// the first `inline-size` in the file (that one is the 40 px grip).
const cardW = Number(
  sheetCss.match(/@media \(min-width: 900px\)[\s\S]*?\.sheet\s*\{[^}]*inline-size:\s*(\d+)px/)?.[1] ??
    die("card inline-size"),
);
const SHEET_VH = Number(sheetMax) / 100;

// ── Windows, measured ────────────────────────────────────────────────────────
const PHONE = { w: 390, h: 844 };
const LAPTOP = { w: 1440, h: 900 };
/** The leaf on a 1440 × 900 window, measured in the running app (2026-09-02). */
const LEAF = { w: 382, h: 609, top: 144, rightX: 722, leftX: 336 };
const leafScale = LEAF.w / VBW;

// How tall a sheet is today for this verse's "similar in this surah" chip, and
// how much of its ceiling is left for a section beneath the hops. Heights were
// measured in the running app on 2026-09-02 and are reproduced here from the
// stylesheet: head = touch target + gap + hairline; a hop row = its padding
// around a 44 px hop button + hairline.
const HEAD_H = T.touch + T.space2 + 1; // 53
const ROW_H = T.space3 * 2 + T.touch + 1; // 69
const GRIP_H = 4 + T.space2; // 12
const PAD_TOP = T.space3;
const PAD_BOTTOM = T.space5;
const todayH = PAD_TOP + GRIP_H + HEAD_H + inSurah.length * ROW_H - 1 + PAD_BOTTOM; // 240
const ceiling = (win) => Math.floor(win.h * SHEET_VH);
const LINE_H = 28; // a line of Arabic prose at the sheet's body size, 1.75 leading
const SECTION_HEAD_H = ROW_H; // the "Tafseer" row, same shape as a hop row
const PROVENANCE_H = 40; // the source line under the text
const fits = (win) => {
  const room = ceiling(win) - todayH - SECTION_HEAD_H - PROVENANCE_H;
  return { room, lines: Math.max(0, Math.floor(room / LINE_H)) };
};
const phoneFit = fits(PHONE);
const laptopFit = fits(LAPTOP);
// A facing leaf as a reading column: the leaf's own margins, at the leaf's size.
const leafColumn = {
  inner: LEAF.h - 2 * T.space5,
  lines: Math.floor((LEAF.h - 2 * T.space5 - HEAD_H - PROVENANCE_H) / LINE_H),
};
// How much of the facing leaf a card grown to its ceiling covers on a laptop.
const cardTop = LAPTOP.h - T.space5 - ceiling(LAPTOP);
const leafBottom = LEAF.top + LEAF.h;
const coverPct = Math.round(((leafBottom - Math.max(cardTop, LEAF.top)) / LEAF.h) * 100);
const phoneFull = {
  lines: Math.floor((PHONE.h - 56 - HEAD_H - PROVENANCE_H - 2 * T.space4) / LINE_H),
};

// ── Drawing helpers ──────────────────────────────────────────────────────────
// A <use> of a symbol needs the symbol's own size, or the symbol is fitted to
// whatever viewport the referencing svg has — which, for a crop, is a strip.
const use = (id) => `<use href="#${id}" width="${VBW}" height="${VBH}"/>`;
const printUse = (id, w, h, extra = "") =>
  `<svg class="print" viewBox="0 0 ${VBW} ${VBH}" width="${w}" height="${h}" aria-hidden="true">${use(id)}${extra}</svg>`;
const washOn = (scaleX = 1) =>
  `<path d="${esc(poly.d)}" fill="${T.highlightWash}" stroke="${T.highlightRing}" stroke-width="${(0.8 / scaleX).toFixed(2)}" vector-effect="non-scaling-stroke"/>`;

/** The verse, cropped out of its leaf at leaf size. */
const crop = () => {
  const pad = 6;
  const y = Math.max(0, box.y - pad);
  const h = Math.min(VBH - y, box.h + 2 * pad);
  return `<svg class="print crop" viewBox="0 ${y} ${VBW} ${h}" width="${LEAF.w}" height="${(h * leafScale).toFixed(0)}" aria-label="Al-Baqarah 2:48, cropped from page 7 of the print">${use(`p${RIGHT_PAGE}`)}${washOn()}</svg>`;
};

const bars = (n, cls = "") =>
  Array.from({ length: n }, (_, i) => {
    const w = i === n - 1 ? 42 + ((i * 37) % 30) : 88 + ((i * 53) % 12);
    return `<span class="bar ${cls}" style="width:${w}%"></span>`;
  }).join("");

const hopRow = (e, i) => {
  const twin = e.twin ? `<span class="badge">twin</span>` : "";
  const note = e.note
    ? `<span class="note"><span class="bar note-bar" style="width:${52 + (i * 17) % 20}%"></span></span>`
    : "";
  return `<li class="row"><div class="rowMain"><span class="rowText"><span class="rowLabel">Al-Baqarah · ${esc(ayahOf(e.to))}${twin}<span class="caret">⌄</span></span>${note}</span><span class="hop">↪</span></div></li>`;
};

const sheet = ({ mode, tafseer, lines, provenance = true, width, open = true }) => {
  const rows = inSurah.map(hopRow).join("");
  const section = !tafseer
    ? ""
    : tafseer === "link"
      ? `<li class="row"><div class="rowMain"><span class="rowText"><span class="rowLabel"><span class="glyph small">✎</span>Tafseer<span class="caret out">↗</span></span><span class="note">Opens the verse on the source's own site</span></span></div></li>`
      : `<li class="row section${open ? " open" : ""}"><div class="rowMain"><span class="rowText"><span class="rowLabel"><span class="glyph small">✎</span>Tafseer<span class="caret">${open ? "⌃" : "⌄"}</span></span></span></div>${
          open
            ? `<div class="tafseer" dir="rtl"><div class="lines">${bars(lines, "ar")}</div>${provenance ? `<div class="prov" dir="ltr">al-Tafsir al-Muyassar · Tafsir Center for Quranic Studies · CC BY 4.0 · fetched 2026-09-02</div>` : ""}</div>`
            : ""
        }</li>`;
  return `<div class="sheet ${mode}" style="${width ? `width:${width}px` : ""}"><div class="grip"></div><header class="head"><span class="glyph">↻</span><span class="title">Similar in this surah</span><span class="close">✕</span></header><ul class="list">${rows}${section}</ul></div>`;
};

/** A phone at 1:1. */
const phone = (body, caption) => `
  <figure class="frame phone">
    <div class="screen" style="width:${PHONE.w}px;height:${PHONE.h}px">
      <div class="phone-top">Page ${RIGHT_PAGE} · Al-Baqarah</div>
      ${printUse(`p${RIGHT_PAGE}`, PHONE.w, Math.round((PHONE.w * VBH) / VBW), washOn())}
      ${body}
    </div>
    <figcaption>${caption}</figcaption>
  </figure>`;

/** A laptop window at 1440 × 900, shown at 0.55 with the card also at 1:1 beside it. */
const LAPTOP_SCALE = 0.55;
const laptop = (body, caption, { leftLeaf = true } = {}) => `
  <figure class="frame laptop">
    <div class="viewport" style="width:${LAPTOP.w * LAPTOP_SCALE}px;height:${LAPTOP.h * LAPTOP_SCALE}px">
      <div class="window" style="width:${LAPTOP.w}px;height:${LAPTOP.h}px;transform:scale(${LAPTOP_SCALE})">
        <div class="chrome">Page ${RIGHT_PAGE} · One · <b>Two</b></div>
        <div class="leaf right" style="left:${LEAF.rightX}px;top:${LEAF.top}px;width:${LEAF.w}px;height:${LEAF.h}px">${printUse(`p${RIGHT_PAGE}`, LEAF.w, LEAF.h, washOn())}</div>
        ${leftLeaf ? `<div class="leaf left" style="left:${LEAF.leftX}px;top:${LEAF.top}px;width:${LEAF.w}px;height:${LEAF.h}px">${printUse(`p${LEFT_PAGE}`, LEAF.w, LEAF.h)}</div>` : ""}
        ${body}
      </div>
    </div>
    <figcaption>${caption}</figcaption>
  </figure>`;

const cardAt = (html, { bottom = T.space5, left = T.space5 } = {}) =>
  `<div class="card-pos" style="left:${left}px;bottom:${bottom}px">${html}</div>`;

// ── The drawings ─────────────────────────────────────────────────────────────
const todayPhone = phone(
  `<div class="scrim"></div><div class="sheet-pos">${sheet({ mode: "phone" })}</div>`,
  `A phone, 390 × 844, at life size. Tapping 2:48 and its ↻ chip opens the sheet as it is today: ${inSurah.length} similar verses in this surah, ${todayH} px tall against a ceiling of ${ceiling(PHONE)} px (seven tenths of the window).`,
);
const todayLaptop = laptop(
  cardAt(sheet({ mode: "card" })),
  `A laptop window, 1440 × 900, shown at just over half size. The same sheet is a ${cardW} px card in the corner over the facing leaf, the one the verse is not on.`,
);

const optB_phone = phone(
  `<div class="scrim"></div><div class="sheet-pos">${sheet({ mode: "phone", tafseer: "link" })}</div>`,
  `A phone. One more row under the hops, marked with the ✎ the app already reserves for a tafseer link. Tapping it leaves the app.`,
);
const optB_laptop = laptop(
  cardAt(sheet({ mode: "card", tafseer: "link" })),
  `The laptop card with the same row. Nothing else on the window changes.`,
);

const optC_phone = phone(
  `<div class="scrim"></div><div class="sheet-pos">${sheet({ mode: "phone", tafseer: "inline", lines: phoneFit.lines })}</div>`,
  `A phone. The tafseer opens under the hops inside the same sheet, which grows to its ceiling of ${ceiling(PHONE)} px. What is left for the text after the head, the hop rows, the section's own row and the source line is ${phoneFit.room} px: <b>${phoneFit.lines} lines</b> before it scrolls. The bars stand for lines of Arabic prose; there is no tafseer text in this repository to draw.`,
);
const optC_laptop = laptop(
  cardAt(sheet({ mode: "card", tafseer: "inline", lines: laptopFit.lines })),
  `The laptop card, grown to its ceiling of ${ceiling(LAPTOP)} px: <b>${laptopFit.lines} lines</b> of the text show at once, over the facing leaf, ${coverPct}% of which it now covers.`,
);
const optC_card = `
  <figure class="frame bare">
    <div class="side-by-side">${crop()}${sheet({ mode: "card", tafseer: "inline", lines: laptopFit.lines })}</div>
    <figcaption>The same card at life size beside the verse it is about, also at life size. This is what a reader would compare: the print on the right, the text on the left, a gutter apart.</figcaption>
  </figure>`;

const leafColumnHtml = `<div class="leaf left column" style="left:${LEAF.leftX}px;top:${LEAF.top}px;width:${LEAF.w}px;height:${LEAF.h}px"><header class="head"><span class="glyph">✎</span><span class="title">Tafseer · Al-Baqarah 2:48</span><span class="close">✕</span></header><div class="tafseer" dir="rtl"><div class="lines">${bars(leafColumn.lines, "ar")}</div><div class="prov" dir="ltr">al-Tafsir al-Muyassar · Tafsir Center for Quranic Studies · CC BY 4.0 · fetched 2026-09-02</div></div></div>`;
const optD_laptop = laptop(
  leafColumnHtml,
  `A laptop. The facing leaf gives way to the text at the leaf's own size, ${LEAF.w} × ${LEAF.h} px: <b>${leafColumn.lines} lines</b>, with the verse still in view on the right. Nothing floats over the print; the page the reader was not reading is what moves.`,
  { leftLeaf: false },
);
const optD_phone = phone(
  `<div class="full"><header class="head"><span class="glyph">✎</span><span class="title">Tafseer · Al-Baqarah 2:48</span><span class="close">✕</span></header>${crop()}<div class="tafseer" dir="rtl"><div class="lines">${bars(phoneFull.lines, "ar")}</div><div class="prov" dir="ltr">al-Tafsir al-Muyassar · Tafsir Center for Quranic Studies · CC BY 4.0 · fetched 2026-09-02</div></div></div>`,
  `A phone has no facing leaf, so the text takes the screen, with the verse cropped in above it: <b>${phoneFull.lines} lines</b>, and the mus'haf out of sight until the reader closes it.`,
);

const provenanceLine = `
  <figure class="frame bare">
    <div class="prov-demo">
      <div class="prov big">al-Tafsir al-Muyassar · Tafsir Center for Quranic Studies · CC BY 4.0 · fetched 2026-09-02 · file c3a1…9f0e</div>
      <div class="prov big faint">al-Tafsir al-Muyassar · King Fahd Complex, 2nd edition, 1430 AH · via Tafsir Center · CC BY 4.0 · fetched 2026-09-02 · file c3a1…9f0e</div>
    </div>
    <figcaption>The source line, at the size it would sit under the text. The first is what can be said today from the sources found; the second is what the same line says once a printed edition is named. The file mark is illustrative: the real one is computed from the bytes fetched.</figcaption>
  </figure>`;

// ── The page ─────────────────────────────────────────────────────────────────
const opt = (o, drawings) => `
    <section class="opt${o.today ? " today" : ""}" id="${o.id}">
      <div class="opt-head"><span class="opt-key">${o.key}</span><h3>${esc(o.title)}</h3>${o.today ? `<span class="badge-today">today</span>` : ""}</div>
      <div class="opt-body">
        <p class="gist">${o.gist}</p>
        <dl><dt>takes</dt><dd>${o.takes}</dd><dt>gets</dt><dd>${o.gets}</dd><dt>costs</dt><dd>${o.costs}</dd></dl>
        <div class="drawings">${drawings}</div>
      </div>
    </section>`;

const where = [
  {
    id: "where-a",
    key: "A",
    title: "Nothing: the sheet stays as it is",
    today: true,
    gist: "The app stays a navigator. A verse's sheet lists where else it occurs and what it resembles; what it means is looked up somewhere else, as the plan says.",
    takes: "Nothing.",
    gets: "The app keeps its one job, its bundle, and its rule of shipping no text.",
    costs: "A reader who wants a meaning leaves the app and loses their place in it. Nothing is blocked behind this beyond the tafseer itself.",
  },
  {
    id: "where-b",
    key: "B",
    title: "A row in the sheet that opens the tafseer elsewhere",
    gist: "One more row under the hops, marked with the ✎ the app already reserves for it, which opens the verse on the source's own site in a new tab. No text enters the app.",
    takes: "A row, an address per verse, and a source to point at.",
    gets: "A road to a meaning, one tap long, with no licence to hold and no bytes to ship.",
    costs: "It leaves the app, it needs the network, and the source's page is not ours: it can move, change its tafseer, or close.",
  },
  {
    id: "where-c",
    key: "C",
    title: "A tafseer section inside the sheet, under the hops",
    gist: "The sheet the reader already has grows a section: tap the ✎ row and the text opens beneath the hops, with its source named under it.",
    takes: `A source with a licence that allows a copy, a file per surah fetched on demand and kept for offline, and the sheet's ceiling raised or the text made to scroll.`,
    gets: `The meaning in the same sheet, a gutter from the verse on a laptop, and a place to name the source on every showing.`,
    costs: `Room. ${phoneFit.lines} lines on a phone and ${laptopFit.lines} on a laptop before scrolling, in a sheet whose ceiling is seven tenths of the window; on a laptop the card grows to cover ${coverPct}% of the facing leaf. And the app ships text for the first time, so a licence, a version and a checksum become things it must carry.`,
  },
  {
    id: "where-d",
    key: "D",
    title: "The tafseer takes the facing leaf",
    gist: "On a laptop, the leaf the verse is not on gives way to the text at the leaf's own size, verse and meaning side by side like a printed mus'haf with a margin commentary. On a phone, which has no facing leaf, it takes the screen.",
    takes: "Everything C takes, plus a second surface: a leaf that can hold prose, and a phone screen that can.",
    gets: `${leafColumn.lines} lines beside the verse on a laptop with nothing floating over the print; the print and its meaning at the same size, which is how the printed tradition lays the two out.`,
    costs: `On a phone the mus'haf disappears behind the text, which the sheet never does. Two layouts to keep right instead of one, and the spread's turn, zoom and jump all have to know a leaf can be prose.`,
  },
];

const which = [
  {
    id: "which-a",
    key: "A",
    title: "One text, in Arabic: al-Tafsir al-Muyassar, from the Tafsir Center",
    gist: "The short tafseer the King Fahd Complex prints in the margin of its own mus'haf, taken from the Tafsir Center for Quranic Studies' openly licensed dataset, one small file per surah, fetched the first time a surah's tafseer is opened and kept.",
    takes: "One fetch pipeline, one licence line, and a check that the copy taken matches the file's recorded mark.",
    gets: "A reviewed text under a licence that allows copying, attribution and all, in the language the mus'haf is in, and a source line that can name the licence, the day and the file.",
    costs: "Arabic only, so a reader of the English chrome gets no English meaning. And the dataset names its reviewers but not the printed edition it was typed from, so the source line cannot yet name one.",
  },
  {
    id: "which-b",
    key: "B",
    title: "The same, with a choice of three Arabic texts",
    gist: "As A, with Ibn Kathir and al-Sa'di from the same dataset behind a picker at the top of the section.",
    takes: "What A takes, three times over, and a picker.",
    gets: "A long and a short tafseer for a reader who wants more than the margin text.",
    costs: "Three times the storage per surah, a control the section did not need, and Ibn Kathir's entries run to pages, which the sheet's ceiling was never drawn for.",
  },
  {
    id: "which-c",
    key: "C",
    title: "Look each verse up live, from the Quran Foundation's service",
    gist: "No copy kept. The section asks the Quran Foundation's service for the verse each time, from a catalogue of over a hundred tafseers in several languages, English included.",
    takes: "A key for the service, a check on its terms, and a way to say no when the network is away.",
    gets: "English and Arabic both, and the widest catalogue of any source found.",
    costs: "Nothing offline, which the rest of the app is; a rate limit; and no licence text was found on the service's pages, so the terms are unconfirmed.",
  },
];

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Should the app show a tafseer of the selected verse?</title>
<style>
  :root{
    --bg:#f6f4ef; --panel:#fffdf9; --ink:#211d17; --ink-2:#6a6156; --line:#e3ddd1;
    --line-soft:#efeae0; --accent:#8a6d3b; --accent-soft:#f0e7d6; --lean:#3f6f5f; --lean-soft:#e2efe9;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --bg:#17150f; --panel:#201d16; --ink:#efe9dd; --ink-2:#a79c8a; --line:#332e23;
      --line-soft:#2a261d; --accent:#c8a565; --accent-soft:#332a1a; --lean:#7fb59f; --lean-soft:#1e2b26;
    }
  }
  :root[data-theme="dark"]{
    --bg:#17150f; --panel:#201d16; --ink:#efe9dd; --ink-2:#a79c8a; --line:#332e23;
    --line-soft:#2a261d; --accent:#c8a565; --accent-soft:#332a1a; --lean:#7fb59f; --lean-soft:#1e2b26;
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
  figcaption{font-size:.86rem; color:var(--ink-2); max-width:44ch; margin-top:.6rem; line-height:1.45}
  figure.phone figcaption{max-width:${PHONE.w}px}
  figure.laptop figcaption{max-width:${LAPTOP.w * LAPTOP_SCALE}px}
  .screen{position:relative; overflow:hidden; background:${T.paper}; border:1px solid var(--line); border-radius:22px; box-shadow:0 10px 30px rgba(0,0,0,.12)}
  .phone-top{height:56px; display:flex; align-items:center; padding:0 ${T.space4}px; font:600 ${T.textSm}/1 ${T.fontLatin}; color:${T.inkSoft}; background:${T.paperRaised}; border-bottom:1px solid ${T.hairline}}
  .print{display:block}
  .print.crop{border:1px solid ${T.hairline}; background:${T.paper}}
  .scrim{position:absolute; inset:0; background:rgba(38,32,26,.28)}
  .sheet-pos{position:absolute; left:0; right:0; bottom:0}
  .viewport{overflow:hidden; border:1px solid var(--line); border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.12); max-width:100%}
  .window{position:relative; transform-origin:top left; background:#a5876b; background-image:linear-gradient(#b59a7e, #8f7358)}
  .chrome{height:68px; background:${T.paper}; border-bottom:1px solid ${T.hairline}; display:flex; align-items:center; justify-content:center; gap:.6ch; font:${T.textMd}/1 ${T.fontLatin}; color:${T.inkSoft}}
  .leaf{position:absolute; background:${T.paper}; box-shadow:0 2px 8px rgba(0,0,0,.25)}
  .leaf.column{padding:${T.space5}px ${T.space4}px; display:flex; flex-direction:column; gap:${T.space3}px}
  .card-pos{position:absolute}
  .side-by-side{display:flex; gap:24px; align-items:flex-end; flex-wrap:wrap}
  .full{position:absolute; inset:0; background:${T.paperRaised}; padding:${T.space4}px; display:flex; flex-direction:column; gap:${T.space3}px}
  .full .print.crop{width:100%; height:auto}

  /* The sheet, read from its stylesheet: the same paper, radius, shadow and row shape. */
  .sheet{background:${T.paperRaised}; box-shadow:${T.shadow2}; padding:${T.space3}px ${T.space4}px ${T.space5}px; font-family:${T.fontLatin}; color:${T.ink}; max-height:${Math.round(SHEET_VH * 100)}vh; overflow:hidden}
  .sheet.phone{width:${PHONE.w}px; border-radius:${T.radiusLg} ${T.radiusLg} 0 0; max-height:${ceiling(PHONE)}px}
  .sheet.card{width:${cardW}px; border-radius:${T.radiusLg}; max-height:${ceiling(LAPTOP)}px}
  .grip{width:40px; height:4px; margin:0 auto ${T.space2}px; border-radius:${T.radiusPill}; background:${T.hairline}}
  .head{display:flex; align-items:center; gap:${T.space2}px; padding-bottom:${T.space2}px; border-bottom:1px solid ${T.hairline}; min-height:${HEAD_H}px}
  .glyph{font-size:${T.textLg}; color:${T.accentStrong}}
  .glyph.small{font-size:${T.textMd}; margin-right:${T.space2}px}
  .title{flex:1; font-size:${T.textMd}; font-weight:600}
  .close{min-width:${T.touch}px; min-height:${T.touch}px; display:grid; place-items:center; color:${T.inkSoft}; font-size:${T.textMd}}
  .list{list-style:none; margin:0; padding:0}
  .row{padding:${T.space3}px 0; border-bottom:1px solid ${T.hairline}}
  .row:last-child{border-bottom:none}
  .rowMain{display:flex; align-items:center; gap:${T.space3}px}
  .rowText{flex:1; display:flex; flex-direction:column; gap:2px; min-width:0}
  .rowLabel{display:flex; align-items:center; gap:${T.space2}px; font-size:${T.textMd}; color:${T.ink}}
  .caret{margin-left:auto; color:${T.inkFaint}; font-size:${T.textSm}}
  .caret.out{color:${T.accentStrong}}
  .badge{padding:0 ${T.space2}px; border-radius:${T.radiusPill}; background:${T.accentTint}; color:${T.accentStrong}; font-size:${T.textXs}}
  .note{display:block; color:${T.inkSoft}; font-size:${T.textSm}; line-height:1.4}
  .hop{flex:none; display:grid; place-items:center; min-width:${T.touch}px; min-height:${T.touch}px; border-radius:${T.radiusMd}; background:${T.accent}; color:${T.paperRaised}; font-size:${T.textLg}}
  .row.section{padding-bottom:0}
  .tafseer{padding:${T.space3}px 0 ${T.space2}px}
  .lines{display:flex; flex-direction:column; gap:${LINE_H - 12}px}
  .bar{display:block; height:12px; border-radius:6px; background:${T.inkSoft}; opacity:.28}
  .bar.ar{margin-left:auto}
  .bar.note-bar{height:8px; margin-top:4px; opacity:.22}
  .leaf.column .lines{gap:${LINE_H - 12}px}
  .prov{margin-top:${T.space3}px; padding-top:${T.space2}px; border-top:1px solid ${T.hairline}; font-family:${T.fontLatin}; font-size:${T.textXs}; color:${T.inkSoft}; line-height:1.4}
  .prov-demo{background:${T.paperRaised}; border:1px solid ${T.hairline}; border-radius:${T.radiusLg}; padding:${T.space4}px; width:${cardW}px; max-width:100%}
  .prov.big{margin-top:0; border-top:none; padding-top:0}
  .prov.big + .prov.big{margin-top:${T.space3}px; padding-top:${T.space3}px; border-top:1px solid ${T.hairline}}
  .prov.faint{color:${T.inkFaint}}
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
<svg class="defs" aria-hidden="true"><symbol id="p${RIGHT_PAGE}" viewBox="0 0 ${VBW} ${VBH}">${right}</symbol><symbol id="p${LEFT_PAGE}" viewBox="0 0 ${VBW} ${VBH}">${left}</symbol></svg>
<div class="wrap">
  <p class="eyebrow">Hifth · a decision, drawn</p>
  <h1>Should the app show a tafseer of the selected verse, and where?</h1>
  <p class="lede">Two questions, both open. Every drawing below is the real page 7 of the print with verse 2:48 selected, at the size a phone or a laptop would show it. The bars stand in for tafseer text: none exists in this repository, and the amount that <em>fits</em> is what the placement question turns on.</p>

  <h2>A few words, defined once</h2>
  <dl class="gloss">
    <dt>Tafseer</dt><dd>An explanation of what a verse means, written by a scholar. Several classical ones exist; they differ in length by a hundredfold.</dd>
    <dt>Verse</dt><dd>One numbered sentence of the Qur'an. 2:48 is the forty-eighth verse of the second surah, Al-Baqarah.</dd>
    <dt>The sheet</dt><dd>What opens when a verse is tapped and one of its chips pressed: on a phone it rises from the bottom; on a laptop it is a card in the corner, over the leaf the verse is not on.</dd>
    <dt>The facing leaf</dt><dd>On a laptop the app shows two pages side by side like an open book. The facing leaf is the other one.</dd>
    <dt>Provenance</dt><dd>Where a text came from and how a reader can tell: who wrote it, which edition, who typed it, under what licence, and whether the copy here is the copy they published.</dd>
  </dl>

  <h2>Why is this being asked now?</h2>
  <p>The plan that started this app lists "tafsir reading" among the things it would not do in its first version: the app is a navigator between verses, not a reader of commentary on them. On 2026-09-01 the desktop triage asked for a tafseer section inside the verse's options all the same, with its text sourced and its provenance checked. That is a reversal of a written non-goal, and only the owner can make it. This page is the question put plainly, with each answer drawn.</p>

  <h2>What happens if nobody decides?</h2>
  <p>Nothing breaks. The sheet works today as option A, the plan stands, and no other feature waits on this one. The cost is only the feature itself, and a small one on the other side: the app's links data already reserves a kind of link for tafseer, which renders nothing until something is decided. This can stay open for as long as it likes.</p>

  <h2>What does the app do today?</h2>
  <div class="drawings">${todayPhone}${todayLaptop}</div>
  <p>Tap 2:48 and the app offers two chips: ↻ for the ${inSurah.length} verses in this surah it resembles, ▶ for the ${elsewhere.length} elsewhere in the book. The sheet lists them with a note where one is worth a note, and a hop button that turns the book to that page. Nothing in it says what the verse means.</p>

  <h2>What have we already decided that touches this?</h2>
  <ul>
    <li><b>No reader features in the first version.</b> The plan names audio, translation and tafseer reading as things this app is not. Options C and D reopen that; A and B do not.</li>
    <li><b>The app ships no Qur'an text.</b> The print is outlined shapes and every shipped file is checked for it. A tafseer is not Qur'an, but it quotes the Qur'an constantly, so the first tafseer file is the first shipped file with the Qur'an's words in it. That rule would need restating, not breaking: the words would arrive as a fetched text, not in the app's own bundle.</li>
    <li><b>The sheet rises over the facing leaf.</b> Decided on 2026-09-02: on a laptop the card sits over the leaf the verse is not on, so it never covers what it is about. Option C inherits that and grows inside it; option D takes the idea to its end and gives the whole leaf over.</li>
    <li><b>The bundle has a ceiling.</b> The app's own code is held to a size budget with about thirty kilobytes to spare. No tafseer fits in that, so any text is fetched when wanted and kept by the app's offline store, never bundled.</li>
    <li><b>Every dependency is named and licensed.</b> The app carries a notice naming each thing it distributes and its licence. A tafseer text is a new row in it, with an attribution line the licence requires.</li>
  </ul>

  <h2 class="q" id="where">Where would a tafseer sit, if anywhere?</h2>
  <div class="options">
    ${opt(where[0], `${todayPhone}${todayLaptop}`)}
    ${opt(where[1], `${optB_phone}${optB_laptop}`)}
    ${opt(where[2], `${optC_phone}${optC_laptop}${optC_card}`)}
    ${opt(where[3], `${optD_laptop}${optD_phone}`)}
  </div>
  <p class="aside">How the lines were counted: the sheet's ceiling is ${Math.round(SHEET_VH * 100)}% of the window's height, read from its stylesheet. From that, take the sheet as it is today (${todayH} px for this verse: padding, grip, head and ${inSurah.length} hop rows of ${ROW_H} px), a row for the section itself, and ${PROVENANCE_H} px for the source line. What remains is divided by ${LINE_H} px, one line of Arabic prose at the sheet's body size. A longer hop list leaves fewer lines; a verse with one hop leaves ${Math.floor((ceiling(PHONE) - (todayH - ROW_H) - SECTION_HEAD_H - PROVENANCE_H) / LINE_H)} on a phone.</p>

  <h2 class="q" id="which">Which text, and how would a reader know what they are reading?</h2>
  <p>This question only matters if C or D wins the first; B needs only an address to point at, and A needs nothing. It is here because the answer constrains the first: a text that cannot be copied cannot be shown inside the app at all.</p>
  <div class="tbl"><table>
    <thead><tr><th>Source</th><th>What it has</th><th>Licence</th><th>Names an edition</th><th>Names a version</th><th>Can be kept offline</th></tr></thead>
    <tbody>
      <tr><td><a href="https://huggingface.co/datasets/tafsircenter/tafsir-mcp-data">Tafsir Center for Quranic Studies</a></td><td>al-Muyassar, al-Tabari, Ibn Kathir, al-Baghawi, al-Sa'di in Arabic; the Center's own short tafseer in Arabic, English and Bengali</td><td>CC BY 4.0, attribution to the Center</td><td>No: "reviewed and certified" by its scholars</td><td>No: a change history only</td><td>Yes</td></tr>
      <tr><td><a href="https://qul.tarteel.ai/resources/tafsir">Quranic Universal Library (Tarteel)</a></td><td>108 tafseers, 55 in Arabic, 5 in English</td><td>Varies by resource; each must be checked</td><td>Not shown</td><td>No</td><td>Yes, where the resource's licence allows</td></tr>
      <tr><td><a href="https://api-docs.quran.foundation/docs/content_apis_versioned/4.0.0/tafsirs/">Quran Foundation content service</a></td><td>Over a hundred tafseers, per verse, Arabic and English</td><td>Not found on its pages</td><td>No</td><td>No</td><td>No: a live service with a key and a rate limit</td></tr>
      <tr><td><a href="https://quranenc.com/en/home/api/">Noor International (quranenc.com)</a></td><td>Translations and a few short tafseers; not al-Muyassar</td><td>Copy and republish unchanged, with credit and the version number</td><td>No</td><td><b>Yes</b>, and requires it be cited</td><td>Yes</td></tr>
      <tr><td>Community mirrors of the above</td><td>Per-verse files, convenient shape</td><td>Code open; the data's licence unstated</td><td>No</td><td>No</td><td>Yes</td></tr>
    </tbody>
  </table></div>
  <p>Looked for and not usable without written permission: the English Ibn Kathir (Darussalam), the English al-Jalalayn (Royal Aal al-Bayt Institute) and the English al-Sa'di (IIPH), all of which reserve their rights. No source found publishes a checksum; a reader can only be told which file this is if the app records the mark of the file it fetched, the day, and the address, itself.</p>
  <div class="options">
    ${opt(which[0], provenanceLine)}
    ${opt(which[1], "")}
    ${opt(which[2], "")}
  </div>

  <h2>What do people outside this project do?</h2>
  <p>Looked at on 2026-09-02. Tarteel opens a sheet from the verse with a tafseer item in it, per verse, in English and Arabic. Quran.com opens a panel from the verse's menu and, because its texts are stored per group of verses, says which verses the passage covers. Greentech's Al Quran opens the tafseer of a tapped verse and lets the reader step to the next without going back. The King Fahd Complex's own app, and the accessible Mus'haf app built on its page layout, both offer a tafseer lookup from the verse's quick actions. The pattern is the same everywhere: one item in the verse's sheet, opened per verse, the source named at the top, a picker when there is more than one. Nobody found lays the meaning on the facing leaf as option D does; the printed tradition does, in the margin of the King Fahd mus'haf, which is where al-Muyassar comes from. Muslim Pro, Ayah, Golden Quran and Quran Majeed were not looked at closely.</p>
  <p>What does not transfer: those apps are readers, with the Qur'an's text in them and a translation beside it, so a tafseer is one more text in a stack of texts. This app has no text at all, which is why the first one is a decision and not a feature.</p>

  <h2>What else could be considered, and why is it not here?</h2>
  <ul>
    <li><b>An English tafseer.</b> Every English text found is either all-rights-reserved or of unstated licence. The Tafsir Center's own short English summary is the one openly licensed English text, and it is a summary, not a named classical work. Left off until one is found or permission is asked.</li>
    <li><b>A translation instead.</b> Also a non-goal in the plan, and a different decision: a translation is per verse and short, which changes the first question entirely. Not this page.</li>
    <li><b>Writing a tafseer in.</b> Out of the question; the app is not a scholar.</li>
    <li><b>A hover on a laptop.</b> Meaning on hover, no sheet. Too small to hold a paragraph and nothing for a phone to do. Left off.</li>
  </ul>

  <h2>What would change the answer?</h2>
  <ul>
    <li>An openly licensed English tafseer of a named edition would make C or D worth far more to a reader of the English chrome, and would reopen the second question.</li>
    <li>A source that names its printed edition and publishes a version and a checksum would make the source line honest without the app having to compute its own.</li>
    <li>A hafiz saying, after using B for a month, that leaving the app is the thing they mind. That is the measurement A and B are waiting for, and the reason to do B before C.</li>
    <li>The bundle budget being raised, or the offline store being made to hold text as well as pages, which C and D both need in any case.</li>
  </ul>

  <h2>What is this not settling?</h2>
  <ul>
    <li>Whether the app shows a translation. Same plan, same non-goal, different page.</li>
    <li>Whether the section belongs to the ↻ chip's sheet, the ▶ chip's, or a sheet of its own. Drawn under the ↻ sheet here because that is the one a reader has open; the row would be the same under any.</li>
    <li>How the offline store keeps a fetched text, or when it lets one go.</li>
    <li>What the "similar verses" notes in the sheet say. One of them is in Arabic and is drawn as a bar here for the same reason the tafseer is.</li>
  </ul>

  <h2>So what is being decided?</h2>
  <p>Two things, in order. First, whether a tafseer belongs in the app at all and where it would sit: nowhere (A), as a row that opens it elsewhere (B), as a section inside the sheet (C), or on the facing leaf (D). Second, only if C or D: which text the app would copy and how it would say so — al-Muyassar alone (A), three Arabic texts with a picker (B), or a live lookup with no copy kept (C). The first reopens a written non-goal, and that is the owner's to reopen.</p>

  <footer>Rebuilt by <span class="num">scripts/build-tafseer-options.mjs</span> from the print's page 7 and 8, the hop data for surah 2, the sheet's stylesheet and the app's design tokens. Leaf size measured in the running app at 1440 × 900 on 2026-09-02. The record is <span class="num">docs/decisions/tafseer.md</span>.</footer>
</div>
</body>
</html>
`;

const arabic = html.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g);
if (arabic) die(`refusing to write: the page carries ${arabic.length} Arabic codepoint(s)`);
if (/<text\b/.test(html)) die("refusing to write: the page carries a <text> element");
writeFileSync(OUT, html);
console.log(
  `wrote ${OUT.replace(ROOT, "")} (${(html.length / 1024).toFixed(0)} KB) — today ${todayH}px; fits phone ${phoneFit.lines} / card ${laptopFit.lines} / leaf ${leafColumn.lines} / phone-full ${phoneFull.lines} lines`,
);
