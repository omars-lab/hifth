#!/usr/bin/env node
/**
 * Vendor the boxes, not the pictures.
 *
 * PLAN follow-up 13 asked whether a second corpus could give Hifth word-level
 * geometry, and the arithmetic came back in two parts. The print is the same
 * print (`probe-ligature-print.mjs`). The frames register on the ayah-end
 * ornaments with a **maximum residual of 0.506 viewBox units over 61 pages** —
 * 0.10 to 0.63 device pixels at the widths the stage actually renders
 * (`probe-word-registration.mjs`). What remained was the weight: their pages are
 * 595 KB raw / 114 KB gz each, **67 MB gz for the mus'haf**, against a shipped
 * corpus of 26.2 MB and a `gate:assets` ceiling of 32 MB.
 *
 * So this script fetches those 351 MB once, into a gitignored cache, and ships
 * none of them. What it ships is the answer they contain: one rectangle per word
 * per page, already in **our** viewBox, so the app needs no transform, no
 * constants and no second SVG. The 67 MB is a build-time cost that has already
 * been paid by the time anything reaches a phone.
 *
 * ## What a shard contains, and what it deliberately does not
 *
 *     { "page": 3, "words": { "2:6": { "from": 1, "boxes": [[x,y,w,h], …],
 *                                      "marks": [8] } } }
 *
 * Boxes, in our viewBox units, one decimal — the same precision svgo leaves in
 * the page paths, and 0.1 unit is under a tenth of a device pixel at 320 px
 * wide. `from` is the `data-word-index-in-ayah` of the first box, so an ayah
 * that flows across a page break keeps its numbering; boxes are contiguous from
 * there, and the build asserts it rather than hoping. `marks` lists the indices
 * that are pause marks rather than words (ۖ ۚ …, plus ۩ and ۞); it is absent when
 * there are none. See `isPauseMark` for why they are flagged and not dropped.
 *
 * **No text.** Not `data-hafs`, not `data-imlaey`. The reason first written here
 * was that it "would roughly triple the shards — and the app already has
 * per-word text, from a corpus whose provenance is recorded and whose
 * segmentation the root lens already depends on". The first half is true. **The
 * second half is false, and finding out why is the most important thing this
 * build learned.** The app's per-word corpus is the Quranic Arabic Corpus, whose
 * `(surah:ayah:word:segment)` index is a *morphological* word index; this print
 * splits at the rasm, detaching proclitics that QAC keeps joined — 1:5 is four
 * words to QAC and five here, because «وَإِيَّاكَ» is set as «وَ» + «إِيَّاكَ».
 * Counted over the whole mus'haf: **4,499 of 6,236 ayahs disagree**, and a
 * proclitic-merge heuristic still leaves 2,775 disagreeing. There is no existing
 * per-word text these boxes join to.
 *
 * So the conclusion survives its reason, on a better one. A box's identity here
 * is (page, ayah, this print's word index), which is reproducible from the pin by
 * anyone at any time; the spelling adds nothing the pin does not already fix, and
 * it would be the first Quran text this repo has ever shipped (the roots entry in
 * SOURCES.md says so in as many words). The join to QAC is real work with a real
 * failure mode — the off-by-one that made 47.8% of hop edges wrong was exactly
 * this kind of index — and it belongs to word-C, where it can be built against a
 * measurement instead of guessed. The measurement above is recorded in the pin so
 * that work starts from a number.
 *
 * One consequence to know before consuming a shard: **the index is the print's,
 * not QAC's.** `from` is `data-word-index-in-ayah` verbatim. It counts pause
 * marks (ۖ ۚ …) as words, because the print numbers them.
 *
 * ## Which transform, and why not the constants
 *
 * The probe found the fit is the same on every standard page — scale 1.3333 in
 * both axes, `ty ≈ −88.6`, `tx` −114.6 on even pages and −54.6 on odd, the
 * recto/verso binding margin already sitting in our own SVG matrices. It would
 * be tempting to hard-code those four numbers and skip our side entirely.
 *
 * This build fits per page anyway, for a reason the probe also found: **pages 1
 * and 2 do not obey them.** Their decorated frames fit sx ≈ 1.163 against
 * sy ≈ 1.137 — a scale that differs between the axes, where all 59 standard
 * pages measured fit 1.3333 in both. Those frames are not the fifteen-line block
 * at a different offset; they are a different geometry, and four constants would
 * have put al-Fātiḥah's words in the wrong place while every other page looked
 * perfect. Fitting per page costs one least-squares solve on 5–20 points and
 * makes the exception ordinary.
 *
 * The residual of each fit is recorded per page in the pin, and a page whose
 * residual exceeds `MAX_RESIDUAL` fails the build rather than shipping boxes
 * nobody measured.
 *
 * Usage:
 *   pnpm --filter @hifth/etl build:words            from the cache; fails if it is short
 *   pnpm --filter @hifth/etl build:words --fetch    download what the cache lacks first
 *   pnpm --filter @hifth/etl build:words --pages 1,2,3   a subset, for looking at one
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { candidatePage, pin } from "./lib/candidate-pages.mjs";
import { WAQF, fitFrames, readOurs, readTheirs, readingOrder } from "./lib/mushaf-frame.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const DATA = join(HERE, "..", "data", "pages");
const PAGES = join(REPO, "apps", "web", "public", "assets", "pages", "hafs-kfqc");
const OUT = join(REPO, "apps", "web", "public", "assets", "words", "hafs-kfqc");
const PIN_OUT = join(DATA, "word-boxes.pin.json");

/**
 * The worst marker residual a page may fit at, in that page's viewBox units.
 *
 * `standard` is the fifteen-line block, 602 of the 604. Fitted over all of them:
 * median 0.089, p90 0.167, p99 0.591 — a fraction of a device pixel — and then
 * one page on its own. **p113 fits at 1.933**, and it is not a mis-pairing: its
 * five ornaments pair 5:32 → 5:36 in order, its y fits to 0.12, and every one of
 * its 158 word boxes lands inside its own ayah's polygon. What is off is that
 * page's ornament *x* — two marks their frame puts 0.2 apart, ours puts 3.4
 * apart — so no affine map can satisfy both, and the fit splits the difference.
 * The ceiling is 2.0 to let that page through with its number on the record,
 * rather than 1.0 with an allow-list, because the allow-list is the thing that
 * stops being read.
 *
 * `override` is pages 1 and 2, the decorated frames, `viewBox="0 0 235 235"`.
 * They need their own number for a reason worth writing down rather than
 * rounding away: **page 2 fits to 0.42 and page 1 to 2.72**, on the same frame,
 * with the same scale (sx 1.163, sy 1.137 — non-uniform, unlike every standard
 * page's flat 1.3333). The pairing on page 1 was checked marker by marker and is
 * correct, 1:1 through 1:7 in order; the residual is a single outlier, the
 * basmala's own ornament, whose x our page puts 2.7 units after where their
 * frame predicts. Six of seven markers on that page fit inside 1.6.
 *
 * So this bound is not a claim that page 1's boxes are good to 3 units. It is
 * the point past which the build stops guessing. The claim that page 1's boxes
 * are usable is made somewhere stronger: `gate:words` puts every shipped box
 * against its own ayah's polygon in our committed SVG and demands it land there.
 * A residual is a proxy; that is a measurement.
 */
