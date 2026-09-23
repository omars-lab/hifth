/**
 * Re-scores a committed ruling from the seed and the inputs beside it, and says
 * whether today's number is the recorded one.
 *
 *   node packages/etl/scripts/replay-ruling.mjs <ruling path or id>
 *   node packages/etl/scripts/replay-ruling.mjs <ruling path or id> --record
 *   node packages/etl/scripts/replay-ruling.mjs --list
 *
 * ## What this is for
 *
 * Everything else in the rigor stack makes a faked number *hard*: the answers are
 * committed, the measurement they were given against is committed with its
 * fingerprint in its name, every grader stamps its result with a fingerprint of
 * its own code, and every grader checks a known answer before it scores anything.
 * None of that lets a stranger *do* anything. This does. It takes a ruling that is
 * in the repository, rebuilds the sitting it came from, applies the committed
 * answers, runs the scorer again, and prints — recorded beside recomputed — the
 * three things that have to agree for the number to be the same number: the
 * fingerprint of the input, the fingerprint of the grading code, and the headline
 * figure. It exits 0 only when all of them do. Somebody who wants us to be wrong
 * runs one command and gets our number, or does not.
 *
 * ## What "recorded" means, and where the record is
 *
 * A raw sitting is written by a page in a browser. The page has no grading code
 * to stamp it with, and it does not know the headline, because the headline is
 * what the scorer computes afterwards. So the record lives in a small **receipt**
 * beside the ruling — `<ruling>.replay.json` — that holds what the scorer said on
 * the day the receipt was written: the input fingerprint, the code fingerprint,
 * the headline, the exit code, and every line the scorer printed. `--record`
 * writes one. A ruling with no receipt is *unstamped*: there is nothing to check
 * a replay against, and this says so and stops rather than inventing a record to
 * agree with. When a change to a grader is meant to change its verdict, the
 * receipt is re-recorded beside the change, the same way the graders' known-answer
 * fixtures are — so the new number lands in a diff a reviewer reads.
 *
 * ## What it covers, and what it cannot
 *
 * It replays the **raw sittings**: a placing session (`kind: "nudge"`) or a
 * forced choice (`kind: "session"`), where the trial list is rebuilt from the
 * seed, the answers are keyed by trial, and the measurement they were shown
 * against is committed under `docs/validation/rulings/` with its fingerprint in
 * its name. One thing the rebuild needs is not committed: the word-corpus pages
 * the marks are read from, which are a pinned download (their hash is committed,
 * and fetching them checks it). The shipped page ink is committed.
 *
 * It does **not** replay a **settled table** (`built: "mark-settled"`). Those are
 * the collapse of a transcript against a measurement of every mark on every page,
 * and neither the transcripts nor that measurement is in the repository — the
 * measurement is rebuilt, not committed, and is tens of megabytes. A settled table
 * can be re-counted from its own rows; it cannot be re-scored. This says which of
 * the two it was handed, in those words, and exits non-zero for the one it cannot
 * do, because a replay that quietly did less than it appeared to would be worse
 * than none.
 *
 * ## Exit codes
 *
 * 0 — everything agrees. 1 — something differs, and the table says what. 2 — could
 * not read what it was given. 4 — cannot be replayed at all: unstamped, settled,
 * or an input that is not committed.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { codeFingerprint, stampOf, UNSTAMPED } from "./lib/grader-code.mjs";
import { normalise } from "./lib/self-test.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const RULINGS = join(ROOT, "docs", "validation", "rulings");

/**
 * The two raw-sitting kinds, the grader that reads each, and the line of its
 * printed verdict that is the headline. The regexes match the graders' own
 * output, which their known-answer self-tests pin line for line.
 */
const KINDS = {
  nudge: {
    what: "a placing sitting",
    script: "score-mark-nudge.mjs",
    headline: /^landed nearer our correction\s+(.+)$/m,
    label: "landed nearer our correction",
  },
  session: {
    what: "a forced-choice sitting",
    script: "score-mark-adjudication.mjs",
    headline: /^as shipped\s+(.+)$/m,
    label: "preferred as shipped",
  },
};

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const flag = (k) => argv.includes(k);
let target = null;
for (let i = 0; i < argv.length; i += 1) {
  if (["--shift", "--io"].includes(argv[i])) i += 1;
  else if (!argv[i].startsWith("--") && !target) target = argv[i];
}

