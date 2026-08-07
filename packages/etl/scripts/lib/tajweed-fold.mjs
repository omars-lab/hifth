/**
 * The fold: the print's per-word text, reconstructed into the string the
 * tajweed offsets are offsets into.
 *
 * This file is the **one copy of that arithmetic**. It was extracted from
 * `probe-tajweed-words.mjs`, whose header is still the place to read *why* the
 * reconstruction is necessary and how each correction was earned; what moved
 * here is only the maths, so that `probe-encodings.mjs` can measure the same
 * fold the probe reports on. Two copies would mean the inspector could show a
 * clean screen for a probe that was failing, which is the one failure a
 * diagnostic tool must not have.
 *
 * The short version of the problem, for a reader who arrives here first:
 * `packages/etl/data/tajweed/tajweed.hafs.uthmani-pause-sajdah.json` gives
 * `{rule, start, end}` as **codepoint offsets into each ayah's Tanzil Uthmani
 * text**. That text is not in this repo and will not be (`morphology.mjs`). The
 * print's own per-word `data-hafs` can be joined back into something the
 * offsets address — but only under corrections, because the print and Tanzil do
 * not agree on what a word is or on how a letter is spelled.
 *
 * ## Two constraints this file is written under, both load-bearing
 *
 * **No imports.** `probe-encodings.mjs` inlines this file's source verbatim
 * into the HTML report it emits, stripping the `export ` keyword and nothing
 * else, so that the toggles in that report recompute with the same bytes the
 * ETL ran. An `import` here would break that, and re-implementing the fold in
 * the report's client script is exactly the duplication this file exists to
 * prevent. That is why `mark` is an input rather than something computed here:
 * classifying a word as a pause mark needs `WAQF` from `lib/mushaf-frame.mjs`,
 * which is a fact about the corpus. The fold is arithmetic over that fact.
 *
 * **Every correction is a toggle.** All seven were discovered the same way — by
 * editing the fold, re-running, and watching an aggregate move — and the last
 * four were found with scratch scripts that should not have had to exist.
 * Making the correction set a parameter rather than an edit is most of what the
 * inspector is for: the eighth will be found the same way, from the report.
 * `on` is a set of ids; absent means off.
 */

/**
 * The corrections, in the order they were found, each with the evidence that
 * earned it. `probe-encodings.mjs` renders this list as the toggle panel, so a
 * correction added here appears in the report with no edit there.
 *
 * `id` is what `fold`'s `on` set holds; `costOf` is prose, not a number the
 * code uses — the number is whatever the report measures today.
 *
 * They come in two kinds, and the difference is not cosmetic. The **structural**
 * three are about how words are *joined*, and each is stated by the corpus
 * itself — the source's own basmala convention, `data-waw-alatf`, the WAQF set.
 * The **orthographic** four are about how a single mark is *spelled*, and none
 * is stated anywhere: each was found by bracketing a residual ayah between its
 * last correct oracle annotation and its first wrong one, and each carries a
 * `respell` — substitutions applied to every word of all 6,236 ayahs, never to
 * the ayahs that motivated them. That universality is the overfitting guard: a
 * rule tuned to its own evidence is punished immediately (see `tatweel-carrier`).
 */