const MAX_RESIDUAL = { standard: 2.0, override: 3.0 };

const PAGE_COUNT = 604;

const argv = process.argv.slice(2);
const wantFetch = argv.includes("--fetch");
const only = (() => {
  const i = argv.indexOf("--pages");
  if (i < 0) return null;
  return argv[i + 1].split(",").map(Number);
})();
const wanted = only ?? Array.from({ length: PAGE_COUNT }, (_, i) => i + 1);

const round = (n) => Math.round(n * 10) / 10;
const sha = (s) => createHash("sha256").update(s).digest("hex");

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** `ours = s·theirs + t`, as a thing that maps a box. */
const applier = (t) => (b) => [
  t.sx * b[0] + t.tx,
  t.sy * b[1] + t.ty,
  t.sx * b[2] + t.tx,
  t.sy * b[3] + t.ty,
];

/** How far the markers a page *does* have sit from where a transform predicts. */
function residualUnder(t, theirMarks, ourMarks) {
  const T = readingOrder(
    theirMarks.map((m) => [(m.box[0] + m.box[2]) / 2, (m.box[1] + m.box[3]) / 2]),
    8,
  );
  const O = readingOrder(ourMarks, 11);
  if (T.length !== O.length) return Infinity;
  return Math.max(
    0,
    ...T.map((p, i) =>
      Math.max(Math.abs(O[i][0] - (t.sx * p[0] + t.tx)), Math.abs(O[i][1] - (t.sy * p[1] + t.ty))),
    ),
  );
}

