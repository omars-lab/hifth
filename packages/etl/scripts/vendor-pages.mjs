#!/usr/bin/env node
/**
 * Vendor the 604 mushaf page SVGs of the `hafs-kfqc` edition from the pinned
 * quran-svg corpus into apps/web/public/assets/pages/hafs-kfqc/.
 *
 * This is the ONE script in the ETL that touches the network, and the one
 * script CI does not run. Its input is 348 MB of upstream SVG — too large to
 * vendor under packages/etl/data/ the way mutashabihat, roots and tajweed
 * vendor theirs. So the pattern inverts: instead of committing the input, we
 * commit a *pin* (packages/etl/data/pages/quran-svg.pin.json) carrying a
 * SHA-256 for every upstream file and for every byte we write, and fetch into
 * a gitignored cache. The pin is what makes "run it again and get the same
 * bytes" checkable without carrying the corpus.
 *
 *   pnpm --filter @hifth/etl vendor:pages            verify cache, optimize, write
 *   pnpm --filter @hifth/etl vendor:pages --fetch    download what the cache lacks first
 *   pnpm --filter @hifth/etl vendor:pages --repin    recompute the pin (after a pin bump)
 *
 * The split from extract-pages.mjs is the important part. This script produces
 * page SVGs; extract-pages.mjs derives the anchors *from those committed SVGs*,
 * offline, in CI. That keeps the repo's determinism check intact — and makes it
 * say something stronger than it did before: the anchors that ship are provably
 * derived from the page bytes that ship.
 *
 * Immutability (PLAN §8): upstream bytes are never hand-edited. Three
 * transforms are applied, all declared, all reproducible, all asserted:
 *
 *   1. svgo, at the exact version and config recorded in the pin. The config is
 *      not a taste call — it was recovered by search against the three pages
 *      Loop 0 shipped, and it reproduces all three byte-for-byte. That
 *      reproduction is this script's self-test (see --verify-loop0 below, which
 *      runs unconditionally): the new pipeline must re-derive what the old one
 *      shipped before it is trusted with the other 601 pages.
 *
 *   2. Two `id` repairs. Upstream carries path geometry in the `id` attribute
 *      of exactly two ayah polygons (19:3 on p305, 75:5 on p577) where every
 *      other polygon carries `verse-<absolute ayah>`. We rewrite those two to
 *      the id they should have had, and assert that the count is exactly two
 *      and the ayahs are exactly those two — so a future pin that fixes them
 *      upstream fails loudly instead of drifting silently.
 *
 *   3. Twenty-three polygon repairs across nineteen pages (PLAN follow-up 14).
 *      Upstream gives some ayahs a tappable box that does not cover the ayah:
 *      a page's first ayah given only its last line, two lines of scripture
 *      under one line of polygon, a rect squashed off the line grid. The ayah
 *      is still on the page and still readable — it simply cannot be tapped,
 *      which for this app means it cannot be reached. Each repair carries the
 *      exact upstream `d` it replaces, so a pin that fixes one upstream dies
 *      rather than silently re-breaking it, and `gate:pages` re-derives the
 *      defect from the committed bytes independently (it knows nothing of this
 *      table — it measures ink against polygon and demands zero orphans).
 *
 *      Unlike (2), this runs *before* svgo: svgo rewrites path data at
 *      floatPrecision 1, so a `from` string written against optimized output
 *      would be matching this pipeline's own rounding rather than upstream.
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { optimize } from "svgo";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const DATA = join(HERE, "..", "data", "pages");
const PIN_FILE = join(DATA, "quran-svg.pin.json");
const CACHE = join(DATA, ".cache");
const PAGES_DIR = join(REPO, "apps", "web", "public", "assets", "pages", "hafs-kfqc");

const PAGES = 604;
const FETCH_CONCURRENCY = 12;
const FETCH_RETRIES = 4;

/**
 * The three pages Loop 0 vendored by hand out of the design mock. They are the
 * fixture: this pipeline must reproduce them byte-for-byte from the pin, or the
 * ten committed golden images and every geometry assumption in the app are
 * being quietly rebased on a different corpus.
 */
const LOOP0_PAGES = [7, 9, 19];

/**
 * Upstream `id` defects, as {page, number(SSSAAA)}. Both hold path geometry
 * instead of `verse-<n>`. Asserted exactly — see the header.
 */
