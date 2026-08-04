#!/usr/bin/env node
/**
 * Which print does the candidate word-geometry corpus paginate?
 *
 * `docs/PLAN.md` §13 held word-level selection open on exactly one fact. The
 * pages this app ships carry one polygon per **ayah** and nothing finer, so word
 * granularity has to come from somewhere else, and the only candidate —
 * [MushafDatabase-Ligature-Based-SVG] — is encouraging on everything except the
 * thing that decides it: per-ligature groups with `data-text`, 604 pages, KFGQPC
 * Hafs, a permissive Sadaqa-e-Jaria grant, and **no statement of which print**.
 *
 * Loop 4a is why that is fatal rather than untidy. KFGQPC's V1/1405H and
 * V2/1421H prints paginate differently on 36 pages; our corpus is V2 (see
 * `packages/etl/data/pages/PROVENANCE.md`). A V1-paginated word corpus would
 * silently invalidate `ayah-pages.json`, every edge's `dPage`, and every share
 * link already in someone's notes — silently, because the two prints agree on
 * 568 of 604 pages, so nothing on screen would look wrong until it did.
 *
 * ## What this asks, and why it is arithmetic rather than a reading
 *
 * The corpus tags every word with `data-surah`/`data-aya`, so the set of ayahs a
 * page carries falls straight out of the markup. Compare that set, page by page,
 * against our own `ayah-pages.json` — the table Loop 4b re-derived from the
 * shipped SVG — and a print disagreement shows up as a page whose ayah span
 * differs. No fonts, no rendering, no judgment.
 *
 * **Which pages.** Not a sample: every page in the four bands where V1 and V2 are
 * known to diverge (120–123, 144–145, 531–534, 564–600, per `PROVENANCE.md`),
 * plus controls on either side of each band and at both ends of the book. A
 * uniform sample of the same size would spend most of its downloads on pages the
 * two prints agree about, which is the one place this question cannot be
 * answered. `--all` walks all 604 if the whole table is ever wanted; it is 351 MB
 * of fetch to learn what 56 pages already say.
 *
 * The bytes are not vendored. This is a decision probe, not an input: it is run
 * when the question is asked, and its answer is recorded in
 * `ligature-svg.probe.json` beside the fetched files' hashes, so a rerun against
 * the same pin either reproduces or says loudly that upstream moved. That is the
 * same shape as `quran-svg.pin.json` and for the same reason — the corpus is too
 * large to live under `packages/etl/data/`.
 *
 * Usage:
 *   node packages/etl/scripts/probe-ligature-print.mjs            # the 56 pages
 *   node packages/etl/scripts/probe-ligature-print.mjs --all      # all 604
 *   node packages/etl/scripts/probe-ligature-print.mjs --write    # update the result file
 *
 * [MushafDatabase-Ligature-Based-SVG]: https://github.com/mushafdatabase/MushafDatabase-Ligature-Based-SVG
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fromAbsoluteAyah, TOTAL_AYAHS } from "@hifth/core";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "data", "pages");
const RESULT = join(DATA, "ligature-svg.probe.json");

const prior = JSON.parse(readFileSync(RESULT, "utf8"));
const { repo, commit, path } = prior.candidate;

/**
 * The pages worth fetching.
 *
 * The four `diverge` bands are where V1 and V2 disagree; the `control` pages sit
 * immediately outside each band, plus the first two and last four leaves. The
 * controls are not padding — a probe that only ever looked at contested pages
 * could not tell "this corpus is V2" from "our own table is wrong in exactly the
 * contested places", and the two have different consequences.
 */
const BANDS = [
  { kind: "control", from: 1, to: 2 },
  { kind: "control", from: 119, to: 119 },
  { kind: "diverge", from: 120, to: 123 },
  { kind: "control", from: 143, to: 143 },
  { kind: "diverge", from: 144, to: 145 },
  { kind: "control", from: 146, to: 146 },
  { kind: "control", from: 530, to: 530 },
  { kind: "diverge", from: 531, to: 534 },
  { kind: "control", from: 535, to: 535 },
  { kind: "diverge", from: 564, to: 600 },
  { kind: "control", from: 601, to: 601 },
  { kind: "control", from: 604, to: 604 },
];