const say = (s = "") => process.stdout.write(`${s}\n`);
const die = (msg, code = 2) => {
  process.stderr.write(`${msg}\n`);
  process.exit(code);
};
const rel = (p) => relative(ROOT, p);

/** The same eight-character hash every instrument keeps its own copy of. */
function fingerprint(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/* ── what a ruling is, read from its head alone ─────────────────────────── */

/** The receipt's path: beside the ruling, same stem, `.replay.json`. */
const receiptPath = (rulingPath) => rulingPath.replace(/\.json$/, ".replay.json");

/** The committed measurement a raw sitting was shown against, found by the fingerprint in its name. */
function committedShift(fp) {
  const file = readdirSync(RULINGS).find((f) => new RegExp(`^mark-shift\\..*\\.${fp}\\.json$`).test(f));
  return file ? join(RULINGS, file) : null;
}

/**
 * One of: `raw` (a sitting this can replay), `settled` (a table it cannot),
 * `other` (a measurement file, a finding — not a sitting at all).
 */
function classify(doc) {
  if (doc?.built === "mark-settled") return { type: "settled" };
  if (doc?.kind && KINDS[doc.kind] && typeof doc.shiftFingerprint === "string") return { type: "raw", kind: KINDS[doc.kind] };
  return { type: "other" };
}

/* ── --list: every ruling in the directory, and whether it can be replayed ─ */

if (flag("--list")) {
  const files = readdirSync(RULINGS)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".replay.json"))
    .sort();
  say("docs/validation/rulings — what can be re-scored from here");
  say();
  for (const f of files) {
    const p = join(RULINGS, f);
    let doc;
    try {
      doc = JSON.parse(readFileSync(p, "utf8"));
    } catch {
      say(`  ${f}\n      not JSON`);
      continue;
    }
    const c = classify(doc);
    let line;
    if (c.type === "settled") {
      line = "settled table — cannot be replayed: made from a transcript and a measurement that are not committed";
    } else if (c.type === "raw") {
      const shift = committedShift(doc.shiftFingerprint);
      const receipt = existsSync(receiptPath(p)) ? JSON.parse(readFileSync(receiptPath(p), "utf8")) : null;
      line = !shift
        ? `${c.kind.what} — cannot be replayed: the measurement it was shown against (${doc.shiftFingerprint}) is not committed`
        : !receipt
          ? `${c.kind.what} — unstamped: no receipt beside it, so there is nothing to check a replay against`
          : `${c.kind.what} — replayable; receipt recorded ${String(receipt.recordedAt).slice(0, 10)}, ${c.kind.label} ${receipt.headline}`;
    } else {
      line = "not a sitting (a measurement file or a finding) — nothing to replay";
    }
    say(`  ${f}\n      ${line}`);
  }
  process.exit(0);
}

if (!target) {
  die(
    "usage: replay-ruling.mjs <ruling path or id> [--record] [--shift <path>] [--io <module>]\n" +
      "       replay-ruling.mjs --list\n" +
      "  <id> is a file name under docs/validation/rulings, with or without .json",
  );
}

/* ── the ruling ─────────────────────────────────────────────────────────── */

const candidates = [
  isAbsolute(target) ? target : resolve(process.cwd(), target),
  join(ROOT, target),
  join(RULINGS, target),
  join(RULINGS, `${target}.json`),
];
const rulingPath = candidates.find((p) => existsSync(p) && p.endsWith(".json"));
if (!rulingPath) die(`no ruling at ${target} — tried it as a path and as a file name under docs/validation/rulings.`);
let doc;
try {
  doc = JSON.parse(readFileSync(rulingPath, "utf8"));
} catch {
  die(`${rel(rulingPath)} is not JSON.`);
}

say(`replaying ${rel(rulingPath)}`);
const c = classify(doc);

