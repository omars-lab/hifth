/**
 * Reads a mark-report sitting and says what it did and did not establish.
 *
 *   node packages/etl/scripts/score-mark-report.mjs <transcript.json> [--rows <rows.json>]
 *
 * ## What this is for, and why it is a separate instrument
 *
 * The other two scorers in this directory read sittings that asked a *closed*
 * question — is this rectangle better than that one, and where exactly does this
 * one belong. Both produce a number in page units, and both are about a correction
 * that has already been proposed.
 *
 * This one reads a sitting that asked an open one: look at this rectangle on this
 * printed page and tell me, in five words, what is wrong with it. That produces a
 * *rate* rather than a distance — how often the thing we are about to ship is
 * visibly wrong to somebody who knows the print — and rates are the easier of the
 * two to quote past what they can carry. So most of what follows is about the ways
 * this particular number can be over-read, each of them printed whether or not it
 * is convenient.
 *
 * ## The four things it refuses to do
 *
 * **It will not pool the two populations.** The marks placed from their own ink and
 * the marks that fell back to the printed line are placed by *different rules*, and
 * a rate over both is a fact about neither — it is an average weighted by whatever
 * mix the sampler happened to draw, which is a property of the sampler. Every number
 * below is per population, and the two are never added. This is the same rule the
 * corpus figures follow, one level up.
 *
 * **It will not trust the transcript about which population a mark is in.** Each
 * answer carries the rule that drew it, but that field is a claim, and a transcript
 * can be old, hand-edited, or built before the field existed. The rule is a pure
 * function of the displacements — convincing match, and the search had room — so it
 * is re-derived here from the rows and the transcript's own thresholds, and the
 * transcript's claim is checked against it rather than believed. A disagreement
 * stops the run.
 *
 * **It will not read a sitting against different displacements.** Same guard as the
 * other two instruments: the rectangles are a function of the measurements, so a
 * report read against a different measurement is a set of statements about marks
 * that were never on the screen. The fingerprint has to match.
 *
 * **It will not add a print defect to the error count.** "Something is odd in the
 * print" is not this correction getting a mark wrong — it is a mark that cannot be
 * graded, because the thing it would be graded against is itself in question. Adding
 * those to the numerator inflates our error; dropping them silently deflates it. They
 * come out of the *denominator*, the rate is printed both ways so the size of that
 * choice is visible, and they are routed to docs/issues.json where a defect in
 * vendored data belongs.
 *
 * ## Silence is the verdict, which is why `seen` matters
 *
 * The sitting has no "this one looks right" button, deliberately — the common case
 * must not cost a click or nobody finishes. So passing a mark is the verdict that
 * nothing is wrong with it, and the rate is answers over marks-actually-looked-at.
 * That denominator lives in the transcript as `seen`. A transcript without it (one
 * saved before the field existed) cannot distinguish a reader who cleared sixty
 * marks and found four bad ones from one who looked at five and shut the tab, so
 * both readings are printed as bounds and no single rate is claimed.
 *
 * ## And what a sitting this size can find
 *
 * Sixty is the size that fits in one sitting, not the size that resolves a rate. The
 * report ends with what the sample can support: an interval on every share, and —
 * when nothing at all was found — the bound that a clean result actually carries,
 * which is about 3/n and is nowhere near zero. A clean sitting is exactly the result
 * somebody will want to quote as "we checked it", and the honest version of that
 * sentence has a number in it.
 *
 * Exits 2 when it refuses to read the file at all. It does not exit non-zero for bad
 * news: a sitting that finds a high rate has done its job, and a scorer that fails
 * the build for it teaches everyone to stop sitting them.
 */
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { correctionFor } from "./lib/registration-grain.mjs";
import { wilson } from "./lib/mark-ink.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ETL = join(HERE, "..");
const ROOT = join(ETL, "..", "..");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
let path = null;
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) i += 1;
  else if (!path) path = argv[i];
}
if (!path) {
  process.stderr.write("usage: score-mark-report.mjs <transcript.json> [--rows <rows.json>]\n");
  process.exit(2);
}

const die = (msg) => {
  process.stderr.write(`refused: ${msg}\n`);
  process.exit(2);
};

const doc = JSON.parse(readFileSync(path, "utf8"));
if (doc.built !== "mark-report") die(`${path} is not a mark-report transcript (built: ${doc.built ?? "absent"}).`);

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

