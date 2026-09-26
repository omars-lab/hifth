/**
 * Cut a verse out of the printed mus'haf page, with real geometry over it.
 *
 * Both the decision page (`build-similar-ayah-gap.mjs`) and the reader page
 * (`build-twins-explainer.mjs`) draw the same specimen: a verse crop from the
 * artwork the app already ships, neighbours faded, the whole verse optionally
 * washed green and named words optionally marked yellow. Neither retypes a
 * letter — the crop reads the shipped `WordIndex`, the same one the app calls.
 *
 * It was extracted when the second page needed it; the decision page rebuilds
 * byte-identical from it, which is what makes that a refactor rather than a
 * claim about one. Both pages live under `docs/design/`, so the relative reach
 * to the print (`PRINT_HREF`) is the same for both.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import { WordIndex } from "../packages/core/dist/index.js";

const ASSETS = join(ROOT, "apps/web/public/assets");
const WORDS = join(ASSETS, "words/hafs-kfqc");

/** Where a checked-in page under docs/design/ reaches the print from. */
export const PRINT_HREF = (page) => `../../apps/web/public/assets/pages/hafs-kfqc/${page}.svg`;

/** Breathing room around a crop, in page units — about a letter's width. */
const PAD = 2;

const shardCache = new Map();
function indexOf(page) {
  if (!shardCache.has(page)) {
    try {
      shardCache.set(page, new WordIndex(JSON.parse(readFileSync(join(WORDS, `${page}.json`), "utf8"))));
    } catch {
      shardCache.set(page, null);
    }
  }
  return shardCache.get(page);
}

// verse key -> page, built once from the shipped word geometry.
const v2p = new Map();
for (const f of readdirSync(WORDS)) {
  if (!f.endsWith(".json")) continue;
  const d = JSON.parse(readFileSync(join(WORDS, f), "utf8"));
  for (const k of Object.keys(d.words ?? {})) if (!v2p.has(k)) v2p.set(k, d.page);
}

function unionOf(rs) {
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  for (const q of rs) {
    l = Math.min(l, q.x);
    t = Math.min(t, q.y);
    r = Math.max(r, q.x + q.width);
    b = Math.max(b, q.y + q.height);
  }
  return { x: l, y: t, width: r - l, height: b - t };
}

function printSize(page) {
  const vb = readFileSync(join(ASSETS, `pages/hafs-kfqc/${page}.svg`), "utf8").match(/viewBox="([^"]+)"/);
  const [, , w, h] = vb[1].split(/\s+/).map(Number);
  return { w, h };
}

const n = (v) => Number(v.toFixed(2));
const vb = (r) => `${n(r.x)} ${n(r.y)} ${n(r.width)} ${n(r.height)}`;
const box = (r) => `M${n(r.x)} ${n(r.y)}H${n(r.x + r.width)}V${n(r.y + r.height)}H${n(r.x)}Z`;
const wash = (cls, r) =>
  `<rect class="${cls}" x="${n(r.x - 0.5)}" y="${n(r.y - 0.5)}" width="${n(r.width + 1)}" height="${n(r.height + 1)}" rx="1"></rect>`;

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * One verse, cut out of its printed page. Neighbours that the crop rectangle
 * catches are faded (the same treatment the app itself uses). `green` washes
 * the whole verse; `mark` washes named words yellow.
 */
export function crop(key, { green = false, mark = null } = {}) {
  const page = v2p.get(key);
  const idx = indexOf(page);
  const sp = idx.span(key);
  const bands = idx.bandsFor(key, sp.from, sp.to);
  const u = unionOf(bands);
  const frame = { x: u.x - PAD, y: u.y - PAD, width: u.width + PAD * 2, height: u.height + PAD * 2 };
  const { w, h } = printSize(page);
  const holes = bands.map((b) => box({ x: b.x - 1, y: b.y - 1, width: b.width + 2, height: b.height + 2 }));
  const greens = green ? bands.map((r) => wash("w-share", r)).join("") : "";
  const yellows = mark ? mark.map((i) => idx.boxOf(key, i)).filter(Boolean).map((r) => wash("w-diff", r)).join("") : "";
  return (
    `<svg class="art" viewBox="${vb(frame)}" aria-hidden="true" focusable="false">` +
    `<image href="${PRINT_HREF(page)}" x="0" y="0" width="${w}" height="${h}"></image>` +
    `<path class="scrim" d="${box(frame)}${holes.join("")}" fill-rule="evenodd"></path>` +
    greens +
    yellows +
    `</svg>`
  );
}

export function twinPanel([a, b], opts = {}) {
  const marks = opts.mark ?? {};
  const one = (k) => `<figure class="crop"><figcaption>${k}</figcaption>${crop(k, { green: opts.green, mark: marks[k] })}</figure>`;
  const note = opts.note ? `<p class="note">${esc(opts.note)}</p>` : "";
  return `<div class="pair">${one(a)}${one(b)}${note}</div>`;
}