const all = process.argv.includes("--all");
const write = process.argv.includes("--write");
const wanted = all
  ? Array.from({ length: 604 }, (_, i) => ({ page: i + 1, kind: "all" }))
  : BANDS.flatMap(({ kind, from, to }) =>
      Array.from({ length: to - from + 1 }, (_, i) => ({ page: from + i, kind })),
    );

/** Our own table, inverted: page → the ayah keys it carries, in order. */
function oursByPage() {
  const table = JSON.parse(readFileSync(join(DATA, "ayah-pages.json"), "utf8"));
  if (table.length !== TOTAL_AYAHS) throw new Error(`ayah-pages.json has ${table.length} entries`);
  const by = new Map();
  table.forEach((page, i) => {
    const { surah, ayah } = fromAbsoluteAyah(i + 1);
    if (!by.has(page)) by.set(page, []);
    by.get(page).push(`${surah}:${ayah}`);
  });
  return by;
}

/**
 * The ayahs one candidate page carries, in the order its words appear.
 *
 * Attribute order is not guaranteed by anything, so both orderings are matched —
 * a regex that assumed `data-surah` comes first would return an empty set on a
 * reformatted upstream and the comparison below would read that as a print
 * disagreement on every page at once. Which is the failure mode worth guarding:
 * this probe's output is a yes/no that a loop gets scheduled on.
 */
function ayahsIn(svg) {
  const re = /data-surah="(\d+)"[^>]*?data-aya="(\d+)"|data-aya="(\d+)"[^>]*?data-surah="(\d+)"/g;
  const seen = new Set();
  for (const m of svg.matchAll(re)) {
    seen.add(`${Number(m[1] ?? m[4])}:${Number(m[2] ?? m[3])}`);
  }
  if (seen.size === 0) throw new Error("no data-surah/data-aya pairs — did the schema change?");
  return [...seen];
}

async function fetchPage(page) {
  const file = `${String(page).padStart(3, "0")}.svg`;
  const url = `https://raw.githubusercontent.com/${repo}/${commit}/${encodeURIComponent(path)}/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  return { body, sha256: createHash("sha256").update(body).digest("hex") };
}

const ours = oursByPage();
const checked = [];
const differ = [];
let bytes = 0;

console.log(`\n  probe:ligature-print — ${repo} @ ${commit.slice(0, 12)}`);
console.log(`  ${wanted.length} page(s): ${all ? "the whole book" : "every V1/V2 divergence band, plus controls"}\n`);

for (const { page, kind } of wanted) {
  const { body, sha256 } = await fetchPage(page);
  bytes += body.length;
  const theirs = ayahsIn(body.toString("utf8"));
  const mine = ours.get(page) ?? [];
  const same = theirs.length === mine.length && theirs.every((k, i) => k === mine[i]);
  checked.push({ page, kind, sha256, same });
  if (!same) differ.push({ page, ours: mine, theirs });
  const mark = same ? "·" : "✗";
  process.stdout.write(
    `  ${mark} p${String(page).padStart(3)}  ${kind.padEnd(7)} ${mine[0] ?? "—"} … ${mine.at(-1) ?? "—"}\n`,
  );
}

for (const d of differ) {
  console.log(`\n  p${d.page} differs`);
  console.log(`    ours:   ${d.ours.join(" ")}`);
  console.log(`    theirs: ${d.theirs.join(" ")}`);
}

const verdict = differ.length === 0 ? "same-print" : "different-print";
const mb = (bytes / 1024 / 1024).toFixed(1);
console.log(
  `\n  ${checked.length - differ.length}/${checked.length} pages identical — ${verdict} (${mb} MB fetched)\n`,
);

if (write) {
  writeFileSync(
    RESULT,
    `${JSON.stringify({ ...prior, ranOn: new Date().toISOString().slice(0, 10), verdict, pages: checked }, null, 2)}\n`,
  );
  console.log(`  wrote ${RESULT}\n`);
}

process.exitCode = differ.length === 0 ? 0 : 1;
