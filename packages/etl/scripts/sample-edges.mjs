#!/usr/bin/env node
/**
 * Draw a sample of shipped edges for a human to check against a mushaf.
 *
 * PLAN §Testing plan asks for 20 random edges per audit round. "Random" has to
 * be reproducible or the round cannot be re-run, re-checked, or handed to a
 * second reader — so the draw is seeded, and the seed is printed with the
 * sample. Same seed, same twenty pairs, on any machine.
 *
 * **The unit is the pair, not the edge.** Every edge in the corpus is generated
 * in both directions from one fact, so drawing directed edges spends the
 * scarcest input this project has — a human minute with a mushaf open — asking
 * the same question twice. The draw dedupes to unordered pairs, presents each in
 * reading order, and writes *both* directions into the paste block, so one
 * reading banks two entries.
 *
 * **The draw is stratified, and that is a change of question.** 97% of the
 * shipped pairs are dataset-derived `mutashabih`, and two thirds of those are
 * more than fifty pages apart. A uniform draw of twenty therefore answers "what
 * share of the corpus is right" — and never once, in any plausible round, shows
 * the reader a `shared-root` pair (3 in the whole corpus), a `related-meaning`
 * pair (1), or one of the 11 pairs we curated ourselves. Those are the cells
 * where an error is *invisible to every other check*: `gate:edges` deliberately
 * does not score `shared-root`, and the curated pairs are the ones we wrote, so
 * our own misreading is exactly what nobody would catch.
 *
 * So the draw takes one edge from each class before taking a second from any.
 * The sample covers the map rather than the mass, which means it is **not** an
 * estimate of overall correctness — `gate:edges` already carries that, cheaply
 * and on every commit. `--uniform` restores the old draw when the rate is the
 * question.
 *
 * Each pair is printed with two similarity hints, because a reader with a
 * printed mushaf open should not also have to hold the reason the machine
 * proposed the pair. They are hints and not verdicts: the pair this whole
 * product was designed around (2:48 → 2:123) swaps شفاعة and عدل and scores
 * low on both.
 *
 * Output is two things at once: a list a reader can work through with a printed
 * mushaf beside them, and the JSON entries to paste into
 * packages/etl/data/qa/verified-edges.json once they have a verdict. Making the
 * recording step a copy-paste is deliberate — the audit is only worth its cost
 * if the verdicts get banked, and a format the reader has to author by hand is
 * where that stops happening.
 *
 * Usage:
 *   node packages/etl/scripts/sample-edges.mjs                # 20 pairs, seed 1, stratified
 *   node packages/etl/scripts/sample-edges.mjs --n 30 --seed 7
 *   node packages/etl/scripts/sample-edges.mjs --skip-verified   # only unsettled pairs
 *   node packages/etl/scripts/sample-edges.mjs --uniform         # the old flat draw
 *   node packages/etl/scripts/sample-edges.mjs --coverage        # what has been audited, by class
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { longestSharedRun, wordsByAyah } from "./morphology.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const ADJ = join(ROOT, "apps", "web", "public", "assets", "adj");
const ROOTS = join(ROOT, "apps", "web", "public", "assets", "roots");
const FIXTURE = join(ROOT, "packages", "etl", "data", "qa", "verified-edges.json");

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const N = Number(arg("n", 20));
const SEED = Number(arg("seed", 1));
const EDITION = arg("edition", "hafs-kfqc");
const SKIP_VERIFIED = argv.includes("--skip-verified");
const UNIFORM = argv.includes("--uniform");
const COVERAGE = argv.includes("--coverage");

/* mulberry32 — a small deterministic PRNG. Math.random() cannot be seeded, and
   an unseeded draw makes the round unrepeatable, which is the one property the
   audit needs most. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dir = join(ADJ, EDITION);
if (!existsSync(dir)) {
  console.error(`sample-edges — no shards for edition "${EDITION}" at ${dir}`);
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* The strata.                                                         */
/* ------------------------------------------------------------------ */

