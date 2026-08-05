#!/usr/bin/env node
/**
 * Build the map between the two word indices, and answer questions about it.
 *
 * `word-boxes.pin.json` states the problem: the print's `data-word-index-in-ayah`
 * and QAC's `(surah:ayah:word:segment)` disagree on 4,499 of 6,236 ayahs, and no
 * rule reconciles them. This script builds the thing that does — an alignment —
 * and writes it to `data/pages/word-alignment.pin.json` so every consumer reads
 * one answer rather than deriving its own.
 *
 * ## Two modes, and why the default is the cheap one
 *
 *     pnpm align --rebuild           derive the map from the cache, write the pin
 *     pnpm align --rebuild --fetch   …downloading what the cache lacks first
 *     pnpm align 2:4                 look one ayah up, from the pin
 *     pnpm align 2:4 --print 3       …one print word
 *     pnpm align 2:4 --qac 1         …one QAC word
 *
 * `--rebuild` needs the 378 MB upstream ligature corpus, because the print's
 * *text* is the only thing the two indices can be aligned on and this repo ships
 * none of it (`build-words.mjs` drops `data-hafs` on purpose, and that stays
 * true — the alignment is derived from the text and does not carry it). Lookups
 * need nothing but the committed pin and the shipped shards, so the common case
 * — a developer asking which QAC word a box is — runs offline in a second.
 *
 * `--fetch` is opt-in and spelled the same way `build:words` spells it, for the
 * same reason: a third of a gigabyte arriving because somebody re-ran a build is
 * a surprise, and a surprise that size should be asked for. Without it a cold
 * cache is an error naming the flag, not a download.
 *
 * The alignment itself lives in `lib/segmentation.mjs`; this file is the driver
 * and the report. See `docs/design/word-indexing.md`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { candidatePage, pin as printPin } from "./lib/candidate-pages.mjs";
import { readTheirs, WAQF } from "./lib/mushaf-frame.mjs";
import { MORPHOLOGY_PATH } from "./morphology.mjs";
import {
  ALIGNMENT_PATH,
  EXCEPTIONS,
  alignBlocks,
  encodeBlocks,
  openAlignment,
  qacSkeletons,
  skeleton,
} from "./lib/segmentation.mjs";

const PAGES = 604;

/** A token that is nothing but pause marks — the print numbers these, QAC does not. */
const isMark = (text) => text.length > 0 && [...text].every((c) => WAQF.has(c) || c === " ");

// ------------------------------------------------------------------ rebuild --

async function rebuild({ fetch: wantFetch }) {
  const qac = qacSkeletons();

  /** `"surah:ayah"` → the print's lexical words, in index order. */
  const print = new Map();
  for (let page = 1; page <= PAGES; page += 1) {
    const { body, cached } = await candidatePage(page, { offline: !wantFetch });
    if (!cached && page % 50 === 0) console.log(`  fetched through p${page}`);
    for (const w of readTheirs(body.toString("utf8")).words) {
      if (isMark(w.hafs)) continue;
      const key = `${w.surah}:${w.aya}`;
      if (!print.has(key)) print.set(key, new Map());
      print.get(key).set(w.idx, w.hafs);
    }
    if (page % 100 === 0) console.log(`  read ${page}/${PAGES} pages`);
  }

  const ayahs = {};
  const failed = [];
  const shapes = new Map();
  let joins = 0;
  let splits = 0;
  let printWords = 0;
  let qacWords = 0;

  for (const [key, words] of qac) {
    const theirs = [...(print.get(key) ?? new Map())].sort((a, b) => a[0] - b[0]);
    const lexical = theirs.map(([idx]) => idx);
    const blocks = alignBlocks(theirs.map(([, text]) => skeleton(text)), words);
    printWords += lexical.length;
    qacWords += words.length;
    if (!blocks) {
      failed.push(key);
      continue;
    }
    for (const b of blocks) {
      const shape = `${b.p[1] - b.p[0]}→${b.q[1] - b.q[0]}`;
      shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
    }
    const encoded = encodeBlocks(blocks, lexical);
    joins += encoded.j?.length ?? 0;
    splits += Object.keys(encoded.s ?? {}).length;
    if (encoded.j || encoded.s) ayahs[key] = encoded;
  }

  // The exceptions are the *measurement*, not a filter applied to it: whatever
  // fails to align is what goes in the pin, and it has to be the four the table
  // in `segmentation.mjs` names. A fifth means something upstream moved, and
  // silently widening the table is how an allow-list starts.
  const expected = Object.keys(EXCEPTIONS).sort();
  if (failed.sort().join(",") !== expected.join(",")) {
    console.error("build:alignment — FAIL: the unaligned set is not the recorded one");
    console.error(`  recorded: ${expected.join(" ")}`);
    console.error(`  measured: ${failed.join(" ")}`);
    console.error("  Measure the new ones, name them in EXCEPTIONS with a reason, then rerun.");
    process.exit(1);
  }

  const out = {
    $comment:
      "The map between this print's word index (data-word-index-in-ayah, in assets/words/**) " +
      "and the Quranic Arabic Corpus's (surah:ayah:word:segment), which assets/roots/** and " +
      "gate:edges speak. Built by build-alignment.mjs from the pinned ligature corpus and the " +
      "vendored QAC morphology; read by lib/segmentation.mjs. It is a DELTA over the shipped " +
      "word shards, not a table: `j` lists the print indices that continue the QAC word their " +
      "predecessor started, `s` the one print word that covers two QAC words, and everything " +
      "else is recovered from the shards. Storing the mapping outright would restate the shards " +
      "86,965 times and let the two disagree; a delta can only fail to apply, which gate:align " +
      "checks offline on every push. Do not hand-edit — rerun `pnpm align --rebuild`, adding " +
      "`--fetch` if the upstream cache under data/pages/.cache/words is cold.",
    $method:
      "Monotone block alignment on a folded consonant skeleton. Both sides reduce to the same " +
      "Buckwalter alphabet, hamza seats and madda fold to alif (measured: without that fold 276 " +
      "ayahs fail, every sampled one an orthographic difference rather than a segmentational " +
      "one; with it, 4). A block boundary can only fall where both cumulative lengths agree, so " +
      "the alignment either partitions both sequences or does not exist — there is no score and " +
      "no threshold to tune.",
    source: {
      print: {
        repo: printPin.candidate.repo,
        commit: printPin.candidate.commit,
        path: printPin.candidate.path,
        index: "data-word-index-in-ayah, verbatim as assets/words/** carries it",
      },
      qac: {
        file: "packages/etl/data/roots/quranic-corpus-morphology-0.4.txt",
        sha256: createHash("sha256").update(readFileSync(MORPHOLOGY_PATH)).digest("hex"),
        index: "(surah:ayah:word:segment) — the word field",
        url: "http://corpus.quran.com",
      },
    },
    measured: {
      ayahsAligned: qac.size - failed.length,
      ayahsTotal: qac.size,
      printWords,
      qacWords,
      joins,
      splits,
      blockShapes: Object.fromEntries([...shapes].sort((a, b) => b[1] - a[1])),
    },
    exceptions: { ...EXCEPTIONS },
    ayahs,
  };

  writeFileSync(ALIGNMENT_PATH, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`\naligned ${out.measured.ayahsAligned}/${qac.size} ayahs`);
  console.log(`${printWords} print words → ${qacWords} QAC words`);
  console.log(`joins ${joins} · splits ${splits}`);
  for (const [shape, n] of shapes) console.log(`  ${shape.padEnd(8)} ${n}`);
  console.log(`\nwrote ${ALIGNMENT_PATH}`);
}

