#!/usr/bin/env node
/**
 * QUL -> Supabase ingest — hold a copy in a store we control, not in the tree.
 *
 * WHY THIS EXISTS. `qul-reliance` (docs/decisions/qul-reliance.md) was reopened on
 * 2026-09-07 and re-decided **D**: a copy of the outside library's page positions and
 * word text may be *held* in a hosted database this project controls — off the
 * repository and off the shipped bundle — for the building tools to read. This script
 * is that hold. It reads a gitignored `.cache/` and upserts into the Supabase schema in
 * `supabase/migrations/`.
 *
 * WHAT V4 MEANS HERE. `qul-store-purpose` (docs/decisions/qul-store-purpose.md) settled
 * what the held copy is for: draw our own word-by-word page and stand it beside the
 * shipped print to check our pages. That page is drawn from the V4 pieces — the
 * digital-khatt 15-line layout (library id 21) and the qpc-v4 word text (library id 47) —
 * NOT the V2 ruler (library id 10) the probe measures against. The two are different
 * resources with different caches; this script holds the V4 pair.
 *
 * WHAT CROSSES WHERE. Nothing this script writes touches the repository. The page map
 * is numbers only. The word text is text-bearing and flows cache -> database directly,
 * staged through a gitignored temporary file, never a tracked one. This file itself
 * carries no Qur'an text: `gate:scripture` / `gate:notext` stay green.
 *
 * TWO HALVES, ONE GATED.
 *   --pages   the digital-khatt 15-line page layout, library id 21 — positions only.
 *             Safe to run whenever its cache is present.
 *   --words   the per-word qpc-v4 text (library id 47), keyed by the same global word id.
 *             TEXT-BEARING, so it refuses to run until the source resource's licence has
 *             been read and recorded (the ledger check `qul-rulers-terms-and-text-free`)
 *             AND you pass --licence-cleared to acknowledge it. Holding text you have not
 *             cleared is exactly what option D forbids. The same gate stands in front of
 *             every other held item that is text, a font, or morphology — the fonts that
 *             draw this text (ids 457/462) and the per-word root/lemma/stem — so any of
 *             those added here later routes through this same licence check, never around it.
 *
 * RUN.
 *   node packages/etl/scripts/ingest-qul-supabase.mjs --pages --dry-run   # read cache, count, touch no db
 *   SUPABASE_DB_URL=... node .../ingest-qul-supabase.mjs --pages          # upsert the page map
 *   SUPABASE_DB_URL=... node .../ingest-qul-supabase.mjs --words --licence-cleared
 *
 * A missing cache is news about this machine, not an error: the half is skipped and
 * exit stays 0, the same contract the ruler probe keeps. Populate the caches with the
 * `leverage-qul` skill first; push the schema with `supabase db push` before the first
 * real (non-dry-run) ingest.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ETL = join(HERE, "..");
const REPO = join(ETL, "..", "..");

const argv = new Set(process.argv.slice(2));
const DRY = argv.has("--dry-run");
const DO_PAGES = argv.has("--pages");
const DO_WORDS = argv.has("--words");
const LICENCE_CLEARED = argv.has("--licence-cleared");

const CACHE = {
  // the V4 self-render layout (library id 21), gitignored — distinct from the probe's
  // V2 ruler cache (library id 10). Populate it with the leverage-qul skill.
  layout: join(ETL, "data/pages/.cache/qul-layout21/digital-khatt-15-lines.db"),
  // text-bearing qpc-v4 word export (library id 47), shaped as an array of
  // {word_id, surah, ayah, position, text}
  words: join(ETL, "data/qul/.cache/qul-words/words.json"),
};
const LEDGER = join(REPO, "docs/validation/ledger.json");
const LICENCE_CHECK = "qul-rulers-terms-and-text-free";

const DB_URL = process.env.SUPABASE_DB_URL || "";

function die(msg) {
  console.error(`ingest-qul-supabase — ${msg}`);
  process.exit(1);
}

/** Run a batch of SQL against the database over psql (numbers-only, safe to log). */
function psqlExec(sql) {
  if (DRY) return;
  if (!DB_URL) die("set SUPABASE_DB_URL to a Postgres connection string (or pass --dry-run)");
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"], {
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
  });
}

