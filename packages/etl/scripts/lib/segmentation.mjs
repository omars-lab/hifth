/**
 * The two word indices, and the map between them.
 *
 * Hifth numbers every word twice, from two upstreams it did not write:
 *
 * - **the print index** — `data-word-index-in-ayah` on the MushafDatabase
 *   ligature SVGs, copied verbatim into `assets/words/**` by `build-words.mjs`.
 *   It numbers *ink on a page*: it counts pause marks as words and it splits at
 *   the rasm, so a proclitic written apart gets its own number.
 * - **the QAC index** — `(surah:ayah:word:segment)` in the vendored Quranic
 *   Arabic Corpus morphology. It numbers *the text*: a word is its group of
 *   PREFIX/STEM/SUFFIX segments, so a proclitic is a segment inside the word.
 *   `assets/roots/**`, the tajweed offsets and `gate:edges` all speak it.
 *
 * `word-boxes.pin.json` records that 4,499 of 6,236 ayahs disagree on the count
 * and that no rule reconciles them. That is true and it is not the end: the two
 * are *monotone* — they never cross, they only group differently — so a block
 * alignment on the shared consonant skeleton resolves 6,232 of 6,236 exactly,
 * with four named orthographic exceptions. See `docs/design/word-indexing.md`
 * for the measurements and why the map lives here.
 *
 * This file is the one copy of that alignment: the aligner that derives it
 * (needs the upstream corpus, so only `build-alignment.mjs` calls it) and the
 * reader that answers lookups from the committed pin (needs nothing but this
 * repo, so the gate and every ETL consumer call it).
 *
 * ## Why the pin is a delta and not a table
 *
 * The pin stores, per ayah, only the print indices that *continue* the QAC word
 * their predecessor started — 9,533 numbers for the whole mus'haf. Everything
 * else is recovered from the shipped word shards, which already state which
 * indices exist and which are pause marks. Storing the mapping outright would
 * restate the shards 86,965 times and make it possible for the two to disagree.
 * A delta cannot disagree with its base; it can only fail to apply, which
 * `gate:align` checks on every push.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import { normalise, wordsByAyah } from "../morphology.mjs";

const HERE = new URL(".", import.meta.url).pathname;

/** The committed map. Written by `build-alignment.mjs`, read by everything else. */
export const ALIGNMENT_PATH = join(HERE, "..", "..", "data", "pages", "word-alignment.pin.json");

/** The shipped word shards — the print side of the map, and its only base. */
export const WORDS_DIR = join(HERE, "..", "..", "..", "..", "apps", "web", "public", "assets", "words");

/** The edition whose print index this map is *of*. There is exactly one. */
export const EDITION = "hafs-kfqc";

/**
 * The four ayahs no alignment reaches, and why.
 *
 * Every one is an **orthographic** difference between the two corpora — the
 * same word spelled with a letter more or less — not a segmentational one. They
 * are listed rather than heuristised, the same move `MAX_RESIDUAL` made for
 * pages 1 and 113: let the exception through with its reason on the record
 * instead of slackening the rule for everyone. A table of four with a sentence
 * each stays readable; an allow-list is the thing that stops being read.
 *
 * `gate:align` checks this table against the pin's in both directions, so
 * adding an ayah here without measuring it fails CI.
 */
export const EXCEPTIONS = Object.freeze({
  "2:72": "print فَٱدَّٰرَٰءۡتُمۡ carries a hamza the QAC form does not",
  "12:39": "print يَٰصَٰحِبَيِ drops the yaa QAC keeps",
  "12:41": "print يَٰصَٰحِبَيِ drops the yaa QAC keeps",
  "37:130": "QAC holds إِلۡ يَاسِينَ as one word containing a space",
});

// --------------------------------------------------------------- the folds --

/**
 * Arabic → the Buckwalter alphabet `morphology.mjs` reduces QAC to.
 *
 * Consonants and the two alifs only. Everything unmapped — every harakat, every
 * Quranic annotation the print draws — is dropped, which is exactly what
 * `normalise` does to the Buckwalter side, so both sequences land in one
 * alphabet without either being re-encoded twice.
 */
