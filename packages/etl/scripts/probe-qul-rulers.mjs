#!/usr/bin/env node
/**
 * QUL rulers — do the outside library's numbers agree with the ones we ship?
 *
 * WHY THIS EXISTS. `qul-reliance` (docs/decisions/qul-reliance.md) settled that this
 * project leans on the Quranic Universal Library only as a *ruler* and an outbound
 * link, never copying its bytes. A ruler you never read against your own work is not a
 * ruler. This probe reads three of the library's datasets from a gitignored cache and
 * measures our shipped numbers against them:
 *
 *   layout    — the KFGQPC QCF V2 (1421H) page layout, id 10. The pagination AUTHORITY
 *               for this edition. Confirms our ayah→page table fingerprints as V2 by
 *               agreeing with the authority on every surah's first page — the V2
 *               cross-check `PROVENANCE.md` deferred in Loop 4a, now measured offline.
 *   juz       — the library's juz boundaries vs our `JUZ_STARTS`. A second, independent
 *               opinion on the structural tables `gate-quran-meta` already derives from
 *               Tanzil.
 *   similar   — our shipped mutashabihat edges vs the library's two similarity corpora
 *               (73 phrase-level, 74 ayah-level): how many of our edges a second source
 *               corroborates, and how many pairs it knows that we do not.
 *
 * WHAT IT DOES AND DOES NOT SHIP. It reads verse KEYS, word-index ranges, page and word
 * ids, and boundary numbers — never a glyph, never a codepoint of Qur'an text. It writes
 * a numbers-only pin (`packages/etl/data/qul/qul-rulers.probe.json`) recording the
 * agreement figures and the SHA-256 of every file it read, so a rerun either reproduces
 * or says loudly that upstream moved. No Qur'an text crosses into the repo; `gate:notext`
 * and `gate:scripture` stay green.
 *
 * WHY IT IS A PROBE, NOT A GATE. Like `probe-reference.mjs`: it reads a cache that a
 * clean CI checkout does not have, so it is opt-in (`make probe-qul`), absent from
 * `make ci`, and its output is evidence a human banks — not a red build. A missing cache
 * is news about this machine, not about the data: the section is skipped and exit stays 0.
 *
 * Populate the cache with the `leverage-qul` skill, then:
 *   node packages/etl/scripts/probe-qul-rulers.mjs            # measure, print
 *   node packages/etl/scripts/probe-qul-rulers.mjs --write    # also refresh the pin
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JUZ_STARTS, toAbsoluteAyah, fromAbsoluteAyah } from "../../core/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ETL = join(HERE, "..");
const REPO = join(ETL, "..", "..");
const WRITE = process.argv.includes("--write");

const CACHE = {
  layout: join(ETL, "data/pages/.cache/qul-layout10/qpc-v2-15-lines.db"),
  juz: join(ETL, "data/meta/.cache/qul-metadata/quran-metadata-juz.json"),
  sim74: join(ETL, "data/similar-ayah/.cache/qul74/matching-ayah.json"),
  phraseVerses73: join(ETL, "data/mutashabihat/.cache/qul73/phrase_verses.json"),
  phrases73: join(ETL, "data/mutashabihat/.cache/qul73/phrases.json"),
};
const SHIPPED = {
  ayahPages: join(ETL, "data/pages/ayah-pages.json"),
  edges: join(ETL, "data/mutashabihat/mutashabiha_data.json"),
};
const PIN = join(ETL, "data/qul/qul-rulers.probe.json");

const reads = {};
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const note = (p) => {
  reads[p.replace(REPO + "/", "")] = existsSync(p) ? sha(p) : "ABSENT";
};
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const key = (abs) => {
  const { surah, ayah } = fromAbsoluteAyah(abs);
  return `${surah}:${ayah}`;
};

/* ── layout: our ayah→page table vs the V2 pagination authority ──────────── */
function layoutCheck() {
  if (!existsSync(CACHE.layout)) return { skipped: "layout cache absent" };
  note(CACHE.layout);
  note(SHIPPED.ayahPages);

  const info = JSON.parse(
    execFileSync("sqlite3", ["-json", CACHE.layout, "SELECT * FROM info"], { encoding: "utf8" }),
  )[0];
  // The page each surah opens on, per the authority. `surah_number` is populated
  // only on the `surah_name` header line (it is empty text on ayah/basmallah
  // lines), and the header sits on the page the surah opens on — so that line is
  // the authority's answer to "which page does surah S start on?".
  const rows = JSON.parse(
    execFileSync(
      "sqlite3",
      [
        "-json",
        CACHE.layout,
        "SELECT CAST(surah_number AS INTEGER) s, MIN(page_number) p FROM pages " +
          "WHERE line_type='surah_name' AND surah_number <> '' GROUP BY surah_number",
      ],
      { encoding: "utf8" },
    ),
  );
  const theirFirst = new Map(rows.map((r) => [r.s, r.p]));

  const ayahPages = json(SHIPPED.ayahPages); // ayahPages[abs-1] = page
  // Two reasonable answers to "where does surah S start" differ by exactly one
  // page whenever the surah's header is printed at the FOOT of the previous page
  // and its first ayah opens the next: the authority's header line says page P,
  // our first-ayah table says P+1. That is expected and not a finding. Any other
  // delta is a surprise — a real pagination disagreement to settle at the artwork.
  const headerOnPriorPage = [];
  const surprises = [];
  let agree = 0;
  for (let s = 1; s <= 114; s++) {
    const ours = ayahPages[toAbsoluteAyah(s, 1) - 1];
    const theirs = theirFirst.get(s);
    if (ours === theirs) agree += 1;
    else if (ours === theirs + 1) headerOnPriorPage.push(s);
    else surprises.push({ surah: s, oursFirstAyahPage: ours, theirsHeaderPage: theirs });
  }
  return {
    authority: info.name,
    pages: { ours: Math.max(...ayahPages), theirs: info.number_of_pages },
    linesPerPage: info.lines_per_page,
    surahFirstPage: {
      checked: 114,
      agree,
      headerOnPriorPage,
      surprises,
    },
  };
}

