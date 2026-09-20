/**
 * Build the PRIVATE pitch data for the WHOLE Qur'an, one file per surah.
 *
 * This is for the private pitch build only — the demo we show, in a room, to the
 * team behind The Study Quran (see CLAUDE.md → "What we are building right now").
 * It reads their captured surah files from the sibling `books` repo and, for
 * every surah, writes a single gitignored JSON the app loads at runtime only
 * when the build sets `VITE_PITCH` — and only for the surah the reader is on.
 *
 * Two kinds of content come out of each source file:
 *
 *   - the held reading: each verse's translation and commentary, taken as
 *     captured. This is what the note drawer shows on a tap.
 *   - the roads: the Study Quran's OWN cross-references (`refs` in the source),
 *     turned into the app's "related-meaning" edges so they render and jump with
 *     no code change — their scholarship, made navigable. Al-Fātiḥah keeps the
 *     hand-written roads below instead, because it is the demo's centrepiece and
 *     its notes were composed by hand.
 *
 * Nothing this writes is ever committed or deployed: the output lives under
 * `apps/web/public/assets/private/`, which `.gitignore` excludes wholesale, so
 * the held commentary and translation never enter the repo, the public site, or
 * any gate's view. This script itself carries no scripture — it only points at
 * where the held copy lives on this one laptop, and every line of prose it emits
 * of its own (the road notes) is our plain-language writing, never a quote.
 *
 *   node packages/etl/tools/pitch/extract.mjs            # all 114 surahs
 *   node packages/etl/tools/pitch/extract.mjs 1 2 36     # just these surahs
 *
 * Re-run it whenever the source capture changes or the curation below is edited.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../../../..");

// The Study Quran capture, next door. Absolute on this laptop; never vendored.
const SRC_DIR = resolve(REPO, "../books/books/study-quran/tafseer-bundle");
const MANIFEST = resolve(REPO, "apps/web/public/assets/manifest.json");
const OUT_DIR = resolve(REPO, "apps/web/public/assets/private/study-quran");

// How many road edges a single verse may carry when they come from the source's
// own cross-references. A few dozen refs on one ayah would bury the hop list; a
// handful keeps the drawer legible and still shows the graph is real. Verses
// whose target also has commentary are kept first, so a hop lands somewhere with
// something to read.
const MAX_REF_EDGES = 8;

// Public Qur'an metadata (verse counts per surah) — not held copy. Used to turn
// a "surah:ayah" reference into the global ordinal the manifest is indexed by.
const AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111,
  110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45,
  83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55,
  78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20,
  56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21,
  11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

const OFFSET = (() => {
  const off = [0];
  for (let i = 0; i < AYAH_COUNTS.length; i++) off.push(off[i] + AYAH_COUNTS[i]);
  return off; // OFFSET[s-1] = ordinal of surah s, ayah 1
})();

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const pageOf = (surah, ayah) => manifest.ayahPages[OFFSET[surah - 1] + (ayah - 1)];

// The app's canonical key carries a corpus prefix ("quran/<edition>/S:A").
const CORPUS = "quran";
const canon = (surah, ayah) => `${CORPUS}/${manifest.edition}/${surah}:${ayah}`;
const parseRef = (key) => {
  const m = /(\d+):(\d+)$/.exec(key);
  return m ? [Number(m[1]), Number(m[2])] : null;
};

/**
 * Al-Fātiḥah's hand-written roads — the demo's centrepiece, kept by hand because
 * every `note` is our own plain-language line about WHY the two verses connect,
 * never a quote of the held translation. The rest of the Qur'an takes its roads
 * from the source's own cross-references instead (see `refEdges`).
 */
const CURATION = {
  "1:1": [
    {
      to: [27, 30],
      kind: "xref",
      twin: true,
      note: "The one other place these exact words open a text in the whole Qur'an — Solomon's letter to the Queen of Sheba.",
    },
  ],
  "1:2": [
    {
      to: [10, 10],
      kind: "meaning",
      note: "The last words of the people of Paradise are this same praise — the opening of the Book becomes the close of the journey.",
    },
    {
      to: [6, 45],
      kind: "xref",
      note: "Study Quran cross-reference: the same praise seals the account of the wrongdoers.",
    },
  ],
  "1:3": [
    {
      to: [2, 163],
      kind: "meaning",
      note: "The two Names paired here — the Compassionate, the Merciful — name the one God alone.",
    },
  ],
  "1:4": [
    {
      to: [82, 19],
      kind: "meaning",
      note: "What the Day of Judgment is: a Day when no soul can do a thing for another, and the command is God's alone.",
    },
  ],
  "1:5": [
    {
      to: [51, 56],
      kind: "meaning",
      note: "Why we worship at all: humankind and jinn were created for nothing else. No words shared — the link is the meaning.",
    },
  ],
  "1:6": [
    {
      to: [6, 153],
      kind: "meaning",
      note: "The straight path, named again as God's own — 'so follow it, and follow not the many ways.'",
    },
    {
      to: [36, 61],
      kind: "meaning",
      note: "The straight path as the covenant: 'that you worship Me — this is a straight path.'",
    },
  ],
  "1:7": [
    {
      to: [4, 69],
      kind: "xref",
      note: "Study Quran cross-reference: who 'those whom Thou hast blessed' are — the prophets, the truthful, the witnesses, and the righteous.",
    },
  ],
};