/**
 * Is this "word" a pause mark rather than a word?
 *
 * The print numbers ۖ ۚ ۗ ۘ ۙ ۛ, the sajda ۩ and the juz star ۞ as words — they
 * carry a `data-word-index-in-ayah` like everything else — but nobody selects one
 * and nothing searches for one. They are flagged rather than dropped because
 * dropping them would renumber every word after them, and the numbering is the
 * one thing about this corpus that must not be invented (see the header).
 *
 * The flag is also what makes `gate:words` able to hold every real word to a
 * strict rule: a pause mark is set *above* its line's ink, high enough that on
 * 400 of the 91,451 boxes its centre falls in the band above — which is the
 * previous ayah's polygon, not its own. That is a fact about superscripts, not
 * about the registration, and a gate that could not tell the two apart would
 * have to slacken for all 91,451 to accommodate 400.
 */
const isPauseMark = (w) => {
  const t = w.hafs || "";
  return t.length > 0 && [...t].every((c) => WAQF.has(c) || c === " ");
};

/**
 * Their words, grouped by ayah and mapped into our frame.
 *
 * Grouped rather than emitted flat because that is how the app asks — an ayah is
 * selected first and its words second — and because grouping is what lets `from`
 * say once the thing a flat list would repeat per word.
 */
function boxesByAyah(words, apply) {
  const byAyah = new Map();
  for (const w of words) {
    const key = `${w.surah}:${w.aya}`;
    if (!byAyah.has(key)) byAyah.set(key, []);
    byAyah.get(key).push(w);
  }
  const out = {};
  for (const [key, ws] of byAyah) {
    ws.sort((a, b) => a.idx - b.idx);
    const from = ws[0].idx;
    for (let i = 0; i < ws.length; i += 1) {
      // A gap here would silently shift every later word's identity by one, and
      // the identity is the whole product — a box nobody can name is a box.
      if (ws[i].idx !== from + i) {
        throw new Error(`${key} word indices jump: ${ws.map((w) => w.idx).join(",")}`);
      }
    }
    const marks = ws.filter((w) => isPauseMark(w)).map((w) => w.idx);
    out[key] = {
      from,
      boxes: ws.map((w) => {
        const [x0, y0, x1, y1] = apply(w.box);
        return [round(x0), round(y0), round(x1 - x0), round(y1 - y0)];
      }),
      ...(marks.length ? { marks } : {}),
    };
  }
  return out;
}

// --------------------------------------------------------------------- run --

const { repo, commit } = pin.candidate;
console.log(`\n  build:words — ${repo} @ ${commit.slice(0, 12)}`);
console.log(`  ${wanted.length} page(s) → assets/words/hafs-kfqc/\n`);

