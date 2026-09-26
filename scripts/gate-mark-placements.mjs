#!/usr/bin/env node
/**
 * CI gate: the mark-placement shards are the ones `build-mark-placements.mjs`
 * produced, every rectangle is drawable on the page it claims, and — the reason
 * this gate exists — not one mark a person placed by hand is stranded.
 *
 * `build-mark-placements.mjs` reads a 380 MB ligature-corpus cache and a 74 MB
 * whole-book displacement file to write ~14 MB of committed geometry: one final
 * rectangle per mark across all 604 pages, option H. Nothing in CI can afford to
 * re-run it, and nothing should have to — `mark-boxes.pin.json` carries a
 * SHA-256 of every shard, so a hand-edited shard fails here without anyone
 * fetching either large input. That is the division of labour `gate:words` and
 * `gate:pages` run on: the producer verifies its inputs when it runs, the gate
 * verifies its outputs on every run, offline.
 *
 * A hash only proves the bytes did not move. Three things this gate re-derives
 * from the committed files and nothing else:
 *
 *   SHAPE     every rectangle is four finite numbers, has area, is rounded to
 *             the one decimal the shards ship at, and sits inside the page's own
 *             viewBox. Marks are superscripts and sublinear diacritics, so —
 *             unlike a word box — a mark's rectangle is NOT expected to fall
 *             inside its ayah's tap polygon, and this gate does not ask it to;
 *             that would fail the very displacement the placement corrects.
 *   PAIRING   every ayah a shard carries has a polygon on that page's SVG, so a
 *             shard cannot invent an ayah. One direction only: unlike a word, an
 *             ayah can carry no marks at all — the disjoined letters طٰه are drawn
 *             bare — so a polygon absent from the shard is a page of the Book,
 *             not a lost ayah.
 *   HAND      every hand rectangle shipped traces to a committed ruling, every
 *             winning ruling ships, and the counts agree with the pin. This is
 *             the no-stranded proof, done offline — see below.
 *
 * ## The no-stranded proof, without the corpus
 *
 * A hand placement is one a person dragged onto a mark's own ink in a sitting
 * and `settle-mark-report.mjs` banked into a ruling under
 * `docs/validation/rulings/`. The build resolves each ruling to its live mark by
 * that mark's *identity* and lays the person's rectangle over the automatic one;
 * it refuses to write a shard while any hand placement fails to resolve. This
 * gate cannot resolve by identity — that needs the corpus it is forbidden to
 * read — so it reconciles by rectangle instead, which the committed bytes carry
 * in full:
 *
 *   - Each ruling names its mark's page, its name, and the *base* rectangle it
 *     shipped at. Two rulings about one physical mark share that base, so
 *     grouping by (page, name, base rectangle) and keeping the latest sitting
 *     gives the winning placement per mark — the same last-writer-wins the build
 *     does, keyed on a value the shards preserve.
 *   - Each shipped shard tags a hand-placed mark `s: "hand"` and carries its
 *     final rectangle.
 *
 * The winning rulings and the shipped hand marks must be the *same set* — every
 * winner present in a shard, every shipped hand mark traceable to a winner, and
 * both counts equal to the resolved count the pin recorded (which the build
 * computed by true identity). Three numbers from three independent readings; if
 * the rectangle proxy ever disagreed with identity, they would diverge and this
 * gate would stop. It is the same idea as `gate:words` re-measuring containment
 * with its own polygon parser: a second, independent witness to the claim, not a
 * re-run of the thing that made it.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const PIN_FILE = join(REPO, "packages", "etl", "data", "pages", "mark-boxes.pin.json");
const MARKS_DIR = join(REPO, "apps", "web", "public", "assets", "marks", "hafs-kfqc");
const PAGES_DIR = join(REPO, "apps", "web", "public", "assets", "pages", "hafs-kfqc");
const RULINGS_DIR = join(REPO, "docs", "validation", "rulings");

const failures = [];
const fail = (msg) => failures.push(msg);

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const r1 = (v) => Math.round(v * 10) / 10;
/** A rectangle as a stable key: page, mark name, and the four numbers at ship precision. */
const rectKey = (page, name, rect) => `${page}|${name}|${rect.map(r1).join(",")}`;

if (!existsSync(PIN_FILE)) {
  console.error("FAIL gate:mark-placements — no pin. Run `pnpm --filter @hifth/etl build:mark-placements`.");
  process.exit(1);
}
const pin = JSON.parse(readFileSync(PIN_FILE, "utf8"));

if (!existsSync(MARKS_DIR)) {
  console.error(`FAIL gate:mark-placements — ${MARKS_DIR} does not exist, but the pin lists ${pin.pages.length} shard(s).`);
  process.exit(1);
}