/**
 * How far apart, in pages. Distance is the axis a *reader* feels: two ayahs on
 * one spread are confusable in a way two ayahs three hundred pages apart are
 * not, and a defect in near pairs is the one that costs a hafiz mid-recitation.
 * The corpus is bottom-heavy here — 78 same-page edges against 728 more than
 * 200 pages apart — so distance is exactly the axis a uniform draw flattens.
 */
const DISTANCE_BANDS = [
  { label: "same page", max: 0 },
  { label: "1-2 pp", max: 2 },
  { label: "3-10 pp", max: 10 },
  { label: "11-50 pp", max: 50 },
  { label: "51+ pp", max: Infinity },
];
const bandOf = (dPage) => DISTANCE_BANDS.find((b) => Math.abs(dPage ?? 0) <= b.max).label;

/**
 * Where the edge came from. `build-adjacency.mjs` writes hand-authored metadata
 * — a note, a twin flag, a root anchor — only on the seed clusters inherited
 * from the design mock; everything from the Waqar144 dataset arrives bare. So
 * the presence of that metadata *is* the provenance, with no extra field to
 * keep in step.
 */
const provenanceOf = (e) => (e.note || e.twin || e.root ? "curated" : "dataset");

/** type × source × distance. Tab-joined so a label containing a space is safe. */
const stratumOf = (e) => `${e.type}\t${e.provenance}\t${e.band}`;
const stratumParts = (key) => key.split("\t");

/* ------------------------------------------------------------------ */
/* Load every shipped directed edge.                                   */
/* ------------------------------------------------------------------ */

const all = [];
/**
 * ayah key → mushaf page. An edge's `page` is its *destination's* page, so it
 * cannot be carried along when a pair is flipped into reading order. Every
 * endpoint is some edge's destination — the corpus is bidirectional — so
 * collecting them while loading gives both pages for every pair, which is what
 * a reader with a printed mushaf actually needs: two page numbers to flip to.
 */
const pageOf = new Map();
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const surah = file.replace(/\.json$/, "");
  const shard = JSON.parse(readFileSync(join(dir, file), "utf8"));
  for (const [ayah, node] of Object.entries(shard)) {
    for (const edge of node.edges ?? []) {
      const to = edge.to.split("/").pop().split("#")[0];
      if (edge.page != null) pageOf.set(to, edge.page);
      all.push({
        from: `${surah}:${ayah}`,
        to,
        type: edge.type,
        dPage: edge.dir?.dPage ?? 0,
        provenance: provenanceOf(edge),
        band: bandOf(edge.dir?.dPage),
        note: edge.note ?? "",
      });
    }
  }
}

const edgeKey = (e) => `${e.from}>${e.to}>${e.type}`;

/** Sort order a reader would use: by surah, then by ayah. */
const before = (a, b) => {
  const [as, aa] = a.split(":").map(Number);
  const [bs, ba] = b.split(":").map(Number);
  return as - bs || aa - ba;
};

/**
 * Both directions of a pair are one question.
 *
 * Every edge here is bidirectional: `build-adjacency.mjs` generates b→a from
 * a→b and copies the note, the twin flag and the root anchor across, because
 * "these two are confusable" is a symmetric claim. Drawing both directions
 * spends the scarcest input this project has — a reader with a printed mushaf —
 * on a question they already answered thirty seconds ago. So the pool is one
 * entry per unordered pair, presented in reading order, and the *paste* block
 * emits both directed rows so a single verdict banks the whole pair.
 */
const pairKey = (e) =>
  before(e.from, e.to) <= 0 ? `${e.from}|${e.to}|${e.type}` : `${e.to}|${e.from}|${e.type}`;

/** Verdicts already banked, by edge key — used by --skip-verified and --coverage. */
function verdicts() {
  if (!existsSync(FIXTURE)) return new Map();
  const entries = JSON.parse(readFileSync(FIXTURE, "utf8")).entries ?? [];
  return new Map(entries.map((e) => [`${e.from}>${e.to}>${e.type}`, e.verdict]));
}