export const CORRECTIONS = [
  {
    id: "basmala",
    kind: "structural",
    title: "prepend the basmala to ayah 1",
    what: "The tajweed source counts the basmala as part of ayah 1 of every surah but al-Fatiha (where it is ayah 1) and at-Tawba (which has none).",
    evidence: "2:1's offsets run to 44 against a reconstruction 5 codepoints long; without it 326 annotations fall past the end of their own ayah, with it 0.",
  },
  {
    id: "waw",
    kind: "structural",
    title: "glue the split conjunction waw to its successor",
    what: "The print sets «وَ» as its own word and numbers it; Tanzil writes it joined. A word carrying the flag takes no space after it.",
    evidence: "The corpus states the split itself — `data-waw-alatf=\"true\"`, always on «وَ» — so this is read, not guessed.",
  },
  {
    id: "marks",
    kind: "structural",
    title: "drop the pause-mark words from the string",
    what: "The print numbers pause and hizb marks as words; the Tanzil text carries none of them. They are dropped from the string, and their word slots keep their numbers.",
    evidence: "The miss histogram clustered on even values and decayed monotonically (0 → 63.4%, +2 → 21.0%, +4 → 7.5%), the signature of one repeated two-codepoint insertion — a mark plus its space. Dropping them took the oracle from 63.4% to 97.0%.",
  },
  {
    id: "tatweel-carrier",
    kind: "orthographic",
    title: "unseat a small high mark from its tatweel",
    respell: [
      [/ـۧ/g, "ۧ"], // U+0640 U+06E7 — SMALL HIGH YEH   (إِبۡرَٰهِـۧمُ, ٱلنَّبِيِّـۧنَ)
      [/ـۨ/g, "ۨ"], // U+0640 U+06E8 — SMALL HIGH NOON  (أَنجِـۨي)
    ],
    what: "The print seats these two marks on a stretch of baseline; the offsets' text counts the mark alone. Only these two carriers, never the tatweel itself.",
    evidence: "172 → 143 residual ayahs on the yeh carrier; the noon carrier is rare enough to close exactly one more, and closes it last (12 → 11). The narrowness is measured, not chosen: stripping EVERY U+0640 takes the oracle down to 94.48%, below doing nothing at all.",
  },
  {
    id: "alef-madda",
    kind: "orthographic",
    title: "spend three codepoints on «أٓ», not two",
    respell: [[/أٓ/g, "ءَا"]], // U+0623 U+0653 → three codepoints of any identity
    what: "ٱلۡأٓخِرَة, ٱلۡأٓيَٰت — two codepoints in the print, three in the offsets' text. What is measured is the length, not the identity: any three-codepoint substitution recovers the alignment.",
    evidence: "The largest of the four — 143 → 60 ayahs on its own. Every implicated word is wholly implicated (ٱلۡأٓخِرَةِ in 41 of the 41 ayahs it appears in) and every bracketing window is bounded on both sides.",
  },
  {
    id: "small-madda",
    kind: "orthographic",
    title: "drop the small high madda «ۤ»",
    respell: [[/ۤ/g, ""]], // U+06E4 — written by the print, absent from the offsets' text
    what: "The print writes it; the indexed text does not.",
    evidence: "60 → 19 ayahs. It clusters on the sajdah ayahs — يَسۡجُدُۤ, ٱسۡجُدُواْۤ, لِلَّهِۤ — which is corroboration rather than coincidence: the source is Tanzil's pause-sajdah edition and marks those places its own way.",
  },
  {
    id: "hamza-below",
    kind: "orthographic",
    title: "drop the hamza below «ٕ» from its seat",
    respell: [[/ٕ/g, ""]], // U+0655 — seat + kasra + hamza-below here, two codepoints there
    what: "شَٰطِيِٕ, إِيتَآيِٕ, ٱللُّؤۡلُوِٕ — the print spends one codepoint more than the offsets count. A length again, not an identity.",
    evidence: "19 → 12 ayahs, the last of the four to be found and the smallest.",
  },
];

/** Every correction id, in order — the default `on` set. */
export const ALL_CORRECTIONS = CORRECTIONS.map((c) => c.id);

/**
 * What each of the eighteen source rules must begin on, and why.
 *
 * This is the only independent evidence that the fold is right — the span
 * arithmetic cannot be, because a subtly wrong reconstruction still produces
 * spans that land inside *some* word. A rule that names a letter can be checked
 * without any word boundary at all.
 *
 * **Every set here was written from tajweed and then measured, never read off
 * the corpus.** That ordering is the whole method: deriving a letter set from
 * where the offsets actually land, and then declaring that the offsets land
 * where the set says, is circular and would pass on a broken fold. Written
 * first, a set is a falsifiable prediction — and `qalqalah` really is exactly
 * قطب جد, `ghunnah` really has no third letter, and there really are only two
 * mutaqaribayn pairs. Each entry carries the tajweed reason it has the shape it
 * has, so the next reader can disagree with the prediction rather than with a
 * number.
 *
 * `near` is a window, not a slop allowance: the two rules that use it are
 * written as a *vowel followed by a mark*, so the characteristic codepoint is
 * one position after the span's start rather than at it. Nothing else may use
 * it — a `near` bought to raise a hit rate is the oracle grading itself.
 *
 * **A high hit rate is not by itself evidence.** {ا, و, ي} covers ~12% of the
 * corpus, so a rule restricted to it would score well on a fold that was wrong.
 * The number that matters is {@link oracleDensity}'s complement — how much of a
 * one-codepoint drift the rule could actually notice — and the probes report it
 * per rule as `sensitivity`. Two of the eighteen are worth knowing about before
 * reading any of their results: `madd_6` needs a fourteen-codepoint set and so
 * sees only ~70% of drifts, and `madd_246`/`madd_munfasil`/`madd_muttasil` sit
 * near 88%. The other fourteen are above 91%.
 */
