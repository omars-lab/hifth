#!/usr/bin/env node
/**
 * Measure the sub-word layer before anything ships it.
 *
 * The user's question was whether Hifth can highlight *part* of a word — a
 * tanween, a shadda, a superscript alef — and `packages/core/src/skins.ts` has
 * said since Loop 6a that it cannot, because "its glyphs are anonymous outlined
 * `<path>`s". That is true of `assets/pages/**`, which is what the app draws.
 * It is false of the ligature corpus, which names every mark it draws in a
 * `data-diacritic` attribute — and this probe is how that gets established with
 * a number rather than asserted from a grep.
 *
 * It ships nothing. `build-words.mjs` will emit the shards when there is a
 * caller for them (mark-C); this runs first because the honest order is to find
 * out whether the boxes are trustworthy before paying two megabytes to send
 * them to a phone.
 *
 * ## The four questions, and why these four
 *
 * **① Does the vocabulary hold?** Every `data-diacritic` value in the corpus
 * must be one `@hifth/core` knows. `readDiacritics` throws otherwise, so this
 * is really asking whether the twenty-six names in `DIACRITICS` are all of
 * them — a claim that can only be made by reading all 604 pages, which is what
 * this does.
 *
 * **② Does every mark stay inside its own word?** This is the load-bearing one.
 * A word's shipped box is `union(pathBBox)` over *every* path in the word,
 * marks included, so containment holds exactly before rounding. That makes an
 * escape impossible for geometric reasons and possible only for alignment
 * reasons: a mark filed under the wrong word. It is the same failure mode as
 * the off-by-one that made 47.8% of hop edges wrong, and it is worth measuring
 * against the *committed* shards rather than against boxes computed in the same
 * pass — otherwise both sides share a mistake and agree about it.
 *
 * **③ What would it weigh?** Because that decides whether mark-C is a decision
 * or a formality. Measured as the shard text `build-words.mjs` would write, not
 * estimated from a path count.
 *
 * **④ Can a mark be tied to a letter?** ① and ② together say the boxes are
 * real and filed under the right *word*. They say nothing about *which letter*
 * a mark sits on, and a tajweed rule is a `[start, end)` over codepoints — so
 * without a letter-level join the app can highlight a rule no finer than the
 * whole word, which for «بِسْمِ ٱللَّهِ» is most of the line.
 *
 * The corpus's only offer is the ligature: `<g id="md-ligature-…">` names the
 * letters it draws in `data-text` and nests the marks drawn on them. ④ checks
 * whether that join holds, by partitioning `data-hafs` into base letters and
 * their combining marks, walking the ligatures across that partition, and
 * comparing counts. **Every failure is bucketed by cause and counted**, because
 * a single percentage here would be a lie of composition: the check is layered,
 * and a word that fails the letter partition never reaches the mark comparison,
 * so quoting the mark agreement alone quietly conditions it on a filter.
 *
 * ④ is a measurement and does not affect the exit code. It is describing a
 * property of somebody else's file, not asserting one about ours.
 *
 * ## Where the residual went, and why it stops at three
 *
 * ④ was chased to 100% on request, and the interesting part is that it got
 * there without a single rule invented to make it. Every rule in `letters`,
 * `expected` and `align` below was added because a markup dump showed the print
 * doing something, and each is stated with the word that demonstrated it — the
 * seated hamza on «أَنَّ», the sajda overline on «خَرُّواْۤ», the second alef
 * stroke of «فَلَا», the out-of-order `ٱ` in «ٱلرَّحِيمِ», the tatweel inside
 * «مَـَٔابٗا»'s `data-text`. That order matters: a rule added to move a number
 * would make ④ agree with the corpus by construction, which is precisely the
 * property that would stop it from being evidence.
 *
 * Three of 86,965 entries remain, and they are named here rather than absorbed
 * because neither is a convention — both are the corpus disagreeing with
 * itself, and a rule for either would be a rule for one word:
 *
 * - **p324 21:28#4 and p341 22:76#4, «أَيۡدِيهِمۡ».** The word occurs 26 times.
 *   Twenty-four draw `hamza, fatha, sukun, kasra, kasra, sukun`; these two draw
 *   the same list without the `hamza`. Same spelling, same marks otherwise.
 * - **p282 17:7#15, «لِيَسُـُٔواْ».** The print draws a `small waw` and a
 *   `maddah` for which its own `data-hafs` has no codepoint. It is the only word
 *   in the corpus where a `small waw` path appears without a `U+06E5`.
 *
 * Neither costs us anything downstream: ② is what decides whether the geometry
 * is shippable, and ② is exact.
 *
 * ## What it deliberately does not check
 *
 * Whether a mark is on the *right* letter. ④ can show that a ligature drawing
 * three letters carries the three marks those letters call for; it cannot show
 * that the second mark is over the second letter and not the third. Counts are
 * necessary and not sufficient, and nothing offline closes that gap — it is a
 * correspondence between a codepoint in a reconstructed text and an outline on
 * a page, and only an eye closes it. That check belongs to the encoding
 * inspector (mark-B), where a human sees the boxes on the page beside the three
 * other encodings.
 *
 * Usage:
 *   pnpm --filter @hifth/etl probe:diacritics
 *   pnpm --filter @hifth/etl probe:diacritics --pages 1,2,7
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { DIACRITICS, diacriticName } from "@hifth/core";

import { candidatePage } from "./lib/candidate-pages.mjs";
import { applierFromPin, readDiacritics } from "./lib/diacritics.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const PIN = join(HERE, "..", "data", "pages", "word-boxes.pin.json");
const WORDS = join(REPO, "apps", "web", "public", "assets", "words", "hafs-kfqc");

const argv = process.argv.slice(2);
const only = (() => {
  const i = argv.indexOf("--pages");
  return i < 0 ? null : argv[i + 1].split(",").map(Number);
})();

/**
 * How far outside its word's box a mark may sit, in viewBox units.
 *
 * Rounding only. Both boxes are written to one decimal, so each edge can move
 * 0.05 and the two can move in opposite directions — 0.1 is the arithmetic
 * bound and 0.2 is that with one decimal place of slack. It is deliberately not
 * a tolerance for misregistration: there is nothing to misregister, because
 * both boxes come out of the same fit applied to paths from the same file.
 */