// One entry per unordered pair, in reading order, so no reader is asked the
// same question twice. Keeping the earlier endpoint as `from` also means a
// stable presentation: the pair reads the way it sits in the mushaf.
const pairs = new Map();
for (const e of all) {
  const key = pairKey(e);
  if (!pairs.has(key)) {
    pairs.set(key, before(e.from, e.to) <= 0 ? e : { ...e, from: e.to, to: e.from });
  }
}

/**
 * Pairs a verdict has already settled. Either direction counts — that is what
 * makes the reverse edge generated rather than independently claimed.
 */
function settled() {
  const banked = verdicts();
  const seen = new Map();
  for (const e of all) {
    const verdict = banked.get(edgeKey(e));
    if (verdict) seen.set(pairKey(e), verdict);
  }
  return seen;
}

/* ------------------------------------------------------------------ */
/* --coverage: which classes has a human ever looked at?               */
/* ------------------------------------------------------------------ */

if (COVERAGE) {
  const seen = settled();
  const cells = new Map();
  for (const [key, e] of pairs) {
    const stratum = stratumOf(e);
    let cell = cells.get(stratum);
    if (!cell) cells.set(stratum, (cell = { n: 0, seen: 0, wrong: 0 }));
    cell.n += 1;
    const verdict = seen.get(key);
    if (verdict) cell.seen += 1;
    if (verdict === "wrong") cell.wrong += 1;
  }

  const rows = [...cells].sort(([a], [b]) => (a < b ? -1 : 1));
  const audited = rows.filter(([, c]) => c.seen > 0).length;

  console.log(`\n  Edge-audit coverage — edition ${EDITION}\n`);
  console.log(`  Not "how many edges have been checked" but "which kinds have never`);
  console.log(`  been looked at". A class with no verdicts in it is a class where a`);
  console.log(`  defect would survive every check this repo has — gate:edges scores`);
  console.log(`  phrasing overlap and cannot tell a plausible wrong pair from a right`);
  console.log(`  one, and it does not score shared-root at all.\n`);
  console.log(
    `      ${"type".padEnd(16)}${"source".padEnd(10)}${"distance".padEnd(11)}${"pairs audited".padStart(14)}`,
  );
  for (const [key, cell] of rows) {
    const [type, prov, band] = stratumParts(key);
    console.log(
      `  ${cell.seen === 0 ? "·" : "✓"} ${type.padEnd(16)}${prov.padEnd(10)}${band.padEnd(11)}` +
        `${`${cell.seen} of ${cell.n}`.padStart(14)}` +
        `${cell.wrong ? `   ${cell.wrong} rejected` : ""}`,
    );
  }
  console.log(
    `\n  ${audited} of ${rows.length} classes carry at least one verdict.\n` +
      `  Draw from the classes that do not:  make audit-edges NEW=1\n`,
  );
  process.exit(0);
}

/* ------------------------------------------------------------------ */
/* The draw.                                                           */
/* ------------------------------------------------------------------ */

let pool = [...pairs.values()];
if (SKIP_VERIFIED) {
  const seen = settled();
  pool = pool.filter((e) => !seen.has(pairKey(e)));
}

const next = rng(SEED);

/** Fisher–Yates against the seeded stream, so order within a class is a draw too. */
function shuffled(items) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

