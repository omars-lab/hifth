#!/usr/bin/env node
/**
 * CI gate: a hop edge must share words with the ayah it departs from.
 *
 * This gate exists because the corpus shipped wrong for four loops and every
 * other check stayed green. `mutashabiha_data.json` addresses ayahs from zero,
 * `toAbsoluteAyah` addresses them from one, and the bridge between them was
 * missing a +1 — so 47.8% of the hop edges named the ayah *after* the one they
 * meant. Nothing caught it: the determinism gate only proves the ETL repeats
 * itself, `gate:verified-edges` only guards the eight edges a human has read,
 * and those eight are written as "S:A" strings that skip the conversion
 * entirely. The bad edges were structurally perfect and semantically noise.
 *
 * So this gate reads meaning, cheaply. Words are reconstructed per ayah from
 * the vendored morphology (segment FORMs concatenated per word, reduced to a
 * consonant skeleton), and each edge is scored by the longest *contiguous* run
 * of words its two ends share. Contiguous matters: mutashabihat are shared
 * phrasing, and two ayahs both containing "الله" and "من" separately are not
 * similar — two ayahs sharing four words in a row are.
 *
 * The separation is wide enough that the threshold is not a tuning knob:
 *
 *   corpus as it shipped (no shift)  47.8% of edges share zero words
 *   random ayah pairs                69.1%
 *   corpus with the +1               ~4%
 *
 * Anything above 10% means numbering broke again. The gate deliberately does
 * not check the *right* answer is present — only a human with a mushaf can say
 * that, and `gate:verified-edges` is where their verdicts live. This one
 * catches the failure that class of check cannot: data that is wholesale wrong
 * everywhere nobody has looked.
 *
 * Scope: the dataset-derived types only. `shared-root` edges are generated from
 * the morphology itself and are *defined* by a shared root rather than shared
 * phrasing, so a contiguous-run floor is the wrong question to ask of them —
 * they are counted and reported, never failed.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ADJ = join(ROOT, "apps", "web", "public", "assets", "adj");
const MORPHOLOGY = join(
  ROOT,
  "packages",
  "etl",
  "data",
  "roots",
  "quranic-corpus-morphology-0.4.txt",
);

/** Share of scored edges with no shared words at all, above which CI fails. */
const ZERO_OVERLAP_LIMIT = 0.1;
/** Edge types whose promise is shared *phrasing*, and so are scored here. */
const SCORED_TYPES = new Set(["mutashabih", "related-meaning"]);

const fail = (msg) => {
  console.error(`gate:edges — FAIL: ${msg}`);
  process.exit(1);
};

for (const p of [ADJ, MORPHOLOGY]) if (!existsSync(p)) fail(`missing ${p}`);

/* ------------------------------------------------------------------ */
/* Words per ayah, as a consonant skeleton.                            */
/* ------------------------------------------------------------------ */

// Buckwalter marks that carry no consonant: short vowels, tanwin, shadda,
// sukun, the Quranic pause and small-letter annotations, and tatweel. Dropping
// them makes the comparison robust to the recitation marks a shared phrase is
// allowed to differ in.
const DIACRITICS = new Set([
  ..."FNKaui~o^#`:@\"[;,.!-+%]_",
]);
/** Orthographic variants a hafiz reads as the same letter. */
const FOLD = { ">": "A", "<": "A", "{": "A", "|": "A", "`": "A", Y: "y", p: "t", "&": "w", "}": "y" };

/** `(s:a:w:seg)\tFORM\t…` — the only lines with a location are segment rows. */
const LOCATION = /^\((\d+):(\d+):(\d+):\d+\)\t([^\t]*)\t/;

/** "surah:ayah" → the ayah's words, in order, as consonant skeletons. */
const wordsByAyah = new Map();
{
  /** The word currently being assembled, so segments concatenate in order. */
  let atKey = null;
  let atWord = -1;
  let buffer = "";
  const flush = () => {
    if (atKey === null) return;
    const skeleton = normalise(buffer);
    if (skeleton) wordsByAyah.get(atKey).push(skeleton);
  };
  for (const line of readFileSync(MORPHOLOGY, "utf8").split("\n")) {
    const at = LOCATION.exec(line);
    if (!at) continue;
    const key = `${Number(at[1])}:${Number(at[2])}`;
    const word = Number(at[3]);
    if (key !== atKey || word !== atWord) {
      flush();
      if (!wordsByAyah.has(key)) wordsByAyah.set(key, []);
      atKey = key;
      atWord = word;
      buffer = "";
    }
    buffer += at[4];
  }
  flush();
}

