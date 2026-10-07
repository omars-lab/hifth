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
 *   node packages/etl/tools/pitch/extract.mjs --seams 17 # list where sentences may run
 *                                                        # together, with each spot's
 *                                                        # fingerprint for print-breaks.json;
 *                                                        # prints to the terminal, writes nothing
 *
 * Re-run it whenever the source capture changes or the curation below is edited.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { joinPageBreaks } from "./blocks.mjs";
import { dropRaisedEndings, seamPrint, seams } from "./breaks.mjs";
import { dropVerseHeading } from "./heading.mjs";
import { cleanIntro } from "./intro.mjs";
import { dropMarginRefs } from "./strays.mjs";
import { readKey } from "./key.mjs";
import { noteRange, settleTranslation } from "./translation.mjs";
import { finishNote } from "./finish.mjs";
import { endPrint } from "./ends.mjs";
import { wordsOf } from "./splits.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../../../..");

// The Study Quran capture, next door. Absolute on this laptop; never vendored.
// "Next door" is beside the main checkout: a worktree is a folder or two deeper,
// and from there the capture used to be missing, so every surah was skipped.
const CAPTURE = "../books/books/study-quran/tafseer-bundle";
const MAIN = dirname(
  resolve(REPO, execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: REPO, encoding: "utf8" }).trim()),
);
const SRC_DIR = [resolve(REPO, CAPTURE), resolve(MAIN, CAPTURE)].find(existsSync) ?? resolve(REPO, CAPTURE);
const MANIFEST = resolve(REPO, "apps/web/public/assets/manifest.json");
const OUT_DIR = resolve(REPO, "apps/web/public/assets/private/study-quran");
// The key to the commentators' initials, typed by hand from the front of the
// volume into the capture's folder (see key.mjs). Optional: without it the
// notes still show, their initials just stay plain.
const KEY_SRC = resolve(SRC_DIR, "../raw/commentator-key.hand.json");
// Verses the capture lost, read again off the page pictures (see translation.mjs).
const FIXES_SRC = resolve(SRC_DIR, "../raw/translation-fixes.hand.json");
const FIXES = existsSync(FIXES_SRC) ? JSON.parse(readFileSync(FIXES_SRC, "utf8")).verses : {};

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
 * The print closes a commentary section with a "* * *" divider. At the end of a
 * note or a card it is only noise, so it is dropped wherever held text ends.
 */
function dropSectionBreak(text) {
  return text.replace(/\s*\*\s*\*\s*\*\s*$/, "");
}

/**
 * Every captured commentary block opens with the verse label it covers — "3 …"
 * for a single ayah, "67–71 …" for a range the note is shared across. When the
 * label is exactly the ayah the reader tapped, it just repeats the verse the
 * drawer is already about, so we drop it. A range label stays: it is the note's
 * own way of saying "this covers verses 67 through 71", which the drawer cannot
 * show any other way. Only ever removes a leading number equal to this ayah;
 * touches nothing else in the held text.
 */
function trimSelfLabel(text, ayah) {
  return text.replace(new RegExp(`^${ayah}[\\s\\u00a0]+`), "");
}

/**
 * Al-Fātiḥah's hand-written roads — the demo's centrepiece, kept by hand because
 * every `note` is our own plain-language line about WHY the two verses connect,
 * never a quote of the held translation. The rest of the Qur'an takes its roads
 * from the source's own cross-references instead (see `refShard`).
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
 * count, and label each with the opening words of the target verse's own
 * translation, so a card says what is there. That is a quote of the held
 * translation, which is why this output stays in the private, gitignored pitch
 * data and never ships; a target with no translation keeps a plain line.
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
        snippet(translationOf(to[0], to[1])) ?? "A verse the Study Quran cross-references from here.",
        "xref",
      ),
    );
    if (edges.length) shard[String(sourceAyah)] = { edges, ext: [] };
  }
  return shard;
}

/** The longest a related verse's card label runs before it is cut. */
const SNIPPET_MAX = 110;

