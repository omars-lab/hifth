#!/usr/bin/env node
/**
 * CI gate: a shipped asset tree names every upstream it was built from.
 *
 * WHY THIS EXISTS. `apps/web/public/assets/adj/**` was bucketed in LICENSES.md
 * under one upstream — Waqar144's mutashabihat pairings, free to use with
 * attribution — for the entire life of the spans feature. `build-adjacency.mjs`
 * reaches the GPL'd Quranic Arabic Corpus morphology two hops out, through
 * `morphology.mjs`, and writes what it computes into 2,544 of 3,002 shipped
 * edges. The tree was a GPL derivative and neither the licence table nor the
 * shards said so; the shards also shipped without any NOTICE.txt at all, while
 * the two sibling trees built by the same ETL both emit one.
 *
 * Nothing caught either, for the same reason: the drift arrived as a FEATURE.
 * Nobody edited a licence file, so nothing prompted anybody to look. The gate
 * that could have caught it is not one that checks quotations — `gate:license-copy`
 * already pins the licence text quoted in SOURCES.md against the copy in the
 * colophon, which is a real check on whether a quotation drifted and no check at
 * all on whether the SET of quotations is still complete.
 *
 * WHAT IT CHECKS. Four things that could each drift alone, tied together:
 *
 *   1. THE TABLE AGAINST THE BYTES. Every row of LICENSES.md's bucket table
 *      whose terms say "(inherited)" must be declared below, and vice versa —
 *      so a new inherited bucket cannot be added to the table without arriving
 *      here. Each declared tree must exist, carry a NOTICE.txt, and that notice
 *      must name every upstream the table's row names.
 *
 *   2. THE CODE AGAINST THE TABLE. This is the check that would have caught the
 *      original drift. Each bucket's builder is traced through its transitive
 *      relative imports, and every vendored input the resulting module graph
 *      reads must carry a verdict below. An input the trace finds and the
 *      declaration does not mention FAILS — which is the whole point: the next
 *      time a feature reaches a new upstream, the person who wrote the feature
 *      is the one who has to say what it means.
 *
 *   3. THE NAMES AGAINST SOURCES.md. Every upstream named here must resolve to
 *      a real `### <id>` entry in SOURCES.md, so a typo or a renamed project
 *      fails instead of quietly matching nothing.
 *
 *   4. THE DECLARATIONS AGAINST THE FOLDER. Everything that actually ships under
 *      apps/web/public/assets/ is either an inherited bucket or a named entry
 *      below, and LICENSES.md mentions it either way. Added 2026-08-16, because
 *      checks 1–3 compared a declaration against a table and never looked in the
 *      directory — so two trees that were in neither, 604 files of word geometry
 *      and the manifest, passed this gate every time it ran. A check that reads
 *      only what it was told about cannot report what it was not told about.
 *
 * THE VERDICT VOCABULARY. Three words, and the third is the interesting one.
 *
 *   named          this input's terms are on the row and in the notice.
 *   ours           the file is this project's own derived artefact. Its own
 *                  upstreams are traced through the code that built IT, not
 *                  here, or it is a fact this project measured.
 *   open:<issue>   the input's content reaches the shipped bytes and whether it
 *                  adds terms is not settled. The id must exist in
 *                  docs/issues.json AND still be open.
 *
 * That last condition is deliberate and is the answer to the objection
 * `gate-gates.mjs` makes about exemption lists — "a quiet line in an array here,
 * which is how an allow-list starts every time". This allow-list cannot go
 * quiet: every entry in it is a question somebody has to close, and closing the
 * question breaks the gate until the declaration is revisited. An exemption that
 * expires is a different object from one that does not.
 *
 * PROVEN TO FAIL, 2026-08-16. A gate that has only ever passed is a comment, and
 * no gate here carries a unit test, so the three ties were each broken on purpose
 * and the file restored. Deleting the adjacency NOTICE.txt: "ships 114 files and
 * no NOTICE.txt". Appending a read of the tajweed input to build-adjacency.mjs —
 * the exact shape of the original drift, a builder quietly reaching one more
 * upstream: "reads packages/etl/data/tajweed/… and gate-notices.mjs has no verdict
 * for it". Dropping Waqar144 from the bucket row: "does not name Waqar144". The
 * middle one is the one that matters; the other two are cheap. Check 4 was broken
 * the same way when it was added: an empty directory under assets/ — "ships and
 * nothing declares it" — and the declaration for the word geometry removed from
 * LICENSES.md — "never mentions assets/words, which ships". Both restored.
 *
 * WHAT IT DOES NOT SEE, said out loud rather than discovered later. The trace
 * follows *relative* imports inside packages/etl and reads string literals; it
 * does not resolve dynamic paths, does not follow `@hifth/core`, and treats
 * `*.pin.json` and `*.probe.json` as this project's own artefacts rather than
 * vendored inputs — they are, but each has upstreams of its own, and following
 * them from here would make this gate a second and worse copy of the provenance
 * files. The consequence is exact and worth stating: a builder that reaches a
 * new upstream *only* through a pin is invisible to check 2.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ETL = join(ROOT, "packages", "etl");
const DATA = join(ETL, "data");
const ASSETS = join(ROOT, "apps", "web", "public", "assets");

/**
 * The declaration. One entry per inherited bucket in LICENSES.md.
 *
 * `names` are the strings that must appear both in the table row and in the
 * shipped NOTICE.txt. They are prose on purpose — the table is a document for a
 * reader, and putting slugs in it to make a gate's life easier is the wrong
 * trade. `sources` are the SOURCES.md ids the prose stands for.
 */