if (c.type === "settled") {
  const from = (doc.sittings ?? []).map((s) => s.file).join(", ") || "a transcript";
  say(`  a settled table — one row per mark, the collapse of what a reader said — not the answers themselves.`);
  say(`  It was made from ${from} and from ${doc.rows ?? "a measurement of every mark on every page"},`);
  say("  and neither is in the repository: the transcript was never committed, and the measurement is");
  say("  rebuilt rather than committed. What this file carries can be re-counted; it cannot be re-scored.");
  const recorded = stampOf(doc);
  if (recorded !== UNSTAMPED) {
    const now = codeFingerprint(join(HERE, "settle-mark-report.mjs")).hash;
    say();
    say(`  For what it is worth: it was settled by code ${recorded}, and the settler now hashes to ${now}` + (now === recorded ? " — the same." : " — it has changed since."));
  }
  say();
  say("cannot be replayed from committed bytes.");
  process.exit(4);
}
if (c.type === "other") {
  say("  not a sitting — a measurement file or a finding. There are no answers here to re-score.");
  process.exit(4);
}

const kind = c.kind;
const shiftOverride = arg("--shift", null);
const shiftPath = shiftOverride ? resolve(process.cwd(), shiftOverride) : committedShift(doc.shiftFingerprint);
if (!shiftPath || !existsSync(shiftPath)) {
  say(`  ${kind.what}, seed ${doc.seed}, ${doc.count} trials — but the measurement it was shown against`);
  say(`  (fingerprint ${doc.shiftFingerprint}) is not under docs/validation/rulings, so the sitting cannot be rebuilt.`);
  say();
  say("cannot be replayed from committed bytes.");
  process.exit(4);
}
const shiftFp = fingerprint(readFileSync(shiftPath, "utf8"));

say(`  ${kind.what}: seed ${doc.seed}, ${doc.count} trials over ${doc.pages} pages, ${(doc.answers ?? []).length} answers.`);
say("  The trial list is rebuilt from the seed, the committed answers are applied, and the scorer runs again.");
say(`  measurement: ${rel(shiftPath)}`);

/* ── run the scorer, the same way a person would ────────────────────────── */

