#!/usr/bin/env node
/**
 * Where every mark is drawn, once and for the app — option H, made shippable.
 *
 * The placement decision (`docs/decisions.json` → `mark-placement`) is settled:
 * **H**. Put each mark on its own found ink where the print's own stroke is
 * there to sit on, and where it is not, let the mark inherit the tilt of the
 * printed line it belongs to. That is a rule this repo has drawn, argued and
 * measured on one page (`docs/design/mark-placement.html`, the page-179 draw).
 * What it had never done is *materialise* it: turn the rule into a rectangle per
 * mark across all 604 pages, commit those rectangles, and hand a person the one
 * lever they asked for — the marks the machine cannot place, placed by hand and
 * carried through to what ships. This build is that materialisation.
 *
 * ## The two halves, and the seam between them
 *
 * **Automatic**, for the confident majority. For each of the 326,515 marks the
 * ink search measured, `refusedItsOwnInk` asks whether the mark found its own
 * ink: the match cleared IoU 0.55 *and* the search did not run out of the room
 * it was given (each mark carries its own `searchedAt` — 3 for the ordinary
 * look, 8 for the marks the wide second look rescued). If it did, the mark goes
 * exactly where the search put it, `box + (dx, dy)`.
 *
 * If it did not, the mark first *reaches for the ink*: the pieces of print under
 * its own search window whose middle sits inside the rectangle we ship are
 * unioned into one candidate, and that candidate is taken when its area stays
 * close to the shipped rectangle's — grown no more than 1.75× and shrunk no
 * more than to 0.571× (`packages/etl/scripts/lib/piece-union.mjs`, the guard
 * settled in `mark-registration.md` ㉞). This is the one move that fixes a
 * refused doubled mark, whose box was drawn for one stroke and needs its true
 * two-stroke extent (㉖), and a refused single mark, which needed the ink's
 * position (㉟) — both at once, because the ink piece carries both.
 *
 * Only where there is no piece to point to, or the union is too far from the
 * shipped size to believe, does the mark fall back to the printed line's own
 * drift — the `line-tilt` correction fitted on that page. That is the floor that
 * makes H shippable rather than reckless: a mark chasing weak ink it cannot even
 * find is set down on the line instead of on the noise.
 *
 * A note on which "ran out of room" test this uses, because there are two in the
 * tree and they disagree. `refusedItsOwnInk` reads each mark's *own* reach
 * (`searchedAt`); the decision page's `trusted` hard-codes ±3. For a mark the
 * wide look rescued, those give opposite verdicts at the ±3 wall — and the
 * per-mark reach is the correct one, because a mark searched to ±8 that landed
 * at 3 was nowhere near its wall. The ship asset uses the correct test; the
 * divergence is filed as an issue (`asDrawn-vs-ranOutOfRoom-fixed-radius`).
 *
 * **By hand**, laid over the top. Every mark a person dragged onto its own ink
 * in a sitting was settled into a ruling under `docs/validation/rulings/`; this
 * build reads all of them back through `authoredPlacements`, which resolves each
 * ruling to the live mark it is about *by that mark's identity* — the word it
 * sits on, its name and its rank — so an afternoon of hand placement survives a
 * re-extract that renumbers the page. Where a person placed a mark, their
 * rectangle wins over the automatic one, always. **The build refuses to write a
 * single shard while any hand placement fails to resolve**: a placement a person
 * made that the app would silently ignore is the one failure this whole scheme
 * exists to prevent, so it stops the build rather than shipping around it.
 *
 * ## What a shard contains
 *
 *     { "page": 3, "marks": { "2:6": [ { "w": 1, "n": "fatha",
 *                                        "r": [x, y, w, h], "s": "ink" }, … ] } }
 *
 * Keyed by ayah, the way the word shards are, so a mark joins to its word and
 * its ayah with no third index. `w` is the mark's word within the ayah (the
 * print's own `data-word-index-in-ayah`); `n` is the mark's name; `r` is the
 * final rectangle in our viewBox units at one decimal — the same precision the
 * page paths and word boxes ship at; `s` is where the rectangle came from —
 * `ink` (its own found ink), `reach` (the union of ink pieces under a refused
 * mark's window, when the guard trusts it), `tilt` (the line's fallback), or
 * `hand` (a person). Marks appear in reading order within each ayah.
 *
 * **No text**, for the same reason the word shards carry none: a mark's identity
 * here is (page, ayah, word, name), reproducible from the pin, and the spelling
 * would be the first Qur'an text this repo ever shipped.
 *
 * ## What this reads, and what a fresh clone cannot
 *
 * Like `build-words.mjs`, this is a producer that pays a build-time cost no CI
 * run should: it reads the 380 MB ligature-corpus cache (`marksOf`) and the
 * 74 MB whole-book displacement rows (`mark-rows.line-tilt.json`, gitignored,
 * fingerprint recorded in the pin). It writes ~14 MB of committed geometry. A
 * fresh clone rebuilds the rows with `probe-mark-ink.mjs --rows-out` first; the
 * gate (`gate:mark-placements`) verifies the committed shards offline, against
 * the pin and the committed rulings, and never needs either large input.
 *
 * Usage:
 *   pnpm --filter @hifth/etl build:mark-placements          from the caches
 *   node scripts/build-mark-placements.mjs --pages 1,179    a subset, to look
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { fingerprint } from "./lib/answered.mjs";
import { readPageInk } from "./lib/ink.mjs";
import { authoredIdOf, authoredPlacements } from "./lib/mark-authored.mjs";
import { refusedItsOwnInk } from "./lib/mark-ink.mjs";
import { marksOf } from "./lib/marks.mjs";
import { GUARD, pieceUnionCandidate, reachOrFall } from "./lib/piece-union.mjs";
import { correctionFor } from "./lib/registration-grain.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const ROWS = join(HERE, "..", "out", "mark-rows.line-tilt.json");
const RULINGS = join(REPO, "docs", "validation", "rulings");
const PAGES = join(REPO, "apps", "web", "public", "assets", "pages", "hafs-kfqc");
const OUT = join(REPO, "apps", "web", "public", "assets", "marks", "hafs-kfqc");
const PIN_OUT = join(HERE, "..", "data", "pages", "mark-boxes.pin.json");

/** The raster grain the ink search ran at, and so the grain a reach candidate is cut at. */
const RES = 16;

