/**
 * Turns the sittings somebody has sat into one row per mark, and writes it down.
 *
 *   node packages/etl/scripts/settle-mark-report.mjs <transcript.json>... [--rows <rows.json>]
 *     [--out <path>] [--issues]
 *
 * ## Why this exists at all
 *
 * A sitting is an hour of the scarcest thing this project has, and what it produces is
 * a list of events: this mark was pushed left, then a little back, then called the
 * wrong shape as well, then stretched. Everything a person actually decided is in
 * there, and none of it is written in a form anybody can read, argue with, or check
 * against next month's answer.
 *
 * The scorer reads that list and prints a summary. A summary in a terminal is not a
 * record — it cannot be diffed, it cannot be quoted with a line number, and the next
 * person to ask "what did we actually conclude about page 19" has to re-run a command
 * they do not know exists against a file that is not checked in. This writes the
 * middle thing: the settled answer, one line per mark, in the repository, where the
 * rulings from every other sitting already live.
 *
 * ## What settling means
 *
 * The rule is in lib/mark-settle.mjs and the short version is: the route is not the
 * statement, the resting place is. A rectangle pushed a unit left and a unit right
 * again has not moved, and no amount of averaging the presses will say so — that is
 * the mistake the first scorer made, and it printed nothing moved for twenty-six marks
 * that had every one of them been dragged the better part of two units.
 *
 * ## What it writes down about each mark, and why each one is there
 *
 * **Where the reader left it**, twice, because there are two honest answers and they
 * are not the same number. `hand` is how far the reader moved the rectangle *we drew
 * them* — how wrong our correction looked to somebody sitting in front of the print.
 * `to` is measured from the raw box instead, so it carries our correction plus theirs,
 * and it is the one to set beside a measurement taken off the ink, because that one is
 * measured from the raw box too. They are never differenced. The gap between them is
 * only the correction we already applied, and reading it as a disagreement between two
 * instruments has already misled somebody here.
 *
 * **How big they made it**, when they said the shape was wrong, next to the size we
 * shipped — a rectangle in the right place at the wrong size is a different complaint
 * from one in the wrong place, and the two need telling apart before either is fixed.
 *
 * **How many goes it took.** Not a fact about the mark: a fact about the controls. A
 * rectangle that took nine presses to settle is one the pad is not letting anybody
 * place, and that finding disappears the moment the route is thrown away.
 *
 * **Their own words**, whole and unmerged. A note is the one thing in a sitting that
 * was not chosen from a list of six, so nothing is summarised and nothing is dropped.
 *
 * ## Several sittings at once
 *
 * Pass as many as you like. They are sorted by when they were handed over and settled
 * oldest first, so a mark looked at twice is settled by the later look — which is the
 * only ordering under which asking for a second opinion means anything. The head
 * records every file that went in, so a row can always be traced back to the hour that
 * produced it.
 *
 * ## What it refuses
 *
 * The same two refusals as the scorer, for the same reason: a sitting read against
 * different displacements is a set of statements about marks that were never on the
 * screen, and a transcript that disagrees with the displacements about which rule drew
 * a mark would file answers about one option against the other. Both stop the run.
 *
 * `--issues` prints a draft row for the marks the reader called odd in the print. It
 * prints it rather than writing it: docs/issues.json is hand-edited, always, and a
 * script that edited it would be the second thing in this repo claiming authorship of
 * a register that is meant to have exactly one.
 *
 * Exits 2 when it refuses to read the files. Never non-zero for bad news.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { asDrawn, settle, isFault, byMark } from "./lib/mark-settle.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const wantsIssues = argv.includes("--issues");
const paths = [];
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === "--issues") continue;
  if (argv[i].startsWith("--")) i += 1;
  else paths.push(argv[i]);
}
if (!paths.length) {
  process.stderr.write(
    "usage: settle-mark-report.mjs <transcript.json>... [--rows <rows.json>] [--out <path>] [--issues]\n",
  );
  process.exit(2);
}

const die = (msg) => {
  process.stderr.write(`refused: ${msg}\n`);
  process.exit(2);
};

/** The same hash the builder stamps in. One copy of it per instrument, on purpose: */
/* a shared helper would let a change to it silently re-bless every old ruling. */
function fingerprint(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/* ── the sittings, oldest first ───────────────────────────────────────────── */

const docs = paths.map((p) => {
  const doc = JSON.parse(readFileSync(p, "utf8"));
  if (doc.built !== "mark-report") {
    die(`${p} is not a mark-report transcript (built: ${doc.built ?? "absent"}).`);
  }
  return { path: p, doc };
});
/**
 * A sitting with no hand-over time sorts first, because the only transcripts without
 * one are older than the field, and older is exactly where they belong.
 */
docs.sort((a, b) => String(a.doc.finished ?? "").localeCompare(String(b.doc.finished ?? "")));

const first = docs[0].doc;
const mixed = docs.filter((d) => d.doc.rowsFingerprint !== first.rowsFingerprint);
if (mixed.length) {
  die(
    `these sittings were made against different displacements: ${first.rowsFingerprint} and ` +
      `${mixed[0].doc.rowsFingerprint} (${mixed[0].path}).\n` +
      "  Settling them together would put two different rectangles under one row.",
  );
}

const rowsPath = arg(
  "--rows",
  first.rows ? (isAbsolute(first.rows) ? first.rows : join(ROOT, first.rows)) : null,
);
if (!rowsPath) die("the transcripts name no displacements file and --rows was not given.");
let rowsText;
try {
  rowsText = readFileSync(rowsPath, "utf8");
} catch {
  die(`cannot read the displacements at ${rowsPath}. Pass --rows if they have moved.`);
}
const rowsFp = fingerprint(rowsText);
if (rowsFp !== first.rowsFingerprint) {
  die(
    `these sittings were made against displacements ${first.rowsFingerprint}, and ${rowsPath} is ${rowsFp}.\n` +
      "  Every rectangle in them would be a statement about a mark that was never on the screen.",
  );
}
const parsed = JSON.parse(rowsText);
const allRows = Array.isArray(parsed) ? parsed : parsed.rows;

const radius = Number(first.radius ?? 3);
const iouFloor = Number(first.iouFloor ?? 0.55);
const { byId, drawnAt, ruleOf } = asDrawn(allRows, { radius, iouFloor });

/* ── the answers, checked against the displacements before they are believed ─ */

const said = [];
const unknown = [];
const mismatched = [];
for (const { doc } of docs) {
  for (const e of Array.isArray(doc.said) ? doc.said : []) {
    const r = byId.get(e.id);
    if (!r) {
      unknown.push(e.id);
      continue;
    }
    const truth = ruleOf(r);
    if (e.rule != null && e.rule !== truth) mismatched.push(`${e.id}: says ${e.rule}, is ${truth}`);
    said.push({ ...e, rule: truth });
  }
}
if (unknown.length) {
  die(
    `${unknown.length} answers name marks that are not in the displacements (first: ${unknown[0]}).\n` +
      "  The fingerprint matched, so this is a hand-edited transcript rather than a stale one.",
  );
}
if (mismatched.length) {
  die(
    `${mismatched.length} answers disagree with the displacements about which rule drew them.\n` +
      mismatched.slice(0, 5).map((m) => `    ${m}`).join("\n") +
      "\n  Settling these would file answers about one option against the other.",
  );
}

/* ── settling ─────────────────────────────────────────────────────────────── */

const settled = [...settle(said).values()].sort(byMark);
const n3 = (v) => Math.round(v * 1000) / 1000;

const marks = settled.map((row) => {
  const r = byId.get(row.id);
  const at = drawnAt(r);
  // The reader's own hand: what they added on top of the correction the rectangle
  // already carried when it was drawn for them.
  const hand = row.to ? [n3(row.to[0] - (at[0] - r.box[0])), n3(row.to[1] - (at[1] - r.box[1]))] : null;
  return {
    id: row.id,
    page: row.page,
    line: row.line,
    name: row.name,
    rule: row.rule,
    words: row.words,
    fault: isFault(row),
    // What we shipped and what we drew them, as whole rectangles, so a reader of this
    // file never has to add two offsets together to picture what happened. Where they
    // left it is filled in below, once, where the arithmetic fits on one line.
    box: r.box.map(n3),
    drawn: at.map(n3),
    settled: null,
    hand,
    to: row.to ? row.to.map(n3) : null,
    size: row.size ? row.size.map(n3) : null,
    was: row.was ? row.was.map(n3) : null,
    goes: row.goes,
    reshapes: row.reshapes,
    notes: row.notes,
  };
});
// Where the rectangle came to rest, as a rectangle: the raw box, plus the running
// total the reader's last move recorded, at whatever size they left it. Written out
// here rather than inline above so the arithmetic is one readable line.
for (const m of marks) {
  const r = byId.get(m.id);
  m.settled = m.to
    ? [n3(r.box[0] + m.to[0]), n3(r.box[1] + m.to[1]), ...(m.size ?? [r.box[2], r.box[3]]).map(n3)]
    : null;
}

const faults = marks.filter((m) => m.fault);
const defects = marks.filter((m) => m.words.includes("print-defect"));
const banked = marks.filter((m) => m.words.includes("exception"));

const out = {
  built: "mark-settled",
  settledAt: new Date().toISOString(),
  rows: first.rows,
  rowsFingerprint: first.rowsFingerprint,
  set: first.set,
  seed: first.seed,
  radius,
  iouFloor,
  /**
   * Every sitting that went into this, with what it claimed about itself. `seen` is
   * the count of marks put in front of somebody, and it is the denominator of every
   * rate anybody will compute from this file — so it is carried here beside the
   * answers rather than left in a transcript that is not checked in.
   */
  sittings: docs.map(({ path: p, doc }) => {
    const spoke = new Set((Array.isArray(doc.said) ? doc.said : []).map((e) => e.id)).size;
    return {
      file: basename(p),
      slice: doc.slice,
      finished: doc.finished,
      shown: doc.shown,
      // What the page claimed, and what the file can support. They differ only when the
      // page is wrong, because you cannot say something about a mark you never looked
      // at — and the page has been wrong once, in a way nothing caught until the rates
      // it fed went over a hundred per cent. Both are written down: the claim, so a
      // later reader can see what the instrument said at the time, and the floor,
      // because that is the number anybody dividing by should use.
      seen: doc.seen,
      looked: doc.seen == null ? spoke : Math.max(Number(doc.seen), spoke),
      whole: doc.whole,
      answers: Array.isArray(doc.said) ? doc.said.length : 0,
      spoke,
    };
  }),
  marks: marks.length,
  faulted: faults.length,
  defects: defects.length,
  answers: said.length,
  settledMarks: marks,
};

/**
 * Named the way every other ruling in that directory is named — when, which check,
 * which seed — with the population and the word "settled" added, because these are
 * the two things somebody holding two of these files needs to tell them apart. The
 * date is the sitting's, never the day this happened to be run: a ruling re-settled
 * next month is about the same hour it was always about, and stamping it with today
 * would file one hour under two dates.
 */
const stamp = (first.finished ?? new Date().toISOString()).slice(0, 10);
const outPath = arg(
  "--out",
  join(
    ROOT,
    "docs/validation/rulings",
    `${stamp}-placement-what-kind-of-wrong-${first.set}.seed${first.seed}.settled.json`,
  ),
);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(out, null, 1)}\n`);

/* ── what it says, out loud ───────────────────────────────────────────────── */

const say = (s = "") => process.stdout.write(`${s}\n`);
const pct = (v) => `${(v * 100).toFixed(1)}%`;

say(`${outPath.replace(`${ROOT}/`, "")}`);
say(`  ${docs.length} ${docs.length === 1 ? "sitting" : "sittings"} · ${said.length} answers · ${marks.length} marks`);
const looked = out.sittings.reduce((a, s) => a + Number(s.looked ?? 0), 0);
if (looked) say(`  ${looked} marks were put in front of somebody across them`);
const undercounted = out.sittings.filter((s) => s.seen != null && Number(s.seen) < s.spoke);
for (const s of undercounted) {
  say(`  ! ${s.file} says it looked at ${s.seen} and says something about ${s.spoke}, which cannot both be`);
  say(`    true. Read as ${s.looked} — the fewest the file can be describing.`);
}
say();
say(`  ${faults.length} of ${marks.length} settled marks carry a complaint about our rectangle — ${pct(faults.length / (marks.length || 1))} of the marks answered.`);
say("  That share is over the marks somebody SAID something about, which is not the rate.");
say("  The rate is over the marks they looked at, and it is the scorer's to compute.");

const moved = marks.filter((m) => m.hand);
if (moved.length) {
  const mags = moved.map((m) => Math.hypot(m.hand[0], m.hand[1])).sort((a, b) => a - b);
  say();
  say(`  ${moved.length} were moved, over ${moved.reduce((a, m) => a + m.goes, 0)} separate goes:`);
  say(`    median ${n3(mags[mags.length >> 1])} units by hand · worst ${n3(mags[mags.length - 1])}`);
}
const reshaped = marks.filter((m) => m.size && m.was);
if (reshaped.length) {
  say(`  ${reshaped.length} were reshaped, over ${reshaped.reduce((a, m) => a + m.reshapes, 0)} separate goes.`);
}
if (banked.length) say(`  ${banked.length} were banked as could-not-say.`);

if (defects.length) {
  say();
  say(`  ${defects.length} ${defects.length === 1 ? "mark was" : "marks were"} called odd in the print. That is a defect in vendored data,`);
  say("  not in our correction, and it belongs in docs/issues.json rather than in this ruling:");
  for (const m of defects) say(`    page ${m.page}, line ${m.line}, ${m.name} — ${m.notes[0] ?? "(no note)"}`);
  if (!wantsIssues) say("  Run again with --issues for a row you can paste into the register.");
}

if (wantsIssues && defects.length) {
  const pages = [...new Set(defects.map((m) => m.page))].sort((a, b) => a - b);
  say();
  say("  ── a draft row for docs/issues.json — read it, edit it, paste it by hand ──");
  say("  The register is hand-edited and stays that way, so this is printed and not written.");
  say();
  say("  Write the numbered item in the design document FIRST and put its numeral in `item`.");
  say("  The register indexes; it never states. A row whose source does not resolve, or whose");
  say("  status disagrees with the document's own, fails the gate — which is the register");
  say("  refusing to hold a sentence that nothing else in the repo is answerable for.");
  say();
  say(
    JSON.stringify(
      {
        id: `print-oddities-called-out-by-eye-${stamp}`,
        source: { file: "docs/design/mark-registration.md", item: "<the numeral you just wrote>" },
        status: "open",
        severity: "question",
        owner: "user",
        note:
          `A reader working through the marks we could not place from ink stopped at ${defects.length} of them ` +
          `on ${pages.length} pages and said the print itself looked wrong, rather than our rectangle. ` +
          "They are out of the denominator of that sitting's error rate — not our mistake, and not evidence " +
          "we are right either — so nothing about them is settled until somebody checks the pages against " +
          "another copy of this print. Pages " +
          pages.join(", ") +
          `; marks ${defects.map((m) => m.id).join(", ")}; measured in ${basename(outPath)}.`,
      },
      null,
      2,
    )
      .split("\n")
      .map((l) => `  ${l}`)
      .join("\n"),
  );
}

if (faults.length === marks.length && marks.length > 4) {
  say();
  say("  Every settled mark carries a complaint. Before reading that as a measurement of the");
  say("  correction, check it is not a measurement of the sitting: a population selected for");
  say("  being hard, or a card that makes affirming harder than faulting, produces this exact");
  say("  shape and it is a fact about the instrument.");
}

// Never non-zero for bad news. A sitting that finds everything wrong has done its job,
// and an exit code that fails the build for it teaches everybody to stop sitting them.
process.exit(0);
