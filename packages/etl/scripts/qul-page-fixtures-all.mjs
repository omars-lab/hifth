#!/usr/bin/env node
/**
 * QUL page fixtures — pull ALL 604 pages out of the held store in one connection.
 *
 * The bulk sibling of `qul-page-fixture.mjs`. The whole-book tappable-area sweep
 * (docs/PLAN.md follow-up 20) needs every page's fixture at once; pulling them one
 * psql spawn at a time is 604 connections. This does it in a single query, writing
 * the same per-page JSON files under the same gitignored apps/web/dev-fixtures/.
 *
 * The word text is text-bearing and flows store -> gitignored fixture directly,
 * NEVER a tracked file. This script carries no Qur'an text, so gate:scripture /
 * gate:notext stay green. The store is reached with SUPABASE_DB_URL from the
 * environment (via `dotenvx run --`), handed to psql, never printed.
 *
 * RUN:
 *   dotenvx run -- node packages/etl/scripts/qul-page-fixtures-all.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const OUT_DIR = join(REPO, "apps/web/dev-fixtures");

const DB_URL = process.env.SUPABASE_DB_URL || "";
if (!DB_URL) {
  console.error(
    "qul-page-fixtures-all — set SUPABASE_DB_URL (via `dotenvx run --`). Not printing it.",
  );
  process.exit(1);
}

// One query: every page's lines-and-words as a single-line JSON, one row per page.
// Two columns, tab-separated (the JSON text carries no tabs). Same shape the
// per-page reader writes, so loadFixture reads either identically.
const SQL = `
select p.page as page,
  json_build_object(
    'page', p.page,
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
        where l.page_number = p.page
      ) s
    ), '[]'::json)
  )::text as fixture
from generate_series(1,604) as p(page)
order by p.page;
`;

let out;
try {
  out = execFileSync("psql", [DB_URL, "-t", "-A", "-X", "-q", "-F", "\t", "-c", SQL], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
  });
} catch {
  console.error(
    "qul-page-fixtures-all — the store read failed (see psql's message above). psql on PATH? " +
      "Use the session pooler URL; the page map + word text must be ingested first.",
  );
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
let written = 0;
let empty = 0;
for (const raw of out.split("\n")) {
  const line = raw.trim();
  if (!line) continue;
  const tab = line.indexOf("\t");
  if (tab < 0) continue;
  const page = Number(line.slice(0, tab));
  const json = line.slice(tab + 1);
  let fixture;
  try {
    fixture = JSON.parse(json);
  } catch {
    console.error(`qul-page-fixtures-all — page ${page}: store did not return valid JSON; skipped.`);
    continue;
  }
  const lines = Array.isArray(fixture.lines) ? fixture.lines : [];
  if (lines.length === 0) {
    empty++;
    continue;
  }
  writeFileSync(join(OUT_DIR, `qul-page-${page}.json`), JSON.stringify(fixture) + "\n");
  written++;
}
console.log(
  `qul-page-fixtures-all — wrote ${written} page fixture(s) to apps/web/dev-fixtures/ (gitignored)` +
    (empty ? `; ${empty} page(s) had no lines in the store.` : "."),
);
