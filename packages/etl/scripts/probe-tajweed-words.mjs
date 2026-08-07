#!/usr/bin/env node
/**
 * Does a tajweed annotation land inside one print word?
 *
 * `docs/design/word-indexing.md` ⑤ asks this and says what would answer it:
 *
 * > A probe that folds Tanzil-Uthmani against the print's word text would say
 * > whether each annotation's span falls inside one print word, and how many
 * > ayahs need named exceptions … ETL-only, nothing ships from it but a number,
 * > and the number decides whether this is a build change or a design problem.
 *
 * The obstacle the item names is real: `build-tajweed.mjs` emits **codepoint
 * offsets into each ayah's Tanzil Uthmani text**, and this repo holds no Quran
 * text and will not (`morphology.mjs`). So the text cannot be read — it has to
 * be *reconstructed*, from the print's own per-word `data-hafs`, which
 * `build-words.mjs` already reads and drops on purpose. Nothing is vendored and
 * nothing is written but numbers.
 *
 * ## The corrections, each one earned by a failed run
 *
 * ### Structural — how the words are joined (1–3)
 *
 * A naive join — every `data-hafs` in index order, single spaces between — puts
 * 326 annotations past the end of their own ayah. Three differences explain it,
 * and each was found by measurement rather than assumed:
 *
 * 1. **The basmala is part of ayah 1.** The tajweed source prefixes it to the
 *    first ayah of every surah except al-Fatiha (where it *is* ayah 1) and
 *    at-Tawba (which has none). 2:1's offsets run to 44 against a reconstruction
 *    5 codepoints long. Prepending 1:1 drops out-of-range from 326 to 0.
 * 2. **The print splits the conjunction waw; Tanzil does not.** The corpus flags
 *    it — `data-waw-alatf="true"`, always on «وَ» — so the split is stated, not
 *    guessed. A word carrying the flag is glued to its successor with no space.
 * 3. **The print numbers pause marks as words; the Tanzil text has none of
 *    them.** This is the big one and it points the opposite way to intuition:
 *    the marks are *dropped* from the reconstruction, not spaced or glued. The
 *    evidence was a delta histogram that clustered on **even** values and decayed
 *    monotonically (0 → 63.4%, +2 → 21.0%, +4 → 7.5%, +6 → 2.4%), which is the
 *    signature of one repeated two-codepoint insertion — a mark plus its space —
 *    and not of a scrambled text. Dropping them took the oracle from 63.4% to
 *    97.0%. `build-words.mjs` keeps the marks for its own good reason (dropping
 *    them renumbers every later word); this probe drops them only from the
 *    *string*, and their word slots stay in the span list unaddressed.
 *
 * ### Orthographic — how a single mark is spelled (4–7)
 *
 * Those three took the oracle to 97.03% and left 172 ayahs. That residual was
 * first recorded as unnamed "orthographic drift", which was true and useless.
 * Bracketing each ayah's drift between its last correct annotation and its
 * first wrong one narrows it to four spellings — every one a case where the two
 * texts render the **same printed mark** with a different number of codepoints.
 * None is a variant reading; all four are decisions about carriers.
 *
 * 4. **The tatweel that carries a small high mark.** «ـۧ» (U+0640 U+06E7) and
 *    «ـۨ» (U+0640 U+06E8) — إِبۡرَٰهِـۧم, ٱلنَّبِيِّـۧنَ, نُـۨجِي. The print seats the
 *    mark on a stretch of baseline; the offsets count the mark alone. This is
 *    deliberately narrow, and the narrowness is measured: stripping *every*
 *    U+0640 takes the oracle **down** to 94.48%, so most tatweels are in both
 *    texts and only these two carriers are not. The yeh carrier is the common
 *    one — 172 → 143 ayahs by itself; the noon carrier is rare enough that it
 *    closes exactly one ayah, and it closes it last (12 → 11).
 * 5. **The alef-hamza with maddah.** «أٓ» (U+0623 U+0653) in ٱلۡأٓخِرَة, ٱلۡأٓيَٰت —
 *    two codepoints in the print, three in the offsets' text. What is measured
 *    is the *length*, not the identity: any three-codepoint substitution
 *    recovers the alignment, so the probe can prove the other text spends one
 *    more codepoint there without claiming which three it uses. The biggest
 *    single correction of the four — 143 → 60 ayahs on its own.
 * 6. **The small high madda.** «ۤ» (U+06E4), written by the print and absent
 *    from the offsets' text. It clusters on the sajdah ayahs — يَسۡجُدُۤ,
 *    ٱسۡجُدُواْۤ, لِلَّهِۤ — which is a good sign rather than a coincidence: the
 *    source text is Tanzil's *pause-sajdah* edition and marks those places its
 *    own way. 60 → 19 ayahs.
 * 7. **The hamza below on a seat.** «ٕ» (U+0655) in شَٰطِيِٕ, إِيتَآيِٕ, ٱللُّؤۡلُوِٕ —
 *    the print writes seat + kasra + hamza-below where the offsets count two
 *    codepoints. Again a length, not an identity. 19 → 12 ayahs.
 *
 * Together: **97.03% → 99.81%**, and **172 → 11** ayahs. The eleven are not a
 * remainder — they are `NAMED`, below, and three of them the repo already names
 * in another register entirely.
 *
 * The corrections were made for alignment, and paintability moved with them
 * without being asked to: spans running past the end of their ayah went 2 → 0,
 * and spans touching more than two words went 4 → 1. That is the second reason
 * to believe them — a rule that merely shifted the string to satisfy the oracle
 * would have no reason to also settle the arithmetic the oracle does not see.
 *
 * ## The oracle: why this is a measurement and not a hope
 *
 * A reconstruction that were subtly wrong would still produce spans, and every
 * span would still fall inside some word. So alignment is checked independently
 * of word boundaries, by two rules whose target letter is not in doubt:
 * `hamzat_wasl` must start on **ٱ** (U+0671) and `lam_shamsiyyah` on **ل**.
 * 15,985 annotations carry that obligation. It is the oracle that decides
 * whether the fold is right; the span arithmetic only decides what follows.
 *
 * ## What it is blind to
 *
 * - **The 12 rules with no characteristic letter.** madd, ghunnah, qalqalah and
 *   the rest are counted for paintability but cannot be checked for alignment.
 *   The oracle covers 26.6% of the annotations; the rest inherit its verdict.
 * - **Whether the colours are right.** Untouched. The skin is beta on a hafiz's
 *   sign-off (`plan-tajweed-golden-row`), and this measures geometry only.
 * - **Overfitting.** Corrections 4–7 were found by looking at what the oracle
 *   got wrong, so in principle any codepoint deletion that shifts the string
 *   could score. Three things hold that in check and none of them is taste:
 *   each rule names a real orthographic feature and is applied to all 6,236
 *   ayahs rather than to the ayahs that motivated it; the oracle tests letter
 *   *identity* at a position the rule does not touch; and a rule that is too
 *   broad is punished immediately and visibly — the generalisation of 4 to
 *   every tatweel costs 4.5 points. A rule that fixed only the ayah that
 *   suggested it was rejected for that reason (see `NAMED`, 36:52).
 * - **Its own base.** The reconstruction is *of* the print, so a two-word span
 *   here means two print words, which is exactly the question. It says nothing
 *   about Tanzil's own tokenisation, which PROVENANCE already puts at 16.7%.
 *
 * Not a gate, and never will be: it reads a 380 MB cache that is gitignored, so
 * on a clean checkout it has nothing to read. Same reasoning that named
 * `check-source-offer.mjs` and `probe-reference.mjs` what they are named. Pages
 * come from the same gitignored `.cache/words/` that `build-words.mjs` fills, so
 * a run after that build costs nothing and reads the bytes it shipped.
 *
 * Usage:
 *   node packages/etl/scripts/probe-tajweed-words.mjs            # from the cache
 *   node packages/etl/scripts/probe-tajweed-words.mjs --fetch    # fill it first
 *   node packages/etl/scripts/probe-tajweed-words.mjs --write    # record it
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { candidatePage, pin } from "./lib/candidate-pages.mjs";
import { WAQF } from "./lib/mushaf-frame.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TAJWEED = join(HERE, "..", "data", "tajweed", "tajweed.hafs.uthmani-pause-sajdah.json");
const RESULT = join(HERE, "..", "data", "tajweed", "tajweed-words.probe.json");

const fetchMissing = process.argv.includes("--fetch");
const write = process.argv.includes("--write");

/**
 * The letter each rule must start on. Two of the eighteen state their own
 * target: hamzat wasl *is* the ٱ, and lam shamsiyyah *is* the assimilated ل.
 * Everything else describes a manner of articulation, which no single codepoint
 * witnesses — so those twelve rules are counted, never used as evidence.
 */