export const ORACLE = Object.freeze({
  // --- the two that ARE a letter, and were the whole oracle until 2026-08-07
  hamzat_wasl: { letters: "ٱ", why: "the rule is the alef wasla; there is nothing else it can be" },
  lam_shamsiyyah: { letters: "ل", why: "the assimilated lam the rule is named for" },

  // --- closed sets, named by tajweed and short enough to state in full
  qalqalah: { letters: "قطبجد", why: "قطب جد — the five qalqalah letters, a closed mnemonic set" },
  ghunnah: { letters: "نم", why: "a doubled noon or meem; there is no third ghunnah letter" },
  idghaam_shafawi: { letters: "م", why: "meem saakinah into meem — the first is a meem by definition" },
  ikhfa_shafawi: { letters: "م", why: "meem saakinah before beh — the first is a meem by definition" },
  idghaam_mutajanisayn: {
    letters: "دتذثب",
    why: "the first of each articulation-sharing pair (د→ت, ت→ط/د, ذ→ظ, ث→ذ, ب→م)",
  },
  idghaam_mutaqaribayn: { letters: "لق", why: "lam→reh and qaf→kaf, the only two pairs there are" },

  // --- the noon family. A tanween whose noon is not pronounced plainly is
  //     written with a DIFFERENT second mark, so the set is the noon plus those
  //     three marks — which is why these score like a named letter and not like
  //     a vowel.
  ikhfa: { letters: "نٖٗٞ", why: "noon saakinah or tanween; the tanween carries its ikhfa second mark" },
  idghaam_ghunnah: { letters: "نٖٗٞ", why: "noon saakinah or tanween before ينمو" },
  idghaam_no_ghunnah: { letters: "نٖٗٞ", why: "noon saakinah or tanween before ل or ر" },
  iqlab: {
    letters: "ۭۢ",
    near: 1,
    why: "the meem the print writes FOR iqlab — U+06E2 high on a fatha or damma, U+06ED LOW on a kasra. The span opens on the vowel, so the meem sits at start or start+1. Missing the low form scores 85.05%: the second-largest thing this oracle has caught, and it was the oracle catching itself.",
  },

  // --- the madd family. `madd_2` is written with the small madd letters, which
  //     are rare ink; the other three admit the full alef/waw/yeh and pay for it
  //     in sensitivity rather than in hit rate.
  madd_2: { letters: "ٰۥۦۧ", why: "the natural madd is written as a small madd letter in this print" },
  madd_muttasil: { letters: "اويٰۥۦۧ", why: "a madd letter with hamza following in the same word" },
  madd_munfasil: { letters: "اويىٰۥۦۧ", why: "a madd letter ending a word, hamza opening the next" },
  madd_246: { letters: "اويىٰۥۦۧ", why: "madd leen and madd aarid — the same madd letters" },
  madd_6: {
    letters: "اويٰۥۦملسصعقنك",
    why: "madd laazim: a madd letter, OR one of the eight muqatta'a letters whose spelt-out name is three long (نٓ, قٓ, صٓ, عٓ, سٓ, لٓ, كٓ, مٓ). The broadest set here by far, and the one to distrust: it covers 30% of the ayahs it appears in, because those ayahs are the muqatta'a openings and are almost nothing else.",
  },

  // --- the remainder
  silent: { letters: "اوي", why: "an unpronounced alef, waw or yeh" },
});

/**
 * The respeller for one `on` set: the orthographic corrections it enables,
 * composed left to right. None of the four overlaps another, so the order is
 * the table's order and nothing depends on it.
 *
 * A word's *identity* survives a respell and its *width* does not — which is
 * exactly the claim being made, that the two texts spend a different number of
 * codepoints on the same printed mark. Spans are into the respelled string,
 * because that is the string the offsets address.
 */
