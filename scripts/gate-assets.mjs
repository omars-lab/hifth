#!/usr/bin/env node
/**
 * CI gate: the vendored corpus — the largest thing this app ships — has a number.
 *
 * `gate:budget` watches the JS bundle (150 KB gz). `gate:golden-size` watches the
 * committed baseline PNGs. Neither of them has ever looked at
 * `apps/web/public/assets`, which today is 850 KB gzipped and, once Loop 4b
 * vendors the rest of the mus'haf, will be roughly **twenty-seven megabytes** —
 * two orders of magnitude past the bundle, and the actual weight of Hifth. The
 * defect this gate closes (backlog ⑥) is not that the number is too big; it is
 * that nobody was going to notice which commit made it bigger.
 *
 * ── Why the ceilings are shaped differently per kind ────────────────────────
 *
 * Three of the four kinds are already *complete* and do not grow with Loop 4b:
 * `adj` is one shard per surah (114), `roots` is a corpus-wide index, `skins` is
 * one tajweed shard per surah. Their ceiling is simply their total, with room.
 * A jump there means the ETL started emitting something new, which is a thing to
 * see on the commit that does it.
 *
 * `pages` is the one that grows — it went from 3 to 604 in Loop 4b and grows
 * again with the next edition — so a total ceiling would be useless in the
 * specific way that matters: it would have to be raised by the very change it
 * exists to watch, and raising it would be indistinguishable from noticing. The
 * invariant that survives vendoring is **per-page weight**, so that is what is
 * gated — a per-file ceiling, plus the whole-mus'haf figure projected from the
 * mean and gated against where "this does not fit on a phone over a hotel wifi"
 * begins. Written against three pages and already speaking about 604, which is
 * the point of measuring before rather than after: when the 601 arrived the gate
 * had an opinion about them already, and the projection it had been printing all
 * along came in 15% high (`docs/backlog.md` ⑥).
 *
 * `manifest.json` is the one file fetched **whole** before anything can be drawn,
 * so its ceiling is about latency, not bytes. When this gate was written it
 * carried a polygon list per page — 184 bytes gz per page, nothing until
 * multiplied by 604 — and the projection said 109 KB gz in front of first paint
 * (backlog ⑪). Loop 4b made the projection moot rather than affordable: the
 * compact manifest is an ayah→page table, 1.3 KB gz for all 604 pages, and the
 * check below is a flat one because there is no longer anything to project.
 *
 * ── Why the shape of the tree is gated too ──────────────────────────────────
 *
 * An unknown kind directory, or a file loose at the top level, fails. That is not
 * tidiness: the whole defect here is bytes shipping that nothing weighs, and a
 * gate that silently skips what it does not recognise reintroduces it one
 * directory at a time. An edition directory must likewise name an edition that
 * `EDITIONS` calls `vendored` — assets on disk for an edition the picker refuses
 * to select is a half-landed vendoring, and it is cheaper to hear about it here
 * than from a reader tapping a greyed-out row.
 *
 * Edition ids and page counts are read from `packages/core/src/concordance.ts`
 * *source*, not from `dist/`, for the reason `gate-quran-meta.mjs` gives: the gate
 * must fail on the commit that introduces the mistake, and dist is a build
 * artifact that may be stale, absent, or (in CI's gate job) never built at all.
 *
 * Run: `pnpm gate:assets` (also in `pnpm gates`, `make ci` and CI).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = new URL("..", import.meta.url).pathname;
const ASSETS = join(ROOT, "apps", "web", "public", "assets");
const CONCORDANCE = join(ROOT, "packages", "core", "src", "concordance.ts");

/**
 * Gzipped ceilings, in bytes. Each is roughly double today's figure — loose
 * enough that ordinary ETL churn does not trip it, tight enough that a doubling
 * has to be argued for in the commit that causes it.
 */
const CEILINGS = {
  //                    today      what a breach would mean
  adj: 128 * 1024, //     55.8 KB   the edge shards stopped being edge lists
  roots: 768 * 1024, //  450.7 KB   the root index started carrying text
  skins: 384 * 1024, //  207.7 KB   the tajweed shards started carrying geometry
  words: 1792 * 1024, // 885.6 KB   the word shards started carrying text
};

/** A single page's SVG, gzipped. Today's heaviest is 47.4 KB (page 7). */
const MAX_PAGE_GZ = 64 * 1024;

/** The whole mus'haf, projected from the mean page. Today's projection: 26.8 MB. */
const MAX_MUSHAF_GZ = 32 * 1024 * 1024;

/**
 * The manifest, whole. Until Loop 4b this was a per-page projection (3 pages of
 * polygon lists projected to 604 → 109 KB gz). The compact form carries the
 * whole print in one ayah→page table, so there is nothing left to project: the
 * file measured today already is the file at 604 pages, and the ceiling is a
 * flat one. 256 KB is left where it was on purpose — it is the "in front of
 * first paint" budget, and the fact that the manifest now uses 0.5% of it is
 * the result to notice, not a reason to tighten it onto today's number.
 */