const onDisk = readdirSync(MARKS_DIR).sort();
const shardFiles = onDisk.filter((f) => /^\d+\.json$/.test(f));
const stray = onDisk.filter((f) => !shardFiles.includes(f));
if (stray.length) fail(`${stray.length} file(s) in the marks directory are not shards: ${stray.join(", ")}`);
if (shardFiles.length !== pin.pages.length) {
  fail(`the pin lists ${pin.pages.length} shard(s); ${shardFiles.length} are committed`);
}

/* --------------------------------------------------- the polygon numbers only */

/** The ayah keys a page SVG carries, read straight off the `number` attributes. */
function ayahKeysOf(svg) {
  const keys = new Set();
  for (const m of svg.matchAll(/<path\b[^>]*\bclass="ayahPolygon"[^>]*>/g)) {
    const number = Number((m[0].match(/\bnumber="(\d+)"/) ?? [])[1]);
    if (number) keys.add(`${Math.floor(number / 1000)}:${number % 1000}`);
  }
  return keys;
}

/* ------------------------------------------------------------- per-page checks */

const totals = { marks: 0, ink: 0, reach: 0, tilt: 0, hand: 0 };
const shippedHand = []; // { page, name, rect }

for (const row of pin.pages) {
  const page = row.page;
  const where = `page ${page}`;
  const shardFile = join(MARKS_DIR, `${page}.json`);
  const pageFile = join(PAGES_DIR, `${page}.svg`);

  if (!existsSync(shardFile)) {
    fail(`${where}: shard missing`);
    continue;
  }
  const raw = readFileSync(shardFile);
  if (sha256(raw) !== row.sha256) {
    fail(`${where}: shard does not match the pin — it was edited, or build:mark-placements was not re-run`);
    continue;
  }
  if (!existsSync(pageFile)) {
    fail(`${where}: shard is committed but the page SVG it measures is not`);
    continue;
  }

  const shard = JSON.parse(raw.toString("utf8"));
  if (shard.page !== page) fail(`${where}: shard says page ${shard.page}`);

  const svg = readFileSync(pageFile, "utf8");
  const vb = (svg.match(/viewBox="([^"]+)"/) ?? [])[1]?.split(/\s+/).map(Number);
  if (!vb || vb.length !== 4) {
    fail(`${where}: page SVG has no readable viewBox`);
    continue;
  }
  const polygonKeys = ayahKeysOf(svg);

  // Every ayah the shard names must have a polygon on the page — the shard cannot
  // invent an ayah. The reverse does not hold: an ayah can legitimately carry no
  // marks at all (the disjoined letters, طٰه at 20:1, are drawn bare here), so a
  // polygon with no entry in the shard is a page of the Book, not a fault.
  const ayahKeys = Object.keys(shard.marks);
  for (const key of ayahKeys) if (!polygonKeys.has(key)) fail(`${where}: ${key} has marks but no polygon on the page`);

  const tally = { marks: 0, ink: 0, reach: 0, tilt: 0, hand: 0 };
  for (const key of ayahKeys) {
    const list = shard.marks[key];
    if (!Array.isArray(list) || list.length === 0) {
      fail(`${where} ${key}: no marks`);
      continue;
    }
    for (const mk of list) {
      const at = `${where} ${key}`;
      if (!Number.isInteger(mk.w) || mk.w < 1) fail(`${at}: mark word index is ${mk.w}`);
      if (typeof mk.n !== "string" || !mk.n) fail(`${at}: mark has no name`);
      if (!["ink", "reach", "tilt", "hand"].includes(mk.s)) fail(`${at}: mark source is "${mk.s}"`);
      const rect = mk.r;
      if (!Array.isArray(rect) || rect.length !== 4 || rect.some((v) => !Number.isFinite(v))) {
        fail(`${at}: rectangle is not four finite numbers`);
        continue;
      }
      if (rect.some((v) => r1(v) !== v)) fail(`${at}: rectangle ${JSON.stringify(rect)} is not at one decimal`);
      const [x, y, w, h] = rect;
      if (w <= 0 || h <= 0) fail(`${at}: rectangle has no area`);
      if (x < vb[0] || y < vb[1] || x + w > vb[0] + vb[2] || y + h > vb[1] + vb[3]) {
        fail(`${at}: rectangle ${JSON.stringify(rect)} falls outside the page's ${vb.join(" ")} viewBox`);
      }
      tally.marks += 1;
      tally[mk.s] += 1;
      if (mk.s === "hand") shippedHand.push({ page, name: mk.n, rect });
    }
  }

  if (row.marks !== tally.marks) fail(`${where}: pin says ${row.marks} marks, the shard holds ${tally.marks}`);
  if (row.ink !== tally.ink) fail(`${where}: pin says ${row.ink} ink, the shard holds ${tally.ink}`);
  if ((row.reach ?? 0) !== tally.reach) fail(`${where}: pin says ${row.reach ?? 0} reach, the shard holds ${tally.reach}`);
  if (row.tilt !== tally.tilt) fail(`${where}: pin says ${row.tilt} tilt, the shard holds ${tally.tilt}`);
  if (row.hand !== tally.hand) fail(`${where}: pin says ${row.hand} hand, the shard holds ${tally.hand}`);
  if (row.ayahs !== ayahKeys.length) fail(`${where}: pin says ${row.ayahs} ayahs, the shard holds ${ayahKeys.length}`);
  for (const kk of Object.keys(totals)) totals[kk] += tally[kk];
}