const BUCKETS = [
  {
    path: "roots",
    builder: "packages/etl/scripts/build-roots.mjs",
    names: ["Quranic Arabic Corpus"],
    sources: ["quranic-arabic-corpus"],
    reads: {
      "quranic-corpus-morphology-0.4.txt": "named",
      // This read was declared "ours" on the grounds that "no page number
      // reaches a root shard". That was false, and measurably so:
      // `build-roots.mjs` writes `pageOf(abs)` into every one of 44,431
      // occurrence tuples. It is the same table, reaching the same kind of
      // output, as the deferral the adjacency bucket already carries — so it
      // defers to the same question, in the row that widened it to cover this
      // tree. Declaring one bucket's read of a file "ours" while another
      // bucket's read of that same file is an open question was the drift.
      "ayah-pages.json": "open:the-pagination-question-covers-three-outputs",
    },
  },
  {
    path: "skins",
    builder: "packages/etl/scripts/build-tajweed.mjs",
    names: ["quran-tajweed"],
    sources: ["quran-tajweed-cpfair"],
    reads: {
      "tajweed.hafs.uthmani-pause-sajdah.json": "named",
    },
  },
  {
    path: "adj",
    builder: "packages/etl/scripts/build-adjacency.mjs",
    // Three parents, not two. The third arrived through `@hifth/core`, which
    // this gate does not follow (see the header): `sameJuz` on 510 of 3,002
    // edges is computed from core's juz table, and that table is derived from
    // the Tanzil structural metadata (CC BY — attribution is mandatory). Named
    // here so the row and the notice must carry it; the question of whether
    // the trace should follow the core package stays open in
    // what-we-depend-on.md ③.
    names: ["Quranic Arabic Corpus", "Waqar144", "Tanzil"],
    sources: ["quranic-arabic-corpus", "mutashabihat-waqar144", "tanzil-quran-metadata"],
    reads: {
      "mutashabiha_data.json": "named",
      // The spans. This is the one the row was missing.
      "quranic-corpus-morphology-0.4.txt": "named",
      // Found by this gate on its first run, and not settled by writing it:
      // every edge carries `page` and `dPage`, straight out of a pagination
      // table derived from the KFGQPC page corpus. Whether a pagination table
      // is expression that carries terms forward is a licensing question, not
      // an engineering one, so it is tracked rather than answered here.
      "ayah-pages.json": "open:adj-shards-carry-a-third-upstream",
    },
  },
];

/**
 * Everything else that ships under `apps/web/public/assets/`.
 *
 * The buckets above are the trees whose terms are *inherited*, and until this
 * list existed that was the only part of the folder anything read. The check was
 * therefore blind by construction: it compared a declaration against a table,
 * and never once asked what was actually in the directory. Two shipped trees sat
 * outside both for months — 604 files of word geometry and a 24 KB manifest —
 * and no file in the repository mentioned either.
 *
 * So every entry of that folder must now appear here or in `BUCKETS`, and every
 * entry here must name where a reader goes to find out what it is. The verdicts
 * are the same three words the buckets use, with the same meanings.
 */
const UNBUCKETED = {
  // KFGQPC's artwork, which is not ours to relicense and is deliberately not a
  // bucket: an inherited bucket promises a NOTICE.txt travelling with the data,
  // and this tree's terms are the Complex's own rather than a grant we can
  // restate. LICENSES.md says so under "What we do not license".
  pages: { verdict: "named" },
  // Rectangles this project measured onto its own page frame. No byte of the
  // print they were measured from ships, and the grant behind that print obliges
  // no attribution — so the tree carries no inherited terms and the source entry
  // is a courtesy pointer, not a condition.
  words: { verdict: "ours", source: "word-geometry-mushafdatabase" },
  // Ships the whole 6,236-entry page table verbatim, which is the third of the
  // three outputs the pagination question covers. Having a row in the licence
  // table is what it was missing; what the row cannot yet say is settled.
  "manifest.json": { verdict: "open:the-pagination-question-covers-three-outputs" },
};