/** The opening words of a translation, cut on a word boundary with "…". */
function snippet(text, max = SNIPPET_MAX) {
  const flat = dropSectionBreak((text ?? "").replace(/\s+/g, " ").trim());
  if (!flat) return null;
  // A verse that runs on into the next ends mid-sentence; drop its dangling comma.
  if (flat.length <= max) return flat.replace(/[,;:—-]+$/, "");
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.—-]+$/, "")}…`;
}

/** One verse's held translation, reading each surah's file once. */
const translations = new Map();
function translationOf(surah, ayah) {
  if (!translations.has(surah)) {
    const bySurah = new Map();
    for (const entry of readSurah(surah)?.entries ?? []) {
      const ref = parseRef(entry.key);
      if (ref && ref[0] === surah) bySurah.set(ref[1], settled(ref, entry).translation);
    }
    translations.set(surah, bySurah);
  }
  return translations.get(surah).get(ayah) ?? "";
}

/** One verse's translation and any note the capture filed in its place. */
function settled([s, a], entry) {
  return settleTranslation(entry.translation?.text ?? "", FIXES[`${s}:${a}`]?.translation);
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
// The book's translation of the opening verse, which its capture repeats under
// every surah's introduction (see intro.mjs). Read here, never written down.
const OPENING = readSurah(1)?.entries.find((e) => parseRef(e.key)?.join(":") === "1:1")?.translation?.text ?? "";

// The full stops and new paragraphs the print has and the capture lost, each
// read off the printed page (see breaks.mjs).
const MARKS = JSON.parse(readFileSync(resolve(HERE, "print-breaks.json"), "utf8")).marks;
const usedMarks = new Set();
const LIST_SEAMS = process.argv.includes("--seams");

// Sentences a column or page break split into two paragraphs (see splits.mjs):
// every word the book uses, to tell a cut word from two, and the joins only the
// printed page could settle.
const WORDS = wordsOf(
  Array.from({ length: 114 }, (_, i) => readSurah(i + 1)?.entries ?? []).flatMap((entries) =>
    entries.flatMap((e) => (e.commentary ?? []).flatMap((c) => (c.blocks ?? []).map((b) => b.text ?? ""))),
  ),
);
const JOINS = JSON.parse(readFileSync(resolve(HERE, "print-joins.json"), "utf8")).joins;
const usedJoins = new Set();
const LIST_SPLITS = process.argv.includes("--splits");
// Notes whose closing stop the capture lost, read off the printed page (see ends.mjs).
const ENDS = JSON.parse(readFileSync(resolve(HERE, "print-ends.json"), "utf8")).ends;
const usedEnds = new Set();
const LIST_ENDS = process.argv.includes("--ends");

function buildSurah(surah) {
  const src = readSurah(surah);
  if (!src) return { surah, skipped: true };

  // Per-verse held content: the editors' translation + the commentary prose.
  const verses = {};
  // A note the capture filed as a verse goes back under it, and a range note
  // ("105–7 …") also goes under the other verses it covers.
  const moved = new Map();
  for (const entry of src.entries) {
    const ref = parseRef(entry.key);
    const { note } = ref ? settled(ref, entry) : { note: "" };
    if (!note) continue;
    const [from, to] = noteRange(note) ?? [ref[1], ref[1]];
    for (let a = from; a <= to; a++) moved.set(a, [...(moved.get(a) ?? []), note]);
  }
  let previous = [];
  for (const entry of src.entries) {
    const ref = parseRef(entry.key);
    if (!ref) continue;
    const [s, a] = ref;
    const captured = (entry.commentary ?? []).flatMap((c) => (c.blocks ?? []).map((b) => b.text).filter(Boolean));
    const own = moved.get(a) ?? [];
    const joined = joinPageBreaks(
      [...own, ...captured.filter((b) => !own.includes(b))]
        .map(dropMarginRefs)
        .map((text) => trimSelfLabel(dropVerseHeading(text, a, (n) => translationOf(s, n)), a))
        .map(dropSectionBreak)
        .map(dropRaisedEndings)
        .filter(Boolean),
    );
    const done = finishNote(`${s}:${a}`, joined, previous, { marks: MARKS, joins: JOINS, words: WORDS, ends: ENDS });
    for (const i of done.usedMarks) usedMarks.add(i);
    for (const i of done.usedJoins) usedJoins.add(i);
    for (const i of done.usedEnds) usedEnds.add(i);
    const blocks = done.blocks;
    if (LIST_SPLITS)
      for (let i = 1; i < blocks.length; i++)
        if (!/[.!?;:”"’)\]]\s*$/u.test(blocks[i - 1])) {
          const prev = blocks[i - 1].trimEnd();
          console.log(`${s}:${a} ${seamPrint(`${prev} ${blocks[i]}`, prev.length)} …${prev.slice(-30)} | ${blocks[i].slice(0, 30)}…`);
        }
    if (LIST_ENDS && blocks.length && !/[.!?…:;)\]"'”’»]\s*$/u.test(blocks.at(-1)))
      console.log(`${s}:${a} ${endPrint(blocks.at(-1))}`);
    if (LIST_SEAMS)
      for (const block of blocks)
        for (const { at } of seams(block))
          console.log(`${s}:${a} ${seamPrint(block, at)} …${block.slice(Math.max(0, at - 30), at + 30)}…`);
    verses[`${s}:${a}`] = {
      ref: `${s}:${a}`,
      key: canon(s, a),
      translation: settled(ref, entry).translation,
      commentary: blocks,
    };
    previous = done.handOn;
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
    intro: cleanIntro((src.intro ?? []).map((i) => i.text).filter(Boolean), OPENING),
    verses,
    shard,
    generated: new Date().toISOString(),
    note: "PRIVATE pitch data. Held copy (The Study Quran, HarperOne 2015). Never commit or deploy.",
  };

  if (LIST_SEAMS || LIST_SPLITS) return { surah, listed: true };
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
  if (r.listed) continue;
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

// A listed spot that matched nothing means the capture moved under the list.
const stale = MARKS.filter((m, i) => surahs.includes(Number(m.verse.split(":")[0])) && !usedMarks.has(i));
if (stale.length) {
  console.error(`print-breaks.json names ${stale.length} spot(s) the capture no longer has:`);
  for (const m of stale) console.error(`  ${m.verse} ${m.print} (page image ${m.page})`);
  console.error("  read those pages again and list each spot's new fingerprint (--seams).");
  process.exit(1);
}
const staleJoins = JOINS.filter((m, i) => surahs.includes(Number(m.verse.split(":")[0])) && !usedJoins.has(i));
if (staleJoins.length) {
  console.error(`print-joins.json names ${staleJoins.length} join(s) the capture no longer has:`);
  for (const m of staleJoins) console.error(`  ${m.verse} ${m.print} (page image ${m.page})`);
  console.error("  read those pages again and list each join's new fingerprint (--splits).");
  process.exit(1);
}
const staleEnds = ENDS.filter((m, i) => surahs.includes(Number(m.verse.split(":")[0])) && !usedEnds.has(i));
if (staleEnds.length) {
  console.error(`print-ends.json names ${staleEnds.length} note ending(s) the capture no longer has:`);
  for (const m of staleEnds) console.error(`  ${m.verse} ${m.print} (page image ${m.page})`);
  console.error("  read those pages again and list each ending's new fingerprint (--ends).");
  process.exit(1);
}
if (LIST_SEAMS || LIST_SPLITS || LIST_ENDS) process.exit(0);

if (existsSync(KEY_SRC)) {
  const raw = JSON.parse(readFileSync(KEY_SRC, "utf8"));
  const key = readKey(raw);
  writeFileSync(
    resolve(OUT_DIR, "key.json"),
    JSON.stringify(
      {
        source: raw.source,
        license: "private",
        key,
        note: "PRIVATE pitch data. Held copy (The Study Quran, HarperOne 2015). Never commit or deploy.",
      },
      null,
      2,
    ),
  );
  console.log(`wrote the key to ${Object.keys(key).length} commentators' initials`);
} else {
  console.log(`  no key to the commentators' initials at ${KEY_SRC}: their initials stay plain`);
}

console.log(`wrote ${wrote} surah file(s) to ${OUT_DIR}`);
if (skipped) console.log(`  skipped ${skipped} (no source file)`);
console.log(
  `  verses: ${totalVerses}, with commentary: ${totalCommentary}, cross-reference edges: ${totalEdges}`,
);