const ORACLE = { hamzat_wasl: "ٱ", lam_shamsiyyah: "ل" };

/**
 * Corrections 4–7: the same grapheme, encoded differently by the two
 * transcriptions. Applied to every word of all 6,236 ayahs, never to the ayahs
 * that motivated them. Order matters only in that none of these five overlap.
 */
const RESPELL = [
  [/ـۧ/g, "ۧ"], // 4 — tatweel carrying SMALL HIGH YEH   (إِبۡرَٰهِـۧمُ)
  [/ـۨ/g, "ۨ"], // 4 — tatweel carrying SMALL HIGH NOON  (أَنجِـۨي)
  [/أٓ/g, "ءَا"], // 5 — alef-hamza + maddah, two cp here and three there
  [/ۤ/g, ""], // 6 — SMALL HIGH MADDA, the print's only
  [/ٕ/g, ""], // 7 — HAMZA BELOW on a seat
];
const respell = (text) => RESPELL.reduce((s, [re, to]) => s.replace(re, to), text);

/**
 * The eleven ayahs the corrections do not reach, each one named. This list is
 * documentation, not logic — nothing reads it — and it is here so that a future
 * run that changes the count has something to disagree with.
 *
 * Three of them the repo already names in a different register: 12:39 and 12:41
 * are two of the four print↔QAC orthographic exceptions in `lib/segmentation.mjs`
 * (a third independent witness to the same spelling), and 15:7 is the single
 * 1→2 alignment singularity. They drift here for the reason they drift there.
 */
