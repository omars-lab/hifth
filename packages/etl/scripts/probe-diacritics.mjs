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
 * ## The five questions, and why these five
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
 * **⑤ Which mark is which?** ④ counts. Counting says a ligature drawing three
 * letters carries three marks; it does not say which drawn path is the tanween
 * and which is the sukun, and a tajweed rule that wants to light the tanween
 * needs exactly that. The obvious answer — pair them off left to right — is not
 * an answer at all: it *assumes* the print draws marks in the order the text
 * writes them, which is the thing in question, and assuming it manufactures
 * agreement out of nothing.
 *
 * So ⑤ never looks at position. Each agreeing ligature contributes a *bag* of
 * codepoint tokens beside a *bag* of drawn names, and the correspondence is
 * recovered by elimination across the whole corpus: if a run wants
 * `{sukun, أ, fatha}` and the print draws `{hamza, sukun, fatha}`, then once
 * two are pinned elsewhere the third follows from set arithmetic. The mechanism
 * is arc consistency over bipartite matchings — `supported` states why that and
 * not plain intersection.
 *
 * It is checked on data it was not shown. Every run carrying exactly one mark is
 * **held out** of the propagation, because a one-mark run forces its own pairing
 * and scoring against it would report 100% by construction. Order is measured
 * only afterwards, once pairing is settled without it.
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
 * Whether a mark is drawn where a reader would look for it. ⑤ closes *which*
 * path is which — the token a path belongs to, and via R1 which box on the page
 * carries it. What no count and no set arithmetic can reach is the last step:
 * that the path so identified is physically over the letter that wrote it, and
 * not floating a letter to its left. Everything here is a correspondence
 * between a reconstructed text and an outline on a page, established through
 * the corpus's own attributes; whether the ink lands where a reader's eye goes
 * is a claim about the picture, and only an eye settles it. That check belongs
 * to the encoding inspector (mark-B), where a human sees the boxes on the page
 * beside the three other encodings.
 *
 * Usage:
 *   pnpm probe:diacritics                 # all 604 cached pages
 *   pnpm probe:diacritics --pages 1,2,7   # a fast subset
 *
 * (from the repo root — the script is registered there, not in this package)
 *
 * On a subset ⑤ is reporting what those pages alone can settle: the dictionary
 * is a corpus-scale result, and a handful of pages will leave tokens open. The
 * numbers quoted in `docs/design/sub-word-marks.md` are the full-corpus run.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { DIACRITICS, diacriticName } from "@hifth/core";

import { candidatePage } from "./lib/candidate-pages.mjs";
import { applierFromPin, readDiacritics } from "./lib/diacritics.mjs";
import { DRAWN_NAME, align, expected, letters, pairMarks } from "./lib/mark-join.mjs";

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
 * The join itself — `letters`, `align`, `expected`, and the conventions each
 * encodes — lives in `lib/mark-join.mjs`, because `probe-encodings.mjs` draws
 * the marks it resolves and the two must be the same arithmetic. ④ and ⑤ below
 * are still where the evidence for every one of those conventions is written
 * down; what moved is only the code.
 */

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
const why = new Map(); //     a compact signature of a disagreement → [n, example]

/**
 * ⑤'s corpus: one entry per ligature whose counts agree, holding the tokens the
 * text writes, the names the print drew, and where to look. The two lists are
 * the same length and in no stated correspondence — establishing one is ⑤'s
 * whole job, and zipping them here by position would answer the question by
 * assuming it.
 */
const runs = [];

const blame = (sig, example) => {
  const e = why.get(sig) ?? [0, example];
  why.set(sig, [e[0] + 1, e[1]]);
};

/**
 * The one thing `pairMarks` assumes, counted.
 *
 * The dictionary settles a ligature outright when its tokens name distinct
 * paths. Where two tokens name the *same* path — a `U+0653@hamza` fatha beside
 * an ordinary one — something has to break the tie, and `lib/mark-join.mjs`
 * breaks it with geometry: Arabic is set right to left, so among same-named
 * paths the rightmost is the one the text writes first.
 *
 * That is a claim, so it is measured rather than asserted. `ties` counts the
 * ligatures where a tie exists at all — if it is rare, the assumption is cheap
 * whatever it is worth — and `tiesDiffer` counts where the geometric order and
 * the print's own emission order disagree, which is the only case in which
 * choosing between them changes a rectangle.
 */