const MAX_MANIFEST_GZ = 256 * 1024;

const problems = [];

// ── What the editions table says ─────────────────────────────────────────────
// Parsed out of the TypeScript rather than imported, per the docblock. The
// shape is stable and small: an `EDITIONS` array of object literals, each with
// an `id`, a `status`, and optionally a `pages`.

const src = readFileSync(CONCORDANCE, "utf8");
const table = src.slice(src.indexOf("export const EDITIONS"));
const editions = new Map();
for (const entry of table.split(/\n {2}\{\n/).slice(1)) {
  // Commented-out lines dropped first. Every entry in that table carries prose
  // above its fields, and `// pages: 604,` left behind during an edit reads as a
  // page count to a regex — the gate would then project a whole mus'haf off a
  // line the compiler cannot see.
  const body = entry
    .slice(0, entry.indexOf("\n  }"))
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
  const id = /\bid: "([^"]+)"/.exec(body)?.[1];
  if (!id) continue;
  editions.set(id, {
    status: /\bstatus: "([^"]+)"/.exec(body)?.[1],
    pages: Number(/\bpages: (\d+)/.exec(body)?.[1]) || null,
  });
}
if (editions.size === 0) {
  console.error(
    `gate:assets — FAIL: no editions parsed out of ${CONCORDANCE.replace(ROOT, "")}.\n` +
      "  The gate reads that table for edition ids and page counts. If EDITIONS moved or\n" +
      "  changed shape, this parser has to move with it — do not silently pass instead.",
  );
  process.exit(1);
}

// ── Weigh the tree ───────────────────────────────────────────────────────────

const kb = (b) => `${(b / 1024).toFixed(1)} KB`;
const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const gzOf = (f) => gzipSync(readFileSync(f)).length;

const rows = [];
let files = 0;