/**
 * The rule, in two numbers. A mark is placed on its own ink when its best match
 * clears `iou` and the search did not run out of `radius` (or the wider reach
 * the mark itself records). Both are the settled values every sitting used.
 */
const RULE = { iou: 0.55, radius: 3 };

const sha = (s) => createHash("sha256").update(s).digest("hex");
const r1 = (v) => Math.round(v * 10) / 10;

const argOf = (flag, dflt = null) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt;
};

const die = (msg) => {
  console.error(`\nFAIL build:mark-placements — ${msg}\n`);
  process.exit(1);
};

// ── the measured displacements ────────────────────────────────────────────
if (!existsSync(ROWS)) {
  die(`no displacement rows at ${ROWS.replace(REPO, "")}. Rebuild with:\n  node scripts/probe-mark-ink.mjs --rows-out packages/etl/out/mark-rows.line-tilt.json`);
}
const rowsText = readFileSync(ROWS, "utf8");
const rowsFp = fingerprint(rowsText);
const rows = JSON.parse(rowsText);
const byPage = new Map();
for (const r of rows) {
  if (!byPage.has(r.page)) byPage.set(r.page, new Map());
  byPage.get(r.page).set(r.k, r);
}

// ── the corpus, read once per page and remembered ─────────────────────────
const marksCache = new Map();
const marksForPage = (p) => {
  if (!marksCache.has(p)) marksCache.set(p, marksOf(p));
  return marksCache.get(p);
};

