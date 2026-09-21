#!/usr/bin/env node
/**
 * QUL V2 layout probe — a fourth, independent witness that our page table is the
 * KFGQPC V2 / 1421H print, checked against the authority that print was matched to.
 *
 * WHY THIS EXISTS. `packages/etl/data/pages/PROVENANCE.md` pinned our edition as
 * V2/1421H by matching it against QUL's published V2 layout resource
 * (`https://qul.tarteel.ai/resources/mushaf-layout/10`). `scripts/probe-reference.mjs`
 * already cross-checks us against api.quran.com, but that is a V1/1405H table used
 * as a *fingerprint* — it must DISAGREE on 36 pages. This probe is the other half:
 * a direct read of the V2 authority itself, which must AGREE everywhere. Two
 * witnesses that fail in opposite directions catch different mistakes.
 *
 * The owner asked for it as a redundant fourth witness on 2026-09-20 (task #66),
 * over a recommendation to decline it as redundant. It is redundant on purpose:
 * the surah-start pagination is settled, and a second independent authority that
 * still agrees is worth the redundancy on a POC being shown to outside reviewers.
 *
 * WHAT IT COMPARES, AND WHY IT IS SEGMENTATION-SAFE. QUL's word ids (1..83668) do
 * NOT line up with our QAC segmentation, so an ayah-by-ayah word mapping is not
 * robust and is not attempted. What IS robust is where each surah opens: walk
 * QUL's lines in order, and the surah's first-AYAH page is the page of the first
 * `ayah` line after its `surah_name` banner. That is a tag-independent signal —
 * it needs no word count and no ayah numbering to line up — so it is the one this
 * probe pins. (QUL's banner often prints at the foot of the previous page; that is
 * a banner-placement fact, not a first-ayah-page fact, so the banner page is
 * reported for the eye but not asserted.) Plus the structural constants: 604
 * pages, 15 lines per page.
 *
 * WHAT IT STORES. Nothing. QUL's layout export is login-gated (standing permission
 * 2026-09-08 to download it via the owner's signed-in browser), and the repo
 * vendors ZERO QUL bytes — the same rule SOURCES.md writes for every measuring
 * stick. So the path to the downloaded SQLite is PASSED IN; this probe reads it in
 * place, writes nothing, and commits nothing derived from it beyond the pass/fail.
 * Positions carry no letters, so no Quran text crosses into the repo.
 *
 * WHY IT IS NOT A GATE. It needs a human-downloaded file that is not in the repo
 * and cannot be, so CI could never run it. Like `probe-reference`, it is opt-in
 * (`make probe-qul-v2 DB=<path>`), absent from `make ci`, and its output is
 * evidence a human banks with `make record` — not a red build.
 *
 * Usage:
 *   node scripts/probe-qul-v2-layout.mjs --db /path/to/qpc-v2-15-lines.db
 *   make probe-qul-v2 DB=/path/to/qpc-v2-15-lines.db
 *
 * Exit code is 1 when a surah opens on a different page than the V2 authority
 * places it, or when the structural constants (604 pages / 15 lines) disagree.
 * Exit is 0 when they all agree, and 2 when the DB path is missing or unreadable
 * (news about the download, not about us).
 *
 * Requires node's experimental SQLite reader (--experimental-sqlite), present in
 * the repo's pinned v22.22.3.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
// Reached through core's build output, like probe-reference.mjs: `make probe-qul-v2`
// depends on the `core` target so `dist` is fresh.
import { toAbsoluteAyah } from "../packages/core/dist/index.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(REPO, "apps", "web", "public", "assets", "manifest.json");

const AUTHORITY = "https://qul.tarteel.ai/resources/mushaf-layout/10";

/** --db <path>, or QUL_V2_DB in the environment. */
function dbPath() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--db");
  if (i !== -1 && argv[i + 1]) return argv[i + 1];
  return process.env.QUL_V2_DB ?? null;
}

function fail(msg, code) {
  console.error(msg);
  process.exit(code);
}

const path = dbPath();
if (!path) {
  fail(
    "No QUL V2 layout DB given. This is a login-gated download the repo never vendors —\n" +
      "pass the file you downloaded:\n" +
      `  make probe-qul-v2 DB=/path/to/qpc-v2-15-lines.db\n` +
      `The V2 authority is ${AUTHORITY} (the '15 lines' SQLite export).`,
    2,
  );
}
if (!existsSync(path)) fail(`No such file: ${path}`, 2);

let db;
try {
  db = new DatabaseSync(path, { readOnly: true });
} catch (e) {
  fail(`Could not open ${path} as SQLite: ${e.message}`, 2);
}

// --- The V2 authority, read in place -----------------------------------------
const info = db.prepare("SELECT * FROM info").get();
const lines = db
  .prepare(
    "SELECT page_number AS page, line_number AS line, line_type AS type, surah_number AS surah " +
      "FROM pages ORDER BY page_number, line_number",
  )
  .all();

