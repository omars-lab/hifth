/**
 * Build the PRIVATE pitch data for Al-Fātiḥah (surah 1).
 *
 * This is for the private pitch build only — the demo we show, in a room, to the
 * team behind The Study Quran (see CLAUDE.md → "What we are building right now").
 * It reads their captured surah file from the sibling `books` repo, keeps the
 * verses that make the demo sing, and writes a single gitignored JSON the app
 * loads at runtime only when the build sets `VITE_PITCH`.
 *
 * Nothing this writes is ever committed or deployed: the output lives under
 * `apps/web/public/assets/private/`, which `.gitignore` excludes wholesale, so
 * the held commentary and translation never enter the repo, the public site, or
 * any gate's view. This script itself carries no scripture — it only points at
 * where the held copy lives on this one laptop.
 *
 *   node packages/etl/tools/pitch/extract-fatiha.mjs
 *
 * Re-run it whenever the source capture changes or the curation below is edited.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../../../..");

// The Study Quran capture, next door. Absolute on this laptop; never vendored.
const SRC = resolve(
  REPO,
  "../books/books/study-quran/tafseer-bundle/001.json",
);
const MANIFEST = resolve(REPO, "apps/web/public/assets/manifest.json");
const OUT = resolve(REPO, "apps/web/public/assets/private/study-quran/1.json");

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
const keyOf = (surah, ayah) => `${manifest.edition}/${surah}:${ayah}` /* w/o corpus prefix set below */;

// The app's canonical key carries a corpus prefix ("quran/<edition>/S:A").
const CORPUS = "quran";
const canon = (surah, ayah) => `${CORPUS}/${manifest.edition}/${surah}:${ayah}`;

const SOURCE_PAGE = 1; // all of al-Fātiḥah is on page 1

/**
 * The curation. Two kinds of road out of each verse, both carried as the app's
 * active "related-meaning" (≈) edge so they render and jump with no code change:
 *
 *   kind: "xref"    — the Study Quran's OWN cross-reference (their scholarship,
 *                     turned into navigation)
 *   kind: "meaning" — a verse about the same thing in different words (what the
 *                     derived meaning-map will one day do at scale)
 *
 * `note` is our own plain-language line about WHY the two connect — never a quote
 * of the held translation. Kept short and few per verse: depth of impression.
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

const src = JSON.parse(readFileSync(SRC, "utf8"));
if (src.surah !== 1) throw new Error(`expected surah 1, got ${src.surah}`);

// Per-verse held content: the editors' translation + the commentary prose.
const verses = {};
for (const entry of src.entries) {
  const m = /(\d+):(\d+)$/.exec(entry.key);
  if (!m) continue;
  const ref = `${m[1]}:${m[2]}`;
  const blocks = (entry.commentary ?? []).flatMap((c) =>
    (c.blocks ?? []).map((b) => b.text).filter(Boolean),
  );
  verses[ref] = {
    ref,
    key: canon(Number(m[1]), Number(m[2])),
    translation: entry.translation?.text ?? "",
    commentary: blocks,
  };
}

// The adjacency shard for surah 1: ayah-number → its edges, in the exact shape
// the app's Adjacency table ingests (packages/core/src/adjacency.ts).
const shard = {};
for (const [ref, roads] of Object.entries(CURATION)) {
  const ayah = Number(ref.split(":")[1]);
  const edges = roads.map((r) => {
    const [ts, ta] = r.to;
    const page = pageOf(ts, ta);
    return {
      type: "related-meaning",
      to: canon(ts, ta),
      page,
      dir: { dSurah: ts - 1, dPage: page - SOURCE_PAGE },
      ...(r.twin ? { twin: true } : {}),
      note: r.note,
      src: r.kind === "xref" ? "study-quran-xref" : "study-quran-meaning",
    };
  });
  shard[String(ayah)] = { edges, ext: [] };
}

const out = {
  source: src.source,
  license: src.license, // "private"
  edition: manifest.edition,
  surah: 1,
  title: src.title,
  intro: (src.intro ?? []).map((i) => i.text).filter(Boolean),
  verses,
  shard,
  generated: new Date().toISOString(),
  note: "PRIVATE pitch data. Held copy (The Study Quran, HarperOne 2015). Never commit or deploy.",
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2));

const edgeCount = Object.values(shard).reduce((n, a) => n + a.edges.length, 0);
console.log(`wrote ${OUT}`);
console.log(
  `  verses: ${Object.keys(verses).length}, intro paras: ${out.intro.length}, curated edges: ${edgeCount}`,
);
for (const [ref, a] of Object.entries(shard)) {
  for (const e of a.edges) {
    const to = e.to.split("/").pop();
    console.log(`  ${ref} → ${to} (p${e.page}, ${e.src})`);
  }
}