// ── the page's own ink, read once per page and remembered ─────────────────
// Only a refused mark reaches for it, so it is loaded lazily: a page with no
// refusal never opens its SVG. The outlines come from committed bytes, so the
// gate can re-check every rectangle offline without them.
const inkCache = new Map();
const inkForPage = (p) => {
  if (!inkCache.has(p)) inkCache.set(p, readPageInk(readFileSync(join(PAGES, `${p}.svg`), "utf8"), 1 / RES).shapes);
  return inkCache.get(p);
};

// ── the hand placements, resolved by identity ─────────────────────────────
const rulingFiles = readdirSync(RULINGS)
  .filter((f) => /\.settled\.json$/.test(f))
  .sort();
const rulings = rulingFiles.map((f) => {
  const j = JSON.parse(readFileSync(join(RULINGS, f), "utf8"));
  return { from: f, settledAt: j.settledAt || "", settledMarks: j.settledMarks || [] };
});
const { placements, unresolved } = authoredPlacements(rulings, marksForPage);
if (unresolved.length) {
  console.error(`\nFAIL build:mark-placements — ${unresolved.length} hand placement(s) cannot be resolved to a live mark:\n`);
  for (const u of unresolved) console.error(`  ${u.from}  ${u.id}  ${u.name}  (page ${u.page})`);
  console.error(`\nA placement a person made and the app would ignore stops the build. Re-settle these, or the corpus moved under them.\n`);
  process.exit(1);
}

// ── which pages to write ──────────────────────────────────────────────────
const only = argOf("--pages");
const pages = only ? only.split(",").map(Number) : [...byPage.keys()].sort((a, b) => a - b);

if (!only) {
  rmSync(OUT, { recursive: true, force: true });
}
mkdirSync(OUT, { recursive: true });

// ── build ─────────────────────────────────────────────────────────────────
const pinPages = [];
const consumed = new Set();
const totals = { marks: 0, ink: 0, reach: 0, tilt: 0, hand: 0 };
let wrote = 0;

for (const page of pages) {
  const rmap = byPage.get(page);
  if (!rmap) die(`page ${page} has no rows in ${ROWS.replace(REPO, "")}`);
  const ms = marksForPage(page);
  const corr = correctionFor("line-tilt", [...rmap.values()]);

  const marks = {};
  const tally = { marks: 0, ink: 0, reach: 0, tilt: 0, hand: 0 };
  for (const m of ms) {
    const row = rmap.get(m.k);
    if (!row) die(`page ${page} mark ${m.k} (${m.name}) has no measured row`);
    // The rows and the corpus must be the same extract, or the join is a lie.
    if (m.box.some((v, i) => Math.abs(v - row.box[i]) > 0.2)) {
      die(`page ${page} mark ${m.k}: corpus box ${JSON.stringify(m.box)} ≠ rows box ${JSON.stringify(row.box)} — the rows file is a different extract than the cache`);
    }

    // Where each mark goes, in three tiers. A mark the search placed on its own
    // ink sits exactly there. A mark it refused reaches for the ink instead: the
    // pieces under its own window, unioned, when that union stays close enough in
    // area to the rectangle we ship (the ㉞ guard, 1.75/0.571) to be believed —
    // this is what fixes a refused doubled mark's size (㉖) and the refused
    // singles' position (㉟) in one move. A refused mark with no piece to point
    // to, or one whose union the guard throws out, falls back to the printed
    // line's own tilt. A hand placement, resolved below, wins over all of them.
    const refused = refusedItsOwnInk(row, RULE.radius, RULE.iou);
    const { candidate, ratio } = refused
      ? pieceUnionCandidate(row, inkForPage(page), { radius: RULE.radius, res: RES })
      : { candidate: null, ratio: null };
    let src = reachOrFall(refused, candidate, ratio);
    let rect;
    if (src === "ink") {
      rect = [r1(m.box[0] + row.dx), r1(m.box[1] + row.dy), r1(m.box[2]), r1(m.box[3])];
    } else if (src === "reach") {
      rect = candidate.map(r1);
    } else {
      const d = corr.apply(row);
      rect = [r1(m.box[0] + d.dx), r1(m.box[1] + d.dy), r1(m.box[2]), r1(m.box[3])];
    }

    const cid = authoredIdOf(m);
    const hand = placements.get(cid);
    if (hand) {
      rect = hand.rect.map(r1);
      src = "hand";
      consumed.add(cid);
    }

    const key = `${m.surah}:${m.aya}`;
    (marks[key] || (marks[key] = [])).push({ w: m.idx, n: m.name, r: rect, s: src });
    tally.marks += 1;
    tally[src] += 1;
  }

  const text = `${JSON.stringify({ page, marks })}\n`;
  writeFileSync(join(OUT, `${page}.json`), text);
  wrote += text.length;
  pinPages.push({ page, ayahs: Object.keys(marks).length, ...tally, sha256: sha(text) });
  for (const kk of Object.keys(tally)) totals[kk] += tally[kk];
}