const ID_REPAIRS = [
  { page: 305, number: 19003 },
  { page: 577, number: 75005 },
];

/**
 * Upstream polygons that do not cover their own ayah, as {page, number(SSSAAA),
 * from, to} — PLAN follow-up 14. `from` is the exact upstream `d`, matched
 * before svgo touches it, so a pin that repairs one upstream fails loudly.
 *
 * Four shapes of defect, all measured off the page's own geometry — its line
 * pitch (the modal rect height), or the ink either side of a boundary — rather
 * than a number chosen to make a page look right:
 *
 *   the abandoned leading line   an ayah flowing in from the previous page is
 *                                given only its last line or two; the rest of
 *                                its run has no polygon at all. The repair
 *                                extends the first rect up to where the page's
 *                                fifteen-line block starts.
 *   the swallowed line           one line of polygon over two lines of ink.
 *   the displaced rect           a rect off the line grid — squashed to 28.8
 *                                or stretched to 46.2 where the print sets 36 —
 *                                so its top edge cuts through a line of
 *                                scripture. Repairing one of these moves the
 *                                neighbouring ayah's rect too, which is why
 *                                pages 294, 468 and 560 carry two entries: the
 *                                strip between them belongs to exactly one of
 *                                them, and both boxes must agree where.
 *   the stranded first word      an ayah that begins at the far end of a line
 *                                and runs onto the next is given only its
 *                                next-line rect; its first word is left inside
 *                                the previous ayah's. Page 577 is the only one,
 *                                and it carries two entries for the same reason
 *                                the displaced rects do.
 *
 * The first three shapes are the ones `gate:pages` can see: it measures ink
 * against polygon and demands zero orphans. The fourth is invisible to it —
 * the ink *is* covered, by the wrong ayah — and was found instead by the
 * ligature corpus, an independent print of the same page whose per-word boxes
 * transfer onto our frame (`build-words.mjs`). Over all 604 pages, 86,965
 * lexical words land in their own ayah's polygon and exactly one did not:
 * p577 75:5#1. One witness cannot see what the other can, which is the whole
 * argument for having two.
 */