const AR2BW = {
  ء: "'", آ: "|", أ: ">", ؤ: "&", إ: "<", ئ: "}",
  ا: "A", ب: "b", ة: "p", ت: "t", ث: "v", ج: "j",
  ح: "H", خ: "x", د: "d", ذ: "*", ر: "r", ز: "z",
  س: "s", ش: "$", ص: "S", ض: "D", ط: "T", ظ: "Z",
  ع: "E", غ: "g", ف: "f", ق: "q", ك: "k", ل: "l",
  م: "m", ن: "n", ه: "h", و: "w", ى: "Y", ي: "y",
  "ٱ": "{", // alef wasla
  "ٰ": "`", // dagger alif
};

/** Every Buckwalter letter that is a hamza seat or a madda alif. */
const HAMZA = /['|>&<}]/g;

/**
 * One fold past `normalise`: hamza seats and madda collapse to a plain alif,
 * and a resulting run of alifs collapses to one.
 *
 * **Measured, not assumed.** Without it the aligner fails on 276 of 6,236
 * ayahs; every one of the sampled failures was the same shape — the print
 * writing `'A` where QAC writes `A`, or the reverse — and folding hamza cut 276
 * to 4. No segmentation question turns on a hamza seat: the two corpora are
 * spelling the same word, and where a word *begins* is the only thing this file
 * is entitled to an opinion about.
 */
export function fold(buckwalter) {
  return normalise(buckwalter).replace(HAMZA, "A").replace(/AA+/g, "A");
}

/** A print word's text, reduced to the same folded skeleton QAC words reduce to. */
export function skeleton(arabic) {
  let bw = "";
  for (const ch of arabic) bw += AR2BW[ch] ?? "";
  return fold(bw);
}

/** `"surah:ayah"` → the ayah's QAC words as folded skeletons, in order. */
export function qacSkeletons() {
  const out = new Map();
  for (const [key, words] of wordsByAyah()) {
    // `wordsByAyah` already normalised; `fold` is idempotent over its output.
    out.set(key, words.map((w) => fold(w)));
  }
  return out;
}

// ------------------------------------------------------------- the aligner --

/**
 * Partition two sequences into the same number of consecutive blocks whose
 * concatenations are equal. Returns the blocks, or null if none exists.
 *
 * The cheap algorithm is available because the problem is monotone: neither
 * corpus reorders the other, so a block boundary can only fall where both
 * cumulative lengths agree. Walk the print's cut points, keep the ones the QAC
 * side also cuts at, and check the walk consumed both sequences. No DP, no
 * scoring, no threshold — it either partitions or it does not, and "does not"
 * is a result worth having rather than a number to tune.
 *
 * Returns `[{ p: [i, j], q: [k, l] }]`, half-open on both sides.
 */
export function alignBlocks(P, Q) {
  if (P.join("") !== Q.join("")) return null;
  const pc = [0];
  for (const t of P) pc.push(pc.at(-1) + t.length);
  const qc = [0];
  for (const t of Q) qc.push(qc.at(-1) + t.length);
  const qAt = new Map(qc.map((v, i) => [v, i]));
  const blocks = [];
  let pi = 0;
  let qi = 0;
  for (let i = 1; i <= P.length; i += 1) {
    const j = qAt.get(pc[i]);
    if (j === undefined) continue;
    blocks.push({ p: [pi, i], q: [qi, j] });
    pi = i;
    qi = j;
  }
  return pi === P.length && qi === Q.length ? blocks : null;
}

/**
 * The pin's per-ayah payload for one aligned ayah.
 *
 * `j` — print indices that continue the QAC word their predecessor started.
 *       This is the 2→1 proclitic case, 9,533 of them.
 * `s` — print index → how many QAC words it covers, for the one 1→2 block in
 *       the mus'haf. Absent everywhere else, and deliberately not merged into
 *       `j`: the two are opposite directions and encoding them alike is how a
 *       reader stops noticing that the rare one exists.
 *
 * `lexical` is the ayah's print indices with pause marks already removed, in
 * order — the same sequence the blocks were computed over.
 */
export function encodeBlocks(blocks, lexical) {
  const j = [];
  const s = {};
  for (const b of blocks) {
    for (let i = b.p[0] + 1; i < b.p[1]; i += 1) j.push(lexical[i]);
    const span = b.q[1] - b.q[0];
    if (span > 1) s[lexical[b.p[0]]] = span;
  }
  const out = {};
  if (j.length) out.j = j;
  if (Object.keys(s).length) out.s = s;
  return out;
}

// -------------------------------------------------------------- the shards --

/**
 * The print side, read from the committed shards rather than the upstream SVGs.
 *
 * `"surah:ayah"` → `{ page, from, count, marks }`. No ayah spans a page in this
 * print — 6,236 ayahs, 6,236 (page, ayah) pairs, checked when this map was
 * built — so one entry per ayah is complete rather than a first fragment.
 */
export function printWordsFromShards(edition = EDITION) {
  const dir = join(WORDS_DIR, edition);
  const out = new Map();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const shard = JSON.parse(readFileSync(join(dir, file), "utf8"));
    for (const [key, entry] of Object.entries(shard.words)) {
      out.set(key, {
        page: shard.page,
        from: entry.from,
        count: entry.boxes.length,
        marks: new Set(entry.marks ?? []),
      });
    }
  }
  return out;
}