export function respellerFor(on) {
  const rules = CORRECTIONS.filter((c) => c.respell && on.has(c.id)).flatMap((c) => c.respell);
  if (!rules.length) return (text) => text;
  return (text) => rules.reduce((s, [re, to]) => s.replace(re, to), text);
}

/** Does the tajweed source prefix the basmala to this ayah? */
export function hasBasmala(surah, ayah) {
  return ayah === 1 && surah !== 1 && surah !== 9;
}

/**
 * Join one run of print words into codepoints, and say where each word landed.
 *
 * `words` is `[{ hafs, waw, mark }]` in print-index order — `mark` precomputed
 * by the caller (see the header). Returns `cps` (an array of single-codepoint
 * strings, so `cps[n]` is the codepoint the offsets call `n`) and `spans`,
 * parallel to `words`: `[from, to)` or `null` for a word that contributed
 * nothing to the string.
 *
 * `at` shifts every span, so a run folded after a prefix reports absolute
 * offsets rather than offsets into itself.
 */
export function joinWords(words, on, at = 0) {
  const dropMarks = on.has("marks");
  const glueWaw = on.has("waw");
  const respell = respellerFor(on);
  // The last word that will contribute anything, found once. A lookahead per
  // word would be quadratic, and the report re-folds all 6,236 ayahs every time
  // a toggle moves.
  let last = -1;
  for (let i = 0; i < words.length; i += 1) if (!(dropMarks && words[i].mark)) last = i;

  const cps = [];
  const spans = [];
  for (let i = 0; i < words.length; i += 1) {
    if (dropMarks && words[i].mark) {
      spans.push(null);
      continue;
    }
    const from = at + cps.length;
    for (const ch of respell(words[i].hafs)) cps.push(ch);
    spans.push([from, at + cps.length]);
    // A space unless this word is a split waw, and never a trailing one — which
    // is why `last` skips dropped marks: they are not in the string to be next to.
    if (i < last && !(glueWaw && words[i].waw)) cps.push(" ");
  }
  return { cps, spans };
}

/**
 * The whole reconstruction for one ayah, prefix included.
 *
 * `basmala` is 1:1's word list — the same shape as `words`. It is folded under
 * the same corrections rather than pasted in as a constant, so toggling `marks`
 * or `waw` moves the prefix too and the offsets stay self-consistent.
 *
 * Returns:
 *   `cps`     the reconstructed codepoints, index 0 = tajweed offset 0
 *   `spans`   parallel to `words`; `[from, to)` or null
 *   `hosts`   every `[from, to)` in the string, in order, with the print index
 *             that owns it — `null` for a basmala word, which is ink from
 *             another ayah and has no index here
 *   `prefix`  how many codepoints the basmala contributed, 0 when it did not
 */
export function foldAyah({ surah, ayah, words, basmala, indices, on }) {
  const enabled = on instanceof Set ? on : new Set(on ?? ALL_CORRECTIONS);
  const hosts = [];
  let cps = [];
  let prefix = 0;

  if (enabled.has("basmala") && basmala && hasBasmala(surah, ayah)) {
    const b = joinWords(basmala, enabled, 0);
    for (const s of b.spans) if (s) hosts.push({ print: null, from: s[0], to: s[1] });
    cps = b.cps.concat([" "]); // the basmala, then the space that joins it on
    prefix = cps.length;
  }

  const body = joinWords(words, enabled, prefix);
  cps = cps.concat(body.cps);
  for (let i = 0; i < body.spans.length; i += 1) {
    const s = body.spans[i];
    if (s) hosts.push({ print: indices ? indices[i] : i + 1, from: s[0], to: s[1] });
  }
  return { cps, spans: body.spans, hosts, prefix };
}

// ------------------------------------------------------------- the verdicts --

/**
 * Which hosts a `[start, end)` span overlaps, as indices into `hosts`.
 *
 * Half-open on both sides, so a span that ends exactly where a word begins does
 * not touch it — the difference between "two adjacent words" and "one" for
 * every cross-word rule in the source.
 */
export function touched(hosts, start, end) {
  const out = [];
  for (let i = 0; i < hosts.length; i += 1) {
    if (start < hosts[i].to && end > hosts[i].from) out.push(i);
  }
  return out;
}

