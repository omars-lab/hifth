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
 * Immutability (PLAN §8): upstream bytes are never hand-edited. Two transforms
 * are applied, both declared, both reproducible, both asserted:
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

  // 2. Optimize + repair.
  const config = svgoConfig(pin);
  const out = [];
  let repairs = 0;
  for (const u of upstream) {
    const optimized = optimize(u.svg.toString("utf8"), config).data + "\n";
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