const POLYGON_REPAIRS = [
  // p227: two 28.8-unit rects where the ink sets two lines of 35.96
  {
    page: 227,
    number: "011046",
    from: "M 0.0 24.0 L 345.0 24.0 L 345.0 52.8 L 0.0 52.8 Z M 0.0 52.8 L 345.0 52.8 L 345.0 81.61 L 0.0 81.61 Z",
    to: "M 0.0 9.69 L 345.0 9.69 L 345.0 45.65 L 0.0 45.65 Z M 0.0 45.65 L 345.0 45.65 L 345.0 81.61 L 0.0 81.61 Z",
  },
  // p294: 18:5 given one rect, and 18:6 left claiming the first line
  {
    page: 294,
    number: "018005",
    from: "M 136.23 20.5 L 345.0 20.5 L 345.0 56.5 L 136.23 56.5 Z",
    to: "M 0.0 5.99 L 345.0 5.99 L 345.0 41.8 L 0.0 41.8 Z M 136.23 41.8 L 345.0 41.8 L 345.0 77.59 L 136.23 77.59 Z",
  },
  {
    page: 294,
    number: "018006",
    from: "M 0.0 20.5 L 136.23 20.5 L 136.23 77.59 L 0.0 77.59 Z M 31.29 77.59 L 345.0 77.59 L 345.0 113.57 L 31.29 113.57 Z",
    to: "M 0.0 41.8 L 136.23 41.8 L 136.23 77.59 L 0.0 77.59 Z M 31.29 77.59 L 345.0 77.59 L 345.0 113.57 L 31.29 113.57 Z",
  },
  // p431: one line of polygon over two lines of ayah
  {
    page: 431,
    number: "034023",
    from: "M 0.0 26.0 L 345.0 26.0 L 345.0 62.0 L 0.0 62.0 Z",
    to: "M 0.0 11.08 L 345.0 11.08 L 345.0 83.06 L 0.0 83.06 Z",
  },
  // p468: three lines of ink under two rects stretched to 46.22
  {
    page: 468,
    number: "040008",
    from: "M 0.0 26.5 L 345.0 26.5 L 345.0 72.72 L 0.0 72.72 Z M 249.05 72.72 L 345.0 72.72 L 345.0 118.94 L 249.05 118.94 Z",
    to: "M 0.0 11.2 L 345.0 11.2 L 345.0 82.94 L 0.0 82.94 Z M 249.05 82.94 L 345.0 82.94 L 345.0 118.81 L 249.05 118.81 Z",
  },
  {
    page: 468,
    number: "040009",
    from: "M 0.0 72.72 L 249.05 72.72 L 249.05 118.81 L 0.0 118.81 Z M 23.43 118.81 L 345.0 118.81 L 345.0 154.68 L 23.43 154.68 Z",
    to: "M 0.0 82.94 L 249.05 82.94 L 249.05 118.81 L 0.0 118.81 Z M 23.43 118.81 L 345.0 118.81 L 345.0 154.68 L 23.43 154.68 Z",
  },
  // p542: 58:1 given only its last line
  {
    page: 542,
    number: "058001",
    from: "M 81.82 115.25 L 340.0 115.25 L 340.0 151.25 L 81.82 151.25 Z",
    to: "M 5.0 79.25 L 340.0 79.25 L 340.0 115.25 L 5.0 115.25 Z M 81.82 115.25 L 340.0 115.25 L 340.0 151.25 L 81.82 151.25 Z",
  },
  // p545: 58:22 given only its last line
  {
    page: 545,
    number: "058022",
    from: "M 43.55 188.78 L 340.0 188.78 L 340.0 224.78 L 43.55 224.78 Z",
    to: "M 5.0 8.78 L 340.0 8.78 L 340.0 188.78 L 5.0 188.78 Z M 43.55 188.78 L 340.0 188.78 L 340.0 224.78 L 43.55 224.78 Z",
  },
  // p549: 60:1 given only its last line
  {
    page: 549,
    number: "060001",
    from: "M 137.6 225.1 L 340.0 225.1 L 340.0 261.1 L 137.6 261.1 Z",
    to: "M 5.0 81.54 L 340.0 81.54 L 340.0 225.1 L 5.0 225.1 Z M 137.6 225.1 L 340.0 225.1 L 340.0 261.1 L 137.6 261.1 Z",
  },
  // p551: 60:12 given only its last line
  {
    page: 551,
    number: "060012",
    from: "M 5.0 118.86 L 340.0 118.86 L 340.0 154.86 L 5.0 154.86 Z",
    to: "M 5.0 10.86 L 340.0 10.86 L 340.0 118.86 L 5.0 118.86 Z M 5.0 118.86 L 340.0 118.86 L 340.0 154.86 L 5.0 154.86 Z",
  },
  // p554: 62:9 given only its last line
  {
    page: 554,
    number: "062009",
    from: "M 5.0 45.89 L 340.0 45.89 L 340.0 81.89 L 5.0 81.89 Z",
    to: "M 5.0 10.05 L 340.0 10.05 L 340.0 45.89 L 5.0 45.89 Z M 5.0 45.89 L 340.0 45.89 L 340.0 81.89 L 5.0 81.89 Z",
  },
  // p558: 65:1 given only its last line
  {
    page: 558,
    number: "065001",
    from: "M 5.0 189.92 L 340.0 189.92 L 340.0 225.92 L 5.0 225.92 Z",
    to: "M 5.0 81.92 L 340.0 81.92 L 340.0 225.92 L 5.0 225.92 Z",
  },
  // p560: 66:1 and 66:2 squashed to 29.25 and shifted down
  {
    page: 560,
    number: "066001",
    from: "M 5.0 95.5 L 340.0 95.5 L 340.0 124.75 L 5.0 124.75 Z M 246.34 124.75 L 340.0 124.75 L 340.0 154.0 L 246.34 154.0 Z",
    to: "M 5.0 82.05 L 340.0 82.05 L 340.0 118.05 L 5.0 118.05 Z M 246.34 118.05 L 340.0 118.05 L 340.0 154.05 L 246.34 154.05 Z",
  },
  {
    page: 560,
    number: "066002",
    from: "M 5.0 124.75 L 246.34 124.75 L 246.34 154.05 L 5.0 154.05 Z M 238.51 154.05 L 340.0 154.05 L 340.0 190.1 L 238.51 190.1 Z",
    to: "M 5.0 118.05 L 246.34 118.05 L 246.34 154.05 L 5.0 154.05 Z M 238.51 154.05 L 340.0 154.05 L 340.0 190.1 L 238.51 190.1 Z",
  },
  // p564: 67:27 given only its last line
  {
    page: 564,
    number: "067027",
    from: "M 253.05 45.89 L 340.0 45.89 L 340.0 81.89 L 253.05 81.89 Z",
    to: "M 5.0 9.89 L 340.0 9.89 L 340.0 45.89 L 5.0 45.89 Z M 253.05 45.89 L 340.0 45.89 L 340.0 81.89 L 253.05 81.89 Z",
  },
  // p566: 68:43 given only its last line
  {
    page: 566,
    number: "068043",
    from: "M 270.25 47.17 L 340.0 47.17 L 340.0 83.17 L 270.25 83.17 Z",
    to: "M 5.0 11.22 L 340.0 11.22 L 340.0 47.17 L 5.0 47.17 Z M 270.25 47.17 L 340.0 47.17 L 340.0 83.17 L 270.25 83.17 Z",
  },
  // p575: 73:20 given only its last line
  {
    page: 575,
    number: "073020",
    from: "M 5.0 226.03 L 340.0 226.03 L 340.0 262.03 L 5.0 262.03 Z",
    to: "M 5.0 10.03 L 340.0 10.03 L 340.0 226.03 L 5.0 226.03 Z M 5.0 226.03 L 340.0 226.03 L 340.0 262.03 L 5.0 262.03 Z",
  },
  // p577: 75:5 begins at the far left of 75:4's line and is given only its
  // next-line rect, so its first word sits inside 75:4. The boundary bisects
  // the two centres — 75:5#1 at x 12.60, 75:4's end-ornament at x 27.79 — and
  // both rects are moved so the strip belongs to exactly one of them.
  {
    page: 577,
    number: "075004",
    from: "M 5.0 294.18 L 177.97 294.18 L 177.97 330.18 L 5.0 330.18 Z",
    to: "M 20.2 294.18 L 177.97 294.18 L 177.97 330.18 L 20.2 330.18 Z",
  },
  {
    page: 577,
    number: "075005",
    from: "M 185.25 330.25 L 340.0 330.25 L 340.0 363.75 L 185.25 363.75 Z",
    to: "M 5.0 294.18 L 20.2 294.18 L 20.2 330.18 L 5.0 330.18 Z M 185.25 330.25 L 340.0 330.25 L 340.0 363.75 L 185.25 363.75 Z",
  },
  // p594: 89:23 given only its last line
  {
    page: 594,
    number: "089023",
    from: "M 235.06 47.28 L 340.0 47.28 L 340.0 83.28 L 235.06 83.28 Z",
    to: "M 5.0 11.28 L 340.0 11.28 L 340.0 47.28 L 5.0 47.28 Z M 235.06 47.28 L 340.0 47.28 L 340.0 83.28 L 235.06 83.28 Z",
  },
  // p599: 98:6 given only its last line
  {
    page: 599,
    number: "098006",
    from: "M 107.2 47.35 L 340.0 47.35 L 340.0 83.35 L 107.2 83.35 Z",
    to: "M 5.0 11.35 L 340.0 11.35 L 340.0 47.35 L 5.0 47.35 Z M 107.2 47.35 L 340.0 47.35 L 340.0 83.35 L 107.2 83.35 Z",
  },
  // p602: 106:4 given two 4.4-unit slivers instead of two lines
  {
    page: 602,
    number: "106004",
    from: "M 5.0 180.0 L 340.0 180.0 L 340.0 184.41 L 5.0 184.41 Z M 64.1 184.41 L 340.0 184.41 L 340.0 188.81 L 64.1 188.81 Z",
    to: "M 5.0 118.52 L 125.87 118.52 L 125.87 154.52 L 5.0 154.52 Z M 64.1 154.52 L 340.0 154.52 L 340.0 190.52 L 64.1 190.52 Z",
  },
  // p604: 114:6 given two 4.6-unit slivers instead of two lines
  {
    page: 604,
    number: "114006",
    from: "M 5.0 540.0 L 340.0 540.0 L 340.0 544.6 L 5.0 544.6 Z M 87.82 544.6 L 340.0 544.6 L 340.0 549.2 L 87.82 549.2 Z",
    to: "M 5.0 477.09 L 59.08 477.09 L 59.08 512.51 L 5.0 512.51 Z M 87.82 512.51 L 340.0 512.51 L 340.0 548.51 L 87.82 548.51 Z",
  },
];

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const pad3 = (n) => String(n).padStart(3, "0");