/** The four outcomes a span can have. `past-end` is checked before the rest. */
export function touchClass(hosts, start, end, length) {
  if (end > length) return "past-end";
  const t = touched(hosts, start, end);
  if (t.length <= 1) return "one";
  if (t.length === 2 && t[1] === t[0] + 1) return "two-adjacent";
  return "wider";
}

/** How far a search for the expected letter is allowed to run. */
export const DRIFT_LIMIT = 8;

/**
 * Does the rule's letter sit at `i`, allowing for its `near` window?
 *
 * One place, so {@link oracleOf} and {@link oracleDensity} can never disagree
 * about what counts as a hit — which matters, because `sensitivity` is only
 * meaningful if the null is measured with the same predicate as the result.
 */
function satisfiedAt(cps, spec, i) {
  for (let d = 0; d <= (spec.near ?? 0); d += 1) if (spec.set.has(cps[i + d])) return cps[i + d];
  return null;
}

/** The `letters` string of a rule as a Set, memoised — `oracleOf` runs 60,057× per fold. */
const SETS = new Map();
function specOf(rule) {
  const e = ORACLE[rule];
  if (!e) return null;
  if (!SETS.has(rule)) SETS.set(rule, { ...e, set: new Set(e.letters) });
  return SETS.get(rule);
}

/**
 * The oracle, for one annotation. `null` when the rule is not in {@link ORACLE}
 * — which no longer happens for this source's eighteen, but a nineteenth rule
 * in some future edition would land here rather than be silently counted right.
 *
 * `delta` is where the letter actually is, relative to where the offset says it
 * should be: `+1` means the fold ran **long** and pushed the letter one
 * codepoint later than Tanzil counts it; `-1` means the fold ran **short**.
 * `null` means the letter is not within ±8 either way, which is a different
 * finding from a large delta and is kept as its own outcome.
 *
 * `want` is the letter actually found — the one that matched on a hit, or the
 * one standing at `delta` on a near miss. It is `null` only when nothing in the
 * set is within the limit; use {@link oracleLabel} for something printable in
 * every case, since a set of five is not a letter to name.
 */
export function oracleOf(cps, annotation) {
  const spec = specOf(annotation.rule);
  if (!spec) return null;
  const at = annotation.start;
  const here = satisfiedAt(cps, spec, at);
  if (here !== null) return { rule: annotation.rule, want: here, letters: spec.letters, hit: true, delta: 0 };
  for (let x = 1; x <= DRIFT_LIMIT; x += 1) {
    const back = satisfiedAt(cps, spec, at - x);
    if (back !== null) return { rule: annotation.rule, want: back, letters: spec.letters, hit: false, delta: -x };
    const fwd = satisfiedAt(cps, spec, at + x);
    if (fwd !== null) return { rule: annotation.rule, want: fwd, letters: spec.letters, hit: false, delta: x };
  }
  return { rule: annotation.rule, want: null, letters: spec.letters, hit: false, delta: null };
}

/**
 * How much of this ayah would satisfy the rule at a position picked at random —
 * the null the hit rate has to beat.
 *
 * This is the number §9 ③ was missing, and it is what stopped the widening from
 * being self-congratulation. A hit rate says the offsets land on the right
 * letter; it does not say the check could have told you otherwise. {ا, و, ي}
 * covers ~12% of the corpus, so `silent` at 99.86% is worth much less per
 * annotation than `hamzat_wasl` at 99.83%, whose ٱ covers 2.8%.
 *
 * `1 - oracleDensity(...)` is the rule's **sensitivity**: the chance it notices
 * a drift of one codepoint. Summed over annotations and divided by all 60,057
 * it gives an effective coverage, which is the honest headline — the raw
 * "100% of annotations are checked" is true and, on its own, flattering.
 */
export function oracleDensity(cps, rule) {
  const spec = specOf(rule);
  if (!spec || !cps.length) return 0;
  let n = 0;
  for (let i = 0; i < cps.length; i += 1) if (satisfiedAt(cps, spec, i) !== null) n += 1;
  return n / cps.length;
}

/** What the oracle was looking for, printable: one letter, or the set as written. */
export function oracleLabel(o) {
  if (!o) return "";
  return o.want ?? [...o.letters].join("/");
}