let picked;
if (UNIFORM) {
  picked = shuffled(pool).slice(0, Math.min(N, pool.length));
} else {
  // One from every class, then fill uniformly from what is left.
  //
  // The first pass buys coverage: no class can be missed by luck, and rarest
  // first means that when N is smaller than the number of classes, the classes
  // nothing else checks are the ones that make the cut. The fill buys back the
  // proportions. Round-robin all the way down would have been worse than the
  // uniform draw it replaced — six of the eleven classes are curated, holding
  // twenty edges between them, so repeated rounds would spend most of a
  // twenty-edge audit re-reading the same twenty pairs while the 2,900-edge
  // bulk got two slots.
  const classes = new Map();
  for (const e of pool) {
    const key = stratumOf(e);
    if (!classes.has(key)) classes.set(key, []);
    classes.get(key).push(e);
  }
  const queues = [...classes]
    .sort(([ka, a], [kb, b]) => a.length - b.length || (ka < kb ? -1 : 1))
    .map(([, items]) => shuffled(items));

  picked = [];
  const target = Math.min(N, pool.length);
  const taken = new Set();
  for (const q of queues) {
    if (picked.length === target) break;
    picked.push(q[0]);
    taken.add(pairKey(q[0]));
  }
  for (const e of shuffled(pool)) {
    if (picked.length === target) break;
    if (taken.has(pairKey(e))) continue;
    taken.add(pairKey(e));
    picked.push(e);
  }
  picked.sort((a, b) => before(a.from, b.from) || before(a.to, b.to));
}

/* ------------------------------------------------------------------ */
/* Similarity hints.                                                   */
/* ------------------------------------------------------------------ */

const words = wordsByAyah();

/**
 * Roots per ayah, read from the *shipped* shards rather than re-parsed from the
 * morphology. `build-roots.mjs` is this repo's one parser of the `ROOT:`
 * feature and a second one would be free to drift from it; and an audit should
 * look at the data the app actually serves. The shards list each root once, in
 * first-appearance order, which is the right granularity here — a hafiz is not
 * thrown by one ayah repeating الله, but by two ayahs walking the same roots in
 * the same order.
 */
const rootShards = new Map();
function rootsOf(key) {
  const [surah, ayah] = key.split(":");
  if (!rootShards.has(surah)) {
    const path = join(ROOTS, EDITION, "ayah", `${surah}.json`);
    rootShards.set(surah, existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {});
  }
  return (rootShards.get(surah)[ayah] ?? []).map((r) => r.r);
}

/** Longest common *subsequence* — shared roots in the same order, gaps allowed. */
function inOrderShared(a, b) {
  if (!a.length || !b.length) return 0;
  let prev = new Uint16Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    const row = new Uint16Array(b.length + 1);
    for (let j = 1; j <= b.length; j++) {
      row[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1]);
    }
    prev = row;
  }
  return prev[b.length];
}

for (const e of picked) {
  e.run = longestSharedRun(words.get(e.from), words.get(e.to));
  const ra = rootsOf(e.from);
  const rb = rootsOf(e.to);
  e.rootsShared = inOrderShared(ra, rb);
  e.rootsOf = Math.min(ra.length, rb.length);
}

/* ------------------------------------------------------------------ */
/* Report.                                                             */
/* ------------------------------------------------------------------ */

const today = new Date().toISOString().slice(0, 10);
const mode = UNIFORM ? "uniform" : "stratified";
const rerun =
  `--seed ${SEED} --n ${N}` + (UNIFORM ? " --uniform" : "") + (SKIP_VERIFIED ? " --skip-verified" : "");

console.log(`\n  Edge spot-audit — ${picked.length} pairs drawn from ${pool.length}`);
console.log(`  edition ${EDITION} · seed ${SEED} · ${mode} · rerun: ${rerun}\n`);

if (UNIFORM) {
  console.log(`  Uniform draw: every shipped edge equally likely. This estimates a *rate*,`);
  console.log(`  and will almost certainly show you nothing but dataset-derived mutashabih`);
  console.log(`  pairs, because 99.7% of the corpus is that. Drop --uniform to cover the`);
  console.log(`  rare classes instead.\n`);
} else {
  console.log(`  Stratified by type × source × page distance: one pair from every class`);
  console.log(`  first, then the rest filled uniformly. The first pass is coverage of the`);
  console.log(`  classes where a defect would survive every other check — gate:edges does`);
  console.log(`  not score shared-root at all, and the curated pairs are ones we wrote`);
  console.log(`  ourselves. The fill keeps the proportions honest. Pass --uniform for a`);
  console.log(`  flat draw when the *rate* is the question — though gate:edges already`);
  console.log(`  carries the rate, on every commit.\n`);
}