const SLACK = 0.2;

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
 * The class is `const` and shared with `align`, which has to fold a ligature's
 * `data-text` by exactly the same rule for the two to be comparable at all.
 * `FOLD` tests one character and `FOLDS` strips a run; they are the same class
 * written once, because two copies of it would be the drift this paragraph is
 * about.
 */
const FOLD_CLASS = "[\\p{Mn}\\p{Lm}]";
const FOLD = new RegExp(FOLD_CLASS, "u");
const FOLDS = new RegExp(FOLD_CLASS, "gu");

function letters(hafs) {
  const out = [];
  for (const c of hafs) {
    if (FOLD.test(c) && out.length) out[out.length - 1].marks.push(c);
    else out.push({ letter: c, marks: [] });
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
 * Which codepoints of a letter the print draws a *named* path for, in order.
 *
 * The hamza or wasla sign comes first where the letter is a hamza form, because
 * that is the order the print draws it in: «أَنَّ» is `hamza` then `fatha`. It
 * is not universal — «ٱلۡمَلَؤُاْ» draws `damma` before the `hamza` on its `ؤ` —
 * and ④ compares counts, so the two disagree without failing. §⑦ of
 * `sub-word-marks.md` is about exactly that gap.
 *
 * The marks follow, minus the two the print draws by other means (the tatweel's
 * tooth, the sajda overline) and with one merge: `DIACRITICS` carries `fatha
 * iqlab`, `kasra iqlab` and `damma iqlab` as names in their own right, so where
 * the text writes a vowel followed by `ۭ` the print draws a single composite
 * glyph — «كَافِرِۭ» is two paths on `فر`, not three. Collapsing them is not a
 * fudge to raise the number; it is the same fact the vocabulary already states,
 * read from the other end.
 */
function expected(l) {
  const out = [];
  if (HAMZA_ON[l.letter]) out.push(l.letter);
  for (const m of l.marks) {
    if (m === TATWEEL || m === SAJDA_LINE) continue;
    if (IQLAB.test(m) && out.length && VOWEL.test(out[out.length - 1])) continue;
    out.push(m);
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
function align(ls, ligs) {
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

const cp = (c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;

const pin = JSON.parse(readFileSync(PIN, "utf8"));
const rows = new Map(pin.pages.map((p) => [p.page, p]));
const wanted = only ?? pin.pages.map((p) => p.page);

console.log(`\n  probe:diacritics — ${wanted.length} page(s), reading the cache and nothing else\n`);

const seen = new Map();
const escapes = [];
let marks = 0;
let words = 0;
let wordsWithMarks = 0;
let unmatched = 0;
let raw = 0;
let gz = 0;
let smallest = Infinity;

/**
 * ④'s buckets. Every word lands in exactly one, so they sum to `words` and no
 * percentage below is conditioned on a filter the reader cannot see.
 */
const bucket = {
  joined: 0, //    the ligatures' letters agree with the hafs, and every mark count agrees
  ornament: 0, //  draws no letters at all — a pause mark, a sajda sign, a ۞
  partition: 0, // the ligature texts do not partition the hafs letter-for-letter
  counts: 0, //    they partition, but some ligature's mark count disagrees
};
let ligatures = 0;
let ligaturesAgree = 0;
let textIsImlaey = 0;
const pairs = new Map(); //   "U+0650 → kasra" → n, only where a ligature's counts agree
const why = new Map(); //     a compact signature of a disagreement → [n, example]

const blame = (sig, example) => {
  const e = why.get(sig) ?? [0, example];
  why.set(sig, [e[0] + 1, e[1]]);
};

for (const page of wanted) {
  const row = rows.get(page);
  if (!row) {
    console.error(`\n  FAIL p${page}: word-boxes.pin.json has no row for it\n`);
    process.exit(1);
  }
  const { body } = await candidatePage(page, { offline: true });
  const shard = JSON.parse(readFileSync(join(WORDS, `${page}.json`), "utf8"));

  const perWord = readDiacritics(body.toString("utf8"), applierFromPin(row));

  for (const w of perWord) {
    words += 1;
    if (w.marks.length) wordsWithMarks += 1;
    for (const m of w.marks) {
      marks += 1;
      seen.set(m[0], (seen.get(m[0]) ?? 0) + 1);
      smallest = Math.min(smallest, m[3], m[4]);
    }

    // ── ④, per word ──────────────────────────────────────────────────────────
    const where = `p${page} ${w.surah}:${w.aya}#${w.idx} “${w.hafs}”`;
    const drawn = w.ligatures.map((l) => l.text).join("");
    if (!drawn) {
      // An entry the print files as a word and a reader does not read as one:
      // the pause marks `ۖ ۗ ۘ ۙ ۚ ۛ`, the sajda sign, the `۞` rub' al-hizb.
      // They have no letters, so there is no join to succeed or fail at, and
      // counting them as a disagreement would be counting the instrument.
      bucket.ornament += 1;
    } else {
      if (drawn === w.imlaey) textIsImlaey += 1;
      const ls = letters(w.hafs);
      const plan = align(ls, w.ligatures);
      if (!plan) {
        bucket.partition += 1;
        blame(
          `no assignment of ligatures to letters — hafs “${ls.map((l) => l.letter).join("")}”`,
          `${where} → [${w.ligatures.map((l) => l.text).join("|")}]`,
        );
      } else {
        let ok = true;
        for (const step of plan) {
          const l = w.ligatures[step.lig];
          // A redraw is the second stroke of a letter already drawn. It has no
          // marks by the rule that recognised it, so there is nothing to check
          // and nothing to count — counting it as a ligature would inflate the
          // denominator with runs that cannot disagree.
          if (step.redraw) continue;
          ligatures += 1;
          const want = ls.slice(step.from, step.to).flatMap(expected);
          if (want.length !== l.marks.length) {
            ok = false;
            blame(
              `ligature “${l.text}” wants ${want.length} mark(s), the print draws ${l.marks.length}`,
              where,
            );
            continue;
          }
          ligaturesAgree += 1;
          for (let k = 0; k < want.length; k += 1) {
            const p = `${cp(want[k])} ${want[k]} → ${diacriticName(l.marks[k][0])}`;
            pairs.set(p, (pairs.get(p) ?? 0) + 1);
          }
        }
        bucket[ok ? "joined" : "counts"] += 1;
      }
    }

    const key = `${w.surah}:${w.aya}`;
    const ayah = shard.words[key];
    if (!ayah) {
      // A word in the corpus whose ayah the committed shard does not carry.
      // Counted rather than thrown: it would mean the two page reads disagree
      // about what is on the page, which is a finding, not a crash.
      unmatched += 1;
      continue;
    }
    const at = w.idx - ayah.from;
    const box = ayah.boxes[at];
    if (!box) {
      unmatched += 1;
      continue;
    }
    for (const [id, x, y, mw, mh] of w.marks) {
      const outside =
        x < box[0] - SLACK ||
        y < box[1] - SLACK ||
        x + mw > box[0] + box[2] + SLACK ||
        y + mh > box[1] + box[3] + SLACK;
      if (outside) {
        escapes.push({ page, key, idx: w.idx, name: diacriticName(id), mark: [x, y, mw, mh], box });
      }
    }
  }

  // Weighed on the real shape rather than the placeholder above: per ayah, a
  // `from` and a dense array of per-word mark lists, empty where a word has
  // none. The empties are kept because position IS the word index — dropping
  // them would need a second index per entry, which costs more than the `[]`.
  const dense = {};
  for (const [key, ayah] of Object.entries(shard.words)) {
    const list = ayah.boxes.map(() => []);
    for (const w of perWord) {
      if (`${w.surah}:${w.aya}` !== key) continue;
      const at = w.idx - ayah.from;
      if (at >= 0 && at < list.length) list[at] = w.marks;
    }
    if (list.some((l) => l.length)) dense[key] = { from: ayah.from, words: list };
  }
  const text = `${JSON.stringify({ page, diacritics: dense })}\n`;
  raw += Buffer.byteLength(text);
  gz += gzipSync(text).length;
}

// ── ① the vocabulary ─────────────────────────────────────────────────────────

const unused = DIACRITICS.map((n, i) => [i, n]).filter(([i]) => !seen.has(i));
console.log(`  ① vocabulary — ${seen.size} of ${DIACRITICS.length} names drawn`);
for (const [id, n] of [...seen].sort((a, b) => b[1] - a[1])) {
  console.log(`      ${String(id).padStart(2)}  ${String(n).padStart(7)}  ${diacriticName(id)}`);
}
if (unused.length) {
  console.log(`      unused on these pages: ${unused.map(([, n]) => n).join(", ")}`);
}

// ── ② containment ────────────────────────────────────────────────────────────

console.log(
  `\n  ② containment — ${marks} marks on ${wordsWithMarks} of ${words} words, ` +
    `${escapes.length} outside their word (slack ${SLACK})`,
);
for (const e of escapes.slice(0, 10)) {
  console.log(
    `      p${e.page} ${e.key} word ${e.idx} ${e.name}: ` +
      `[${e.mark.join(",")}] not inside [${e.box.join(",")}]`,
  );
}
if (unmatched) console.log(`      ${unmatched} word(s) had no box in the committed shard`);

// ── ③ weight ─────────────────────────────────────────────────────────────────

console.log(
  `\n  ③ weight — ${(raw / 1024 / 1024).toFixed(2)} MB raw / ` +
    `${(gz / 1024 / 1024).toFixed(2)} MB gz across ${wanted.length} shard(s)` +
    `\n      smallest mark on our frame: ${smallest.toFixed(1)} units`,
);

// ── ④ the ligature join ──────────────────────────────────────────────────────

const pct = (n, d) => (d ? ((n / d) * 100).toFixed(2) : "0.00");
const lettered = words - bucket.ornament;

console.log(`\n  ④ the ligature join — of ${words} entries the print calls words:`);
console.log(
  `      ${String(bucket.ornament).padStart(7)}  (${pct(bucket.ornament, words).padStart(5)}%)  ` +
    "draw no letters at all — pause marks, ۩, ۞",
);
console.log(`      ${" ".repeat(7)}  ${" ".repeat(7)}  of the remaining ${lettered}:`);
console.log(
  `      ${String(bucket.joined).padStart(7)}  (${pct(bucket.joined, lettered).padStart(5)}%)  ` +
    "join cleanly — letters partition and every mark count agrees",
);
console.log(
  `      ${String(bucket.partition).padStart(7)}  (${pct(bucket.partition, lettered).padStart(5)}%)  ` +
    "no assignment of their ligatures to their letters exists",
);
console.log(
  `      ${String(bucket.counts).padStart(7)}  (${pct(bucket.counts, lettered).padStart(5)}%)  ` +
    "partition, but at least one ligature's mark count disagrees",
);
console.log(
  `\n      ligatures ${ligatures}, mark counts agree on ${ligaturesAgree} ` +
    `(${pct(ligaturesAgree, ligatures)}%) — but that is conditioned on the ` +
    `\n      partition above, so it describes ${lettered - bucket.partition} of ${words} ` +
    "entries and is not a corpus figure",
);
console.log(
  `      ligature texts concatenate to data-imlaey on ${textIsImlaey} of ${lettered} ` +
    `(${pct(textIsImlaey, lettered)}%) — informational; the join does not use it`,
);

console.log("\n      why the rest disagree, most common first:");
for (const [sig, [n, example]] of [...why].sort((a, b) => b[1][0] - a[1][0]).slice(0, 12)) {
  console.log(`      ${String(n).padStart(7)}  ${sig}\n${" ".repeat(15)}e.g. ${example}`);
}

console.log("\n      codepoint → name, where a ligature's counts agree:");
for (const [p, n] of [...pairs].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`      ${String(n).padStart(7)}  ${p}`);
}
console.log();

if (escapes.length || unmatched) {
  console.error("  probe:diacritics — the boxes are not yet trustworthy; see above\n");
  process.exit(1);
}
console.log("  probe:diacritics — every mark sits inside its own word\n");
