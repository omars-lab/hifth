#!/usr/bin/env node
/**
 * Are the sittings on disk the ones somebody should actually sit?
 *
 * The rebuild step of a sitting review ends with an instruction and no command:
 * *confirm the deal did not move — same number of parts, same total, and no mark
 * that has been answered coming back round again.* Everything before it in that
 * skill is a script. That one sentence was a person squinting at sixteen files,
 * which means in practice it was a person not squinting at sixteen files, and the
 * two ways it goes wrong are both silent:
 *
 *   - A rebuild is **forgotten**, or run with one hand-over left out of the list.
 *     The parts still open, still count down, still bank answers — and re-ask
 *     questions somebody already answered. The reader cannot tell; the pages look
 *     exactly like pages they have not seen.
 *   - A rebuild is run against **different measurements**. Every rectangle in every
 *     part is then drawn from displacements that are not the ones on disk, so every
 *     answer is about a picture nobody will be able to reconstruct afterwards. This
 *     is the worse one, because the answers are wrong rather than merely wasted, and
 *     nothing downstream can detect it.
 *
 * Both are exactly checkable, because a built sitting says what it was built from.
 * The identity is not decoration: the reader's place is stored under a key made of
 * the measurements' fingerprint, the set, the slice and the seed, and the answered
 * set is folded into the slice for that reason. So a part that disagrees with the
 * tree announces itself, if anything asks.
 *
 * This asks. It reads no answers of its own — the one reading of *answered* lives in
 * lib/answered.mjs and both this and the builder import it, because two readings of
 * that word drift and the drift shows up as a mark one of them drops and the other
 * counts, with neither obviously wrong.
 *
 * It is an audit, not a gate. It cannot run in CI: the sittings are build products in
 * `out/`, the answers accumulate on the machine doing the serving, and a check that
 * passes in CI by being unable to look is worse than no check.
 *
 *   node scripts/audit-mark-sittings.mjs --answered out/mark-answers.jsonl,out/handed.json
 *   pnpm audit:sittings -- --answered out/mark-answers.jsonl
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { answeredKey, fingerprint, readAnswered } from "./lib/answered.mjs";
import { readSitting } from "./lib/sitting-file.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ETL = join(HERE, "..");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const dir = arg("--dir", join(ETL, "out"));
const rowsPath = arg("--rows", join(ETL, "out", "mark-rows.line-tilt.json"));

/**
 * The same flag the builder takes, and it is required to be the same list.
 *
 * Defaulting it would be the one mistake worth avoiding here. An auditor that
 * quietly reads the running log and nothing else calls a sitting stale whenever a
 * hand-over exists, or calls it fresh whenever the rebuild used a file this did not
 * — and both verdicts are confident. So it is given, exactly as the rebuild was
 * given it, and the report prints what it read so a wrong list is visible rather
 * than inferred.
 */
const answeredPaths = String(arg("--answered", ""))
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

const problems = [];
const notes = [];

if (!existsSync(dir)) {
  console.error(`audit:sittings — FAIL: no ${dir.replace(`${ETL}/`, "")} to look in. Nothing has been built.`);
  process.exit(1);
}

/* What the rectangles were measured from, as it stands right now. */
let rowsFpNow = null;
if (existsSync(rowsPath)) rowsFpNow = fingerprint(readFileSync(rowsPath, "utf8"));
else notes.push(`the rows file ${rowsPath.replace(`${ETL}/`, "")} is not here, so nothing can be said about which measurements the parts were drawn from`);

const answered = answeredPaths.length ? readAnswered(answeredPaths) : new Set();
const wantKey = answeredKey(answered);

/**
 * Read the built sittings back.
 *
 * The reading itself is in lib/sitting-file.mjs, shared with the front door, for the
 * reason given there: two readers of the same two literals disagree eventually, and
 * the disagreement is a part one of them cannot see. It hands faults back rather than
 * printing them, so they land in this run's problem list and fail the audit.
 */
const sittings = readdirSync(dir)
  .filter((n) => n.endsWith(".html"))
  .map((n) => readSitting(join(dir, n)))
  .filter(Boolean);

for (const s of sittings) {
  for (const fault of s.faults) problems.push(`${s.file.replace(`${ETL}/`, "")}: ${fault}`);
}

if (!sittings.length) {
  console.error(`audit:sittings — FAIL: no built sittings in ${dir.replace(`${ETL}/`, "")}.`);
  process.exit(1);
}

/**
 * A **deal** is one shuffle dealt out into parts: the same set, the same seed, the
 * same number of parts. Two deals in the same directory are not a fault — the bands
 * are five separate small sittings on purpose, and an old deal left behind is
 * evidence, not litter. What is a fault is a *gap inside* one deal, so they are
 * grouped first and every check below is asked of a deal rather than of a folder.
 */
const deals = new Map();
for (const s of sittings) {
  const { set, seed, part, band } = s.head;
  if (!part) {
    notes.push(`${s.file.replace(`${ETL}/`, "")} is a single sitting rather than part of a deal${band ? ` (the ${band} band)` : ""} — counted, not audited for coverage`);
    continue;
  }
  const of = Number(part.split("/")[1]);
  const key = `${set} · seed ${seed} · ${of} parts`;
  if (!deals.has(key)) deals.set(key, []);
  deals.get(key).push(s);
}

