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
 * ## The three questions, and why these three
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
 * ## What it deliberately does not check
 *
 * Whether a mark is on the *right letter*. Nothing in this repo can answer that
 * offline — it would need the print's own letter order, which the corpus gives
 * as ligature ids this does not read, and ultimately a reader's eye. That check
 * belongs to the encoding inspector (mark-B), where a human can see the boxes
 * on the page beside the three other encodings.
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
    `\n      smallest mark on our frame: ${smallest.toFixed(1)} units\n`,
);

if (escapes.length || unmatched) {
  console.error("  probe:diacritics — the boxes are not yet trustworthy; see above\n");
  process.exit(1);
}
console.log("  probe:diacritics — every mark sits inside its own word\n");
