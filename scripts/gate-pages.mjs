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

if (failures.length) {
  console.error("FAIL gate:pages");
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}

console.log(
  `gate:pages — ${verified}/${expected} page SVGs match ` +
    `${pin.repo}@${pin.commit.slice(0, 8)} via svgo ${pin.svgo.version}`,
);