/** Vendored third-party inputs: a real file under a data directory that has a
 *  PROVENANCE.md, excluding this project's own pins and probe results. */
function vendoredInputs() {
  const out = new Map(); // basename -> relative path
  for (const dir of readdirSync(DATA)) {
    const full = join(DATA, dir);
    if (!statSync(full).isDirectory()) continue;
    if (!existsSync(join(full, "PROVENANCE.md"))) continue;
    for (const file of readdirSync(full)) {
      if (file === "PROVENANCE.md") continue;
      if (file.endsWith(".pin.json") || file.endsWith(".probe.json")) continue;
      out.set(file, `packages/etl/data/${dir}/${file}`);
    }
  }
  return out;
}

/** Every module reachable from `entry` by relative import, `entry` included. */
function moduleGraph(entry) {
  const seen = new Set();
  const queue = [resolve(ROOT, entry)];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/\bfrom\s+["'](\.[^"']+)["']/g)) {
      queue.push(resolve(dirname(file), m[1]));
    }
  }
  return [...seen];
}

const problems = [];
const notes = [];

/* 1 ─ The bucket table, parsed. Rows whose terms say "(inherited)". */
const licenses = readFileSync(join(ROOT, "LICENSES.md"), "utf8");
const rows = new Map(); // bucket path -> {terms, whose}
for (const line of licenses.split("\n")) {
  if (!line.startsWith("|") || !line.includes("(inherited)")) continue;
  const cells = line.split("|").map((c) => c.trim());
  const m = /assets\/([a-z-]+)\/\*\*/.exec(cells[1] ?? "");
  if (!m) {
    problems.push(`a bucket row inherits terms but names no assets/<tree>/** path: ${line.trim()}`);
    continue;
  }
  rows.set(m[1], { terms: cells[2] ?? "", whose: cells[3] ?? "" });
}
if (rows.size === 0) {
  problems.push("LICENSES.md's bucket table has no rows with inherited terms — the table moved");
}

const declared = new Set(BUCKETS.map((b) => b.path));
for (const path of rows.keys()) {
  if (!declared.has(path)) {
    problems.push(
      `LICENSES.md buckets assets/${path}/** under inherited terms, and gate-notices.mjs does not declare it`,
    );
  }
}
for (const b of BUCKETS) {
  if (!rows.has(b.path)) {
    problems.push(
      `gate-notices.mjs declares assets/${b.path}/**, and LICENSES.md's table has no inherited row for it`,
    );
  }
}