// The pin's own totals must match what the shards actually hold.
for (const kk of Object.keys(totals)) {
  if (pin.totals?.[kk] !== totals[kk]) fail(`pin totals say ${kk}=${pin.totals?.[kk]}, the shards hold ${totals[kk]}`);
}

/* ---------------------------------------------- the no-stranded reconciliation */

// The winning hand placement per physical mark, keyed by (page, name, base box),
// latest sitting wins — the build's last-writer-wins, on a value the shards keep.
if (!existsSync(RULINGS_DIR)) {
  fail("no rulings directory — the hand placements cannot be reconciled");
} else {
  const rulingFiles = readdirSync(RULINGS_DIR).filter((f) => /\.settled\.json$/.test(f)).sort();
  const winners = new Map(); // base-key -> { at, page, name, rect }
  const placedPerFile = new Map();
  for (const f of rulingFiles) {
    const j = JSON.parse(readFileSync(join(RULINGS_DIR, f), "utf8"));
    const at = j.settledAt || "";
    let placed = 0;
    for (const m of j.settledMarks || []) {
      if (!(m.fault && Array.isArray(m.settled))) continue;
      placed += 1;
      const base = rectKey(m.page, m.name, m.box || []);
      const prev = winners.get(base);
      if (!prev || at >= prev.at) winners.set(base, { at, page: m.page, name: m.name, rect: m.settled });
    }
    placedPerFile.set(f, placed);
  }

  // The pin's record of the rulings must match the committed rulings.
  for (const src of pin.authored?.sources ?? []) {
    const have = placedPerFile.get(src.file);
    if (have === undefined) fail(`pin names ruling ${src.file}, which is not committed`);
    else if (have !== src.placed) fail(`pin says ${src.file} placed ${src.placed}; it places ${have}`);
  }
  for (const f of rulingFiles) {
    if (!(pin.authored?.sources ?? []).some((s) => s.file === f)) fail(`ruling ${f} is committed but the pin does not name it`);
  }

  const winnerRects = new Set([...winners.values()].map((w) => rectKey(w.page, w.name, w.rect)));
  const shippedRects = new Set(shippedHand.map((h) => rectKey(h.page, h.name, h.rect)));

  let stranded = 0;
  for (const w of winners.values()) {
    if (!shippedRects.has(rectKey(w.page, w.name, w.rect))) {
      stranded += 1;
      if (stranded <= 10) fail(`hand placement stranded — ${w.name} on page ${w.page} at ${w.rect.map(r1).join(",")} is in a ruling but no shard`);
    }
  }
  let invented = 0;
  for (const h of shippedHand) {
    if (!winnerRects.has(rectKey(h.page, h.name, h.rect))) {
      invented += 1;
      if (invented <= 10) fail(`shipped hand mark not in any ruling — ${h.name} on page ${h.page} at ${h.rect.map(r1).join(",")}`);
    }
  }

  // Three independent counts of the same set.
  if (winners.size !== shippedHand.length) fail(`${winners.size} winning hand placement(s), but ${shippedHand.length} shipped hand mark(s)`);
  const resolved = pin.authored?.resolved;
  if (resolved !== winners.size) fail(`pin says ${resolved} placement(s) resolved; ${winners.size} win by rectangle`);
  if (pin.authored?.unresolved) fail(`pin records ${pin.authored.unresolved} unresolved placement(s) — the build should have refused to write`);
}

/* ----------------------------------------------------------------------- verdict */

if (failures.length) {
  console.error(`FAIL gate:mark-placements — ${failures.length} problem(s):`);
  for (const f of failures.slice(0, 40)) console.error(`  ${f}`);
  if (failures.length > 40) console.error(`  … and ${failures.length - 40} more`);
  process.exit(1);
}

console.log(
  `gate:mark-placements — ${pin.pages.length} shard(s) match the pin; ${totals.marks} marks drawn ` +
    `(${totals.ink} on ink, ${totals.reach} reaching for the ink, ${totals.tilt} on the line's tilt, ${totals.hand} by hand), every rectangle inside its page; ` +
    `all ${totals.hand} hand placements trace to a committed ruling and none is stranded`,
);