/**
 * Walk the lines in order. A `surah_name` banner names the surah; the surah's
 * first-AYAH page is the page of the next `ayah` line (a `basmallah` line may sit
 * between them). This needs no word count and no ayah numbering, so QUL's word ids
 * disagreeing with our segmentation cannot touch it.
 */
const qulFirstAyahPage = new Map();
const qulBannerPage = new Map();
let pending = null;
for (const row of lines) {
  if (row.type === "surah_name") {
    qulBannerPage.set(row.surah, row.page);
    pending = row.surah;
  } else if (row.type === "ayah" && pending !== null) {
    qulFirstAyahPage.set(pending, row.page);
    pending = null;
  }
}

// --- Our page table ----------------------------------------------------------
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
// ayahPages[i] = page of absolute ayah (i+1); a surah's first ayah is 1.
const ourFirstAyahPage = (surah) => manifest.ayahPages[toAbsoluteAyah(surah, 1) - 1];
const ourPageCount = Math.max(...manifest.ayahPages);

// --- Structural constants ----------------------------------------------------
console.log(`QUL V2 layout — ${manifest.edition} vs ${AUTHORITY}\n`);
console.log(`  font: ${info.font_name}`);
const structural = [];
const qulPages = Number(info.number_of_pages);
const qulLpp = Number(info.lines_per_page);
structural.push({
  what: "pages",
  ours: ourPageCount,
  theirs: qulPages,
  ok: ourPageCount === qulPages,
});
// 15 lines per page is a fact about the V2 print we ship; QUL's info carries it,
// and so does every line-row (max line_number). We assert QUL's own two agree and
// that it is the expected 15 — our data is per-page ayah spans and does not store
// a line count, so this half is QUL-internal consistency plus the print constant.
const maxLine = lines.reduce((m, r) => Math.max(m, r.line), 0);
structural.push({
  what: "lines/page",
  ours: 15,
  theirs: qulLpp,
  ok: qulLpp === 15 && maxLine === 15,
});
for (const s of structural) {
  console.log(`  ${s.ok ? "✓" : "✗"} ${s.what.padEnd(11)} ours ${s.ours}   authority ${s.theirs}`);
}

// --- The witness: where each surah opens -------------------------------------
let agree = 0;
let bannerAgree = 0;
const mismatches = [];
for (let s = 1; s <= 114; s++) {
  const ours = ourFirstAyahPage(s);
  const theirs = qulFirstAyahPage.get(s);
  if (ours === theirs) agree += 1;
  else mismatches.push({ surah: s, ours, theirs, banner: qulBannerPage.get(s) });
  if (ours === qulBannerPage.get(s)) bannerAgree += 1;
}

console.log(`\nsurah first-ayah page vs V2 authority:  ${agree}/114 agree`);
console.log(
  `surah banner page (for the eye only):   ${bannerAgree}/114 ` +
    `(QUL prints many banners on the previous page — not asserted)`,
);

const structuralOk = structural.every((s) => s.ok);
if (mismatches.length === 0 && structuralOk) {
  console.log(
    "\nEvery surah opens on the page QUL's KFGQPC V2 authority places it, and the print\n" +
      "constants agree (604 pages, 15 lines). Our page table fingerprints as V2/1421H\n" +
      "against the direct authority, the same edition PROVENANCE.md pinned in Loop 4a —\n" +
      "now cross-checked a second, independent way from the one probe-reference uses.\n" +
      "\nWhat it does NOT prove: that a hop edge joins two ayahs that genuinely resemble\n" +
      "each other. That still needs a reader — make validate CHECK=edge-spot-audit.",
  );
  process.exit(0);
}

if (!structuralOk) {
  console.log("\nSTRUCTURAL DISAGREEMENT — the two prints are not the same shape:");
  for (const s of structural.filter((x) => !x.ok)) {
    console.log(`  ${s.what}: ours ${s.ours} vs authority ${s.theirs}`);
  }
}
if (mismatches.length) {
  console.log(`\n${mismatches.length} SURAH(S) open on a different page than the V2 authority:`);
  for (const m of mismatches) {
    console.log(
      `  surah ${String(m.surah).padStart(3)}: ours p${m.ours} vs authority p${m.theirs}` +
        ` (banner p${m.banner})`,
    );
  }
  console.log(
    "\nThis is not proof we are wrong — settle it against the artwork before changing\n" +
      "anything: the SVG for that page IS the print and is already in the repo\n" +
      "(`#/hafs-kfqc/p<N>` in `make dev`). If the artwork sides with the authority,\n" +
      "it is a gate:pages-shaped defect and belongs in docs/issues.json.",
  );
}
process.exit(1);