// ------------------------------------------------------------------- lookup --

function lookup(key, { print, qac }) {
  const align = openAlignment();
  const why = align.exception(key);
  if (why) {
    console.log(`${key} — no map: ${why}`);
    console.log("This ayah's print and QAC indices are both valid; nothing relates them.");
    process.exit(0);
  }
  const map = align.mapOf(key);
  if (!map) {
    console.error(`no words for ${key} — expected "<surah>:<ayah>", e.g. 2:4`);
    process.exit(1);
  }

  if (print !== undefined) {
    const row = map.find((r) => r.print === print);
    if (!row) {
      console.error(`print word ${print} is not a lexical word of ${key}`);
      console.error(`  it has ${map.length}: ${map.map((r) => r.print).join(" ")}`);
      console.error("  (pause marks are numbered by the print and are never in this map)");
      process.exit(1);
    }
    console.log(`${key} print ${row.print} → QAC ${row.qac}${row.qacSpan > 1 ? `–${row.qac + row.qacSpan - 1}` : ""}`);
    const siblings = align.printWordsOf(key, row.qac);
    if (siblings.length > 1) console.log(`  QAC ${row.qac} is print ${siblings.join(" + ")} — the print split it`);
    return;
  }

  if (qac !== undefined) {
    const words = align.printWordsOf(key, qac);
    if (!words.length) {
      console.error(`QAC word ${qac} is not in ${key} — it has ${align.qacCount(key)}`);
      process.exit(1);
    }
    console.log(`${key} QAC ${qac} → print ${words.join(" + ")}`);
    return;
  }

  console.log(`${key} — ${map.length} print words → ${align.qacCount(key)} QAC words\n`);
  console.log("  print   QAC");
  for (const row of map) {
    const span = row.qacSpan > 1 ? `${row.qac}–${row.qac + row.qacSpan - 1}` : `${row.qac}`;
    const note =
      row.qacSpan > 1
        ? "  ← one print word, two QAC words"
        : align.printWordsOf(key, row.qac).length > 1
          ? "  ← joined"
          : "";
    console.log(`  ${String(row.print).padStart(5)}  ${span.padStart(4)}${note}`);
  }
}

// --------------------------------------------------------------------- cli --

const argv = process.argv.slice(2);
const flag = (name) => {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : Number(argv[at + 1]);
};

if (argv.includes("--rebuild")) {
  await rebuild({ fetch: argv.includes("--fetch") });
} else {
  const key = argv.find((a) => /^\d+:\d+$/.test(a));
  if (!key) {
    console.error("usage: pnpm align --rebuild [--fetch]");
    console.error("       pnpm align <surah>:<ayah> [--print N | --qac N]");
    process.exit(1);
  }
  lookup(key, { print: flag("--print"), qac: flag("--qac") });
}
