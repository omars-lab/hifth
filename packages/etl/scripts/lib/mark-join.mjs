/**
 * The join from a codepoint to the path the print drew for it.
 *
 * `lib/diacritics.mjs` reads the marks out of a page: rectangles with names,
 * grouped by word and by the ligature inside it. It stops there deliberately —
 * its own header says a caller "does its own arithmetic". This file is that
 * arithmetic, extracted once so there is exactly one of it.
 *
 * Three steps, and each was measured before it was written down.
 * `probe-diacritics.mjs` is where to read *why* each has the shape it has; its
 * ④ and ⑤ are the evidence, and what moved here is only the maths.
 *
 * 1. **{@link letters}** — a word's `data-hafs` as the letters the print draws
 *    an outline for, each carrying the codepoints written on it.
 * 2. **{@link align}** — which ligature draws which run of those letters. This
 *    is the only join the corpus offers between a mark and a codepoint, and ④
 *    reports it holding for 86,962 of 86,965 lettered words.
 * 3. **{@link DRAWN_NAME} + {@link pairMarks}** — which *drawn path* answers to
 *    which written codepoint. ⑤ recovered the dictionary by elimination and
 *    validated it on 62,931 runs it was never shown.
 *
 * ## Why this is a lib and not more of the probe
 *
 * Two callers, the same reason `tajweed-fold.mjs` gives about itself. The probe
 * derives the dictionary from the corpus and checks it; `probe-encodings.mjs`
 * *uses* it, to ask whether a tajweed span opens on a codepoint the print drew
 * a mark for and to put that mark's rectangle on a screen. If the inspector's
 * join and the probe's join were two implementations, a clean screen would stop
 * being evidence about the probe — which is the one failure a diagnostic tool
 * must not have.
 */
import { diacriticName } from "@hifth/core";

/**
 * A word's `data-hafs` as the letters the print draws an *outline* for, each
 * carrying the codepoints written on it: `بِسْمِ` → `[ب:[ِ], س:[ْ], م:[ِ]]`.
 *
 * Two Unicode categories are not outlines and fold into the letter before them:
 *
 * - **`\p{Mn}`**, the combining marks. Obvious, and the reason this exists.
 * - **`\p{Lm}`**, the modifier letters — and this one is the whole reason ④'s
 *   first draft disagreed. Three of them occur in this text: the tatweel
 *   `U+0640` that seats a hamza in `شَيۡـٔٗا`, and the small waw `U+06E5` and
 *   small yeh `U+06E6` of `بِهِۦ`. The text calls all three letters. The print
 *   does not: the tatweel is drawn as a tooth folded into its neighbour's
 *   ligature, and the two small letters are drawn as `data-diacritic="small
 *   waw"` and `"small yeh"` — named marks, sitting in `DIACRITICS` beside the
 *   fatha. Counting them as base letters made the partition off by one for
 *   every word containing a seated hamza.
 *
 * Both rules are Unicode's own categories rather than a codepoint list this
 * repo maintains, because a list would be a third place with an opinion about
 * Arabic marks and would drift from the other two.
 *
 * `at` is the **codepoint** index into `hafs`, on both the letter and each mark,
 * and it is the whole reason a tajweed offset can reach a rectangle: the offsets
 * count codepoints, and so does this. It is carried rather than recomputed
 * because folding a `\p{Lm}` into its neighbour destroys the correspondence and
 * a caller that tried to recover it would be guessing.
 *
 * The class is `const` and shared with `align`, which has to fold a ligature's
 * `data-text` by exactly the same rule for the two to be comparable at all.
 * `FOLD` tests one character and `FOLDS` strips a run; they are the same class
 * written once, because two copies of it would be the drift this paragraph is
 * about.
 */
const FOLD_CLASS = "[\\p{Mn}\\p{Lm}]";
const FOLD = new RegExp(FOLD_CLASS, "u");
const FOLDS = new RegExp(FOLD_CLASS, "gu");

export function letters(hafs) {
  const out = [];
  let at = 0;
  for (const c of hafs) {
    if (FOLD.test(c) && out.length) out[out.length - 1].marks.push({ ch: c, at });
    else out.push({ letter: c, at, marks: [] });
    at += 1;
  }
  return out;
}