const NAMED = {
  "12:39": "«يَٰصَٰحِبَيِ» Δ−1 — a named print↔QAC exception, seen a third time",
  "12:41": "«يَٰصَٰحِبَيِ» Δ−1 — the same word, the same exception",
  "15:7": "«لَّوۡمَا» Δ−1 — the repo's one 1→2 alignment singularity",
  "2:181": "«بَعۡدَ مَا» Δ+1 — the print splits, the offsets' text joins",
  "8:6": "«بَعۡدَ مَا» Δ+1 — the same join, uncorpus-flagged so not derivable",
  "13:37": "«بَعۡدَ مَا» Δ+1 — the same join",
  "2:97": "«لِّـجِبۡرِيلَ» Δ+1 — a bare tatweel carrying no mark, so rule 4 misses it",
  "17:7": "«لِيَسُـُٔواْ» Δ−2 — a bare tatweel, and ٱلۡءَاخِرَةِ spelled the long way",
  "36:52": "«مَّرۡقَدِنَاۜ» Δ+1 — SMALL HIGH SEEN; a rule for it gains 1 annotation, 0 ayahs",
  "95:1": "Δ−1 — not localisable: the first oracle annotation is already drifted",
  "97:1": "Δ−1 — not localisable, the same way",
};

// ------------------------------------------------------------------ reading --

// A local attribute scan rather than `readTheirs`: that reader exists to build
// geometry and parses every path in the file to do it, which is minutes of work
// for a question that needs no boxes at all — and it drops `data-waw-alatf`,
// which correction 2 is entirely about.
const WORD = /<g id="md-word-\d+"([^>]*)>/g;
const attr = (s, name) => {
  const m = s.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
};
const unescape = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

/** A word that is nothing but pause/hizb marks — ink the Tanzil text does not carry. */
const isMark = (text) => [...text].length > 0 && [...text].every((c) => WAQF.has(c));

/** "surah:ayah" → Map(printIndex → { hafs, waw }), over every page read. */
const byAyah = new Map();

async function readPages() {
  let bytes = 0;
  for (let page = 1; page <= 604; page += 1) {
    const { body } = await candidatePage(page, { offline: !fetchMissing });
    bytes += body.length;
    const svg = body.toString("utf8");
    for (const m of svg.matchAll(WORD)) {
      const a = m[1];
      const surah = Number(attr(a, "data-surah"));
      const aya = Number(attr(a, "data-aya"));
      const idx = Number(attr(a, "data-word-index-in-ayah"));
      const hafs = attr(a, "data-hafs");
      if (!surah || !aya || !idx || hafs == null) continue;
      const key = `${surah}:${aya}`;
      if (!byAyah.has(key)) byAyah.set(key, new Map());
      byAyah.get(key).set(idx, { hafs: unescape(hafs), waw: attr(a, "data-waw-alatf") === "true" });
    }
    if (page % 100 === 0) process.stdout.write(`  … ${page}/604 pages\n`);
  }
  return bytes;
}

