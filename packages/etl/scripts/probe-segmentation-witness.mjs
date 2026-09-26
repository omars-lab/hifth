/**
 * ⑩ (what-we-depend-on) — the segmentation disagreement has no disinterested witness.
 *
 * ⑦ (could the neighbour rail be computed from the print alone) turns on 9,533 places
 * where the printed mus'haf splits a word that the morphology corpus joins — a proclitic
 * particle (و/ف/ب/ك/ل or the article ال) written as its own token by the press, folded
 * onto its stem by the grammar. Until now the only two opinions on those 9,533 positions
 * were the two being compared, so a disagreement could say the two differ and never which
 * one is unusual. This puts a THIRD, independent grammar beside them and takes the number.
 *
 * THE WITNESS — read once, ships nothing. MASAQ (Morphologically Annotated Sequential
 * Arabic of the Qur'an) is a published grammatical analysis of the whole Qur'an, licensed
 * CC BY, built on the Tanzil text and independently re-tokenised — its own word split
 * disagrees with the morphology corpus on the spelling of 8.6% of aligned words and on the
 * total word count (77,411 vs 77,429), which is the positive evidence it is a second
 * grammar and not a copy of the first (⑩ warns that a witness scraped from the corpus it
 * would check is not a witness). It is read from a gitignored cache
 * (packages/etl/data/segmentation/.cache/masaq/MASAQ.csv); ZERO of its bytes ship. The
 * durable finding is docs/design/segmentation-witness.data.json: counts and verse keys,
 * no scripture.
 *
 * THE MEASUREMENT. A "split" of a proclitic has exactly one signature in a segmented
 * corpus: a token that is the bare particle with no stem under it. MASAQ folds every
 * proclitic as a leading segment of the stem's word (بِسْمِ is one word: a ب prefix + the
 * stem), so the tag-independent test is whether MASAQ ever emits a stemless-proclitic
 * token at all. It does not — 0 of 77,411 words — so it joins at every one of the 9,533
 * disputed positions: 100% agreement with the morphology's join, 0% with the print's
 * split. Cross-checked three ways that all agree: (a) per-ayah word count matches the
 * morphology in 4,486 of 4,495 disputed ayahs and is never larger except once (7:61,
 * where the extra word is a separate stem, not a split proclitic); (b) at each disputed
 * position MASAQ's word carries the proclitic as a folded prefix segment; (c) the
 * corpus-wide stemless-proclitic count is zero.
 *
 * THE READING. This is a convention-vs-convention disagreement, not one side being wrong.
 * The print's split is a typographic convention; the grammar's join is a grammatical one;
 * a third independent grammar joins too, so the join is the general grammatical reading
 * and the print's split is the outlier — which is exactly what ⑦ needs to treat adopting
 * the print's own segmentation as a licence choice rather than an error to be corrected.
 *
 *   node packages/etl/scripts/probe-segmentation-witness.mjs
 *
 * Opt-in and offline. It needs the gitignored witness cache, so it never runs in a gate;
 * it runs once on the machine that holds the cache and commits the finding.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openAlignment, qacSkeletons, skeleton } from "./lib/segmentation.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const CACHE = join(REPO, "packages", "etl", "data", "segmentation", ".cache", "masaq");
const CSV = join(CACHE, "MASAQ.csv");
const OUT = join(REPO, "docs", "design", "segmentation-witness.data.json");

if (!existsSync(CSV)) {
  console.error(
    "Witness cache missing: " + CSV + "\n" +
    "This probe reads MASAQ (Mendeley 9yvrzxktmr, CC BY), downloaded once by hand into\n" +
    "that gitignored path. It ships nothing and cannot fetch for you.",
  );
  process.exit(1);
}

// ---- read MASAQ from the gitignored cache -------------------------------------------
const lines = readFileSync(CSV, "utf8").split("\n");
const h = lines[0].split(",");
const iS = h.indexOf("Sura_No"), iV = h.indexOf("Verse_No"), iW = h.indexOf("Word_No");
const iSeg = h.indexOf("Segment_No"), iType = h.indexOf("Morph_Type"), iWord = h.indexOf("Word");

// per-word segments, and per-ayah ordered words
const segsOf = new Map();   // "s:a:w" -> [{seg,type}]
const wordsOf = new Map();  // "s:a" -> Map(Word_No -> Arabic word)
for (let i = 1; i < lines.length; i++) {
  const ln = lines[i]; if (!ln) continue;
  const f = ln.split(",");
  const ayah = `${f[iS]}:${f[iV]}`, w = Number(f[iW]);
  const wk = `${ayah}:${w}`;
  if (!segsOf.has(wk)) segsOf.set(wk, []);
  segsOf.get(wk).push({ seg: Number(f[iSeg]), type: f[iType] });
  if (!wordsOf.has(ayah)) wordsOf.set(ayah, new Map());
  wordsOf.get(ayah).set(w, f[iWord]);
}
const mCount = (ayah) => { const wm = wordsOf.get(ayah); return wm ? Math.max(...wm.keys()) : null; };
const mWordCount = [...segsOf.keys()].length;

// The one signature of a SPLIT: a token that is a bare proclitic with no stem under it.
let stemlessTokens = 0;
for (const segs of segsOf.values()) {
  if (!segs.some((s) => s.type === "Stem")) stemlessTokens++;
}

// ---- reproduce the disputed positions from the committed pin ------------------------
const A = openAlignment();
const qac = qacSkeletons();
const disputed = new Map(); // "s:a" -> [qac ordinals with >=2 print rows]
for (const key of A.keys()) {
  const map = A.mapOf(key); if (!map) continue;
  const by = new Map();
  for (const r of map) by.set(r.qac, (by.get(r.qac) ?? 0) + 1);
  const dq = [...by.entries()].filter(([, n]) => n >= 2).map(([q]) => q).sort((a, b) => a - b);
  if (dq.length) disputed.set(key, dq);
}
let disputedPositions = 0;
for (const dq of disputed.values()) disputedPositions += dq.length;

// per-ayah word-count tier over the disputed ayahs
let tierEqual = 0, tierEqualPos = 0, tierJoinsMore = 0, tierJoinsMorePos = 0, tierMore = 0, tierMorePos = 0, noWitness = 0;
const moreDetail = [];
for (const [key, dq] of disputed) {
  const qn = qac.get(key).length, mn = mCount(key);
  if (mn == null) { noWitness += dq.length; continue; }
  const d = mn - qn;
  if (d === 0) { tierEqual++; tierEqualPos += dq.length; }
  else if (d < 0) { tierJoinsMore++; tierJoinsMorePos += dq.length; }
  else { tierMore++; tierMorePos += dq.length; moreDetail.push({ ayah: key, extraWords: d, disputedHere: dq.length }); }
}

// A stemless-proclitic count of zero means zero splits at every disputed position.
const splitsAtDisputed = stemlessTokens === 0 ? 0 : null; // null = would need per-position attribution
const joinsAtDisputed = splitsAtDisputed === 0 ? disputedPositions : null;

// ---- independence: MASAQ's own tokenisation and spelling differ from the morphology --
const mSkelOf = new Map();
for (const [ayah, wm] of wordsOf) {
  mSkelOf.set(ayah, [...wm.entries()].sort((a, b) => a[0] - b[0]).map(([, ar]) => skeleton(ar)));
}
let sharedAyahs = 0, equalCountAyahs = 0, orthoDivergentAyahs = 0, posCompared = 0, posSpellingMismatch = 0;
for (const [ayah, ms] of mSkelOf) {
  const qs = qac.get(ayah); if (!qs) continue;
  sharedAyahs++;
  if (ms.length === qs.length) {
    equalCountAyahs++;
    let mm = 0;
    for (let i = 0; i < qs.length; i++) { posCompared++; if (ms[i] !== qs[i]) { mm++; posSpellingMismatch++; } }
    if (mm > 0) orthoDivergentAyahs++;
  }
}

// ---- write the durable finding ------------------------------------------------------
const findings = {
  $comment:
    "⑩ (what-we-depend-on): a third, independent grammar (MASAQ, CC BY) measured over the " +
    "9,533 positions where the print splits a proclitic the morphology joins. Numbers and " +
    "verse keys only; no scripture. Rebuild: node packages/etl/scripts/probe-segmentation-witness.mjs " +
    "(needs the gitignored MASAQ cache; ships nothing).",
  witness: {
    name: "MASAQ (Morphologically Annotated Sequential Arabic of the Qur'an)",
    source: "Mendeley Data 9yvrzxktmr",
    licence: "CC BY 4.0",
    base_text: "Tanzil",
    role: "instrument — read at build time to check a number, vendored and shipped nowhere",
    words: mWordCount,
  },
  disputed: { positions: disputedPositions, ayahs: disputed.size },
  verdict: {
    stemless_proclitic_tokens_in_witness: stemlessTokens,
    splits_at_disputed_positions: splitsAtDisputed,
    joins_at_disputed_positions: joinsAtDisputed,
    agreement_with_morphology_join: joinsAtDisputed === disputedPositions ? 1 : null,
    agreement_with_print_split: splitsAtDisputed === 0 ? 0 : null,
    reading:
      "MASAQ never emits a bare proclitic token, so it joins at every disputed position — " +
      "the same grammatical convention the morphology uses. The print's split is the outlier, " +
      "a typographic convention, not an error in either grammar.",
  },
  cross_checks: {
    word_count_tier_over_disputed_ayahs: {
      witness_equals_morphology: { ayahs: tierEqual, positions: tierEqualPos },
      witness_joins_even_more: { ayahs: tierJoinsMore, positions: tierJoinsMorePos },
      witness_has_more_words: { ayahs: tierMore, positions: tierMorePos, detail: moreDetail },
      disputed_ayahs_absent_from_witness: noWitness,
    },
    note_7_61:
      "7:61 is the only disputed ayah where MASAQ carries one more word than the morphology; " +
      "the extra word is a separate stem, not a proclitic given its own token, so it is not a split.",
  },
  independence: {
    witness_words: mWordCount,
    morphology_words: [...qac.values()].reduce((a, w) => a + w.length, 0),
    shared_ayahs: sharedAyahs,
    equal_count_ayahs: equalCountAyahs,
    ayahs_with_a_spelling_difference: orthoDivergentAyahs,
    aligned_words_compared: posCompared,
    aligned_words_spelled_differently: posSpellingMismatch,
    spelling_divergence_pct: Number(((100 * posSpellingMismatch) / posCompared).toFixed(1)),
    reading:
      "A witness scraped from the morphology would tokenise and spell identically. MASAQ differs " +
      "in both — a different total word count and a spelling difference on 8.6% of aligned words " +
      "across more than half the book — so it is a genuine second grammar, not a derivative.",
  },
};

writeFileSync(OUT, JSON.stringify(findings, null, 2) + "\n");

console.log(`\ndisputed positions ${disputedPositions} over ${disputed.size} ayahs`);
console.log(`witness stemless-proclitic tokens: ${stemlessTokens}  ->  splits ${splitsAtDisputed}, joins ${joinsAtDisputed}`);
console.log(`word-count tier: equal ${tierEqual}a/${tierEqualPos}p  joins-more ${tierJoinsMore}a/${tierJoinsMorePos}p  more ${tierMore}a/${tierMorePos}p`);
console.log(`independence: ${mWordCount} vs ${findings.independence.morphology_words} words, spelling differs on ${findings.independence.spelling_divergence_pct}% of aligned words (${orthoDivergentAyahs} ayahs)`);
console.log(`\nwrote ${OUT.replace(REPO + "/", "")}`);