/**
 * A hamza form written as one codepoint, and the carrier it is written on.
 *
 * Two separate facts live here, and conflating them cost a pass of the corpus.
 *
 * **The print always draws the sign.** `أ` gets a `hamza` path, `ٱ` a `wasla`
 * path, every time, in all 9,168 and 13,476 places they occur. The ligature's
 * own spelling does *not* decide it: «أَنَّ» on p119 is drawn `[أ | ن]` and the
 * first ligature still carries `hamza` then `fatha`. Making the expectation
 * conditional on the ligature spelling the bare carrier — which a first reading
 * of «أَيۡدِيهِمۡ» seemed to show — put 151 words on seven pages into the
 * residual, and the markup dump said plainly why.
 *
 * **The spelling still matters for matching.** `align` compares a ligature's
 * `data-text` to the word's letters, and the two disagree about the carrier: a
 * ligature may spell `ا` where the word writes `أ`. So `base()` folds a hamza
 * form to its carrier for that comparison only, and never for what the print
 * is expected to draw.
 *
 * The bare hamza `ء` `U+0621` is deliberately absent: with no carrier to sit
 * on it is drawn as `data-type="text"` like any other letter, always.
 */
const HAMZA_ON = { آ: "ا", أ: "ا", إ: "ا", ٱ: "ا", ؤ: "و", ئ: "ي" };

/** The letter under a hamza form, for matching a ligature's text to the word's. */
const base = (c) => HAMZA_ON[c] ?? c;

/** A short vowel or a tanween — the thing an iqlab meem merges into. */
const VOWEL = /[ً-ِٗٞ]/;

/**
 * The iqlab meem, which the print never draws on its own beside a vowel — both
 * of the forms this text uses. `كَافِرِۭ` writes the final form `U+06ED` and
 * `رِكۡزَۢا` the isolated `U+06E2`; the print composes either with the vowel
 * before it into one `kasra iqlab` / `fatha iqlab` glyph.
 */
const IQLAB = /[ۭۢ]/;

/**
 * The tatweel. It folds like a mark, because the print does not give it a
 * ligature of its own — but unlike the small waw and small yeh it folds beside,
 * it is drawn as part of the neighbouring outline (the tooth that seats a hamza in
 * `شَيۡـٔٗا`), not as a named path. So it is invisible to the partition on both
 * sides: not a letter, and not a mark either.
 */
const TATWEEL = "ـ";

/**
 * `U+06E4`, the small high madda — which in this print is not a mark at all.
 *
 * Every word carrying it sits in a sajda ayah (13:15, 17:107, 19:58 …) and the
 * print draws it as `data-type="sajda-line"`: the overline stretched above the
 * phrase a reader prostrates at, not a diacritic over a letter. It has no
 * `data-diacritic`, so `readDiacritics` never sees it, and expecting one for it
 * was counting a rubric as a vowel.
 */
const SAJDA_LINE = "ۤ";

/**
 * `U+0653` on a `أ` — the one place the print refuses its own `maddah`.
 *
 * Every other carrier of a combining madda gets a path named `maddah`: the alef
 * of «بِمَآ», the yeh of «فِيٓ», the waw of «قَالُوٓاْ», nineteen letters in all,
 * 4,682 paths. The hamza-carrying alef gets one **277 times out of 277 and never
 * a `maddah`** — the print draws a stroke it names `fatha`, and the outline
 * bears that out: measured against an ordinary fatha on the same line it is a
 * shortened version of the same curve (median 0.89×, p5 0.72×), not the maddah's
 * hooked wave, which is drawn at one constant width throughout the corpus.
 *
 * Whether that is the madda rendered short or a fatha standing in for it is a
 * question about the print's intent, and this file does not have to answer it:
 * one codepoint, one path, and ⑤ pins which. It is given a token of its own only
 * so that the relation stays a *function*, which is what makes ⑤'s arithmetic
 * work — without it `U+0653` maps to two names and arc consistency correctly
 * reports a contradiction rather than a dictionary.
 */