/** Build one edge in the exact shape the app's Adjacency table ingests. */
function edge(sourceSurah, sourceAyah, targetSurah, targetAyah, note, kind) {
  const page = pageOf(targetSurah, targetAyah);
  const srcPage = pageOf(sourceSurah, sourceAyah);
  return {
    type: "related-meaning",
    to: canon(targetSurah, targetAyah),
    page,
    dir: { dSurah: targetSurah - sourceSurah, dPage: page - srcPage },
    note,
    src: kind === "xref" ? "study-quran-xref" : "study-quran-meaning",
  };
}

/** The hand-curated roads for al-Fātiḥah, as a shard. */
function curatedShard(surah) {
  const shard = {};
  for (const [ref, roads] of Object.entries(CURATION)) {
    const [s, a] = parseRef(ref);
    if (s !== surah) continue;
    const edges = roads.map((r) => {
      const e = edge(s, a, r.to[0], r.to[1], r.note, r.kind);
      return r.twin ? { ...e, twin: true } : e;
    });
    shard[String(a)] = { edges, ext: [] };
  }
  return shard;
}

/**
 * The source's own cross-references, as a shard. Each `refs` entry is a verse
 * the Study Quran points to from this one; we keep the ones that also carry
 * commentary first (so a hop leads somewhere with something to read), cap the
 * count, and give each our own short provenance line — never a quote.
 */
function refShard(surah, entries) {
  const shard = {};
  for (const entry of entries) {
    const from = parseRef(entry.key);
    if (!from || from[0] !== surah) continue;
    const [, sourceAyah] = from;
    const refs = Array.isArray(entry.refs) ? entry.refs : [];

    const seen = new Set();
    const picked = refs
      // Keep well-formed, in-range targets that are not this verse itself.
      .map((r) => ({ r, to: parseRef(r.key) }))
      .filter(({ to }) => to && to[0] >= 1 && to[0] <= 114 && to[1] >= 1)
      .filter(({ to }) => to[1] <= AYAH_COUNTS[to[0] - 1])
      .filter(({ to }) => !(to[0] === surah && to[1] === sourceAyah))
      .filter(({ to }) => {
        const key = `${to[0]}:${to[1]}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    // Verses whose target also has commentary rank first.
    picked.sort((a, b) => Number(b.r.commentary) - Number(a.r.commentary));

    const edges = picked.slice(0, MAX_REF_EDGES).map(({ to }) =>
      edge(
        surah,
        sourceAyah,
        to[0],
        to[1],
        "A verse the Study Quran cross-references from here.",
        "xref",
      ),
    );
    if (edges.length) shard[String(sourceAyah)] = { edges, ext: [] };
  }
  return shard;
}

/** Read one captured surah file (zero-padded, three digits). */
function readSurah(surah) {
  const path = resolve(SRC_DIR, `${String(surah).padStart(3, "0")}.json`);
  if (!existsSync(path)) return null;
  const src = JSON.parse(readFileSync(path, "utf8"));
  if (src.surah !== surah) {
    throw new Error(`${path}: expected surah ${surah}, got ${src.surah}`);
  }
  return src;
}

/** Build and write one surah's private pitch payload. Returns a summary line. */
function buildSurah(surah) {
  const src = readSurah(surah);
  if (!src) return { surah, skipped: true };

  // Per-verse held content: the editors' translation + the commentary prose.
  const verses = {};
  for (const entry of src.entries) {
    const ref = parseRef(entry.key);
    if (!ref) continue;
    const [s, a] = ref;
    const blocks = (entry.commentary ?? []).flatMap((c) =>
      (c.blocks ?? []).map((b) => b.text).filter(Boolean),
    );
    verses[`${s}:${a}`] = {
      ref: `${s}:${a}`,
      key: canon(s, a),
      translation: entry.translation?.text ?? "",
      commentary: blocks,
    };
  }

  // Al-Fātiḥah keeps its hand-written roads; every other surah takes the
  // source's own cross-references.
  const shard = surah === 1 ? curatedShard(1) : refShard(surah, src.entries);

  const out = {
    source: src.source,
    license: src.license, // "private"
    edition: manifest.edition,
    surah,
    title: src.title,
    intro: (src.intro ?? []).map((i) => i.text).filter(Boolean),
    verses,
    shard,
    generated: new Date().toISOString(),
    note: "PRIVATE pitch data. Held copy (The Study Quran, HarperOne 2015). Never commit or deploy.",
  };

  const outPath = resolve(OUT_DIR, `${surah}.json`);
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  const edgeCount = Object.values(shard).reduce((n, adj) => n + adj.edges.length, 0);
  const withCommentary = Object.values(verses).filter((v) => v.commentary.length).length;
  return { surah, verses: Object.keys(verses).length, withCommentary, edges: edgeCount };
}

// --- run -------------------------------------------------------------------

const args = process.argv.slice(2).map(Number).filter((n) => n >= 1 && n <= 114);
const surahs = args.length ? args : Array.from({ length: 114 }, (_, i) => i + 1);

mkdirSync(OUT_DIR, { recursive: true });

let wrote = 0;
let skipped = 0;
let totalVerses = 0;
let totalCommentary = 0;
let totalEdges = 0;
for (const surah of surahs) {
  const r = buildSurah(surah);
  if (r.skipped) {
    skipped++;
    console.warn(`  surah ${surah}: no source file, skipped`);
    continue;
  }
  wrote++;
  totalVerses += r.verses;
  totalCommentary += r.withCommentary;
  totalEdges += r.edges;
}

console.log(`wrote ${wrote} surah file(s) to ${OUT_DIR}`);
if (skipped) console.log(`  skipped ${skipped} (no source file)`);
console.log(
  `  verses: ${totalVerses}, with commentary: ${totalCommentary}, cross-reference edges: ${totalEdges}`,
);