// The builder records the path repo-relative when the rows live inside the checkout
// and absolute when they do not — a working file in a scratch directory is the
// normal case, and joining that onto the root produces a path that exists nowhere.
const rowsPath = arg("--rows", doc.rows ? (isAbsolute(doc.rows) ? doc.rows : join(ROOT, doc.rows)) : null);
if (!rowsPath) die("the transcript names no displacements file and --rows was not given.");
let rowsText;
try {
  rowsText = readFileSync(rowsPath, "utf8");
} catch {
  die(`cannot read the displacements at ${rowsPath}. Pass --rows if they have moved.`);
}
const rowsFp = fingerprint(rowsText);
if (rowsFp !== doc.rowsFingerprint) {
  die(
    `this sitting was made against displacements ${doc.rowsFingerprint}, and ${rowsPath} is ${rowsFp}.\n` +
      "  Every rectangle in it would be a statement about a mark that was never on the screen.",
  );
}
const parsedRows = JSON.parse(rowsText);
const allRows = Array.isArray(parsedRows) ? parsedRows : parsedRows.rows;

/* ── the split, re-derived rather than believed ───────────────────────────── */

const radius = Number(doc.radius ?? 3);
const iouFloor = Number(doc.iouFloor ?? 0.55);
const EPS = 1e-6;
// Per axis, because the search window is a square — the same reasoning as the
// builder's, and the same error this repo has already paid for once.
const atEdge = (r) => Math.abs(Math.abs(r.dx) - radius) < EPS || Math.abs(Math.abs(r.dy) - radius) < EPS;
const placed = (r) => r.iouBest >= iouFloor && !atEdge(r);
const ruleOf = (r) => (placed(r) ? "ink" : "line-tilt");

const byId = new Map();
for (const r of allRows) byId.set(`${r.page}:${r.k}`, r);

const { apply } = correctionFor("line-tilt", allRows);
/** Where the sitting drew the rectangle — the builder's rule, re-run here. */
const drawnAt = (r) => {
  const c = placed(r) ? { dx: r.dx, dy: r.dy } : apply(r);
  return [r.box[0] + c.dx, r.box[1] + c.dy, r.box[2], r.box[3]];
};

const said = Array.isArray(doc.said) ? doc.said : [];
const unknown = [];
const mismatched = [];
let repaired = 0;
for (const e of said) {
  const r = byId.get(e.id);
  if (!r) {
    unknown.push(e.id);
    continue;
  }
  const truth = ruleOf(r);
  if (e.rule == null) repaired += 1;
  else if (e.rule !== truth) mismatched.push(`${e.id}: says ${e.rule}, is ${truth}`);
  e.rule = truth;
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
      "\n  Reading these would file answers about one option against the other.",
  );
}

/* ── the denominator ──────────────────────────────────────────────────────── */

const shown = Number(doc.shown ?? 0);
/**
 * Which cards this sitting actually looked at — recovered from the rows in the same
 * order the builder drew them, because the transcript carries answers rather than
 * cards. `seen` is a count of cards passed, so the population mix of the denominator
 * is exactly the mix of the first `seen` of them.
 */
const seen = doc.seen == null ? null : Number(doc.seen);

/**
 * The builder draws in page-then-index order, so the answers can be put back in the
 * order they were given even though the transcript carries no cards. Only the marks
 * that were answered are known here, which is enough to locate the last answer
 * within the sitting and no more.
 */
const cardOrder = [...new Set(said.map((e) => e.id))].sort((a, b) => {
  const [pa, ka] = a.split(":").map(Number);
  const [pb, kb] = b.split(":").map(Number);
  return pa - pb || ka - kb;
});
/**
 * The bounds a transcript with no `seen` leaves us with. At the low end the reader
 * looked at exactly the marks they said something about and no others, which would
 * make the rate 100%; at the high end they cleared the whole sitting. Both are
 * consistent with the file, which is the point — and the gap between them is usually
 * the difference between a finding and a non-finding.
 */
const lowBound = cardOrder.length;

/* ── the report ───────────────────────────────────────────────────────────── */

const WORDS = {
  placement: "moved it",
  "wrong-shape": "wrong shape",
  "intended-ink": "boxed the right ink",
  "print-defect": "odd in the print",
  exception: "banked, could not say",
};
/** The two that say our placement is wrong. Everything else is not that. */
const FAULTS = ["placement", "wrong-shape", "intended-ink"];
/**
 * The affirmation, and it is deliberately not in WORDS. That table answers "what
 * was wrong, and how often", and a row reading "nothing wrong 54 — 90.0%" in it
 * would be read by somebody skimming as a 90% failure of something. It gets its
 * own line below, where it says the thing it actually says: how much of the
 * denominator a human explicitly vouched for, as against passed in silence.
 */