/** The print's words for one ayah, or null if the indices are not 1..n contiguous. */
function wordsOf(key) {
  const m = byAyah.get(key);
  if (!m) return null;
  const idxs = [...m.keys()].sort((a, b) => a - b);
  for (let i = 0; i < idxs.length; i += 1) if (idxs[i] !== i + 1) return null;
  return idxs.map((i) => m.get(i));
}

// ------------------------------------------------------------------ folding --

/**
 * The seven corrections, applied. Returns the reconstructed codepoints and, per
 * print word, the `[start, end)` it occupies in them — `null` for a pause mark,
 * which owns ink on the page but no codepoints in this text. The spans are into
 * the *respelled* string, which is the one the offsets address; a word whose
 * spelling changed keeps its identity and changes its width.
 */
function fold(words, prefix) {
  let cps = [...prefix];
  const spans = [];
  for (let i = 0; i < words.length; i += 1) {
    if (isMark(words[i].hafs)) {
      spans.push(null);
      continue;
    }
    const start = cps.length;
    cps = cps.concat([...respell(words[i].hafs)]);
    spans.push([start, cps.length]);
    // A space unless this word is a split waw, and never a trailing one — the
    // lookahead skips marks because they are not in the string to be next to.
    const more = words.slice(i + 1).some((w) => !isMark(w.hafs));
    if (more && !words[i].waw) cps.push(" ");
  }
  return { cps, spans };
}

const hasBasmala = (surah, ayah) => ayah === 1 && surah !== 1 && surah !== 9;

// --------------------------------------------------------------------- run --

console.log(`\n  probe:tajweed-words — ${pin.candidate.repo} @ ${pin.candidate.commit.slice(0, 12)}`);
console.log("  folding the print's per-word text against the tajweed codepoint offsets\n");

const bytes = await readPages();

const tajweed = JSON.parse(readFileSync(TAJWEED, "utf8"));
const basmala = fold(wordsOf("1:1"), []);

const oracle = { hamzat_wasl: { n: 0, hit: 0 }, lam_shamsiyyah: { n: 0, hit: 0 } };
const drift = new Map(); // signed codepoint distance to the expected letter
const residual = []; // one row per ayah the oracle is not perfect on
let annotations = 0;
let inOneWord = 0;
let inTwoAdjacent = 0;
let wider = 0;
let pastEnd = 0;
let ayahsRead = 0;
const widerRows = [];

for (const rec of tajweed) {
  const key = `${rec.surah}:${rec.ayah}`;
  const words = wordsOf(key);
  if (!words) continue;
  ayahsRead += 1;

  const prefix = hasBasmala(rec.surah, rec.ayah) ? [...basmala.cps, " "] : [];
  const { cps, spans } = fold(words, prefix);
  const hosts = [...(prefix.length ? basmala.spans.filter(Boolean) : []), ...spans.filter(Boolean)];

  const deltas = [];
  for (const a of rec.annotations) {
    annotations += 1;

    const want = ORACLE[a.rule];
    if (want) {
      oracle[a.rule].n += 1;
      if (cps[a.start] === want) {
        oracle[a.rule].hit += 1;
      } else {
        // How far away is it? A bounded search, so "nowhere near" stays visible
        // as its own outcome rather than folding into a large delta.
        let d = null;
        for (let x = 1; x <= 8 && d === null; x += 1) {
          if (cps[a.start - x] === want) d = -x;
          else if (cps[a.start + x] === want) d = x;
        }
        drift.set(d, (drift.get(d) ?? 0) + 1);
        deltas.push(d);
      }
    }

    if (a.end > cps.length) {
      pastEnd += 1;
      continue;
    }
    const touched = [];
    for (let i = 0; i < hosts.length; i += 1) {
      if (a.start < hosts[i][1] && a.end > hosts[i][0]) touched.push(i);
    }
    if (touched.length <= 1) inOneWord += 1;
    else if (touched.length === 2 && touched[1] === touched[0] + 1) inTwoAdjacent += 1;
    else {
      wider += 1;
      widerRows.push({ key, rule: a.rule, words: touched.length });
    }
  }
  if (deltas.length) {
    residual.push({ key, misses: deltas.length, deltas: [...new Set(deltas)].sort((x, y) => x - y) });
  }
}

const oracleN = oracle.hamzat_wasl.n + oracle.lam_shamsiyyah.n;
const oracleHit = oracle.hamzat_wasl.hit + oracle.lam_shamsiyyah.hit;
const pct = (n, d) => `${((n / d) * 100).toFixed(2)}%`;
const oneDrift = residual.filter((r) => r.deltas.length === 1).length;
const unreachable = drift.get(null) ?? 0;