function die(msg) {
  console.error(`FATAL: ${msg}`);
  process.exit(1);
}

/* ---------------------------------------------------------------- the pin */

function readPin() {
  if (!existsSync(PIN_FILE)) die(`no pin at ${PIN_FILE} — run with --repin to write one`);
  return JSON.parse(readFileSync(PIN_FILE, "utf8"));
}

/** Raw URL for one upstream file, from the pin's coordinates. */
function upstreamUrl(pin, kind, page) {
  const ext = kind === "svg" ? "svg" : "json";
  return `https://raw.githubusercontent.com/${pin.repo}/${pin.commit}/${pin.path}/${kind}/${pad3(page)}.${ext}`;
}

function cachePath(kind, page) {
  return join(CACHE, kind, `${pad3(page)}.${kind === "svg" ? "svg" : "json"}`);
}

/* --------------------------------------------------------------- fetching */

async function fetchOne(url, dest) {
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      return;
    } catch (err) {
      if (attempt === FETCH_RETRIES) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }
}

/** Download every cache file that is missing. Existing files are left alone. */
async function fetchMissing(pin) {
  for (const kind of ["svg", "json"]) mkdirSync(join(CACHE, kind), { recursive: true });

  const jobs = [];
  for (let page = 1; page <= PAGES; page++) {
    for (const kind of ["svg", "json"]) {
      const dest = cachePath(kind, page);
      if (!existsSync(dest)) jobs.push({ url: upstreamUrl(pin, kind, page), dest });
    }
  }
  if (jobs.length === 0) {
    console.log("cache complete — nothing to fetch");
    return;
  }

  console.log(`fetching ${jobs.length} files from ${pin.repo}@${pin.commit.slice(0, 8)} …`);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      await fetchOne(job.url, job.dest);
      if (++done % 100 === 0) console.log(`  ${done}/${jobs.length}`);
    }
  };
  await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, worker));
  console.log(`  fetched ${done}`);
}