/* ── juz: our JUZ_STARTS vs the library's juz boundaries ─────────────────── */
function juzCheck() {
  if (!existsSync(CACHE.juz)) return { skipped: "juz metadata cache absent" };
  note(CACHE.juz);
  const theirs = json(CACHE.juz); // { "1": { first_verse_key, verses_count, ... }, ... }
  const mismatches = [];
  let agree = 0;
  for (let j = 1; j <= 30; j++) {
    const [s, a] = JUZ_STARTS[j - 1];
    const ourFirst = `${s}:${a}`;
    const theirFirst = theirs[String(j)]?.first_verse_key;
    if (ourFirst === theirFirst) agree += 1;
    else mismatches.push({ juz: j, ours: ourFirst, theirs: theirFirst });
  }
  return { checked: 30, agree, mismatches };
}

/* ── similar: our edges vs the library's two similarity corpora ──────────── */
function similarityCheck() {
  const have74 = existsSync(CACHE.sim74);
  const have73 = existsSync(CACHE.phraseVerses73) && existsSync(CACHE.phrases73);
  if (!have74 && !have73) return { skipped: "no similarity cache" };
  note(SHIPPED.edges);

  // Our directed edges as verse-key pairs (edges use ABSOLUTE ayah numbers; an
  // `ayah` is a number or an array-range). Mirroring build-adjacency: an edge
  // attaches to EVERY ayah of a source range and targets the FIRST of a target range.
  const asList = (v) => (Array.isArray(v) ? v : [v]);
  const first = (v) => (Array.isArray(v) ? v[0] : v);
  const ours = new Set();
  const data = json(SHIPPED.edges);
  for (const list of Object.values(data)) {
    for (const e of list) {
      const srcs = asList(e.src.ayah).map(key);
      for (const m of e.muts ?? []) {
        const b = key(first(m.ayah));
        for (const a of srcs) if (a !== b) ours.add(`${a}|${b}`);
      }
    }
  }

  const result = { ourEdges: ours.size };

  if (have74) {
    note(CACHE.sim74);
    const sim = json(CACHE.sim74); // verse_key -> [{ matched_ayah_key, ... }]
    const theirPairs = new Set();
    for (const [k, arr] of Object.entries(sim))
      for (const m of arr) theirPairs.add(`${k}|${m.matched_ayah_key}`);
    let corrob = 0;
    for (const p of ours) {
      const [a, b] = p.split("|");
      if (theirPairs.has(p) || theirPairs.has(`${b}|${a}`)) corrob += 1;
    }
    // pairs the library knows that we do not (undirected)
    const oursUndir = new Set();
    for (const p of ours) {
      const [a, b] = p.split("|");
      oursUndir.add(a < b ? p : `${b}|${a}`);
    }
    let novel = 0;
    const seen = new Set();
    for (const p of theirPairs) {
      const [a, b] = p.split("|");
      const u = a < b ? p : `${b}|${a}`;
      if (seen.has(u)) continue;
      seen.add(u);
      if (!oursUndir.has(u)) novel += 1;
    }
    // The gap, characterised. `novelToUs` counts every pair the library has that
    // we do not — but many are trivial for a memoriser (surah openings sharing
    // the disconnected letters, single-word coincidences), so bucket by strength.
    // A "strong" miss is a real look-alike: 4+ shared words, high score, high
    // coverage. These verse-key pairs are NUMBERS, no Qur'an text — but we ship
    // none of them today (qul-reliance is "copy none"); this only measures what a
    // reader would gain if that boundary were reopened. Sample capped + sorted by
    // shared-word count so the pin names the worst offenders reproducibly.
    const perSide = new Map(); // undirected -> best {score,cov,mw}
    for (const [k, arr] of Object.entries(sim))
      for (const m of arr) {
        const u = k < m.matched_ayah_key ? `${k}|${m.matched_ayah_key}` : `${m.matched_ayah_key}|${k}`;
        const cur = { score: m.score, cov: m.coverage, mw: m.matched_words_count };
        const prev = perSide.get(u);
        if (!prev || cur.score > prev.score) perSide.set(u, cur);
      }
    const novelPairs = [...perSide].filter(([u]) => !oursUndir.has(u));
    const strong = novelPairs.filter(([, v]) => v.mw >= 4 && v.score >= 80 && v.cov >= 70);
    const shortNoise = novelPairs.filter(([, v]) => v.mw < 4).length;
    // A "verbatim" miss is the sharpest case: two verses the ruler scores as a
    // 100% match over 100% coverage — word-for-word the same verse in two
    // places — that we do not connect at all. These are the twins a memoriser
    // most needs a bridge between, and the ones a picture makes undeniable.
    const verbatim = strong.filter(([, v]) => v.score === 100 && v.cov === 100).length;
    const versesTouched = new Set();
    for (const [u] of strong) {
      const [a, b] = u.split("|");
      versesTouched.add(a);
      versesTouched.add(b);
    }
    result.corpus74 = {
      theirPairs: theirPairs.size,
      oursCorroborated: corrob,
      oursCorroboratedPct: ours.size ? Math.round((corrob / ours.size) * 1000) / 10 : 0,
      novelToUs: novel,
      gap: {
        strongMisses: strong.length,
        verbatimMisses: verbatim,
        versesTouched: versesTouched.size,
        shortNoise,
        strongestMissing: strong
          .sort((x, y) => y[1].mw - x[1].mw)
          .slice(0, 60)
          .map(([u, v]) => ({ pair: u, sharedWords: v.mw, score: v.score, coverage: v.cov })),
      },
    };
  }

  if (have73) {
    note(CACHE.phraseVerses73);
    note(CACHE.phrases73);
    const phrases = json(CACHE.phrases73); // phrase_id -> { ayah: { verse_key: [[from,to]] } }
    // pair corroborated by 73 iff a and b co-occur in some phrase
    const coPairs = new Set();
    for (const ph of Object.values(phrases)) {
      const verses = Object.keys(ph.ayah ?? {});
      for (let i = 0; i < verses.length; i++)
        for (let jx = i + 1; jx < verses.length; jx++) {
          const a = verses[i],
            b = verses[jx];
          coPairs.add(a < b ? `${a}|${b}` : `${b}|${a}`);
        }
    }
    let corrob = 0;
    const seen = new Set();
    for (const p of ours) {
      const [a, b] = p.split("|");
      const u = a < b ? p : `${b}|${a}`;
      if (seen.has(u)) continue;
      seen.add(u);
      if (coPairs.has(u)) corrob += 1;
    }
    result.corpus73 = {
      theirCoPairs: coPairs.size,
      ourUndirectedCorroborated: corrob,
      ourUndirectedPairs: seen.size,
    };
  }
  return result;
}