console.log(`\n  ${ayahsRead}/6236 ayahs reconstructed from ${(bytes / 1024 / 1024).toFixed(0)} MB of print SVG\n`);
console.log("── the oracle: does the fold put the right letter under the offset?");
for (const [rule, o] of Object.entries(oracle)) {
  console.log(`  ${rule.padEnd(15)} ${o.hit}/${o.n} = ${pct(o.hit, o.n)}`);
}
console.log(`  ${"together".padEnd(15)} ${oracleHit}/${oracleN} = ${pct(oracleHit, oracleN)}`);

console.log("\n── paintability: how many print words does a span touch?");
console.log(`  annotations              : ${annotations}`);
console.log(`  one word                 : ${inOneWord}  (${pct(inOneWord, annotations)})`);
console.log(`  two adjacent words       : ${inTwoAdjacent}  (${pct(inTwoAdjacent, annotations)})`);
console.log(`  wider than two           : ${wider}  (${pct(wider, annotations)})`);
console.log(`  past the end of the text : ${pastEnd}`);
for (const r of widerRows) console.log(`     ${r.key} ${r.rule} — ${r.words} words`);

console.log(`\n── the residual: ${residual.length} ayahs the oracle is not perfect on`);
console.log("  distance to the expected letter (negative = the fold ran long):");
for (const [d, n] of [...drift].sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99))) {
  const label = d === null ? "  ∅" : String(d).padStart(3);
  console.log(`   ${label}  ${String(n).padStart(4)}  ${pct(n, oracleN - oracleHit)} of the misses`);
}
console.log(`  ayahs whose every miss shares ONE distance: ${oneDrift}/${residual.length}`);
console.log(
  `  ${unreachable ? `${unreachable} misses have no expected letter within ±8` : "no miss is further than ±8 away"}`,
);

// Every residual ayah should be one this run already has a name for. An unnamed
// one is the interesting outcome: it means the print, the offsets or the
// corrections moved, and the sweep that produced `NAMED` needs running again.
const unnamed = residual.filter((r) => !NAMED[r.key]).map((r) => r.key);
console.log("\n── each one, named:");
for (const r of residual.sort((a, b) => b.misses - a.misses)) {
  const why = NAMED[r.key] ?? "UNNAMED — no cause recorded for this one";
  console.log(`  ${r.key.padEnd(8)} ×${String(r.misses).padStart(2)}  ${why}`);
}
if (unnamed.length) console.log(`\n  ⚠ ${unnamed.length} unnamed: ${unnamed.join(" ")}`);

/**
 * The verdict answers ⑤'s fork and nothing else: is this a build change or a
 * design problem? A build change needs the fold to be *right* (the oracle) and
 * the spans to be *hostable* (one or two adjacent boxes, both of which the
 * highlighter can already paint). A design problem would look like spans
 * sprayed across a line.
 */
const verdict = oracleHit / oracleN >= 0.95 && wider / annotations < 0.001 ? "buildable" : "needs-a-third-text";
console.log(`\n  verdict: ${verdict}\n`);

if (write) {
  const prior = JSON.parse(readFileSync(RESULT, "utf8"));
  writeFileSync(
    RESULT,
    `${JSON.stringify(
      {
        ...prior,
        ranOn: new Date().toISOString().slice(0, 10),
        verdict,
        candidate: { repo: pin.candidate.repo, commit: pin.candidate.commit },
        ayahsRead,
        oracle: {
          ...Object.fromEntries(Object.entries(oracle).map(([k, o]) => [k, { n: o.n, hit: o.hit }])),
          total: { n: oracleN, hit: oracleHit },
        },
        paintability: {
          annotations,
          oneWord: inOneWord,
          twoAdjacent: inTwoAdjacent,
          wider,
          pastEnd,
          widerRows,
        },
        residual: {
          ayahs: residual.length,
          misses: oracleN - oracleHit,
          singleDriftAyahs: oneDrift,
          distances: Object.fromEntries([...drift].map(([d, n]) => [d === null ? "beyond" : String(d), n])),
          named: Object.fromEntries(
            residual.sort((a, b) => b.misses - a.misses).map((r) => [r.key, NAMED[r.key] ?? "UNNAMED"]),
          ),
          unnamed,
        },
      },
      null,
      2,
    )}\n`,
  );
  console.log(`  wrote ${RESULT}\n`);
}