/** The ayah's print indices that are words rather than pause marks, in order. */
export function lexicalIndices(entry) {
  const out = [];
  for (let i = 0; i < entry.count; i += 1) {
    const idx = entry.from + i;
    if (!entry.marks.has(idx)) out.push(idx);
  }
  return out;
}

// --------------------------------------------------------------- the lookup --

/**
 * The committed map, applied. Construct with {@link openAlignment}.
 *
 * Every question is answered per ayah and in both directions, because both
 * directions have a caller: `build-roots.mjs` holds a QAC word and wants the
 * boxes to draw (QAC → print), and word selection holds a tapped box and wants
 * the roots under it (print → QAC).
 */
export class Alignment {
  /** @param pin the parsed pin @param words `printWordsFromShards()` output */
  constructor(pin, words) {
    this.pin = pin;
    this.words = words;
  }

  /** Why this ayah has no map, or null if it has one. */
  exception(key) {
    return this.pin.exceptions[key] ?? null;
  }

  /** Every ayah the map covers, in shard order. */
  keys() {
    return [...this.words.keys()].filter((k) => !this.exception(k));
  }

  /**
   * The whole map for one ayah: `[{ print, qac, qacSpan }]`, one row per
   * lexical print index, in order.
   *
   * `qac` is the **first** QAC word the print word covers and `qacSpan` how
   * many it covers — 1 everywhere except the single 1→2 block in the mus'haf.
   * Two rows sharing a `qac` are the 2→1 proclitic case. QAC word numbers are
   * 1-based, as the corpus writes them.
   *
   * Null for the four exceptions and for an ayah this print does not carry.
   */
  mapOf(key) {
    if (this.exception(key)) return null;
    const entry = this.words.get(key);
    if (!entry) return null;
    const lexical = lexicalIndices(entry);
    const { j = [], s = {} } = this.pin.ayahs[key] ?? {};
    const joins = new Set(j);
    const out = [];
    let qac = 1;
    for (let i = 0; i < lexical.length; i += 1) {
      const idx = lexical[i];
      const prev = out.at(-1);
      // A join stays on its predecessor's word; anything else opens the next
      // one, which begins after however many words the predecessor covered.
      if (prev && !joins.has(idx)) qac = prev.qac + prev.qacSpan;
      out.push({ print: idx, qac, qacSpan: s[idx] ?? 1 });
    }
    return out;
  }

  /** The QAC word a print index belongs to, or null if it is a mark or absent. */
  qacWordOf(key, printIndex) {
    return this.mapOf(key)?.find((p) => p.print === printIndex)?.qac ?? null;
  }

  /** Every print index of a QAC word — one, or two where the print split it. */
  printWordsOf(key, qacWord) {
    const map = this.mapOf(key);
    if (!map) return null;
    return map.filter((p) => qacWord >= p.qac && qacWord < p.qac + p.qacSpan).map((p) => p.print);
  }

  /** How many QAC words the ayah has, per this map. The gate's second witness. */
  qacCount(key) {
    const last = this.mapOf(key)?.at(-1);
    return last ? last.qac + last.qacSpan - 1 : null;
  }
}

/** Read the pin and the shards. Offline; needs nothing but this repo. */
export function openAlignment({ edition = EDITION, path = ALIGNMENT_PATH } = {}) {
  if (!existsSync(path)) {
    throw new Error(`no alignment pin at ${path} — run \`pnpm build:alignment\``);
  }
  return new Alignment(JSON.parse(readFileSync(path, "utf8")), printWordsFromShards(edition));
}