// ── Pass 1: read everything, fit what can be fitted ──────────────────────────

const pages = [];
let read = 0;

for (const page of wanted) {
  const { body, sha256, cached } = await candidatePage(page, { offline: !wantFetch });
  read += body.length;
  if (!cached && page % 50 === 0) process.stdout.write(`  fetched through p${page}\n`);

  const theirs = readTheirs(body.toString("utf8"));
  const ours = readOurs(readFileSync(join(PAGES, `${page}.svg`), "utf8"));
  const cls = ours.vb[2] === 345 && ours.vb[3] === 550 ? "standard" : "override";
  const row = { page, sha256, cls, group: `${cls}/${page % 2 ? "odd" : "even"}`, theirs, ours };
  try {
    row.fit = fitFrames(theirs.marks, ours.marks);
  } catch (e) {
    // Not fatal, and not rare: see BORROWED below.
    row.why = e.message;
  }
  pages.push(row);
}

/**
 * ── Pass 2: the pages with nothing to fit against ───────────────────────────
 *
 * `fitFrames` needs three ornaments and refuses fewer, because two points fit
 * any line exactly and one fits nothing — a "fit" on those is a number with no
 * evidence in it. But a page can honestly carry fewer than three ayah endings:
 * page 48 is most of 2:282, the longest ayah in the Qur'an, and ends exactly one
 * ayah.
 *
 * Those pages do not get a worse fit; they get the group's. The probe's finding
 * is that the transform is not really per-page at all — every standard page fits
 * scale 1.3333 in both axes, `ty ≈ −88.6`, and `tx` one of exactly two values by
 * recto/verso — so the median of the pages that could be fitted is a better
 * estimate for a marker-poor page than anything its own one or two points could
 * produce. Grouped by frame class and parity, because those are the two things
 * the transform actually varies with.
 *
 * It is still checked, not assumed: whatever markers the page *does* have are
 * measured against the borrowed transform and must sit inside the same residual
 * bound as anyone else's. A page with a single ornament in the wrong place fails
 * here rather than shipping a page of boxes nobody looked at.
 */
const reference = new Map();
for (const row of pages.filter((r) => r.fit)) {
  if (!reference.has(row.group)) reference.set(row.group, []);
  reference.get(row.group).push(row.fit);
}
for (const [group, fits] of reference) {
  reference.set(group, {
    sx: median(fits.map((f) => f.sx)),
    tx: median(fits.map((f) => f.tx)),
    sy: median(fits.map((f) => f.sy)),
    ty: median(fits.map((f) => f.ty)),
    from: fits.length,
  });
}

const borrowed = [];
for (const row of pages) {
  if (row.fit) continue;
  const ref = reference.get(row.group);
  if (!ref) {
    console.error(`\n  FAIL p${row.page}: ${row.why}, and no fitted page in ${row.group}\n`);
    process.exit(1);
  }
  row.fit = {
    ...ref,
    markers: row.ours.marks.length,
    residual: residualUnder(ref, row.theirs.marks, row.ours.marks),
    apply: applier(ref),
    borrowedFrom: row.group,
  };
  borrowed.push(row.page);
}

// ── Write ────────────────────────────────────────────────────────────────────

if (!only) {
  // A stale shard from a run with a different page set would pass every check
  // that only looks at what is there. The directory is rebuilt, not patched.
  rmSync(OUT, { recursive: true, force: true });
}
mkdirSync(OUT, { recursive: true });

const rows = [];
let wrote = 0;