let ties = 0;
let tiesDiffer = 0;
const tieWhere = [];
const tie = (tokens, marks, where) => {
  const names = tokens.map((t) => DRAWN_NAME[t.token]);
  if (new Set(names).size === names.length) return;
  ties += 1;
  const doc = marks.map((_, i) => i);
  const geom = pairMarks(tokens, marks);
  // `doc` is document order restricted to the tied name; comparing the whole
  // pairing against it would count the print's known reordering of the seated
  // hamza, which is R1's business and not this one.
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  for (const n of new Set(dup)) {
    const inDoc = doc.filter((i) => diacriticName(marks[i][0]) === n);
    const inGeom = names.map((x, i) => [x, i]).filter(([x]) => x === n).map(([, i]) => geom?.[i]);
    if (inDoc.join() !== inGeom.join()) {
      tiesDiffer += 1;
      if (tieWhere.length < 6) tieWhere.push(`${n} × ${inDoc.length} — ${where}`);
      break;
    }
  }
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
          const tokens = ls.slice(step.from, step.to).flatMap(expected);
          if (tokens.length !== l.marks.length) {
            ok = false;
            blame(
              `ligature “${l.text}” wants ${tokens.length} mark(s), the print draws ${l.marks.length}`,
              where,
            );
            continue;
          }
          ligaturesAgree += 1;
          // ⑤'s raw material: a bag of tokens the text writes beside a bag of
          // names the print drew, and no claim about which goes with which. A
          // ligature carrying no marks at all agrees vacuously and constrains
          // nothing, so it is left out rather than counted as a run — in the
          // denominator it would only dilute ⑤'s held-out percentage.
          if (tokens.length) {
            runs.push([tokens.map((t) => t.token), l.marks.map((m) => diacriticName(m[0])), where]);
            tie(tokens, l.marks, where);
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

// ── ⑤ which mark is which ────────────────────────────────────────────────────

/**
 * The relation, one entry per token: the set of names it might be drawn as.
 *
 * Seeded from co-occurrence — every name any run drew beside this token — and
 * then narrowed. The seed is deliberately generous: a token starts out able to
 * be anything it was ever seen next to, and only elimination takes names away.
 */
const may = new Map();

/**
 * Every `(token, name)` pairing that *some* one-to-one assignment of this run
 * can use, given what the relation currently allows.
 *
 * This is arc consistency over a bipartite matching, and the distinction from
 * plain set intersection matters enough to state: intersection would say "this
 * token was seen beside `{a, b}` here and `{b, c}` there, so it must be `b`",
 * which is only valid if the relation is a function to begin with. It is not
 * known to be one — that is what ⑤ is establishing — and assuming it drove
 * `U+0653` to an empty candidate set on the first attempt. Here a pairing
 * survives unless *no* perfect assignment of this run's tokens to this run's
 * names can use it, which is a claim about the run alone and cannot be wrong.
 *
 * `reach[i]` is the set of name-subsets consumable by the first `i` tokens;
 * `canFinish` asks whether the remaining tokens can consume what is left. A
 * pairing is supported when it lies on a path through both. Runs hold at most a
 * handful of marks, so the `2^k` masks are cheap, and both halves memoise.
 *
 * Returns an empty map when the run admits no assignment at all — a
 * contradiction, which is reported rather than absorbed.
 */
function supported(want, got) {
  const k = want.length;
  const all = (1 << k) - 1;
  const ok = (i, j) => may.get(want[i]).has(got[j]);
  const feas = new Map();
  const canFinish = (i, mask) => {
    if (i === k) return mask === all;
    const key = i * (all + 1) + mask;
    if (feas.has(key)) return feas.get(key);
    let v = false;
    for (let j = 0; j < k && !v; j += 1) {
      if (!(mask & (1 << j)) && ok(i, j)) v = canFinish(i + 1, mask | (1 << j));
    }
    feas.set(key, v);
    return v;
  };
  const reach = Array.from({ length: k + 1 }, () => new Set());
  reach[0].add(0);
  const usable = new Map();
  for (let i = 0; i < k; i += 1) {
    for (const mask of reach[i]) {
      for (let j = 0; j < k; j += 1) {
        if (mask & (1 << j)) continue;
        if (!ok(i, j) || !canFinish(i + 1, mask | (1 << j))) continue;
        reach[i + 1].add(mask | (1 << j));
        if (!usable.has(want[i])) usable.set(want[i], new Set());
        usable.get(want[i]).add(got[j]);
      }
    }
  }
  return usable;
}

/**
 * Runs with exactly one mark are **held out**, and that is the load-bearing
 * choice in ⑤.
 *
 * A one-mark run forces its own pairing: one token, one name, nothing to
 * decide. Feed it to the propagation and then "check" the dictionary against
 * it and the answer is 100% by construction — the check would be reading back
 * what it was told. Withheld, the same runs become a genuine test set of
 * pairings the propagation never saw and cannot have fitted, and they are the
 * overwhelming majority of the corpus.
 *
 * What the propagation learns from is therefore only the multi-mark runs, where
 * every pairing is ambiguous on its own and can only be settled by arithmetic
 * across runs.
 */
const shapes = new Map();
let singles = 0;
for (const [want, got, where] of runs) {
  if (want.length < 2) {
    singles += 1;
    continue;
  }
  const k = `${want.join(",")}|${got.join(",")}`;
  const s = shapes.get(k);
  if (s) s.n += 1;
  else shapes.set(k, { want, got, where, n: 1 });
}

for (const { want, got } of shapes.values()) {
  for (const t of want) {
    if (!may.has(t)) may.set(t, new Set());
    for (const n of got) may.get(t).add(n);
  }
}

const dead = [];
let passes = 0;
for (;;) {
  passes += 1;
  let cut = 0;
  for (const sh of shapes.values()) {
    const usable = supported(sh.want, sh.got);
    if (!usable.size) {
      if (!sh.dead) {
        sh.dead = true;
        dead.push(sh);
      }
      continue;
    }
    for (const [t, allowed] of usable) {
      for (const n of may.get(t)) {
        if (!allowed.has(n)) {
          may.get(t).delete(n);
          cut += 1;
        }
      }
    }
  }
  if (!cut) break;
}

const dict = new Map([...may].filter(([, s]) => s.size === 1).map(([t, s]) => [t, [...s][0]]));
const open = [...may].filter(([, s]) => s.size !== 1);

console.log(
  `\n  ⑤ which mark is which — ${runs.length} runs whose counts agree, ` +
    `${singles} held out\n      for the test below, leaving ${shapes.size} distinct token-bag/name-bag ` +
    `shapes\n      to propagate over; a fixpoint in ${passes} pass(es)`,
);
console.log(`\n      the dictionary, from set arithmetic and no assumption about order:`);
for (const [t, s] of [...may].sort((a, b) => a[0].localeCompare(b[0]))) {
  const rhs = s.size === 1 ? [...s][0] : `{ ${[...s].join(" | ")} }`;
  console.log(`      ${t.padEnd(14)} → ${rhs}`);
}
console.log(
  `      ${dict.size} of ${may.size} tokens pinned to exactly one name; ` +
    `${open.length} still open`,
);

/**
 * The frozen copy, checked against the run that earned it.
 *
 * `lib/mark-join.mjs` ships `DRAWN_NAME` so that a tool drawing one page does
 * not have to read 380 MB to know what a `U+0651` looks like. A frozen copy of
 * a measured result is a liability unless something re-measures it, so this is
 * that something: every full run re-derives the dictionary from the corpus and
 * says whether the table still describes it.
 *
 * Only on a full run. A subset settles fewer tokens by design — `--pages 1,2,7`
 * has not seen enough of the corpus to pin all thirty-four — so a short run
 * reports what it *can* confirm rather than failing for being short.
 */
const full = wanted.length === pin.pages.length;
const drift = [];
for (const [t, n] of dict) if (DRAWN_NAME[t] !== n) drift.push(`${t} → ${n}, the table says ${DRAWN_NAME[t] ?? "nothing"}`);
if (full) for (const t of Object.keys(DRAWN_NAME)) if (!dict.has(t)) drift.push(`${t} is in the table and this run did not pin it`);
if (drift.length) {
  console.log(`\n      ⚠ lib/mark-join.mjs DRAWN_NAME disagrees with this run on ${drift.length}:`);
  for (const d of drift) console.log(`        ${d}`);
} else {
  console.log(
    `      lib/mark-join.mjs DRAWN_NAME agrees on ${dict.size} of them` +
      (full ? " and carries no token this run did not pin" : " (subset run — completeness not checked)"),
  );
}

console.log(
  `\n      the tie the pairing does assume — ${ties} of ${runs.length} runs draw two ` +
    `paths\n      of one name, and geometry disagrees with document order on ${tiesDiffer}`,
);
for (const t of tieWhere) console.log(`        ${t}`);
if (dead.length) {
  console.log(
    `      ${dead.length} shape(s) admit no assignment at all ` +
      `(${dead.reduce((a, d) => a + d.n, 0)} runs) — a contradiction, not a gap:`,
  );
  for (const d of dead.slice(0, 6)) {
    console.log(`      ${String(d.n).padStart(7)}  [${d.want.join(",")}] vs [${d.got.join(",")}]  ${d.where}`);
  }
}

// The held-out test.
let agree = 0;
let differ = 0;
let unseen = 0;
const wrong = new Map();
for (const [want, got, where] of runs) {
  if (want.length !== 1) continue;
  const p = dict.get(want[0]);
  if (!p) {
    unseen += 1;
    continue;
  }
  if (p === got[0]) {
    agree += 1;
    continue;
  }
  differ += 1;
  const k = `${want[0]} predicted ${p}, drawn ${got[0]}`;
  const e = wrong.get(k) ?? { n: 0, where };
  e.n += 1;
  wrong.set(k, e);
}
const spct = (n) => (singles ? ((n / singles) * 100).toFixed(2) : "0.00");
console.log(
  `\n      the held-out test — ${singles} runs carrying exactly one mark, ` +
    "none of which\n      the propagation was shown:",
);
console.log(`      ${String(agree).padStart(7)}  (${spct(agree).padStart(6)}%)  the dictionary predicts the drawn name`);
console.log(`      ${String(differ).padStart(7)}  (${spct(differ).padStart(6)}%)  predicts a different name`);
console.log(
  `      ${String(unseen).padStart(7)}  (${spct(unseen).padStart(6)}%)  ` +
    "a token that never appears beside another, so nothing was learnt",
);
for (const [k, e] of [...wrong].sort((a, b) => b[1].n - a[1].n).slice(0, 8)) {
  console.log(`      ${String(e.n).padStart(7)}  ${k}\n${" ".repeat(15)}e.g. ${e.where}`);
}

/**
 * R1 — a seated hamza's own sign is drawn *after* every other mark on its
 * ligature, though the text writes it first. «يُؤۡمِنُونَ» writes damma, hamza,
 * sukun and draws damma, sukun, hamza.
 *
 * Stated here, before it is scored, so that scoring cannot become fitting. A
 * second candidate — that a shadda is drawn after the vowel it shares a letter
 * with, as «وَّ» suggests — was put up the same way and **refuted**: it costs
 * forty runs, because «نُّؤۡمِنَ» and its family do not swap. It is recorded in
 * `docs/design/sub-word-marks.md` §⑦ and deliberately not implemented.
 */
const HAMZAISH = new Set(["hamza", "wasla"]);
const r1 = (names) => [
  ...names.filter((n) => !HAMZAISH.has(n)),
  ...names.filter((n) => HAMZAISH.has(n)),
];

let multi = 0;
let inOrder = 0;
let byR1 = 0;
let permuted = 0;
let unresolved = 0;
const perms = new Map();
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
for (const [want, got, where] of runs) {
  if (want.length < 2) continue;
  multi += 1;
  const pred = want.map((t) => dict.get(t));
  if (pred.some((p) => !p)) {
    unresolved += 1;
    continue;
  }
  if (same(pred, got)) {
    inOrder += 1;
    byR1 += 1;
    continue;
  }
  const bag = (a) => [...a].sort().join("|");
  if (bag(pred) !== bag(got)) {
    unresolved += 1;
    continue;
  }
  permuted += 1;
  if (same(r1(pred), got)) byR1 += 1;
  else {
    const k = `${pred.join(" , ")}   drawn   ${got.join(" , ")}`;
    const e = perms.get(k) ?? { n: 0, where };
    e.n += 1;
    perms.set(k, e);
  }
}
const mpct = (n) => (multi ? ((n / multi) * 100).toFixed(2) : "0.00");
console.log(
  `\n      and only now, order — of ${multi} runs carrying two marks or more, ` +
    "pairing\n      having been established without ever consulting position:",
);
console.log(`      ${String(inOrder).padStart(7)}  (${mpct(inOrder).padStart(6)}%)  drawn in the order the text writes them`);
console.log(`      ${String(permuted).padStart(7)}  (${mpct(permuted).padStart(6)}%)  the same marks, drawn in another order`);
console.log(`      ${String(unresolved).padStart(7)}  (${mpct(unresolved).padStart(6)}%)  unresolved`);
console.log(
  `      ${String(byR1).padStart(7)}  (${mpct(byR1).padStart(6)}%)  with R1 — the seated hamza drawn last`,
);
console.log(`\n      what R1 leaves, most common first:`);
for (const [k, e] of [...perms].sort((a, b) => b[1].n - a[1].n).slice(0, 10)) {
  console.log(`      ${String(e.n).padStart(7)}  ${k}\n${" ".repeat(15)}e.g. ${e.where}`);
}
console.log();

if (escapes.length || unmatched) {
  console.error("  probe:diacritics — the boxes are not yet trustworthy; see above\n");
  process.exit(1);
}
console.log("  probe:diacritics — every mark sits inside its own word\n");