const MADDA = "ٓ";
const MADDA_ON_HAMZA = "أ";

const cp = (c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;

/** Does a token name a vowel? `parseInt` stops at the `+` or `@` of a suffix. */
const isVowel = (token) => VOWEL.test(String.fromCodePoint(parseInt(token.slice(2), 16)));

/**
 * The *tokens* of a letter — one per named path the print is expected to draw,
 * in the order the text writes them, each with the codepoint index it came from.
 *
 * A token is usually just a codepoint, `"U+064E"`. Two carry context, because
 * the print composes and the composite has a name of its own:
 *
 * - `"U+064E+iqlab"` — `DIACRITICS` carries `fatha iqlab`, `kasra iqlab` and
 *   `damma iqlab` as names in their own right, so where the text writes a vowel
 *   followed by `ۭ` the print draws a single glyph: «كَافِرِۭ» is two paths on
 *   `فر`, not three. Its `[at, at+len)` spans **both** codepoints, because one
 *   rectangle is the answer for either of them.
 * - `"U+0653@hamza"` — see `MADDA_ON_HAMZA` above.
 *
 * The hamza or wasla sign comes first where the letter is a hamza form, because
 * that is the order the text writes it in, and it takes the *letter's* own index
 * — the sign is not written separately, so the codepoint that asks for it is the
 * carrier. The print often disagrees about the order — «أَنَّ» draws `hamza` then
 * `fatha` but «ٱلۡمَلَؤُاْ» draws `damma` then `hamza` — and that disagreement is
 * not swept up here: ④ compares counts and is blind to it, ⑤ measures it, and
 * {@link pairMarks} never depends on it.
 *
 * Excluded are the two codepoints the print draws by other means: the tatweel's
 * tooth, folded into a neighbour, and the sajda overline.
 */
export function expected(l) {
  const out = [];
  if (HAMZA_ON[l.letter]) out.push({ token: cp(l.letter), at: l.at, len: 1 });
  for (const m of l.marks) {
    if (m.ch === TATWEEL || m.ch === SAJDA_LINE) continue;
    const prev = out[out.length - 1];
    if (IQLAB.test(m.ch) && prev && isVowel(prev.token)) {
      prev.token += "+iqlab";
      prev.len = m.at - prev.at + 1;
      continue;
    }
    out.push({
      token: m.ch === MADDA && l.letter === MADDA_ON_HAMZA ? `${cp(m.ch)}@hamza` : cp(m.ch),
      at: m.at,
      len: 1,
    });
  }
  return out;
}

/**
 * Assign each ligature the letters it draws, or `null` if no assignment exists.
 *
 * The obvious implementation — walk the ligatures in document order, handing
 * each the next `text.length` letters — is what ④'s previous draft did, and it
 * is wrong in two ways the markup shows plainly:
 *
 * **Document order is not reading order.** «ٱلرَّحِيمِ» on p379 is drawn as
 * `[لر | حيم | ٱ]`: the alef wasla is a separate ligature emitted *last*. Six
 * letters, six drawn, so a length check passes — and then every mark is
 * assigned to the wrong letter while the totals still balance. That is the
 * failure mode this whole file exists to catch, and counting alone cannot see
 * it.
 *
 * **A letter can be drawn twice.** «فَلَا» is `[فلا | ا]` — four letters drawn
 * for a three-letter word, because the print puts the alef's stroke in a second
 * ligature. Those continuation runs carry no marks of their own, which is what
 * makes them safe to recognise: a repeat that carried marks would be a
 * different phenomenon and would still fail here.
 *
 * So this matches on **content** rather than length, over `base()` so that a
 * ligature spelling `ا` matches a word writing `أ`. A ligature may take the
 * next letters, or re-draw letters already taken if it has no marks. The search
 * is a DFS over (position, set of ligatures used) with memoisation; words have
 * a handful of ligatures, so the state space is tiny.
 *
 * Both sides are reduced the same way, which is the only thing that makes the
 * comparison meaningful: `letters` folds a `\p{Lm}` into the letter before it,
 * so a ligature's `data-text` has to be folded too. It carries the tatweel —
 * «مَـَٔابٗا» is drawn `[مـا | با]`, tatweel and all — and leaving it in made
 * ten seated-hamza words on the last two juz look unassignable when they are
 * simply spelt with the tooth the print draws them with.
 *
 * Matching on content is strictly stronger than the length check it replaces —
 * some words that used to pass the partition now fail it, and that is the point.
 */
export function align(ls, ligs) {
  const target = ls.map((l) => base(l.letter)).join("");
  const texts = ligs.map((l) => [...l.text.replace(FOLDS, "")].map(base));
  const all = (1 << ligs.length) - 1;
  const memo = new Map();

  const go = (pos, used) => {
    if (pos === target.length && used === all) return [];
    const key = pos * (all + 1) + used;
    if (memo.has(key)) return memo.get(key);
    let out = null;
    for (let i = 0; i < ligs.length && !out; i += 1) {
      if (used & (1 << i)) continue;
      const t = texts[i];
      const fits = (from) => from >= 0 && t.every((c, j) => target[from + j] === c);
      if (pos + t.length <= target.length && fits(pos)) {
        const rest = go(pos + t.length, used | (1 << i));
        if (rest) out = [{ lig: i, from: pos, to: pos + t.length }, ...rest];
      }
      if (!out && !ligs[i].marks.length && fits(pos - t.length)) {
        const rest = go(pos, used | (1 << i));
        if (rest) out = [{ lig: i, from: pos - t.length, to: pos, redraw: true }, ...rest];
      }
    }
    memo.set(key, out);
    return out;
  };
  return go(0, 0);
}

// ----------------------------------------------------- which mark is which --

/**
 * What the print draws for each codepoint the text writes — thirty-four tokens,
 * each pinned to exactly one name.
 *
 * **This table is a result, not a premise.** It was recovered by
 * `probe-diacritics.mjs` ⑤ from 152,101 ligatures whose mark counts agree, by
 * arc consistency over bipartite matchings: a pairing is deleted only when no
 * perfect one-to-one assignment of a run's token-bag to its name-bag can use it,
 * so nothing here rests on the order the print happens to emit its paths in. The
 * fixpoint arrives in two passes with 34 of 34 tokens pinned and none left open,
 * and it predicts the drawn name on **62,931 of 62,931** single-mark runs that
 * were held out of the propagation. `docs/design/sub-word-marks.md` §⑤ is the
 * write-up.
 *
 * It is frozen here rather than re-derived per caller because the derivation
 * needs the whole 380 MB cache and two minutes, and a tool that draws one page
 * cannot pay that. The guard against the copy going stale is that ⑤ still
 * derives it every run and **fails** if the two disagree — so this table cannot
 * quietly drift from the corpus it describes, and a corpus that changed its mind
 * about a codepoint is a loud error rather than a wrong rectangle.
 *
 * `U+0653` appearing twice is the one convention in the print where a
 * codepoint's drawn name depends on the letter under it; see `MADDA_ON_HAMZA`.
 */
export const DRAWN_NAME = Object.freeze({
  "U+0623": "hamza", //             أ  alef with hamza above
  "U+0624": "hamza", //             ؤ  waw with hamza above
  "U+0625": "hamza", //             إ  alef with hamza below
  "U+0626": "hamza", //             ئ  yeh with hamza above
  "U+064B": "fathatan",
  "U+064C": "dammatan",
  "U+064D": "kasratan",
  "U+064E": "fatha",
  "U+064E+iqlab": "fatha iqlab", // the composed glyph, not two paths
  "U+064F": "damma",
  "U+064F+iqlab": "damma iqlab",
  "U+0650": "kasra",
  "U+0650+iqlab": "kasra iqlab",
  "U+0651": "shadda",
  "U+0652": "rounded zero", //      the print's sukun-of-silence, drawn as a ring
  "U+0653": "maddah",
  "U+0653@hamza": "fatha", //       the one carrier-dependent name in the table
  "U+0654": "hamza",
  "U+0655": "hamza",
  "U+0656": "successive kasratan",
  "U+0657": "successive fathatan",
  "U+065E": "successive dammatan",
  "U+0670": "superscript alef",
  "U+0671": "wasla",
  "U+06DC": "small seen",
  "U+06E0": "rectangular zero",
  "U+06E1": "sukun",
  "U+06E2": "small meem",
  "U+06E5": "small waw",
  "U+06E6": "small yeh",
  "U+06E7": "small yeh",
  "U+06E8": "small noon",
  "U+06EA": "vowel sign",
  "U+06EC": "vowel sign",
});

/**
 * Which drawn path answers to which token, inside one ligature.
 *
 * `tokens` is {@link expected}'s output for the letters the ligature draws, in
 * written order; `marks` is the ligature's paths as `readDiacritics` returns
 * them, `[id, x, y, w, h]`, in document order. Returns indices into `marks`
 * parallel to `tokens`, or `null` if the two bags do not match — which for a
 * count-agreeing ligature cannot happen unless {@link DRAWN_NAME} has gone
 * stale, and is exactly what a caller should refuse to draw through.
 *
 * **Position is not used to pair.** The dictionary names every token, so a
 * ligature whose tokens name distinct paths is settled outright and the print's
 * emission order is irrelevant — which matters, because ⑤ measured that order
 * disagreeing with the text's on 1.36% of multi-mark runs.
 *
 * A tie is the only place anything is assumed: two tokens in one ligature that
 * name the *same* path — a `U+0653@hamza` fatha beside a real fatha, say. The
 * tiebreak is **geometry, not document order**: Arabic is set right to left, so
 * among paths sharing a name the rightmost is the one the text writes first.
 * That is an independent signal rather than a restatement of the question, and
 * `probe-diacritics.mjs` ⑤ reports how often the two orders disagree.
 */
export function pairMarks(tokens, marks) {
  const byName = new Map();
  marks.forEach((m, i) => {
    const n = diacriticName(m[0]);
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(i);
  });
  for (const list of byName.values()) list.sort((a, b) => marks[b][1] - marks[a][1]);

  const cursor = new Map();
  const out = [];
  for (const t of tokens) {
    const want = DRAWN_NAME[t.token];
    const list = want === undefined ? undefined : byName.get(want);
    const k = cursor.get(want) ?? 0;
    if (!list || k >= list.length) return null;
    cursor.set(want, k + 1);
    out.push(list[k]);
  }
  return out;
}

/**
 * Every codepoint of one word that the print drew a named path for, with the
 * path. The whole file in one call, and the only entry point a caller needs.
 *
 * `word` is one entry from `readDiacritics` — `{ hafs, ligatures, marks }`.
 * Returns `[{ at, len, token, name, mark }]` sorted by `at`, where `mark` is the
 * `[id, x, y, w, h]` the print drew and `[at, at+len)` is the codepoint range
 * into `hafs` that asks for it. `at` counts **codepoints**, which is what the
 * tajweed offsets count.
 *
 * Returns `null` — never a partial answer — when the word does not join: no
 * assignment of ligatures to letters exists, a ligature's mark count disagrees,
 * or a bag does not pair. Those are ④'s and ⑤'s residual, three words in 86,965
 * and a stale dictionary respectively, and a caller that drew through them would
 * be putting a rectangle under a codepoint that did not ask for it — the exact
 * off-by-one this repo has already shipped once.
 */
export function markPaths(word) {
  const ls = letters(word.hafs);
  const plan = align(ls, word.ligatures);
  if (!plan) return null;

  const out = [];
  for (const step of plan) {
    if (step.redraw) continue; // a second stroke of a letter already drawn, markless by construction
    const lig = word.ligatures[step.lig];
    const tokens = ls.slice(step.from, step.to).flatMap(expected);
    if (tokens.length !== lig.marks.length) return null;
    if (!tokens.length) continue;
    const pairing = pairMarks(tokens, lig.marks);
    if (!pairing) return null;
    tokens.forEach((t, i) => {
      out.push({ at: t.at, len: t.len, token: t.token, name: DRAWN_NAME[t.token], mark: lig.marks[pairing[i]] });
    });
  }
  return out.sort((a, b) => a.at - b.at);
}
