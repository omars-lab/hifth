#!/usr/bin/env node
/**
 * CI gate: the committed page SVGs are the pinned corpus, unedited.
 *
 * PLAN §8 has said since Loop 0 that vendored bytes are never hand-edited.
 * Nothing checked it. That was tolerable while the corpus was three files a
 * reviewer could read in a diff; at 604 files and 91 MB it is not — a one-glyph
 * "fix" to a page, or a stray page from an aborted `vendor:pages` run, would
 * land in a pull request as a wall of minified path data that no human reviews
 * and no test notices.
 *
 * So `packages/etl/data/pages/quran-svg.pin.json` carries a SHA-256 per page of
 * exactly the bytes `vendor-pages.mjs` writes, and this gate checks them. It is
 * the offline half of the vendoring story: `vendor:pages` verifies the
 * *upstream* hashes when it runs (proving the fetch got what was pinned), and
 * this gate verifies the *vendored* hashes on every CI run (proving what is
 * committed is what that recipe produced), without needing the 348 MB corpus or
 * a network.
 *
 * It deliberately does not weigh anything — `gate:assets` owns the per-page and
 * whole-mus'haf byte ceilings, and two gates arguing about the same number is
 * how a ceiling gets raised by accident.
 *
 * Also checked: the count. A missing page is not a rendering bug, it is an ayah
 * that cannot be reached, and the manifest alone would not catch it — the
 * manifest is derived from whatever pages happen to be present.
 *
 * And, since PLAN follow-up 14: whether a polygon covers its own ayah. Every
 * check above is about *identity* — are these the bytes we pinned — and none of
 * them would notice a page whose bytes are exactly right and whose polygons
 * leave a line of scripture untappable. Eleven pages do. The three signatures
 * that find them are below, in `readBands`'s callers; the eleven pages are
 * listed in KNOWN, asserted exactly, so a twelfth fails loudly and a repaired
 * one fails too rather than rotting into a permanent excuse.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const PIN_FILE = join(REPO, "packages", "etl", "data", "pages", "quran-svg.pin.json");
const PAGES_DIR = join(REPO, "apps", "web", "public", "assets", "pages", "hafs-kfqc");

const failures = [];
const fail = (msg) => failures.push(msg);

const pin = JSON.parse(readFileSync(PIN_FILE, "utf8"));
const expected = pin.pages.length;

if (expected === 0) {
  console.error(
    "FAIL gate:pages — the pin lists no pages. Run `pnpm --filter @hifth/etl vendor:pages --repin`.",
  );
  process.exit(1);
}

const onDisk = readdirSync(PAGES_DIR).sort();
const svgs = onDisk.filter((f) => /^\d+\.svg$/.test(f));

const stray = onDisk.filter((f) => !svgs.includes(f));
if (stray.length) {
  fail(`${stray.length} file(s) in the page directory are not page SVGs: ${stray.join(", ")}`);
}

let verified = 0;
const missing = [];
const altered = [];

for (const entry of pin.pages) {
  const file = join(PAGES_DIR, `${entry.page}.svg`);
  if (!existsSync(file)) {
    missing.push(entry.page);
    continue;
  }
  const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
  if (digest !== entry.vendored) altered.push(entry.page);
  else verified++;
}

const extraOnDisk = svgs
  .map((f) => Number(f.replace(".svg", "")))
  .filter((p) => !pin.pages.some((e) => e.page === p));

if (missing.length) {
  fail(
    `${missing.length} pinned page(s) are not committed (first: ${missing[0]}) — ` +
      `an ayah on a missing page cannot be reached. Run \`vendor:pages\`.`,
  );
}
if (altered.length) {
  fail(
    `${altered.length} page SVG(s) do not match the pin (first: page ${altered[0]}). ` +
      `Vendored bytes are never hand-edited (PLAN §8): re-run ` +
      `\`pnpm --filter @hifth/etl vendor:pages\` to restore them, or if the change is ` +
      `deliberate, bump the pin with \`--repin\` and say why in the commit.`,
  );
}
if (extraOnDisk.length) {
  fail(
    `${extraOnDisk.length} page SVG(s) are committed but not in the pin ` +
      `(first: page ${extraOnDisk[0]}) — a leftover from an aborted vendoring run?`,
  );
}

/* ------------------------------------------- does a polygon cover its ayah? */

/**
 * The eleven pages where it does not, and why — PLAN follow-up 14, found by the
 * word-registration probe and reproduced here from the committed bytes alone.
 *
 *   "leading"  the page's topmost band sits a full line or more below where
 *              pages start, while the page's first polygon is mid-surah. The
 *              ayah flows in from the previous page and its first line or five
 *              carry no polygon at all: on p545, `58:22` runs across five full
 *              lines with nothing to tap; on p575, `73:20` across six.
 *   "gap"      an uncovered horizontal strip between two bands where the band
 *              below is *not* an `X:1`. A surah header leaves a 63–80 unit gap
 *              on 64 pages and that is the print, not a hole, which is why the
 *              ayah number and not the width is what separates them.
 *
 * This is an allow-list and not a baseline number on purpose: a twelfth page
 * fails, and so does a repaired one. When the repair lands, the entry comes out
 * in the same commit that changes the bytes.
 */
const KNOWN = new Map([
  [431, ["gap"]],
  [545, ["leading"]],
  [551, ["leading"]],
  [554, ["leading"]],
  [564, ["leading"]],
  [566, ["leading"]],
  [575, ["leading"]],
  [594, ["leading"]],
  [599, ["leading"]],
  [602, ["gap"]],
  [604, ["gap"]],
]);

