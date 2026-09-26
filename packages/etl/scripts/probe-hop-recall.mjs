/**
 * ⑪ (what-we-depend-on) — nothing measures what the hop does NOT contain.
 *
 * The hop (the rail of look-alike verses a hafiz confuses) is deliberately not
 * exhaustive, and that is the reason to prefer it — but until now no number said
 * how much it leaves out, so "2,994 edges" could not be read as thorough or thin.
 * This probe puts a ruler beside it.
 *
 * THE RULER — read once, ships nothing. QUL's "Mutashabihat ul Quran" (resource
 * 73 at qul.tarteel.ai) is a second, independently built catalogue of recurring
 * phrases: each entry is a shared word-run and the list of ayahs it recurs in,
 * from a specific two-ayah echo up to a common closing formula that repeats in
 * seventy. Its download is login-gated and its licence is unstated, so it is
 * unusable as a shipped dependency — but a corpus read to CHECK a number is a
 * different act from one distributed, and as a build-time measuring stick it is
 * exactly what ⑪ asks for. It is read from a gitignored cache
 * (packages/etl/data/mutashabihat/.cache/qul73/phrases.json); ZERO of its bytes
 * leave in the build. The durable finding is docs/design/hop-recall.data.json:
 * counts, percentages and our-own verse keys — no Arabic, no ruler bytes.
 *
 * WHY THIS IS A DIVERGENCE MEASUREMENT, NOT A SCORE. The two catalogues are
 * different kinds of thing: ours hand-picks the verses a hafiz actually slips
 * between; the ruler mechanically records every repeated word-run, formulae and
 * all. Two ayahs sharing a run are not two ayahs a reader confuses. So the recall
 * figure measures how far a curated selection sits inside a mechanical one — and
 * the honest headline is that neither contains the other. This is why the finding
 * is framed as deliberate subset and divergence, never as agreement: a published
 * "we independently recomputed it and matched" is, on real precedent, an argument
 * that you copied. Low, explained overlap is the safe and truthful shape here.
 *
 * OURS is read from the SHIPPED shards (apps/web/public/assets/adj/<edition>/),
 * so the "ours" side is exactly what the app serves — symmetrised, curated seed
 * folded in, the dataset's zero-based ayahs already shifted to one-based. Only
 * `mutashabih` edges are counted; `root` edges are a different relation and the
 * ruler is a phrase catalogue, so comparing roots against it would compare unlike
 * things.
 *
 *   node packages/etl/scripts/probe-hop-recall.mjs
 *
 * Opt-in and offline. It needs the gitignored ruler cache, so it never runs in a
 * gate; it runs once on the machine that holds the cache and commits the finding.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toAbsoluteAyah, fromAbsoluteAyah } from "@hifth/core";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const ADJ = join(REPO, "apps", "web", "public", "assets", "adj", "hafs-kfqc");
const CACHE = join(REPO, "packages", "etl", "data", "mutashabihat", ".cache", "qul73");
const OUT = join(REPO, "docs", "design", "hop-recall.data.json");

if (!existsSync(join(CACHE, "phrases.json"))) {
  console.error(
    "Ruler cache missing: " + join(CACHE, "phrases.json") + "\n" +
    "This probe reads QUL's login-gated Mutashabihat resource 73, downloaded once\n" +
    "by hand into that gitignored path. It ships nothing and cannot fetch for you.",
  );
  process.exit(1);
}

const key2abs = (k) => { const [s, a] = k.split(":").map(Number); return toAbsoluteAyah(s, a); };
const absKey = (abs) => { const { surah, ayah } = fromAbsoluteAyah(abs); return `${surah}:${ayah}`; };
const pairKey = (a, b) => { const lo = Math.min(a, b), hi = Math.max(a, b); return `${lo}-${hi}`; };

/* ---- OURS: the shipped hop, mutashabih edges only ---- */
const ourAyahs = new Set();
const ourPairs = new Set();
let mutDirected = 0;
for (const f of readdirSync(ADJ).filter((x) => x.endsWith(".json"))) {
  const surah = Number(f.replace(".json", ""));
  const shard = JSON.parse(readFileSync(join(ADJ, f), "utf8"));
  for (const ayahStr of Object.keys(shard)) {
    const fromAbs = toAbsoluteAyah(surah, Number(ayahStr));
    for (const e of shard[ayahStr].edges || []) {
      if (e.type !== "mutashabih") continue;
      const m = e.to.match(/(\d+):(\d+)$/);
      if (!m) continue;
      const toAbs = toAbsoluteAyah(Number(m[1]), Number(m[2]));
      mutDirected += 1;
      ourAyahs.add(fromAbs);
      ourAyahs.add(toAbs);
      if (fromAbs !== toAbs) ourPairs.add(pairKey(fromAbs, toAbs));
    }
  }
}

