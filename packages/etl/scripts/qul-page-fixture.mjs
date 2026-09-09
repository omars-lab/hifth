#!/usr/bin/env node
/**
 * QUL page fixture — pull ONE page out of the held store, for the dev diff view.
 *
 * WHY THIS EXISTS. `qul-store-purpose` (docs/decisions/qul-store-purpose.md) settled that
 * the held copy is a *second draughtsman*: draw our own word-by-word page from the store and
 * stand it beside the shipped print, to check our page is registered right. This script is
 * the read side of that — the sibling of `ingest-qul-supabase.mjs`, which is the write side.
 * Given a page number it reads that page's lines (from qul_page_lines) and their words (from
 * qul_words) and writes a small JSON the dev diff view renders.
 *
 * WHAT CROSSES WHERE — THE SAME LINE THE HOLD KEEPS. The word text is text-bearing. It flows
 * store -> gitignored fixture directly, NEVER a tracked file. The fixture lands under
 * apps/web/dev-fixtures/ which is gitignored and is NOT apps/web/public/, so a production build
 * cannot copy it into the shipped bundle. This file itself carries no Qur'an text, so
 * gate:scripture / gate:notext stay green. The store is reached with the same credential the
 * ingest uses (SUPABASE_DB_URL), which is the owner's to hold; this script only reads it from
 * the environment and hands it to psql, never prints it.
 *
 * RUN (the credential comes from dotenvx, never typed):
 *   dotenvx run -- node packages/etl/scripts/qul-page-fixture.mjs --page 1
 *   dotenvx run -- node packages/etl/scripts/qul-page-fixture.mjs --page 604 --out /tmp/p604.json
 *
 * A missing SUPABASE_DB_URL is news about this machine, not an error the tree should carry:
 * the script says so and exits non-zero, but writes nothing.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ETL = join(HERE, "..");
const REPO = join(ETL, "..", "..");

const argv = process.argv.slice(2);
function argValue(flag) {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

const page = parseInt(argValue("--page") ?? "", 10);
if (!Number.isInteger(page) || page < 1 || page > 604) {
  console.error("qul-page-fixture — pass --page <1..604> (the 604-page V4 mus'haf plan).");
  process.exit(1);
}

const DB_URL = process.env.SUPABASE_DB_URL || "";
if (!DB_URL) {
  console.error(
    "qul-page-fixture — set SUPABASE_DB_URL (via `dotenvx run --`). Not printing it; " +
      "it is the owner's credential and never lands in the tree or the logs.",
  );
  process.exit(1);
}

// One query: the page's lines in order, each with its words in word-id order. All the text
// stays inside the JSON psql streams back on stdout. `page` is inlined as a bare integer we
// already parsed and range-checked (1..604), so there is nothing to inject; the connection
// string is argv[0], never echoed.
const SQL = `
select coalesce(json_build_object(
  'page', ${page},
  'lines', coalesce((
    select json_agg(j order by ln)
    from (
      select l.line_number as ln,
        json_build_object(
          'line_number',   l.line_number,
          'line_type',     l.line_type,
          'is_centered',   l.is_centered,
          'surah_number',  l.surah_number,
          'first_word_id', l.first_word_id,
          'last_word_id',  l.last_word_id,
          'words', coalesce((
            select json_agg(json_build_object(
              'word_id',  w.word_id,
              'surah',    w.surah,
              'ayah',     w.ayah,
              'position', w.position,
              'text',     w.text
            ) order by w.word_id)
            from public.qul_words w
            where l.first_word_id is not null
              and w.word_id between l.first_word_id and l.last_word_id
          ), '[]'::json)
        ) as j
      from public.qul_page_lines l
      where l.page_number = ${page}
    ) s
  ), '[]'::json)
), '{}'::json)::text as fixture;
`;

let out;
try {
  out = execFileSync("psql", [DB_URL, "-t", "-A", "-X", "-q", "-c", SQL], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
} catch (err) {
  // psql prints its own error to stderr (inherited). Never re-print the command line, which
  // would leak the connection string. Say what to do and stop.
  console.error(
    "qul-page-fixture — the store read failed (see psql's message above). Common causes: " +
      "psql not on PATH (brew install libpq), or the IPv6-only direct host — use the session " +
      "pooler URL. The page map + word text must be ingested first.",
  );
  process.exit(1);
}

let fixture;
try {
  fixture = JSON.parse(out);
} catch {
  console.error("qul-page-fixture — the store did not return valid JSON for this page.");
  process.exit(1);
}

const lines = Array.isArray(fixture.lines) ? fixture.lines : [];
if (lines.length === 0) {
  console.error(
    `qul-page-fixture — page ${page} has no lines in the store. Is the page map ingested?`,
  );
  process.exit(1);
}

const outPath =
  argValue("--out") || join(REPO, "apps/web/dev-fixtures", `qul-page-${page}.json`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(fixture) + "\n");

// counts only — never the words themselves
const wordCount = lines.reduce((n, l) => n + (Array.isArray(l.words) ? l.words.length : 0), 0);
const rel = outPath.startsWith(REPO) ? outPath.slice(REPO.length + 1) : outPath;
console.log(
  `qul-page-fixture — page ${page}: ${lines.length} lines, ${wordCount} words -> ${rel} (gitignored).`,
);