/* ── run ─────────────────────────────────────────────────────────────────── */
const out = {
  $comment:
    "Do the QUL rulers agree with our shipped numbers? See qul-reliance: QUL is a ruler + " +
    "outbound link only, and this repo ships none of its bytes. This pin holds AGREEMENT " +
    "NUMBERS ONLY — verse keys, ids, boundary counts; no Qur'an text — plus the SHA-256 of " +
    "every file read so a rerun reproduces or says upstream moved. Opt-in probe, never a " +
    "gate (the cache is gitignored). Regenerate with `make probe-qul` / `--write`.",
  measuredAt: new Date().toISOString().slice(0, 10),
  reads,
  layout: layoutCheck(),
  juz: juzCheck(),
  similarity: similarityCheck(),
};
// `reads` is filled by the checks; move it after them for a stable, populated pin.
out.reads = reads;

const L = out.layout,
  J = out.juz,
  S = out.similarity;
console.log("QUL rulers — measured against what we ship\n");
if (L.skipped) console.log(`layout      — ${L.skipped}`);
else
  console.log(
    `layout      — ${L.authority}: ${L.surahFirstPage.agree}/114 surah first-pages agree` +
      `${L.surahFirstPage.headerOnPriorPage.length ? `, ${L.surahFirstPage.headerOnPriorPage.length} header-on-prior-page (expected)` : ""}` +
      `${L.surahFirstPage.surprises.length ? `, ${L.surahFirstPage.surprises.length} SURPRISE` : ", 0 surprises"}` +
      `; pages ours=${L.pages.ours} theirs=${L.pages.theirs}, ${L.linesPerPage} lines`,
  );