for (const [key, parts] of deals) {
  const say = (msg) => problems.push(`${key}: ${msg}`);
  const of = Number(parts[0].head.part.split("/")[1]);

  /* ① every part of the deal is here, once. */
  const byN = new Map();
  for (const p of parts) {
    const n = Number(p.head.part.split("/")[0]);
    if (byN.has(n)) say(`part ${n} of ${of} is built twice, as ${byN.get(n).file.replace(`${ETL}/`, "")} and ${p.file.replace(`${ETL}/`, "")} — a reader handed both answers the same marks twice`);
    else byN.set(n, p);
  }
  const missing = [];
  for (let n = 1; n <= of; n += 1) if (!byN.has(n)) missing.push(n);
  if (missing.length) say(`part${missing.length > 1 ? "s" : ""} ${missing.join(", ")} of ${of} ${missing.length > 1 ? "are" : "is"} not built — those marks are in nobody's sitting`);

  /* ② one measurement across the whole deal, and it is the one on disk. */
  const fps = new Set(parts.map((p) => p.head.rowsFingerprint));
  if (fps.size > 1) say(`the parts were drawn from ${fps.size} different measurements (${[...fps].join(", ")}) — they are not one deal, and their answers cannot be settled together`);
  else if (rowsFpNow && !fps.has(rowsFpNow)) say(`built from measurements ${[...fps][0]}, but the rows file on disk is ${rowsFpNow} — every rectangle in every part is about a mark that is not where these parts say it is. Rebuild before anyone sits.`);

  /* ③ the deal knows about every answer that has been given. */
  const keys = new Set(parts.map((p) => String(p.head.slice).replace(/^-p\d+of\d+/, "")));
  if (keys.size > 1) say(`the parts disagree about which answers had been given when they were built — some were rebuilt and some were not`);
  else if ([...keys][0] !== wantKey) {
    const had = [...keys][0] || "(none)";
    say(`built against a different set of answers than the one on disk (part says ${had}, the answers say ${wantKey || "(none)"}) — the rebuild has not been run since somebody last answered${answeredPaths.length ? "" : ", or --answered was not given the files the rebuild was given"}`);
  }

  /* ④ nothing that has been answered comes back round. */
  const seen = new Map();
  let reasked = 0;
  for (const p of parts) {
    for (const id of p.ids) {
      if (answered.has(id)) reasked += 1;
      const where = seen.get(id);
      if (where) say(`${id} is asked in part ${where} and again in part ${p.head.part} — one mark, two answers, and nothing downstream can tell they are the same question`);
      else seen.set(id, p.head.part);
    }
  }
  if (reasked) say(`${reasked} mark${reasked > 1 ? "s" : ""} already carrying a standing answer ${reasked > 1 ? "are" : "is"} asked again`);

  /* ⑤ the arithmetic the reader is shown adds up. */
  const shown = parts.reduce((n, p) => n + (p.head.shown ?? p.ids.length), 0);
  const pool = new Set(parts.map((p) => p.head.pool));
  const population = new Set(parts.map((p) => p.head.population));
  const already = new Set(parts.map((p) => p.head.alreadyAnswered));
  if (pool.size > 1 || population.size > 1) say(`the parts disagree about how big the job is`);
  else {
    const [poolN] = [...pool];
    const [popN] = [...population];
    const [answeredN] = [...already];
    if (!missing.length && shown !== poolN) say(`the parts hold ${shown} marks between them but claim to be dealing out ${poolN} — ${Math.abs(poolN - shown)} ${shown < poolN ? "in nobody's sitting" : "counted twice"}`);
    if (poolN + answeredN !== popN) say(`${poolN} left plus ${answeredN} answered is not ${popN} — the count a reader is shown does not describe this population`);
    // More answers were dropped at build time than this run can find. The rebuild was
    // given a hand-over that `--answered` was not, and every count below is short.
    if (answeredN > answered.size) say(`built after ${answeredN} answers had been given, but only ${answered.size} can be read back — a file the rebuild used is not in --answered`);
    notes.push(`${key}: ${shown} marks across ${byN.size} parts, ${answeredN} already answered, ${popN} in all`);
  }
}

const label = "audit:sittings";
if (answeredPaths.length) console.log(`${label} — answers read from ${answeredPaths.map((p) => p.replace(`${ETL}/`, "")).join(", ")} (${answered.size} standing)`);
else console.log(`${label} — no --answered given, so every part is expected to hold the whole population`);
if (rowsFpNow) console.log(`${label} — measurements on disk: ${rowsPath.replace(`${ETL}/`, "")} (${rowsFpNow})`);
for (const n of notes) console.log(`${label} — ${n}`);

if (problems.length) {
  console.error("");
  for (const p of problems) console.error(`${label} — FAIL: ${p}`);
  process.exit(1);
}
console.log(`${label} — the deal did not move.`);