for (const row of pages) {
  if (!(row.fit.residual <= MAX_RESIDUAL[row.cls])) {
    console.error(
      `\n  FAIL p${row.page}: marker residual ${row.fit.residual.toFixed(3)} > ` +
        `${MAX_RESIDUAL[row.cls]} (${row.cls} frame) on ${row.fit.markers} markers` +
        `${row.fit.borrowedFrom ? `, transform borrowed from ${row.fit.borrowedFrom}` : ""}\n`,
    );
    process.exit(1);
  }
  let shard;
  try {
    shard = { page: row.page, words: boxesByAyah(row.theirs.words, row.fit.apply) };
  } catch (e) {
    console.error(`\n  FAIL p${row.page}: ${e.message}\n`);
    process.exit(1);
  }
  const text = `${JSON.stringify(shard)}\n`;
  writeFileSync(join(OUT, `${row.page}.json`), text);
  wrote += Buffer.byteLength(text);
  rows.push({
    page: row.page,
    upstream: row.sha256,
    markers: row.fit.markers,
    ...(row.fit.borrowedFrom ? { transformBorrowedFrom: row.fit.borrowedFrom } : {}),
    sx: Number(row.fit.sx.toFixed(6)),
    tx: Number(row.fit.tx.toFixed(4)),
    sy: Number(row.fit.sy.toFixed(6)),
    ty: Number(row.fit.ty.toFixed(4)),
    residual: Number(row.fit.residual.toFixed(4)),
    words: row.theirs.words.length,
    ayahs: Object.keys(shard.words).length,
    sha256: sha(text),
  });
}

const gz = readdirSync(OUT).reduce((t, f) => t + gzipSync(readFileSync(join(OUT, f))).length, 0);
const residuals = rows.map((r) => r.residual).sort((a, b) => a - b);
const totalWords = rows.reduce((t, r) => t + r.words, 0);
if (borrowed.length) {
  console.log(
    `  ${borrowed.length} page(s) carried fewer than three ornaments and took their group's ` +
      `transform: ${borrowed.join(", ")}`,
  );
}

console.log(
  `  ${rows.length} shard(s), ${totalWords} words` +
    `\n  ${(read / 1024 / 1024).toFixed(1)} MB read → ${(wrote / 1024).toFixed(1)} KB raw / ` +
    `${(gz / 1024).toFixed(1)} KB gz written` +
    `\n  marker residual: median ${residuals[Math.floor(residuals.length / 2)].toFixed(3)}, ` +
    `max ${residuals.at(-1).toFixed(3)} viewBox units\n`,
);

if (!only) {
  writeFileSync(
    PIN_OUT,
    `${JSON.stringify(
      {
        $comment:
          "What build-words.mjs read and what it wrote, per page. The upstream SHA-256 is the " +
          "ligature corpus page at the commit ligature-svg.probe.json pins; the sha256 is the " +
          "shard this repo ships. gate:words re-derives nothing from the network — it checks the " +
          "committed shards against these hashes, so a hand-edited shard fails without anyone " +
          "downloading 351 MB to find out. The fitted transform is recorded per page because it " +
          "is the one number a future reader would otherwise have to re-derive to know whether a " +
          "box is where it claims: see build-words.mjs on why pages 1 and 2 do not obey the " +
          "constants the other 602 do.",
        $segmentation:
          "The word index in every shard is this print's own data-word-index-in-ayah. It is NOT " +
          "the Quranic Arabic Corpus index the root lens uses: the print splits at the rasm and " +
          "detaches proclitics QAC keeps joined (1:5 is 4 words to QAC, 5 here), and it numbers " +
          "pause marks as words. Measured over the mus'haf on 2026-08-04: 4,499 of 6,236 ayahs " +
          "have different word counts, and merging every proclitic-looking token still leaves " +
          "2,775 disagreeing — so the two cannot be reconciled by a rule, only by an alignment. " +
          "Anything that joins these boxes to roots or morphology must build that alignment and " +
          "check it; assuming the indices match is the same shape of mistake as the off-by-one " +
          "that made 47.8% of hop edges wrong (gate:edges exists because of it).",
        source: pin.candidate,
        ranOn: new Date().toISOString().slice(0, 10),
        pages: rows,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`  pin → ${PIN_OUT.replace(REPO, "")}\n`);
}