if (J.skipped) console.log(`juz         — ${J.skipped}`);
else
  console.log(
    `juz         — ${J.agree}/30 juz starts agree with JUZ_STARTS` +
      `${J.mismatches.length ? ` (${J.mismatches.length} differ)` : ""}`,
  );
if (S.skipped) console.log(`similarity  — ${S.skipped}`);
else {
  console.log(`similarity  — ${S.ourEdges} of our directed edges`);
  if (S.corpus74) {
    console.log(
      `              corpus 74: ${S.corpus74.oursCorroborated} corroborated ` +
        `(${S.corpus74.oursCorroboratedPct}%), ${S.corpus74.novelToUs} pairs novel to us`,
    );
    if (S.corpus74.gap)
      console.log(
        `              gap: ${S.corpus74.gap.strongMisses} strong look-alikes we lack ` +
          `(${S.corpus74.gap.verbatimMisses} verbatim, ${S.corpus74.gap.versesTouched} verses), ` +
          `${S.corpus74.gap.shortNoise} short/noise`,
      );
  }
  if (S.corpus73)
    console.log(
      `              corpus 73: ${S.corpus73.ourUndirectedCorroborated}/${S.corpus73.ourUndirectedPairs} ` +
        `undirected pairs share a phrase`,
    );
}

for (const [k, v] of [
  ["layout", L],
  ["juz", J],
])
  if (v.mismatches?.length) {
    console.log(`\n${k} mismatches (a finding — settle against the artwork, not this table):`);
    for (const m of v.mismatches) console.log("  ", JSON.stringify(m));
  }

if (WRITE) {
  mkdirSync(dirname(PIN), { recursive: true });
  writeFileSync(PIN, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nwrote ${PIN.replace(REPO + "/", "")}`);
} else {
  console.log("\n(run with --write to refresh the pin)");
}