/* ------------------------------------------------------------- optimizing */

/**
 * The svgo config, read from the pin so the recipe and the hashes it produced
 * travel together. Three preset-default plugins are disabled: collapseGroups
 * (flattens the outer transform matrix the stage's coordinate model assumes),
 * removeUnknownsAndDefaults (strips the `number`/`surah`/`ayah` attributes the
 * resolver reads), and cleanupIds (renames `verse-*`, which is the anchor).
 */
function svgoConfig(pin) {
  const overrides = {};
  for (const name of pin.svgo.disabled) overrides[name] = false;
  return {
    multipass: pin.svgo.multipass,
    floatPrecision: pin.svgo.floatPrecision,
    plugins: [{ name: "preset-default", params: { overrides } }],
  };
}

/**
 * Apply the two known `id` repairs to one page's optimized markup. Returns the
 * repaired string and how many polygons it touched, so the caller can assert
 * the corpus-wide total.
 */
function repairIds(svg, page) {
  let repaired = svg;
  let count = 0;
  for (const fix of ID_REPAIRS) {
    if (fix.page !== page) continue;
    const re = new RegExp(`(<path\\b[^>]*\\bnumber="${fix.number}"[^>]*>)`);
    const m = re.exec(repaired);
    if (!m) die(`page ${page}: expected a polygon with number="${fix.number}" to repair`);
    const want = `verse-${absoluteOf(fix.number)}`;
    if (/\bid="verse-\d+"/.test(m[1])) {
      die(
        `page ${page}: number="${fix.number}" already carries a well-formed id — ` +
          `upstream fixed it, so drop it from ID_REPAIRS`,
      );
    }
    const fixedTag = m[1].replace(/\bid="[^"]*"/, `id="${want}"`);
    if (fixedTag === m[1]) die(`page ${page}: number="${fix.number}" has no id attribute to repair`);
    repaired = repaired.replace(m[1], fixedTag);
    count++;
  }
  return { svg: repaired, count };
}