/**
 * The shape of a drift, as a groupable string.
 *
 * A miss at `+d` means the reconstruction carries `d` codepoints the offsets do
 * not count; the codepoints sitting in `[start, start+d)` are one candidate for
 * what they are. A miss at `-d` cannot name what is missing (it is in a text
 * this repo does not hold), so the shape is the print's own spelling around the
 * letter instead, which is the half of the difference we do have.
 *
 * **This only explains a divergence adjacent to the annotation, and most are
 * not.** Drift within an ayah turned out to be cumulative and monotone: 166 of
 * the 172 residual ayahs carry exactly one delta across every miss in them, so
 * one codepoint diverges *once*, early, and every annotation after it inherits
 * the offset. For those, the codepoints under `start` are wherever the reader
 * happened to be standing when the bill came due, and grouping by them scatters
 * one cause across forty shapes. {@link driftOnset} is the aggregate that
 * actually localises it; this one is kept because it is the right answer for
 * the first miss when there is no earlier hit to bound it.
 */
export function driftShape(cps, start, delta) {
  if (delta === null) return "∅ no expected letter within ±8";
  if (delta > 0) return cps.slice(start, start + delta).join("");
  const at = start + delta;
  return cps.slice(Math.max(0, at - 1), at + 2).join("");
}

/**
 * Where in the ayah the drift begins: the window between the last annotation
 * the oracle still agreed with and the first one it did not.
 *
 * This is the aggregate that finds corrections. The offsets are cumulative, so
 * a single divergent codepoint anywhere in an ayah pushes every later
 * annotation by the same amount — which means a miss tells you the drift
 * *exists* and a bracketing hit tells you *where*. Everything between them is
 * suspect, and everything outside is cleared.
 *
 * `rows` is `[{ start, delta }]` for the ayah's checkable annotations, in any
 * order; `hosts` and `cps` come from {@link foldAyah}. Returns null when the
 * ayah has no miss. `words` are the print words that lie wholly inside the
 * window — the ones a reader can look at — and the window is left-open at 0
 * when no annotation before the first miss was a hit, which honestly means
 * "somewhere in the first n words" rather than pretending to a bound.
 */
export function driftOnset(rows, hosts, cps) {
  const sorted = [...rows].sort((a, b) => a.start - b.start);
  const miss = sorted.find((r) => r.delta !== 0);
  if (!miss) return null;
  const hit = [...sorted].reverse().find((r) => r.start < miss.start && r.delta === 0);
  const from = hit ? hit.start : 0;
  const to = miss.start;
  return {
    from,
    to,
    delta: miss.delta,
    bounded: Boolean(hit),
    words: hosts
      .filter((h) => h.from >= from && h.to <= to)
      .map((h) => ({ print: h.print, text: cps.slice(h.from, h.to).join("") })),
  };
}

// ------------------------------------------------------------- naming names --

/**
 * Every codepoint the print's `data-hafs` actually uses, named.
 *
 * 71 of them across all 604 pages, plus the space this fold inserts — measured,
 * not guessed, so the table is complete for this corpus and a `?` in the report
 * means the corpus grew a codepoint rather than that the table is thin. Names
 * are the Unicode character names, because "U+06E7" alone does not tell a
 * reader that the thing under the offset is a *small high yeh* and therefore
 * the kind of ink a plain text might not carry.
 */