console.log(`  One row per pair, not per edge. Every edge here is bidirectional and the`);
console.log(`  reverse is generated from the same fact, so one verdict settles both — the`);
console.log(`  paste block below writes out both directions for you.\n`);

console.log(`  Check each pair in a printed mushaf. The question is not "are these`);
console.log(`  similar?" but "would a hafiz confuse these two while reciting?"\n`);
console.log(`  \`words\` is the longest run of words the two ayahs share — the same score`);
console.log(`  gate:edges enforces a floor on. \`roots\` is how many of the shorter ayah's`);
console.log(`  roots appear in both, in order. Both are hints, never verdicts: 2:48 →`);
console.log(`  2:123 swaps شفاعة and عدل, scores low, and is the pair this whole product`);
console.log(`  was designed around.\n`);

picked.forEach((e, i) => {
  const at = (k) => `p.${pageOf.get(k) ?? "?"}`;
  const pages = e.dPage === 0 ? `${at(e.from)}` : `${at(e.from)} / ${at(e.to)}`;
  console.log(
    `  ${String(i + 1).padStart(2)}. ${e.from.padEnd(8)} → ${String(e.to).padEnd(8)} ` +
      `${e.type.padEnd(16)} ${pages.padEnd(13)} ` +
      `${e.provenance.padEnd(8)} words ${String(e.run).padStart(2)}  ` +
      `roots ${e.rootsShared}/${e.rootsOf}`,
  );
  if (e.note) console.log(`      ${e.note}`);
});

if (!UNIFORM) {
  const drawn = new Map();
  const total = new Map();
  for (const e of pool) total.set(stratumOf(e), (total.get(stratumOf(e)) ?? 0) + 1);
  for (const e of picked) drawn.set(stratumOf(e), (drawn.get(stratumOf(e)) ?? 0) + 1);
  const missed = [...total.keys()].filter((k) => !drawn.has(k));

  console.log(`\n  ── Classes this draw covers`);
  for (const [key, n] of [...drawn].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const [type, prov, band] = stratumParts(key);
    console.log(
      `     ${type.padEnd(16)}${prov.padEnd(10)}${band.padEnd(11)}` +
        `${String(n).padStart(3)} of ${total.get(key)}`,
    );
  }
  if (missed.length) {
    // Never silent about what was left out: a sample that quietly skipped a
    // class reads exactly like a sample that covered everything.
    console.log(`\n     ${missed.length} class(es) not reached at n=${N}. Raise --n to cover them:`);
    for (const key of missed.sort()) {
      const [type, prov, band] = stratumParts(key);
      console.log(
        `       ${type.padEnd(16)}${prov.padEnd(10)}${band.padEnd(11)}${total.get(key)} edges`,
      );
    }
  }
}

/** Directed edges the corpus actually ships, so the paste block never invents one. */
const shipped = new Set(all.map(edgeKey));

const entries = [];
for (const e of picked) {
  const reverse = { from: e.to, to: e.from, type: e.type };
  for (const d of [e, reverse]) {
    if (!shipped.has(edgeKey(d))) continue;
    entries.push({
      from: d.from,
      to: d.to,
      type: d.type,
      verdict: "TODO-correct-or-wrong",
      verifiedBy: "TODO-name",
      verifiedOn: today,
      note: "",
    });
  }
}

console.log(`\n  ── Paste into packages/etl/data/qa/verified-edges.json, one per verdict.`);
console.log(`     Set "verdict" to "correct" or "wrong". Record BOTH — a rejected`);
console.log(`     edge that is not written down comes back on the next data refresh.`);
console.log(`     ${entries.length} entries for ${picked.length} pairs: gate:verified-edges reads`);
console.log(`     directed edges, and both directions of a pair share one verdict. Give`);
console.log(`     each of a pair's two rows the same verdict, or delete one.\n`);
console.log(
  JSON.stringify(entries, null, 2)
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n"),
);
console.log("");