// ── every hand placement must have landed ─────────────────────────────────
if (!only && consumed.size !== placements.size) {
  const missed = [...placements.values()].filter((p) => !consumed.has(p.id));
  console.error(`\nFAIL build:mark-placements — ${missed.length} resolved hand placement(s) never matched a mark on their page:\n`);
  for (const m of missed) console.error(`  ${m.from}  ${m.id}  (page ${m.page})`);
  process.exit(1);
}

// ── the pin ───────────────────────────────────────────────────────────────
if (!only) {
  const pin = {
    $comment:
      "What build-mark-placements.mjs wrote, per page: the final rectangle of every mark, option H. " +
      "The sha256 is the shard this repo ships; gate:mark-placements checks every one offline and " +
      "re-derives the rule from the committed rows fingerprint and rulings.",
    $rule:
      "Option H (docs/decisions.json → mark-placement, decided). Each mark sits on its own found ink " +
      "when its match clears IoU " + RULE.iou + " and the search kept room (its own searchedAt). A refused " +
      "mark reaches for the ink instead — the union of pieces under its window — when that union's area " +
      "stays between " + GUARD.shrink.toFixed(3) + "x and " + GUARD.grow + "x the shipped box (the guard settled in " +
      "mark-registration ㉞); otherwise it inherits the printed line's tilt. Hand placements win over all of them.",
    rule: { iou: RULE.iou, radius: RULE.radius, reachGuard: { grow: GUARD.grow, shrink: Number(GUARD.shrink.toFixed(3)) }, fallback: "line-tilt" },
    rows: {
      file: "packages/etl/out/mark-rows.line-tilt.json",
      fingerprint: rowsFp,
      builtBy: "node scripts/probe-mark-ink.mjs --rows-out packages/etl/out/mark-rows.line-tilt.json",
    },
    authored: {
      sources: rulings.map((r) => ({
        file: r.from,
        settledAt: r.settledAt,
        placed: r.settledMarks.filter((x) => x.fault && Array.isArray(x.settled)).length,
      })),
      resolved: placements.size,
      unresolved: 0,
    },
    ranOn: new Date().toISOString().slice(0, 10),
    totals,
    pages: pinPages,
  };
  writeFileSync(PIN_OUT, `${JSON.stringify(pin, null, 2)}\n`);
}

// ── say what happened ──────────────────────────────────────────────────────
const gz = readdirSync(OUT)
  .filter((f) => /^\d+\.json$/.test(f))
  .reduce((t, f) => t + gzipSync(readFileSync(join(OUT, f))).length, 0);
console.log(
  `\nbuild:mark-placements — ${pinPages.length} shard(s), ${totals.marks} marks\n` +
    `  ${totals.ink} on their own ink · ${totals.reach} reaching for the ink · ${totals.tilt} on the line's tilt · ${totals.hand} by hand (of ${placements.size} placements)\n` +
    `  ${(wrote / 1024 / 1024).toFixed(1)} MB raw / ${(gz / 1024 / 1024).toFixed(2)} MB gz written to ${OUT.replace(REPO, "")}\n` +
    (only ? "  (subset — pin not rewritten)\n" : `  pin → ${PIN_OUT.replace(REPO, "")}\n`),
);