/**
 * Apply this page's polygon repairs to *raw upstream* markup, before svgo. Same
 * contract as repairIds: returns the repaired string and a count, and dies on
 * anything it did not expect rather than guessing.
 */
/**
 * The `d` attribute is matched with its leading space — ` d="…"` — and not as
 * the bare `d="…"`. On page 577 the two are not the same match: 75:5 is one of
 * the two polygons whose `id` holds path geometry instead of `verse-<n>` (see
 * ID_REPAIRS), so its element reads `id="M 185.25 …"`, and `d="M 185.25 …"` is
 * a substring of that. A bare match would have rewritten the id and left the
 * geometry untouched, silently — every assertion here would still have passed.
 */
function repairPolygons(svg, page) {
  let repaired = svg;
  let count = 0;
  for (const fix of POLYGON_REPAIRS) {
    if (fix.page !== page) continue;
    const re = new RegExp(`<path\\b[^>]*\\bclass="ayahPolygon"[^>]*\\bnumber="${fix.number}"[^>]*>`);
    const m = re.exec(repaired);
    if (!m) die(`page ${page}: expected an ayahPolygon with number="${fix.number}" to repair`);
    if (m[0].includes(` d="${fix.to}"`)) {
      die(
        `page ${page}: number="${fix.number}" already carries the repaired geometry — ` +
          `upstream fixed it, so drop it from POLYGON_REPAIRS`,
      );
    }
    if (!m[0].includes(` d="${fix.from}"`)) {
      die(
        `page ${page}: number="${fix.number}" is not the polygon this repair was written ` +
          `against. The pinned corpus moved: re-derive the repair against the new geometry ` +
          `rather than loosening the match.`,
      );
    }
    repaired = repaired.replace(m[0], m[0].replace(` d="${fix.from}"`, ` d="${fix.to}"`));
    count++;
  }
  return { svg: repaired, count };
}

/* --------------------------------------------------- absolute ayah numbers */

/**
 * Absolute ayah number (1-based, Hafs/Kufan counting) for an SSSAAA `number`.
 * Read out of @hifth/core's own table rather than duplicated here — the whole
 * point of `verse-<n>` being derivable is that one table defines it.
 */
let AYAH_COUNTS;
async function loadAyahCounts() {
  ({ AYAH_COUNTS } = await import("@hifth/core"));
}
function absoluteOf(number) {
  const surah = Math.floor(number / 1000);
  const ayah = number % 1000;
  let n = ayah;
  for (let s = 1; s < surah; s++) n += AYAH_COUNTS[s - 1];
  return n;
}

/* ------------------------------------------------------------------- main */