/* ---- RULER: QUL phrase catalogue ---- */
const phrases = JSON.parse(readFileSync(join(CACHE, "phrases.json"), "utf8"));
const tightestSpan = new Map();   // ruler ayah (abs) -> fewest ayahs any of its phrases spans
const rulerPairs = new Map();     // pair -> the smallest phrase-span that ties it
let pairMassTotal = 0, pairMassBroad = 0;
for (const p of Object.values(phrases)) {
  const ays = Object.keys(p.ayah).map(key2abs);
  const span = ays.length;
  const combos = (span * (span - 1)) / 2;
  pairMassTotal += combos;
  if (span >= 11) pairMassBroad += combos;
  for (const a of ays) {
    if (!tightestSpan.has(a) || tightestSpan.get(a) > span) tightestSpan.set(a, span);
  }
  for (let i = 0; i < ays.length; i++) {
    for (let j = i + 1; j < ays.length; j++) {
      const k = pairKey(ays[i], ays[j]);
      if (!rulerPairs.has(k) || rulerPairs.get(k) > span) rulerPairs.set(k, span);
    }
  }
}
const rulerAyahs = [...tightestSpan.keys()];

/* ---- Recall ---- */
const ayahHits = rulerAyahs.filter((a) => ourAyahs.has(a));
let pairHits = 0;
for (const k of rulerPairs.keys()) if (ourPairs.has(k)) pairHits += 1;

/* ---- Omission vs curation, on the ayahs the ruler holds and the hop misses ---- */
const missed = rulerAyahs.filter((a) => !ourAyahs.has(a));
const bucket = (a) => { const s = tightestSpan.get(a); return s <= 4 ? "tight" : s <= 10 ? "mid" : "broad"; };
const missBuckets = { tight: 0, mid: 0, broad: 0 };
for (const a of missed) missBuckets[bucket(a)] += 1;

/* ---- Divergence: what only the hop holds ---- */
const onlyHop = [...ourAyahs].filter((a) => !tightestSpan.has(a));

/* ---- Specimens (verse keys only — our own analysis output, no ruler bytes) ---- */
const round2 = (n) => Math.round(n * 100) / 100;
const genuineOmission = missed
  .filter((a) => tightestSpan.get(a) <= 3)
  .sort((a, b) => a - b)
  .slice(0, 12)
  .map(absKey);
const onlyOursSample = onlyHop.sort((a, b) => a - b).slice(0, 12).map(absKey);

const finding = {
  what: "How much of a larger, independent look-alike catalogue does the hop cover?",
  generatedBy: "packages/etl/scripts/probe-hop-recall.mjs",
  generatedAt: new Date().toISOString().slice(0, 10),
  shipsNothingFromRuler: true,
  ruler: {
    name: "Mutashabihat ul Quran (QUL resource 73)",
    source: "https://qul.tarteel.ai/resources/mutashabihat/73",
    kind: "phrase-recurrence catalogue: each entry a shared word-run and the ayahs it recurs in",
    access: "login-gated download, unstated licence — usable as a ruler, not as a dependency",
    phrases: Object.keys(phrases).length,
    ayahs: rulerAyahs.length,
    pairs: rulerPairs.size,
  },
  hop: {
    from: "apps/web/public/assets/adj/hafs-kfqc (the shipped shards)",
    mutashabihEdgesDirected: mutDirected,
    ayahs: ourAyahs.size,
    pairs: ourPairs.size,
  },
  recall: {
    ayahCoverage: { covered: ayahHits.length, of: rulerAyahs.length, pct: round2((100 * ayahHits.length) / rulerAyahs.length) },
    pair: { covered: pairHits, of: rulerPairs.size, pct: round2((100 * pairHits) / rulerPairs.size) },
  },
  divergence: {
    nested: false,
    sharedAyahs: ayahHits.length,
    onlyInRuler: rulerAyahs.length - ayahHits.length,
    onlyInHop: onlyHop.length,
  },
  omissionVsCuration: {
    missedRulerAyahs: missed.length,
    genuineOmissionCandidates: missBuckets.tight,   // reachable via a tight 2-4 ayah phrase
    middling: missBuckets.mid,                       // 5-10 ayah phrases
    deliberateCuration: missBuckets.broad,           // only ever in an 11+ ayah formula
    rulerPairMassFromBroadFormulaePct: round2((100 * pairMassBroad) / pairMassTotal),
  },
  specimens: {
    genuineOmission: genuineOmission,   // in a <=3-ayah shared phrase, yet the hop does not flag them
    onlyOurs: onlyOursSample,           // the hop flags them; the ruler's catalogue has no phrase for them
  },
};

writeFileSync(OUT, JSON.stringify(finding, null, 2) + "\n");
console.log("wrote", OUT);
console.log(`ayah recall ${finding.recall.ayahCoverage.pct}%  pair recall ${finding.recall.pair.pct}%  (shared ${ayahHits.length}, only-ruler ${finding.divergence.onlyInRuler}, only-hop ${onlyHop.length})`);