const AFFIRMED = "looks-right";

const pct = (v) => `${(v * 100).toFixed(1)}%`;
const n3 = (v) => (Math.round(v * 1000) / 1000).toFixed(3);
const median = (xs) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const quantile = (xs, q) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

const out = [];
const say = (s = "") => out.push(s);

say(`${path.replace(`${ROOT}/`, "")}`);
say(`  ${doc.set} set · seed ${doc.seed} · displacements ${doc.rowsFingerprint} · ${shown} drawn`);
say(`  drawn by ${Object.entries(doc.drawnBy ?? {}).map(([k, v]) => `${k} ${v}`).join(", ") || "unrecorded"}`);
if (repaired) {
  say(`  ${repaired} answers carried no rule and were re-derived from the displacements.`);
  say("  That is safe here only because the fingerprint matched: the rule is a function of the rows.");
}
say();

if (seen == null) {
  say("This transcript does not record how far the reader got, so it has no denominator.");
  say(`  Between ${lowBound} and ${shown} marks were looked at — ${lowBound} if they said something`);
  say(`  about every mark they saw, ${shown} if they cleared the sitting. The rates below use the`);
  say("  upper figure, which is the charitable one, and are quotable only with that stated.");
  say("  Sittings built after this field was added carry it; this one predates it.");
  say();
}

/**
 * Everything from here is per population. The header says so each time rather than
 * once at the top, because a reader who skims to the number they wanted is exactly
 * the reader who will otherwise quote it as the number for the whole book.
 */
const groups = new Map();
for (const e of said) {
  if (!groups.has(e.rule)) groups.set(e.rule, []);
  groups.get(e.rule).push(e);
}
// The denominator's own split — how many of the marks looked at were drawn by each
// rule. The transcript carries answers rather than cards, so this comes from the
// builder's recorded tally rather than from counting them here.
const drawn = doc.drawnBy ?? {};
const drawnTotal = Object.values(drawn).reduce((a, b) => a + b, 0);
const denomOf = (rule) => {
  // A sitting drawn entirely by one rule — which is what --set placed and --set
  // fallback both produce — needs no apportioning at all. A mixed one gets the
  // cards split in the proportion the builder recorded, which assumes the reader
  // worked front to back; they can only go forward and back one card at a time, so
  // that assumption is the shape of the instrument rather than a guess about them.
  const only = Object.keys(drawn).length === 1 && drawnTotal === shown;
  const share = only ? 1 : (drawn[rule] ?? 0) / (drawnTotal || 1);
  if (seen == null) return [Math.round(lowBound * share), Math.round(shown * share)];
  return [Math.round(seen * share), Math.round(seen * share)];
};