/* 2 ─ SOURCES.md must know every name. */
const sources = readFileSync(join(ROOT, "SOURCES.md"), "utf8");
const documented = new Set(
  [...sources.matchAll(/^###\s+([A-Za-z0-9._-]+)\s*$/gm)].map((m) => m[1]),
);
for (const b of BUCKETS) {
  if (b.names.length !== b.sources.length) {
    problems.push(`assets/${b.path}/**: ${b.names.length} names against ${b.sources.length} source ids`);
  }
  for (const id of b.sources) {
    if (!documented.has(id)) problems.push(`assets/${b.path}/** names "${id}", which SOURCES.md has no entry for`);
  }
}

/* 3 ─ Open questions must still be open. */
const issues = JSON.parse(readFileSync(join(ROOT, "docs", "issues.json"), "utf8"));
const openIssues = new Set(
  issues.issues.filter((i) => !["fixed", "answered"].includes(i.status)).map((i) => i.id),
);
const knownIssues = new Set(issues.issues.map((i) => i.id));

/* 4 ─ Each tree: the notice, the names in it, the names on the row. */
const inputs = vendoredInputs();
for (const b of BUCKETS) {
  const row = rows.get(b.path);
  const base = join(ASSETS, b.path);
  const editions = existsSync(base)
    ? readdirSync(base).filter((n) => statSync(join(base, n)).isDirectory())
    : [];
  if (editions.length === 0) {
    problems.push(`assets/${b.path}/ ships no edition directory`);
  }
  for (const ed of editions) {
    const notice = join(base, ed, "NOTICE.txt");
    if (!existsSync(notice)) {
      problems.push(
        `assets/${b.path}/${ed}/ ships ${readdirSync(join(base, ed)).length} files and no NOTICE.txt — ` +
          `its terms are inherited, so the notice has to travel with the data`,
      );
      continue;
    }
    const text = readFileSync(notice, "utf8");
    for (const name of b.names) {
      if (!text.includes(name)) {
        problems.push(`assets/${b.path}/${ed}/NOTICE.txt does not name "${name}"`);
      }
    }
  }
  if (row) {
    for (const name of b.names) {
      if (!row.whose.includes(name)) {
        problems.push(
          `LICENSES.md's assets/${b.path}/** row does not name "${name}" — its "Whose choice" cell reads ${JSON.stringify(row.whose)}`,
        );
      }
    }
  }

  /* 5 ─ The trace. What does this builder actually read? */
  const graph = moduleGraph(b.builder);
  const text = graph.map((f) => readFileSync(f, "utf8")).join("\n");
  const touched = [...inputs.keys()].filter((f) => text.includes(JSON.stringify(f)));
  for (const file of touched) {
    const verdict = b.reads[file];
    if (!verdict) {
      problems.push(
        `${b.builder} reads ${inputs.get(file)} and gate-notices.mjs has no verdict for it — ` +
          `an asset tree gained an upstream. Say whether its terms reach assets/${b.path}/**.`,
      );
      continue;
    }
    if (verdict.startsWith("open:")) {
      const id = verdict.slice(5);
      if (!knownIssues.has(id)) {
        problems.push(`assets/${b.path}/** defers ${file} to issue "${id}", which docs/issues.json does not have`);
      } else if (!openIssues.has(id)) {
        problems.push(
          `assets/${b.path}/** still defers ${file} to issue "${id}", which is now closed — ` +
            `the question was answered, so the declaration has to say what the answer was`,
        );
      } else {
        notes.push(`assets/${b.path}/** ← ${basename(file)} — open, tracked as ${id}`);
      }
    }
  }
  for (const file of Object.keys(b.reads)) {
    if (!touched.includes(file)) {
      problems.push(
        `gate-notices.mjs says ${b.builder} reads ${file}, and the trace does not find it — ` +
          `a stale verdict hides the next real one`,
      );
    }
  }
}

/* 6 ─ The folder against the declarations. Everything shipped is spoken for. */
const shipped = existsSync(ASSETS) ? readdirSync(ASSETS) : [];
if (shipped.length === 0) {
  problems.push("apps/web/public/assets/ is empty or missing — the app ships no data");
}
for (const entry of shipped) {
  if (declared.has(entry) || entry in UNBUCKETED) continue;
  problems.push(
    `apps/web/public/assets/${entry} ships and nothing declares it — it is neither an ` +
      `inherited bucket nor a named entry in gate-notices.mjs. Say what its terms are.`,
  );
}
for (const [entry, decl] of Object.entries(UNBUCKETED)) {
  if (!existsSync(join(ASSETS, entry))) {
    problems.push(
      `gate-notices.mjs names apps/web/public/assets/${entry}, which does not ship — ` +
        `a stale declaration hides the next real one`,
    );
    continue;
  }
  // The licence table is what a reader opens, so every shipped tree has to be
  // findable there. This is the check the two undeclared trees would have failed.
  if (!licenses.includes(`assets/${entry}`)) {
    problems.push(`LICENSES.md never mentions assets/${entry}, which ships`);
  }
  if (decl.source && !documented.has(decl.source)) {
    problems.push(`assets/${entry} names "${decl.source}", which SOURCES.md has no entry for`);
  }
  if (decl.verdict.startsWith("open:")) {
    const id = decl.verdict.slice(5);
    if (!knownIssues.has(id)) {
      problems.push(`assets/${entry} defers to issue "${id}", which docs/issues.json does not have`);
    } else if (!openIssues.has(id)) {
      problems.push(
        `assets/${entry} still defers to issue "${id}", which is now closed — ` +
          `the question was answered, so the declaration has to say what the answer was`,
      );
    } else {
      notes.push(`assets/${entry} — open, tracked as ${id}`);
    }
  }
}

if (problems.length) {
  console.error("gate:notices — FAIL:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

const trees = BUCKETS.length;
const traced = BUCKETS.reduce((n, b) => n + Object.keys(b.reads).length, 0);
console.log(
  `gate:notices — OK (${trees} inherited trees, every notice shipped and naming its upstreams; ` +
    `${traced} vendored inputs traced, all accounted for; ` +
    `${shipped.length} entries under assets/, each one declared)`,
);
for (const n of notes) console.log(`  ${n}`);
