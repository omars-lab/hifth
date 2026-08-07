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
 * ## Why ④ is not chased to 100%
 *
 * Every rule in `letters` and `expected` below was added because reading the
 * markup showed the print doing something, and each one is stated as the print's
 * convention with the word that demonstrated it. That is a bounded exercise.
 * The 85 entries still disagreeing could be driven to zero by adding rules
 * until they are, but a rule added to move a number is a rule fitted to the
 * data, and it would make ④ agree with the corpus by construction — which is
 * exactly the property that would stop it from being evidence. So the residual
 * is printed with its cause and its example and left alone. `sub-word-marks.md`
 * §⑤ names the four families it falls into.
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
 */
function letters(hafs) {
  const out = [];
  for (const c of hafs) {
    if (/[\p{Mn}\p{Lm}]/u.test(c) && out.length) out[out.length - 1].marks.push(c);
    else out.push({ letter: c, marks: [] });
  }
  return out;
}

/**
 * A hamza the print draws as a base outline with a separate named path on top,
 * so that one codepoint in the text is two things on the page.
 *
 * The bare hamza `ء` `U+0621` is deliberately **not** here, and that was the
 * other half of ④'s first draft being wrong: it is drawn as `data-type="text"`
 * like any other letter, because it has no carrier to sit on. Its four seated
 * forms and the alef wasla do get their own path.
 */
const CARRIES_ITS_OWN = /[آأؤإئٱ]/;

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
 * Which codepoints of a letter the print draws a *named* path for, in order.
 *
 * Its marks and, for a seated hamza, itself — with one merge. `DIACRITICS`
 * carries `fatha iqlab`, `kasra iqlab` and `damma iqlab` as names in their own
 * right, so where the text writes a vowel followed by `ۭ` the print draws a
 * single composite glyph rather than two: `كَافِرِۭ` is two paths on `فر`, not
 * three. Collapsing them here is not a fudge to raise the number — it is the
 * same fact the vocabulary already states, read from the other end.
 */
function expected(l) {
  const out = CARRIES_ITS_OWN.test(l.letter) ? [l.letter] : [];
  for (const m of l.marks) {
    if (m === TATWEEL) continue;
    if (IQLAB.test(m) && out.length && VOWEL.test(out[out.length - 1])) continue;
    out.push(m);
  }
  return out;
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
      if (ls.length !== [...drawn].length) {
        bucket.partition += 1;
        blame(
          `hafs has ${ls.length} letters, its ligatures draw ${[...drawn].length}`,
          `${where} → [${w.ligatures.map((l) => l.text).join("|")}]`,
        );
      } else {
        let cut = 0;
        let ok = true;
        for (const l of w.ligatures) {
          ligatures += 1;
          const n = [...l.text].length;
          const want = ls.slice(cut, cut + n).flatMap(expected);
          cut += n;
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
    "their ligature texts do not partition the hafs letters",
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