const script = join(HERE, kind.script);
const ioPath = arg("--io", null);
// Paths inside the repository go to the scorer relative to it, so what it prints —
// and what the receipt keeps — reads the same on every machine.
const portable = (p) => (rel(p).startsWith("..") ? p : rel(p));
const args = [script, portable(rulingPath), "--shift", portable(shiftPath), ...(ioPath ? ["--io", resolve(process.cwd(), ioPath)] : [])];
let exit = 0;
let stdout = "";
let stderr = "";
try {
  stdout = execFileSync(process.execPath, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (e) {
  exit = e.status ?? 1;
  stdout = e.stdout ?? "";
  stderr = e.stderr ?? "";
}
// Exit 2 is the scorer refusing to read (the wrong measurement, a self-test that
// failed, a missing download); the verdict below it is meaningless, so stop here.
if (exit === 2 || exit === 3) {
  say();
  say(`  the scorer refused to run (exit ${exit}):`);
  say(stderr.trim().replace(/^/gm, "    "));
  process.exit(2);
}

const now = {
  input: stdout.match(/displacements \S+ \((\w{8})\)/)?.[1] ?? null,
  code: stdout.match(/· code ([0-9a-f]{12}) \(/)?.[1] ?? null,
  headline: stdout.match(kind.headline)?.[1]?.trim().replace(/\s+/g, " ") ?? null,
  exit,
  verdict: normalise(stdout),
};
if (!now.input || !now.code || !now.headline) {
  say();
  say("  the scorer ran but its output has no fingerprint line or no headline — this replay does not know how to read it.");
  say(stdout.replace(/^/gm, "    "));
  process.exit(2);
}
if (now.input !== shiftFp) {
  // The scorer names the measurement it read; this names the measurement it was handed. They are the same file.
  die(`the scorer read a measurement fingerprinted ${now.input}, and ${rel(shiftPath)} hashes to ${shiftFp}.`);
}

/* ── --record: write the receipt ─────────────────────────────────────────── */

const rPath = receiptPath(rulingPath);
if (flag("--record")) {
  const stamp = codeFingerprint(script);
  const receipt = {
    built: "replay-receipt",
    ruling: basename(rulingPath),
    recordedAt: new Date().toISOString(),
    gradedBy: rel(script),
    input: { file: basename(shiftPath), fingerprint: now.input },
    code: { fingerprint: now.code, files: stamp.files },
    headline: now.headline,
    exit: now.exit,
    verdict: now.verdict,
  };
  const had = existsSync(rPath);
  writeFileSync(rPath, `${JSON.stringify(receipt, null, 1)}\n`);
  say();
  say(`  ${had ? "re-recorded" : "recorded"} ${rel(rPath)}`);
  say(`    input ${now.input} · code ${now.code} · ${kind.label} ${now.headline} · exit ${now.exit}`);
  say("  Commit it beside the ruling. From now on a replay is checked against this, and a grader");
  say("  edit that is meant to move the number is re-recorded here so the move lands in a diff.");
  process.exit(0);
}

/* ── compare ─────────────────────────────────────────────────────────────── */

if (!existsSync(rPath)) {
  say();
  say(`  unstamped: there is no receipt beside it (${basename(rPath)}), so there is nothing to check this`);
  say("  replay against. A receipt is what the scorer said on the day it was recorded — the input");
  say("  fingerprint, the code fingerprint and the headline. Someone on the project writes one with");
  say("  --record and commits it; a stranger then checks against it.");
  say();
  say("unstamped, cannot be replayed.");
  process.exit(4);
}
let receipt;
try {
  receipt = JSON.parse(readFileSync(rPath, "utf8"));
} catch {
  die(`${rel(rPath)} is not JSON.`);
}
if (receipt.built !== "replay-receipt") die(`${rel(rPath)} is not a replay receipt (built: ${receipt.built ?? "absent"}).`);

say(`  receipt: ${rel(rPath)}, recorded ${String(receipt.recordedAt).slice(0, 10)}`);
say();

const recordedVerdict = String(receipt.verdict ?? "");
const rows = [
  {
    what: "input fingerprint",
    recorded: receipt.input?.fingerprint,
    now: now.input,
    why: "the measurement file is not the one the sitting was shown against, or it has changed.",
  },
  {
    what: "code fingerprint",
    recorded: receipt.code?.fingerprint,
    now: now.code,
    why: "the grading code is not the code that recorded this. If the change was meant, re-record with --record and commit the receipt beside the change.",
  },
  {
    what: kind.label,
    recorded: receipt.headline,
    now: now.headline,
    why: "the same inputs no longer give the recorded number. This is the finding the replay exists to catch.",
  },
  {
    what: "every other printed figure",
    recorded: `${recordedVerdict.split("\n").length - 1} lines, exit ${receipt.exit}`,
    now: `${now.verdict.split("\n").length - 1} lines, exit ${now.exit}`,
    same: recordedVerdict === now.verdict && receipt.exit === now.exit,
    why: "the headline agrees but something else the scorer prints has moved.",
  },
];
for (const r of rows) if (r.same == null) r.same = r.recorded === r.now;

const w = Math.max(...rows.map((r) => r.what.length), "recorded".length);
const wr = Math.max(...rows.map((r) => String(r.recorded).length), "recorded".length);
const wn = Math.max(...rows.map((r) => String(r.now).length), "now".length);
say(`  ${"".padEnd(w)}  ${"recorded".padEnd(wr)}  ${"now".padEnd(wn)}`);
for (const r of rows) {
  say(`  ${r.what.padEnd(w)}  ${String(r.recorded).padEnd(wr)}  ${String(r.now).padEnd(wn)}  ${r.same ? "same" : "DIFFERS"}`);
}
const bad = rows.filter((r) => !r.same);
say();
if (!bad.length) {
  say("everything agrees: the number in the record is the number the committed inputs still produce.");
  process.exit(0);
}
for (const r of bad) say(`  ${r.what} differs — ${r.why}`);
const changed = rows[3].same ? [] : firstDiff(recordedVerdict, now.verdict);
for (const l of changed) say(`    ${l}`);
say();
say(`${bad.length === 1 ? "one thing" : `${bad.length} things`} differ. This is not a reproduction.`);
process.exit(1);

/** The first line where the recorded verdict and today's part company. */
function firstDiff(want, got) {
  const a = want.split("\n");
  const b = got.split("\n");
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) return [`line ${i + 1}`, `  recorded: ${a[i] ?? "<end of output>"}`, `  now:      ${b[i] ?? "<end of output>"}`];
  }
  return [];
}