for (const rule of [...groups.keys()].sort()) {
  const evs = groups.get(rule);
  const [dLo, dHi] = denomOf(rule);
  const label = rule === "ink" ? "placed from their own ink" : "that inherited the printed line";
  say(`── ${rule} — the marks ${label} ──`);
  if (dLo === dHi) say(`  ${dLo} marks looked at, ${evs.length} answers given about ${new Set(evs.map((e) => e.id)).size} of them`);
  else say(`  between ${dLo} and ${dHi} marks looked at, ${evs.length} answers about ${new Set(evs.map((e) => e.id)).size} of them`);

  const defects = new Set(evs.filter((e) => e.kind === "print-defect").map((e) => e.id));
  const banked = new Set(evs.filter((e) => e.kind === "exception").map((e) => e.id));
  const faulted = new Set(evs.filter((e) => FAULTS.includes(e.kind)).map((e) => e.id));
  const affirmed = new Set(evs.filter((e) => e.kind === AFFIRMED).map((e) => e.id));

  say();
  say("  What was said, by word — a mark can carry more than one, so these do not sum:");
  for (const kind of Object.keys(WORDS)) {
    const ids = new Set(evs.filter((e) => e.kind === kind).map((e) => e.id));
    if (!ids.size && kind !== "placement" && kind !== "wrong-shape") continue;
    const [lo, hi] = wilson(ids.size, dHi || 1);
    say(`    ${WORDS[kind].padEnd(24)} ${String(ids.size).padStart(3)}   ${pct(ids.size / (dHi || 1)).padStart(6)}   95% ${pct(lo)}–${pct(hi)}`);
  }

  say();
  say("  Our placement is wrong on this mark — moved, wrong shape, or boxed elsewhere:");
  const gradable = (dHi || 0) - defects.size;
  const [fLo, fHi] = wilson(faulted.size, Math.max(1, gradable));
  say(`    ${faulted.size} of ${gradable} gradable marks — ${pct(faulted.size / Math.max(1, gradable))}, 95% ${pct(fLo)}–${pct(fHi)}`);
  if (defects.size) {
    say(`    ${defects.size} ${defects.size === 1 ? "mark is" : "marks are"} out of the denominator because the print itself was`);
    say("    called into question there — not our error, and not evidence that we are right either.");
    say(`    Counted in instead, the rate would read ${pct(faulted.size / (dHi || 1))}; the gap is the size of that choice.`);
  }
  if (banked.size) say(`    ${banked.size} more ${banked.size === 1 ? "was" : "were"} banked as could-not-say, and ${banked.size === 1 ? "is" : "are"} in neither column.`);

  /**
   * How much of that denominator a person actually vouched for.
   *
   * The rate above divides by every mark the reader passed, which quietly assumes
   * that passing one meant judging it. That assumption is only as good as the
   * reader's attention, and it is invisible in the arithmetic — a sitting clicked
   * through in ninety seconds and one worked through carefully produce the same
   * denominator and the same clean 0%. So the affirmations are reported against it:
   * a large silent share does not invalidate the rate, it says how much of the rate
   * rests on somebody having actually looked.
   */
  say();
  const spoken = new Set([...affirmed, ...faulted, ...defects, ...banked]);
  const silent = Math.max(0, (dHi || 0) - spoken.size);
  say("  How much of that denominator somebody actually vouched for:");
  say(`    ${affirmed.size} said outright that nothing was wrong · ${silent} passed in silence`);
  if (!affirmed.size && silent) {
    say("    Nothing here was affirmed out loud. Every clean mark in the rate above is a mark the");
    say("    reader moved past, which is consistent with a careful sitting and with a skimmed one.");
    say("    Sittings built before the affirmation button existed all read this way.");
  } else if (silent > affirmed.size) {
    say("    More were passed in silence than were affirmed, so the rate leans on the passing.");
  }

  /**
   * A mark carrying both an affirmation and a fault. The transcript is appended to
   * rather than rewritten, so this is a reader who changed their mind and did not
   * take the first answer back — which is a real event, not a corruption. It is
   * counted as a fault, because the conservative reading of "I said it was fine and
   * then moved it" is that it needed moving, and it is printed because a scorer that
   * silently picks one of two contradictory statements is a scorer nobody can check.
   */
  const bothWays = [...affirmed].filter((id) => faulted.has(id));
  if (bothWays.length) {
    say();
    say(`  ${bothWays.length} ${bothWays.length === 1 ? "mark was" : "marks were"} called fine and also faulted: ${bothWays.join(", ")}`);
    say("    Counted as faults above. A later answer was not taken back, so both statements stand in");
    say("    the transcript; this line is here so the choice between them is visible rather than made");
    say("    quietly. If the affirmation was the mistake, the fix is to retract it and score again.");
  }

  /**
   * One row per mark, and the last standing placement is the row.
   *
   * This used to median the increments across every event, and an increment is the
   * wrong thing to median twice over. A reader settles a rectangle by pushing it one
   * way and then a little back, so opposite-signed nudges cancel; and one mark nudged
   * forty-four times outvotes twenty-five marks moved once each. On the banked sitting
   * that printed 0.000 across and 0.000 down for twenty-six marks that had every one
   * of them been dragged the better part of two units. The rectangle's final resting
   * place is the reader's statement; the route it took there is not.
   *
   * The transcript is walked in order and the last placement carrying a total wins.
   * A hand-over has its retractions already applied, so what survives here is only
   * what the reader still stood behind when they handed it over.
   */
  const finals = new Map();
  let goes = 0;
  for (const e of evs) {
    if (e.kind !== "placement") continue;
    goes += 1;
    if (Array.isArray(e.to)) finals.set(e.id, e);
  }
  if (finals.size) {
    /**
     * Two different distances, and printing either one alone has already misled
     * somebody in this repo.
     *
     * `to` is measured from the mark's raw box, so it carries the correction this
     * pipeline had already applied *plus* whatever the reader added on top. Subtract
     * the applied part — `drawnAt(r) - r.box`, which is exactly what the sitting drew
     * with — and what is left is the reader's own hand: how wrong our rectangle looked
     * to a person sitting in front of it. Leave it in and you have the whole correction
     * their answer implies, which is the figure that can be set beside a measurement
     * of the ink, because that one is measured from the raw box too.
     */
    const hand = [];
    const whole = [];
    for (const [id, e] of finals) {
      const r = byId.get(id);
      const at = drawnAt(r);
      whole.push(e.to);
      hand.push([e.to[0] - (at[0] - r.box[0]), e.to[1] - (at[1] - r.box[1])]);
    }
    const mags = hand.map((v) => Math.hypot(v[0], v[1]));

    say();
    say("  How far the reader's own hand moved the rectangle we drew, in page units:");
    say(`    median ${n3(median(mags))} · p90 ${n3(quantile(mags, 0.9))} · worst ${n3(Math.max(...mags))}`);
    say(`    across ${n3(median(hand.map((v) => v[0])))} · down ${n3(median(hand.map((v) => v[1])))} — medians, signed`);
    say(`    ${finals.size} ${finals.size === 1 ? "mark" : "marks"}, one row each, settled over ${goes} separate nudges and drags.`);
    if (goes > finals.size * 2) {
      say("    That ratio is itself a finding about the pad rather than about the print: a rectangle");
      say("    that takes several goes to settle is one the controls are not letting anybody place.");
    }

    say();
    say("  Where those rectangles ended up, measured from the box before any correction:");
    say(`    across ${n3(median(whole.map((v) => v[0])))} · down ${n3(median(whole.map((v) => v[1])))} — medians, signed`);
    say("    This is the whole correction their answers imply — ours already in it, theirs on top —");
    say("    so it is the one to set beside a measurement taken off the ink, which is measured from");
    say("    that same uncorrected box. It is not a second opinion about the line above and the two");
    say("    are never differenced: the gap between them is only the correction we already applied.");

    say();
    say("    A distance and the count above it are different questions and are never combined: a");
    say("    mark called the wrong shape has no distance, and a mark moved a hundredth of a unit is");
    say("    not the same finding as one moved a whole mark-height.");
  }

  const drawnBoxes = evs.filter((e) => e.kind === "intended-ink" && Array.isArray(e.box));
  if (drawnBoxes.length) {
    const cds = [];
    const ars = [];
    for (const e of drawnBoxes) {
      const r = byId.get(e.id);
      const at = drawnAt(r);
      cds.push(Math.hypot(e.box[0] + e.box[2] / 2 - (at[0] + at[2] / 2), e.box[1] + e.box[3] / 2 - (at[1] + at[3] / 2)));
      ars.push((e.box[2] * e.box[3]) / Math.max(1e-9, at[2] * at[3]));
    }
    say();
    say("  Where the reader drew the ink instead, against where we drew the rectangle:");
    say(`    centres apart — median ${n3(median(cds))} units · worst ${n3(Math.max(...cds))}   (n=${cds.length})`);
    say(`    their area over ours — median ${median(ars).toFixed(2)}×`);
    say("    An area far from 1 is the wrong-size complaint with a number on it; a large centre gap");
    say("    with an area near 1 is the same rectangle in the wrong place, which is displacement.");
  }

  if (defects.size) {
    say();
    say("  Called odd in the print — these belong in docs/issues.json as a defect in vendored data,");
    say("  not in this correction's error figures:");
    for (const e of evs.filter((x) => x.kind === "print-defect")) {
      say(`    page ${e.page}, line ${e.line}, ${e.name} — ${e.note || "(no note)"}`);
    }
  }
  if (banked.size) {
    say();
    say("  Banked, could not say:");
    for (const e of evs.filter((x) => x.kind === "exception")) {
      say(`    page ${e.page}, line ${e.line}, ${e.name} — ${e.note || "(no note)"}`);
    }
  }

  say();
  say("  What this many marks can support:");
  if (!faulted.size) {
    say(`    Nothing was found, and that bounds the rate at about ${pct(3 / Math.max(1, gradable))} — not at zero.`);
    say("    It is consistent with one mark in twenty being wrong. It is not a clean bill of health.");
  } else {
    say(`    The interval above is the finding, not the point estimate: ${gradable} marks cannot tell`);
    say(`    ${pct(fLo)} from ${pct(fHi)}, and a decision that needs them apart needs a larger sitting.`);
  }
  say(`    It says nothing whatever about the other population — see the ${rule === "ink" ? "fallback" : "placed"} sitting for that.`);
  say();
}

if (groups.size > 1) {
  say("Two populations appeared in one transcript and are reported apart above. They are not");
  say("summed: the marks placed from their own ink and the marks that fell back to the printed");
  say("line are placed by different rules, so a rate over both is weighted by whatever mix the");
  say("sampler drew, which is a fact about the sampler rather than about the print.");
  say();
}

process.stdout.write(`${out.join("\n")}\n`);