/**
 * Every subpath of `d`, as a point list. All 12 346 subpaths in the corpus are
 * straight-line polygons; a curve command would mean the shape is no longer a
 * point list and every bounding box below would be a guess, so it fails instead.
 * (A parser that assumed the axis-aligned `M…h…v…H…Z` rect form is what first
 * reported pages 1 and 2 as malformed. 189 polygons in the corpus are general
 * polygons, 11 of them on those two pages, and they are perfectly well formed.)
 */
function subpaths(d, where) {
  const out = [];
  let cx = 0,
    cy = 0,
    sx = 0,
    sy = 0,
    pts = null;
  for (const tok of d.match(/[A-Za-z][^A-Za-z]*/g) ?? []) {
    const c = tok[0];
    const n = (tok.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
    const rel = c === c.toLowerCase();
    if (c === "M" || c === "m") {
      if (pts && pts.length > 1) out.push(pts);
      cx = rel ? sx + n[0] : n[0];
      cy = rel ? sy + n[1] : n[1];
      sx = cx;
      sy = cy;
      pts = [[cx, cy]];
      for (let i = 2; i < n.length; i += 2) {
        cx = rel ? cx + n[i] : n[i];
        cy = rel ? cy + n[i + 1] : n[i + 1];
        pts.push([cx, cy]);
      }
    } else if (c === "H" || c === "h") {
      for (const v of n) pts.push([(cx = rel ? cx + v : v), cy]);
    } else if (c === "V" || c === "v") {
      for (const v of n) pts.push([cx, (cy = rel ? cy + v : v)]);
    } else if (c === "L" || c === "l") {
      for (let i = 0; i < n.length; i += 2) {
        cx = rel ? cx + n[i] : n[i];
        cy = rel ? cy + n[i + 1] : n[i + 1];
        pts.push([cx, cy]);
      }
    } else if (c === "Z" || c === "z") {
      if (pts && pts.length > 1) out.push(pts);
      pts = null;
      cx = sx;
      cy = sy;
    } else {
      fail(`${where}: polygon path uses "${c}" — only straight-line commands are understood`);
      return [];
    }
  }
  if (pts && pts.length > 1) out.push(pts);
  return out;
}

/** One band per subpath: the ayah it belongs to and the strip of page it covers. */
function readBands(page, svg) {
  const bands = [];
  for (const m of svg.matchAll(/<path\b[^>]*\bclass="ayahPolygon"[^>]*>/g)) {
    const tag = m[0];
    const d = tag.match(/\bd="([^"]+)"/)?.[1];
    const surah = Number(tag.match(/\bsurah="(\d+)"/)?.[1]);
    const ayah = Number(tag.match(/\bayah="(\d+)"/)?.[1]);
    if (!d || !surah || !ayah) {
      fail(`page ${page}: an ayahPolygon is missing its d/surah/ayah`);
      continue;
    }
    for (const pts of subpaths(d, `page ${page} ${surah}:${ayah}`)) {
      const ys = pts.map((p) => p[1]);
      bands.push({ surah, ayah, top: Math.min(...ys), bottom: Math.max(...ys) });
    }
  }
  return bands.sort((a, b) => a.top - b.top);
}

const perPage = new Map();
for (const entry of pin.pages) {
  const file = join(PAGES_DIR, `${entry.page}.svg`);
  if (!existsSync(file)) continue;
  const bands = readBands(entry.page, readFileSync(file, "utf8"));
  if (bands.length) perPage.set(entry.page, bands);
}

/**
 * Where a page starts, and how tall a line is — both read off the corpus rather
 * than written down, so the thresholds move with the print instead of pinning
 * this gate to one edition's numbers.
 */
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const pageTop = median([...perPage.values()].map((b) => b[0].top));
const lineHeight = median([...perPage.values()].flatMap((b) => b.map((x) => x.bottom - x.top)));

const found = new Map();
const note = (page, kind) => {
  if (!found.has(page)) found.set(page, new Set());
  found.get(page).add(kind);
};

for (const [page, bands] of perPage) {
  if (bands[0].ayah !== 1 && bands[0].top > pageTop + lineHeight) note(page, "leading");
  let covered = bands[0].bottom;
  for (const band of bands.slice(1)) {
    if (band.top - covered > 2 && band.ayah !== 1) note(page, "gap");
    covered = Math.max(covered, band.bottom);
  }
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const kindsOf = (m, p) => [...(m.get(p) ?? [])].sort();
for (const page of new Set([...KNOWN.keys(), ...found.keys()].sort((a, b) => a - b))) {
  const want = KNOWN.get(page) ?? [];
  const got = kindsOf(found, page);
  if (same(want.slice().sort(), got)) continue;
  if (!want.length) {
    fail(
      `page ${page}: an ayah polygon does not cover its ayah (${got.join(", ")}) and this page ` +
        `is not one of the eleven PLAN follow-up 14 recorded. Either the corpus pin moved or a ` +
        `repair regressed — do not add it to KNOWN without saying which.`,
    );
  } else if (!got.length) {
    fail(
      `page ${page}: KNOWN says its polygons miss their ayah (${want.join(", ")}) and they no ` +
        `longer do. If that is the repair landing, delete the entry in this commit.`,
    );
  } else {
    fail(`page ${page}: expected ${want.join(", ")} from PLAN 14, found ${got.join(", ")}.`);
  }
}

if (failures.length) {
  console.error("FAIL gate:pages");
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}

console.log(
  `gate:pages — ${verified}/${expected} page SVGs match ` +
    `${pin.repo}@${pin.commit.slice(0, 8)} via svgo ${pin.svgo.version}; ` +
    `polygon coverage as recorded (${KNOWN.size} pages short of their ayah, PLAN 14)`,
);