export const CODEPOINT_NAMES = {
  0x0020: "SPACE",
  0x0621: "ARABIC LETTER HAMZA",
  0x0623: "ARABIC LETTER ALEF WITH HAMZA ABOVE",
  0x0624: "ARABIC LETTER WAW WITH HAMZA ABOVE",
  0x0625: "ARABIC LETTER ALEF WITH HAMZA BELOW",
  0x0626: "ARABIC LETTER YEH WITH HAMZA ABOVE",
  0x0627: "ARABIC LETTER ALEF",
  0x0628: "ARABIC LETTER BEH",
  0x0629: "ARABIC LETTER TEH MARBUTA",
  0x062a: "ARABIC LETTER TEH",
  0x062b: "ARABIC LETTER THEH",
  0x062c: "ARABIC LETTER JEEM",
  0x062d: "ARABIC LETTER HAH",
  0x062e: "ARABIC LETTER KHAH",
  0x062f: "ARABIC LETTER DAL",
  0x0630: "ARABIC LETTER THAL",
  0x0631: "ARABIC LETTER REH",
  0x0632: "ARABIC LETTER ZAIN",
  0x0633: "ARABIC LETTER SEEN",
  0x0634: "ARABIC LETTER SHEEN",
  0x0635: "ARABIC LETTER SAD",
  0x0636: "ARABIC LETTER DAD",
  0x0637: "ARABIC LETTER TAH",
  0x0638: "ARABIC LETTER ZAH",
  0x0639: "ARABIC LETTER AIN",
  0x063a: "ARABIC LETTER GHAIN",
  0x0640: "ARABIC TATWEEL",
  0x0641: "ARABIC LETTER FEH",
  0x0642: "ARABIC LETTER QAF",
  0x0643: "ARABIC LETTER KAF",
  0x0644: "ARABIC LETTER LAM",
  0x0645: "ARABIC LETTER MEEM",
  0x0646: "ARABIC LETTER NOON",
  0x0647: "ARABIC LETTER HEH",
  0x0648: "ARABIC LETTER WAW",
  0x0649: "ARABIC LETTER ALEF MAKSURA",
  0x064a: "ARABIC LETTER YEH",
  0x064b: "ARABIC FATHATAN",
  0x064c: "ARABIC DAMMATAN",
  0x064d: "ARABIC KASRATAN",
  0x064e: "ARABIC FATHA",
  0x064f: "ARABIC DAMMA",
  0x0650: "ARABIC KASRA",
  0x0651: "ARABIC SHADDA",
  0x0652: "ARABIC SUKUN",
  0x0653: "ARABIC MADDAH ABOVE",
  0x0654: "ARABIC HAMZA ABOVE",
  0x0655: "ARABIC HAMZA BELOW",
  0x0656: "ARABIC SUBSCRIPT ALEF",
  0x0657: "ARABIC INVERTED DAMMA",
  0x065e: "ARABIC FATHA WITH TWO DOTS",
  0x0670: "ARABIC LETTER SUPERSCRIPT ALEF",
  0x0671: "ARABIC LETTER ALEF WASLA",
  0x06d6: "ARABIC SMALL HIGH LIGATURE SAD WITH LAM WITH ALEF MAKSURA",
  0x06d7: "ARABIC SMALL HIGH LIGATURE QAF WITH LAM WITH ALEF MAKSURA",
  0x06d8: "ARABIC SMALL HIGH MEEM INITIAL FORM",
  0x06da: "ARABIC SMALL HIGH JEEM",
  0x06db: "ARABIC SMALL HIGH THREE DOTS",
  0x06dc: "ARABIC SMALL HIGH SEEN",
  0x06de: "ARABIC START OF RUB EL HIZB",
  0x06e0: "ARABIC SMALL HIGH UPRIGHT RECTANGULAR ZERO",
  0x06e1: "ARABIC SMALL HIGH DOTLESS HEAD OF KHAH",
  0x06e2: "ARABIC SMALL HIGH MEEM ISOLATED FORM",
  0x06e4: "ARABIC SMALL HIGH MADDA",
  0x06e5: "ARABIC SMALL WAW",
  0x06e6: "ARABIC SMALL YEH",
  0x06e7: "ARABIC SMALL HIGH YEH",
  0x06e8: "ARABIC SMALL HIGH NOON",
  0x06e9: "ARABIC PLACE OF SAJDAH",
  0x06ea: "ARABIC EMPTY CENTRE LOW STOP",
  0x06ec: "ARABIC ROUNDED HIGH STOP WITH FILLED CENTRE",
  0x06ed: "ARABIC SMALL LOW MEEM",
};

/** `"ـ"` → `"U+0640 ARABIC TATWEEL"`. Unknown codepoints keep the hex. */
export function nameOf(ch) {
  if (ch === undefined) return "— (past the end)";
  const cp = ch.codePointAt(0);
  const hex = `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
  const name = CODEPOINT_NAMES[cp];
  return name ? `${hex} ${name}` : hex;
}

/** A window of named codepoints around an offset — the character-level diff. */
export function nameWindow(cps, at, radius = 3) {
  const out = [];
  for (let i = Math.max(0, at - radius); i <= Math.min(cps.length - 1, at + radius); i += 1) {
    out.push({ at: i, ch: cps[i], name: nameOf(cps[i]), focus: i === at });
  }
  return out;
}