for (const entry of readdirSync(ASSETS, { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    // The manifest is the one file that legitimately lives at the root; anything
    // else here is unweighed by every per-kind rule below.
    if (entry.name !== "manifest.json") {
      problems.push(
        `${entry.name} sits loose at the top of assets/. Only manifest.json belongs there;` +
          " everything else goes under a <kind>/<edition>/ that this gate weighs.",
      );
    }
    continue;
  }

  const kind = entry.name;
  if (kind !== "pages" && !(kind in CEILINGS)) {
    problems.push(
      `assets/${kind}/ is a kind this gate has never heard of, so nothing is weighing it.` +
        " Give it a ceiling in CEILINGS (and say in the comment what a breach would mean),"
        + " or move it under a kind that has one.",
    );
    continue;
  }

  for (const dir of readdirSync(join(ASSETS, kind), { withFileTypes: true })) {
    const edition = dir.name;
    if (!dir.isDirectory()) {
      problems.push(`assets/${kind}/${edition} is a file where an edition directory should be.`);
      continue;
    }
    const meta = editions.get(edition);
    if (!meta) {
      problems.push(
        `assets/${kind}/${edition}/ names an edition EDITIONS does not list. Add it to` +
          " packages/core/src/concordance.ts or the app ships bytes it cannot select.",
      );
      continue;
    }
    if (meta.status !== "vendored") {
      problems.push(
        `assets/${kind}/${edition}/ ships assets for an edition still marked` +
          ` "${meta.status}". The picker will refuse to select it; flip the status or` +
          " remove the assets, because right now the download is paid for and unreachable.",
      );
    }

    const found = walk(join(ASSETS, kind, edition));
    files += found.length;
    const gz = found.reduce((sum, f) => sum + gzOf(f), 0);
    rows.push({ kind, edition, count: found.length, gz, meta, dir: join(ASSETS, kind, edition) });
  }
}

if (files === 0) {
  console.error("gate:assets — FAIL: no assets found; the app has nothing to draw");
  process.exit(1);
}

rows.sort((a, b) => b.gz - a.gz);

// ── The complete kinds: an absolute ceiling ──────────────────────────────────

for (const row of rows) {
  if (row.kind === "pages") continue;
  const ceiling = CEILINGS[row.kind];
  const over = row.gz > ceiling;
  console.log(
    `  ${kb(row.gz).padStart(9)} gz  ${String(row.count).padStart(3)} files  ` +
      `${row.kind}/${row.edition}  (ceiling ${kb(ceiling)})${over ? "  ← OVER" : ""}`,
  );
  if (over) {
    problems.push(
      `assets/${row.kind}/ is ${kb(row.gz)} gz against a ${kb(ceiling)} ceiling.` +
        " This kind is already complete — it does not grow with Loop 4b — so a jump means the" +
        " ETL started emitting something new. Find out what before raising the number.",
    );
  }
}

// ── pages: per-file, then the whole mus'haf projected ────────────────────────

for (const row of rows) {
  if (row.kind !== "pages") continue;

  const svgs = readdirSync(row.dir).filter((f) => f.endsWith(".svg"));
  const weighed = svgs.map((f) => ({ name: f, gz: gzOf(join(row.dir, f)) }));
  const heaviest = weighed.reduce((a, b) => (b.gz > a.gz ? b : a));
  const mean = row.gz / weighed.length;
  const pages = row.meta.pages;
  const projected = pages ? mean * pages : null;

  console.log(
    `  ${kb(row.gz).padStart(9)} gz  ${String(row.count).padStart(3)} files  ` +
      `pages/${row.edition}  (heaviest ${kb(heaviest.gz)} ${heaviest.name}, ` +
      `mean ${kb(mean)})`,
  );
  if (projected !== null) {
    console.log(
      `  ${mb(projected).padStart(9)} gz  ${pages} pages projected from that mean  ` +
        `(ceiling ${mb(MAX_MUSHAF_GZ)})`,
    );
  }

  if (heaviest.gz > MAX_PAGE_GZ) {
    problems.push(
      `pages/${row.edition}/${heaviest.name} is ${kb(heaviest.gz)} gz, over the ${kb(MAX_PAGE_GZ)}` +
        " per-page ceiling. Per-page is the invariant that survives vendoring: 604 of these" +
        " is what a reader downloads, so a heavy page is not one heavy page.",
    );
  }
  if (projected !== null && projected > MAX_MUSHAF_GZ) {
    problems.push(
      `pages/${row.edition} projects to ${mb(projected)} gz at ${pages} pages, over` +
        ` ${mb(MAX_MUSHAF_GZ)}. Only 3 pages are vendored today, so this is a forecast and not` +
        " yet a download — which is exactly when it is still cheap to change the geometry" +
        " precision or the path encoding rather than to ship it and find out.",
    );
  }
  if (projected === null) {
    problems.push(
      `EDITIONS has no page count for "${row.edition}", so the whole-mus'haf projection cannot` +
        " be made and the only thing gated here is one page at a time. Confirm the count for" +
        " that print and add `pages:` — a guess is worse than the gap (see EditionMeta.pages).",
    );
  }
}

// ── manifest.json: projected per page, because it is fetched whole ───────────

{
  const gz = gzOf(join(ASSETS, "manifest.json"));
  const manifest = JSON.parse(readFileSync(join(ASSETS, "manifest.json"), "utf8"));
  const full = editions.get(manifest.edition)?.pages ?? null;

  // Two shapes, and the difference decides whether a projection means anything.
  // The compact form (an ayah→page table, @hifth/core manifest.ts) already
  // covers every page the edition has, so its size today IS its size at full
  // vendoring. The full form grows per page and must be projected. Recognising
  // neither is not an option: a gate that shrugs at an unfamiliar shape stops
  // gating without saying so, which is the failure this whole file exists to
  // prevent.
  const compact = Array.isArray(manifest.ayahPages);
  const here = compact ? new Set(manifest.ayahPages.filter(Boolean)).size : manifest.pages?.length;

  if (here === undefined) {
    problems.push(
      "manifest.json is neither the compact shape (an `ayahPages` array) nor the full one" +
        " (a `pages` array). This gate cannot weigh what it cannot read — teach it the new" +
        " shape rather than letting it pass silently.",
    );
  }

  const projected = compact ? gz : here > 0 && full ? (gz / here) * full : null;

  console.log(
    `  ${kb(gz).padStart(9)} gz  ${String(here ?? "?").padStart(3)} pages  manifest.json` +
      (compact
        ? `  (whole print, ceiling ${kb(MAX_MANIFEST_GZ)})`
        : projected === null
          ? ""
          : `  → ${kb(projected)} gz at ${full} pages (ceiling ${kb(MAX_MANIFEST_GZ)})`),
  );

  if (projected !== null && projected > MAX_MANIFEST_GZ) {
    problems.push(
      (compact
        ? `manifest.json is ${kb(gz)} gz for the whole print, over ${kb(MAX_MANIFEST_GZ)}.`
        : `manifest.json projects to ${kb(projected)} gz at ${full} pages, over ${kb(MAX_MANIFEST_GZ)}.`) +
        " It is fetched whole by loadManifest() in apps/web/src/assets.ts before the first page" +
        " can be drawn, so this number is not download weight — it is time in front of first" +
        " paint. Find something else to derive rather than raising the ceiling.",
    );
  }
}

// ── Verdict ──────────────────────────────────────────────────────────────────

if (problems.length > 0) {
  console.error("gate:assets — FAIL");
  for (const p of problems) console.error(`  • ${p}`);
  process.exit(1);
}

const total = rows.reduce((sum, r) => sum + r.gz, 0);
console.log(`gate:assets — OK (${kb(total)} gz across ${files} files in ${rows.length} trees)`);