function normalise(form) {
  let out = "";
  for (const ch of form) {
    if (DIACRITICS.has(ch)) continue;
    out += FOLD[ch] ?? ch;
  }
  return out;
}

if (wordsByAyah.size !== 6236) {
  fail(`morphology covers ${wordsByAyah.size} ayahs, expected 6236 — source is incomplete`);
}

/**
 * Longest run of words present, in order and adjacent, in both ayahs.
 * Classic LCS-of-substrings over two short sequences — ayahs are tens of words,
 * so the quadratic table costs nothing and is far clearer than the alternatives.
 */
function longestSharedRun(a, b) {
  if (!a?.length || !b?.length) return 0;
  let best = 0;
  let prev = new Uint16Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    const row = new Uint16Array(b.length + 1);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        row[j] = prev[j - 1] + 1;
        if (row[j] > best) best = row[j];
      }
    }
    prev = row;
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Score every shipped edge.                                           */
/* ------------------------------------------------------------------ */

/** `quran/<edition>/2:122#w3` → `2:122`. */
const bareKey = (to) => to.slice(to.lastIndexOf("/") + 1).split("#")[0];

const byType = new Map();
/** The worst offenders, kept for the failure message. */
const zeroes = [];

for (const edition of readdirSync(ADJ, { withFileTypes: true })) {
  if (!edition.isDirectory()) continue;
  const dir = join(ADJ, edition.name);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const surah = file.slice(0, -5);
    const shard = JSON.parse(readFileSync(join(dir, file), "utf8"));
    for (const [ayah, node] of Object.entries(shard)) {
      const from = `${surah}:${ayah}`;
      for (const edge of node.edges ?? []) {
        const to = bareKey(edge.to);
        const run = longestSharedRun(wordsByAyah.get(from), wordsByAyah.get(to));
        let stat = byType.get(edge.type);
        if (!stat) byType.set(edge.type, (stat = { n: 0, zero: 0, total: 0 }));
        stat.n += 1;
        stat.total += run;
        if (run === 0) {
          stat.zero += 1;
          if (SCORED_TYPES.has(edge.type)) zeroes.push(`${from} → ${to} (${edge.type})`);
        }
      }
    }
  }
}

if (byType.size === 0) fail("no edges found in the shipped shards");

let n = 0;
let zero = 0;
const lines = [];
for (const [type, s] of [...byType].sort()) {
  const scored = SCORED_TYPES.has(type);
  if (scored) {
    n += s.n;
    zero += s.zero;
  }
  lines.push(
    `  ${scored ? "·" : " "} ${type.padEnd(15)} ${String(s.n).padStart(5)} edges  ` +
      `${((s.zero / s.n) * 100).toFixed(1).padStart(5)}% share no words  ` +
      `mean run ${(s.total / s.n).toFixed(2)}${scored ? "" : "   (reported, not gated)"}`,
  );
}

if (n === 0) fail(`no ${[...SCORED_TYPES].join("/")} edges found — did the ETL stop emitting them?`);

const share = zero / n;
console.log(lines.join("\n"));

if (share > ZERO_OVERLAP_LIMIT) {
  console.error(
    `\ngate:edges — FAIL: ${zero}/${n} scored edges (${(share * 100).toFixed(1)}%) ` +
      `share no words with their source, over the ${(ZERO_OVERLAP_LIMIT * 100).toFixed(0)}% limit.\n`,
  );
  for (const z of zeroes.slice(0, 15)) console.error(`  ${z}`);
  if (zeroes.length > 15) console.error(`  …and ${zeroes.length - 15} more`);
  console.error(
    "\n  Random ayah pairs score 69% here and the off-by-one corpus scored 48%," +
      "\n  so this is not a quality wobble — an ayah-numbering assumption broke." +
      "\n  Check `datasetAbs` in build-adjacency.mjs before anything else.\n",
  );
  process.exit(1);
}

console.log(
  `gate:edges — OK (${zero}/${n} scored edges share no words, ` +
    `${(share * 100).toFixed(1)}% ≤ ${(ZERO_OVERLAP_LIMIT * 100).toFixed(0)}% limit)`,
);