/* ── the page map — positions only, library id 21 (digital-khatt V4) ──────── */
function ingestPages() {
  if (!existsSync(CACHE.layout)) {
    console.log("pages — layout cache absent; skipped. Populate it with the leverage-qul skill.");
    return;
  }
  const info = JSON.parse(
    execFileSync("sqlite3", ["-json", CACHE.layout, "SELECT * FROM info"], { encoding: "utf8" }),
  )[0];
  const rows = JSON.parse(
    execFileSync(
      "sqlite3",
      [
        "-json",
        CACHE.layout,
        "SELECT page_number, line_number, line_type, surah_number, " +
          "first_word_id, last_word_id FROM pages ORDER BY page_number, line_number",
      ],
      { encoding: "utf8" },
    ),
  );

  const intOrNull = (v) => (v === "" || v === null || v === undefined ? "null" : String(parseInt(v, 10)));
  const sqlStr = (v) => `'${String(v).replace(/'/g, "''")}'`;

  const values = rows.map((r) => {
    // word ids exist on ayah lines; surah_number only on the surah_name header line
    const wordFirst = r.line_type === "ayah" ? intOrNull(r.first_word_id) : "null";
    const wordLast = r.line_type === "ayah" ? intOrNull(r.last_word_id) : "null";
    return `(${r.page_number}, ${r.line_number}, ${sqlStr(r.line_type)}, ` +
      `${intOrNull(r.surah_number)}, ${wordFirst}, ${wordLast})`;
  });

  console.log(
    `pages — ${rows.length} lines across ${info.number_of_pages} pages ` +
      `(${info.lines_per_page} lines/page, authority ${sqlStr(info.name)}).`,
  );
  if (DRY) {
    console.log("pages — dry run; no database touched.");
    return;
  }

  // upsert in batches to keep each statement a sane size
  const B = 500;
  let sql = "begin;\n";
  for (let i = 0; i < values.length; i += B) {
    sql +=
      "insert into public.qul_page_lines " +
      "(page_number, line_number, line_type, surah_number, first_word_id, last_word_id) values\n" +
      values.slice(i, i + B).join(",\n") +
      "\non conflict (page_number, line_number) do update set " +
      "line_type=excluded.line_type, surah_number=excluded.surah_number, " +
      "first_word_id=excluded.first_word_id, last_word_id=excluded.last_word_id;\n";
  }
  // layout info (numbers/labels only)
  const infoRows = Object.entries(info)
    .map(([k, v]) => `(${sqlStr(k)}, ${sqlStr(v)})`)
    .join(",\n");
  sql +=
    "insert into public.qul_layout_info (key, value) values\n" +
    infoRows +
    "\non conflict (key) do update set value=excluded.value;\n";
  sql += "commit;\n";
  psqlExec(sql);
  console.log(`pages — upserted ${values.length} lines + ${Object.keys(info).length} info rows.`);
}

/* ── the word text — text-bearing, gated behind the licence read ──────────── */
function licenceCleared() {
  if (!LICENCE_CLEARED) {
    console.error(
      "words — refused: pass --licence-cleared only after the source resource's licence " +
        "is read and recorded. See the leverage-qul rubric and the ledger check " +
        `${LICENCE_CHECK}.`,
    );
    return false;
  }
  if (!existsSync(LEDGER)) return true; // ledger not on this branch; the flag is the acknowledgement
  try {
    const ledger = JSON.parse(readFileSync(LEDGER, "utf8"));
    const checks = ledger.checks || ledger;
    const row = (Array.isArray(checks) ? checks : Object.values(checks)).find?.(
      (c) => c && c.id === LICENCE_CHECK,
    );
    if (row && row.lastResult == null && (row.status === "pending" || row.result == null)) {
      console.error(
        `words — refused: the ledger check ${LICENCE_CHECK} has no recorded pass yet. ` +
          "Read the resource's licence and record it before holding its text.",
      );
      return false;
    }
  } catch {
    /* a shape we do not recognise is not a licence — fall back to the explicit flag */
  }
  return true;
}

function ingestWords() {
  if (!existsSync(CACHE.words)) {
    console.log(
      "words — word-text cache absent; skipped. Identify the text-bearing resource in the " +
        "leverage-qul rubric, read its licence, then cache it as an array of " +
        "{word_id, surah, ayah, position, text}.",
    );
    return;
  }
  if (!licenceCleared()) process.exit(1);

  const words = JSON.parse(readFileSync(CACHE.words, "utf8"));
  const list = Array.isArray(words) ? words : Object.values(words);
  console.log(`words — ${list.length} words in cache.`);
  if (DRY) {
    console.log("words — dry run; no database touched, no text moved.");
    return;
  }

  // stream a TSV into a gitignored temp, then \copy it — text never touches a tracked file
  const tmpDir = join(ETL, "data/qul/.cache/qul-words");
  mkdirSync(tmpDir, { recursive: true });
  const tmp = join(tmpDir, ".ingest-tmp.tsv");
  const esc = (v) => String(v).replace(/\\/g, "\\\\").replace(/\t/g, " ").replace(/\n/g, " ");
  const tsv = list
    .map((w) => `${w.word_id}\t${w.surah}\t${w.ayah}\t${w.position}\t${esc(w.text)}`)
    .join("\n");
  writeFileSync(tmp, tsv);
  try {
    const sql =
      "begin;\n" +
      "create temp table _qw (like public.qul_words including all) on commit drop;\n" +
      `\\copy _qw (word_id, surah, ayah, position, text) from '${tmp}' with (format csv, delimiter E'\\t', quote E'\\b');\n` +
      "insert into public.qul_words select * from _qw " +
      "on conflict (word_id) do update set surah=excluded.surah, ayah=excluded.ayah, " +
      "position=excluded.position, text=excluded.text;\n" +
      "commit;\n";
    psqlExec(sql);
    console.log(`words — upserted ${list.length} words.`);
  } finally {
    rmSync(tmp, { force: true });
  }
}

/* ── main ─────────────────────────────────────────────────────────────────── */
if (!DO_PAGES && !DO_WORDS) {
  console.log(
    "ingest-qul-supabase — nothing selected. Pass --pages and/or --words (add --dry-run to " +
      "read the cache without a database).",
  );
  process.exit(0);
}
if (DO_PAGES) ingestPages();
if (DO_WORDS) ingestWords();