async function main() {
  const argv = process.argv.slice(2);
  const wantFetch = argv.includes("--fetch");
  const wantRepin = argv.includes("--repin");

  await loadAyahCounts();
  const pin = readPin();

  if (wantFetch || wantRepin) await fetchMissing(pin);

  // 1. Every upstream file present, and byte-identical to what was pinned.
  const missing = [];
  for (let page = 1; page <= PAGES; page++) {
    for (const kind of ["svg", "json"]) {
      if (!existsSync(cachePath(kind, page))) missing.push(`${kind}/${pad3(page)}`);
    }
  }
  if (missing.length) {
    die(
      `${missing.length} upstream file(s) missing from the cache (first: ${missing[0]}) — ` +
        `re-run with --fetch`,
    );
  }

  const upstream = [];
  for (let page = 1; page <= PAGES; page++) {
    upstream.push({
      page,
      svg: readFileSync(cachePath("svg", page)),
      meta: readFileSync(cachePath("json", page)),
    });
  }

  if (!wantRepin) {
    const bad = [];
    for (const u of upstream) {
      const want = pin.pages[u.page - 1];
      if (sha256(u.svg) !== want.upstream) bad.push(`svg/${pad3(u.page)}`);
      if (sha256(u.meta) !== want.meta) bad.push(`json/${pad3(u.page)}`);
    }
    if (bad.length) {
      die(
        `${bad.length} cached file(s) do not match the pin (first: ${bad[0]}). ` +
          `Delete packages/etl/data/pages/.cache and re-fetch; if it persists, the ` +
          `pinned commit is not what it was and the pin must be re-derived deliberately.`,
      );
    }
    console.log(`pin verified: ${PAGES * 2} upstream files match ${pin.commit.slice(0, 8)}`);
  }

  // 2. Repair polygons, optimize, repair ids. Order matters: the polygon
  //    repairs match raw upstream `d` strings, which svgo then rewrites.
  const config = svgoConfig(pin);
  const out = [];
  let repairs = 0;
  let polyRepairs = 0;
  for (const u of upstream) {
    const { svg: raw, count: polys } = repairPolygons(u.svg.toString("utf8"), u.page);
    polyRepairs += polys;
    const optimized = optimize(raw, config).data + "\n";
    if (/<text[\s>]/.test(optimized)) {
      // Loop 0's standing rule: outlined paths only. A <text> element trips the
      // Safari content-visibility paint bug (research §1–§2).
      die(`page ${u.page} contains a <text> element`);
    }
    const { svg, count } = repairIds(optimized, u.page);
    repairs += count;
    out.push({ page: u.page, svg });
  }
  if (repairs !== ID_REPAIRS.length) {
    die(`expected exactly ${ID_REPAIRS.length} id repairs, applied ${repairs}`);
  }
  if (polyRepairs !== POLYGON_REPAIRS.length) {
    die(`expected exactly ${POLYGON_REPAIRS.length} polygon repairs, applied ${polyRepairs}`);
  }

  // 3. The self-test: reproduce Loop 0's three pages before overwriting them.
  for (const page of LOOP0_PAGES) {
    const committed = join(PAGES_DIR, `${page}.svg`);
    if (!existsSync(committed)) {
      console.warn(`  note: page ${page} not committed yet — skipping the Loop 0 self-test`);
      continue;
    }
    const before = readFileSync(committed, "utf8");
    const after = out[page - 1].svg;
    if (before !== after) {
      die(
        `page ${page} does not reproduce the bytes Loop 0 shipped ` +
          `(committed ${before.length} B, re-derived ${after.length} B). The svgo ` +
          `version or config in the pin is not the one that produced the committed ` +
          `assets — fix the pin, do not overwrite the fixture.`,
      );
    }
  }
  console.log(`Loop 0 self-test: pages ${LOOP0_PAGES.join(", ")} reproduce byte-for-byte`);

  // 4. Write.
  mkdirSync(PAGES_DIR, { recursive: true });
  let bytes = 0;
  for (const { page, svg } of out) {
    writeFileSync(join(PAGES_DIR, `${page}.svg`), svg);
    bytes += Buffer.byteLength(svg);
  }

  // Any page file that is not one of ours is a leftover from an older run.
  const stray = readdirSync(PAGES_DIR).filter((f) => {
    const n = Number(f.replace(/\.svg$/, ""));
    return !(Number.isInteger(n) && n >= 1 && n <= PAGES && f.endsWith(".svg"));
  });
  if (stray.length) die(`unexpected file(s) in ${PAGES_DIR}: ${stray.join(", ")}`);

  // 5. Re-pin, if asked. The `vendored` column is what gate:pages checks the
  //    committed bytes against, offline, in CI.
  if (wantRepin) {
    pin.pages = upstream.map((u, i) => ({
      page: u.page,
      upstream: sha256(u.svg),
      meta: sha256(u.meta),
      vendored: sha256(Buffer.from(out[i].svg)),
    }));
    writeFileSync(PIN_FILE, JSON.stringify(pin, null, 2) + "\n");
    console.log(`re-pinned ${pin.pages.length} pages → ${PIN_FILE}`);
  } else {
    const drifted = out.filter((o, i) => sha256(Buffer.from(o.svg)) !== pin.pages[i].vendored);
    if (drifted.length) {
      die(
        `${drifted.length} page(s) optimized to bytes the pin does not list ` +
          `(first: page ${drifted[0].page}). svgo's output changed — bump the pin ` +
          `deliberately with --repin and review the diff.`,
      );
    }
  }

  console.log(
    `\nwrote ${out.length} pages, ${(bytes / 1024 / 1024).toFixed(1)} MB → ${PAGES_DIR}`,
  );
  console.log("next: pnpm --filter @hifth/etl extract:pages   (derives the anchors)");
}

main().catch((err) => die(err.stack ?? err.message));
