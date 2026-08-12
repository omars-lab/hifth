/**
 * Reads a set of placements, and says how far our correction still misses.
 *
 * ## What this measures that the forced choice cannot
 *
 * The forced-choice session answers a yes/no: is the corrected rectangle
 * preferred to the one that ships? That is the right question to ask first, and
 * it is the wrong question to stop at, because a correction that is right in
 * direction and short by a third wins every trial and is still wrong. Two
 * answers on offer means at most one bit of an answer.
 *
 * Here a person put each rectangle where they thought it went, having never been
 * shown where we think it goes. Subtracting our proposed move from theirs leaves
 * the **residual**: the further move, in page units, that would put our
 * rectangles where a reader puts them. That is a number that can be applied.
 *
 * ## Why a number needs a noise floor before it means anything
 *
 * A residual of a fifth of a unit is a finding if a hand is repeatable to a
 * fiftieth, and it is nothing at all if a hand wanders by half a unit between
 * two goes at the same mark. So some marks come round twice, with independent
 * starting positions, and the spread between the two landings is this reader's
 * own precision — measured here, on this screen, in this session, rather than
 * assumed. Everything else is printed against it, and a residual inside it is
 * reported as *not distinguishable from the hand*.
 *
 * ## And the pull of the starting point
 *
 * Every rectangle starts displaced, and a hand that stops short drags the
 * landing back toward wherever it started. The starts are spread evenly around
 * the shipped rectangle precisely so that this cancels in the average — but
 * "should cancel" is a claim, so it is measured: the landings are regressed on
 * the starts, and the slope is printed. A slope near nought means the starts did
 * their job. A large one means the placements are partly a record of where they
 * began, and widens what the residual can be trusted to.
 *
 * ## Three things this file learned the hard way
 *
 * The first version of this script printed a residual, an interval, and a
 * verdict, and every one of those was defensible on its own. Together they said
 * more than the session could support, and the overstatement was banked into the
 * registers before anybody noticed. Three things were missing, and each of them
 * is now printed whether or not it is convenient:
 *
 * - **Placements are not independent.** Two marks on one page share that page's
 *   frame error. Sixty placements over forty pages carry closer to forty pages'
 *   worth of information than to sixty trials' worth, and the plain interval on
 *   the residual was narrower than the truth. The verdict at the foot now reads
 *   from the page-clustered interval; both are shown, so the difference is
 *   visible rather than swapped in silently.
 * - **Direction is not size.** A residual of a tenth of a unit and a proposed
 *   move that is a tenth too large are the *same number* when every page happens
 *   to propose the same move. So the gain is estimated, and the spread of the
 *   proposed moves is printed next to it, because that spread is the whole
 *   question of whether the estimate could ever have meant anything.
 * - **A trial needs a proposed move, so it can only come from a measured page.**
 *   Which means a placing session tests the correction on the same pages the
 *   correction was fitted to, and says nothing whatever about the rest. That is
 *   the largest limitation of this instrument and it now leads the report.
 *
 * There is also a block of negative results — the things that turn out not to
 * explain the residual — printed for the reason negative results are usually not
 * printed: somebody will otherwise pay to find them again.
 *
 * Exits non-zero when the session says the correction is not going the right
 * way, so it can sit inside something larger without being read.
 *
 *   node packages/etl/scripts/score-mark-nudge.mjs placements.json
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { planNudge } from "./lib/adjudication.mjs";
import { wilson } from "./lib/mark-ink.mjs";
import { clusteredCI, mean, meanCI, sd, slopeOf, spreadUnderSplit } from "./lib/placement-stats.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ETL = join(HERE, "..");

/** The print, end to end. Every coverage number below is a fraction of this. */
const MUSHAF_PAGES = 604;

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
  process.stderr.write("usage: score-mark-nudge.mjs <placements.json> [--shift path]\n");
  process.exit(2);
}
const shiftPath = arg("--shift", join(ETL, "out", "mark-shift.json"));

const ruling = JSON.parse(readFileSync(path, "utf8"));
const shiftText = readFileSync(shiftPath, "utf8");

function fingerprint(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const fp = fingerprint(shiftText);
if (fp !== ruling.shiftFingerprint) {
  process.stderr.write(
    `these placements were made against different displacements (${ruling.shiftFingerprint}, measured ${ruling.shiftRan})\n` +
      `${shiftPath} is now ${fp}. Read them against the file they were made from, or build a fresh session.\n`,
  );
  process.exit(2);
}
if (ruling.kind !== "nudge") {
  process.stderr.write(`${path} is not a placement session (kind ${ruling.kind || "absent"}).\n`);
  process.exit(2);
}

const shift = JSON.parse(shiftText);

/**
 * The displacements this sitting was actually built from — which is not always
 * all of them.
 *
 * A session may be narrowed to a chosen set of pages: held out from the ones the
 * correction was fitted on, and drawn from the ends of the range rather than the
 * middle, because that is the only sample with any leverage on the correction's
 * *size*. The trials are rebuilt here from the seed, so a narrowing the builder
 * applied and this file did not would put every trial index against a different
 * mark — and nothing would throw, because the indices would all still resolve.
 * The residuals would simply be subtractions of the wrong numbers.
 *
 * So the builder writes its page list into the head and this replays it, in the
 * order recorded. Replaying beats recomputing: if the scorer re-ran the
 * selection, a later improvement to how pages are chosen would silently re-score
 * every sitting ever banked, and the first sign of it would be a residual that
 * moved for no reason anybody could name.
 *
 * A ruling with no list is a session built before this existed, and it took every
 * measured page — which is what `shift.shifts` already is.
 */
let shifts = shift.shifts;
if (Array.isArray(ruling.select?.of)) {
  const byPage = new Map(shift.shifts.map((s) => [s.page, s]));
  const missing = ruling.select.of.filter((p) => !byPage.has(p));
  if (missing.length) {
    process.stderr.write(
      `these placements were built over ${ruling.select.of.length} pages and ${shiftPath} has no ` +
        `displacement for ${missing.length} of them (${missing.slice(0, 8).join(", ")}${missing.length > 8 ? ", …" : ""}).\n` +
        `That is the wrong displacements file, whatever its fingerprint says.\n`,
    );
    process.exit(2);
  }
  shifts = ruling.select.of.map((p) => byPage.get(p));
}
const { trials } = planNudge({ seed: ruling.seed, count: ruling.count, shifts });
const byIndex = new Map(trials.map((t) => [t.i, t]));

const rows = [];
for (const a of ruling.answers) {
  if (!a || !a.u) continue;
  const t = byIndex.get(a.i);
  if (!t) throw new Error(`placement ${a.i} has no trial; the file and the seed disagree`);
  if (t.id !== a.id) throw new Error(`trial ${a.i} is ${t.id} but the file says ${a.id}`);
  rows.push({ t, a, r: [a.u[0] - t.shift[0], a.u[1] - t.shift[1]] });
}
if (!rows.length) {
  process.stderr.write("nothing placed.\n");
  process.exit(1);
}

const median = (xs) => {
  const a = xs.slice().sort((p, q) => p - q);
  return a.length ? a[Math.floor(a.length / 2)] : 0;
};

/** Which page each placement came from — the cluster every interval below uses. */
const pageOf = rows.map((r) => r.t.page);

/**
 * What this session is entitled to speak about.
 *
 * A trial cannot be built without a proposed move, and a proposed move only
 * exists for a page the displacements were measured on. So the pages placed on
 * are always a subset of the pages measured — but that is not the same as the
 * pages the correction was *fitted* on, and the difference is the whole question.
 * A session built over every measured page is an in-sample check: it can say the
 * correction is right where it was fitted and is structurally incapable of saying
 * it holds anywhere else. A session built over pages held out of an earlier
 * measurement is the opposite, and it is the only kind that can answer *does this
 * work where no eye has been?*
 *
 * Which one this was is not something a scorer can infer from the answers, so it
 * is read off the session's own record of how its pages were chosen. Printed
 * first, and printed even when it is 604 of 604, because a limitation that only
 * appears when it bites is one nobody reads until it has bitten.
 */
const placedPages = new Set(pageOf);
const measuredPages = new Set(shift.shifts.map((s) => s.page));
const outside = [...placedPages].filter((p) => !measuredPages.has(p));
const coverage = {
  placed: placedPages.size,
  measured: measuredPages.size,
  pct: (100 * measuredPages.size) / MUSHAF_PAGES,
  outside: outside.length,
  /** The files whose pages were kept out of this build, if any, and how many pages that was. */
  heldOutFrom: [ruling.select?.heldOutFrom ?? []].flat().join(" and "),
  heldOut: ruling.select?.heldOut ?? 0,
  /** How the pages were picked, which is what says whether the gain below could mean anything. */
  strategy: ruling.select?.strategy ?? "all",
  chosen: ruling.select?.of?.length ?? measuredPages.size,
};

/**
 * The reader's own precision, from the marks that came round twice.
 *
 * Two independent goes at the same mark differ by the sum of two placements'
 * worth of wobble, so the spread of the difference is √2 times the spread of a
 * single placement — hence the halving of the variance. Without this the
 * residual below is a number with no scale, and a number with no scale is an
 * opinion with decimal places.
 */
const pairs = new Map();
for (const row of rows) {
  if (!pairs.has(row.t.id)) pairs.set(row.t.id, []);
  pairs.get(row.t.id).push(row);
}
const twice = [...pairs.values()].filter((g) => g.length >= 2).map((g) => g.slice(0, 2));
const gaps = twice.map(([p, q]) => Math.hypot(p.a.u[0] - q.a.u[0], p.a.u[1] - q.a.u[1]));
const axisNoise = (k) =>
  twice.length ? Math.sqrt(mean(twice.map(([p, q]) => (p.a.u[k] - q.a.u[k]) ** 2)) / 2) : NaN;
const noise = { n: twice.length, typical: median(gaps), sx: axisNoise(0), sy: axisNoise(1) };
noise.floor = twice.length ? Math.hypot(noise.sx, noise.sy) : NaN;

/**
 * The headline, in the currency the forced choice already speaks.
 *
 * A landing is either nearer the corrected rectangle than the one that ships, or
 * it is not. That is the same claim the two-panel session makes, arrived at by a
 * different route and without ever putting our answer on the screen, so the two
 * results are comparable — and if they disagree, one of the two instruments is
 * telling us something the other cannot see.
 *
 * The Wilson interval here makes the same independence assumption the residual's
 * plain interval does, and for the same reason it is not quite right. It is left
 * as it is and labelled: a rate this lopsided is not reachable by any clustering
 * adjustment, so widening it would change no decision. If a future session comes
 * back near half, this needs the treatment the residual now gets.
 */
const nearer = rows.filter((r) => Math.hypot(...r.r) < Math.hypot(r.a.u[0], r.a.u[1]));
const [wLo, wHi] = wilson(nearer.length, rows.length);
const head = {
  k: nearer.length,
  n: rows.length,
  pct: (100 * nearer.length) / rows.length,
  lo: 100 * wLo,
  hi: 100 * wHi,
};

const resid = [rows.map((r) => r.r[0]), rows.map((r) => r.r[1])];
const flat = [meanCI(resid[0]), meanCI(resid[1])];
const clust = [clusteredCI(resid[0], pageOf), clusteredCI(resid[1], pageOf)];
const toShipped = rows.map((r) => Math.hypot(r.a.u[0], r.a.u[1]));
const toCorrected = rows.map((r) => Math.hypot(...r.r));

/**
 * Did the starting point pull the landing?
 *
 * The starts are drawn uniformly around the shipped rectangle, so their mean is
 * nought and a slope here does not bias the residual — but it inflates the
 * spread, which is what the residual's interval is made of. Reported rather than
 * corrected for: a correction would be a model of the hand, and this check is
 * meant to measure the hand, not to assume one.
 */
const startPull = (k) => {
  let num = 0;
  let den = 0;
  for (const r of rows) {
    num += r.a.from[k] * r.a.u[k];
    den += r.a.from[k] ** 2;
  }
  return den ? num / den : 0;
};
const pull = { x: startPull(0), y: startPull(1) };

/**
 * Is the proposed move the right *size*, and could this session tell?
 *
 * Regressing where the reader put the rectangle on how far we propose to move it
 * gives a gain: 1.00 means we propose exactly the move a reader makes, 0.80
 * means we overshoot by a fifth, 1.20 means we fall short by one.
 *
 * The estimate is worthless without the second line. If every page in the sample
 * proposes nearly the same move, the regression has nothing to lean on and the
 * gain comes back with an interval wide enough to contain any answer anybody
 * wanted. Worse, a constant residual and a wrong gain are then literally the
 * same number, and no amount of further placements on these pages separates
 * them — only pages whose corrections differ from each other can. So the spread
 * of the proposed moves is printed beside the gain, and when it is small the
 * report says the question was not asked rather than answering it badly.
 */
const gainOn = (k) =>
  slopeOf(
    rows.map((r) => r.t.shift[k]),
    rows.map((r) => r.a.u[k]),
    pageOf,
  );
const gain = [gainOn(0), gainOn(1)];
const proposed = [rows.map((r) => r.t.shift[0]), rows.map((r) => r.t.shift[1])];
/** How wide the gain's interval is, in gain units. Above ~0.4 it decided nothing. */
const GAIN_USELESS = 0.4;
const blind = gain.every((g) => !g || !Number.isFinite(g.se) || g.hi - g.lo > GAIN_USELESS);

/**
 * The things that turn out not to explain the residual.
 *
 * Printed for the reason negative results are usually not printed: each of these
 * is an hour somebody will otherwise spend finding it again, and each of them
 * narrows the problem. Between them they say the residual is not a property of
 * particular glyphs, not a scale error, and not a hand getting tired — which
 * leaves a per-page frame error, which is where the design doc already believed
 * it was.
 */
const byName = [
  spreadUnderSplit(resid[0], rows.map((r) => r.t.name)),
  spreadUnderSplit(resid[1], rows.map((r) => r.t.name)),
];
const centre = (k) => rows.map((r) => r.t.box[k] + r.t.box[k + 2] / 2);
const byPlace = [slopeOf(centre(0), resid[0], pageOf), slopeOf(centre(1), resid[1], pageOf)];
const order = rows.map((r) => r.a.i);
const byOrder = [slopeOf(order, resid[0], pageOf), slopeOf(order, resid[1], pageOf)];

const asksSize = (ruling.asks || []).includes("size");
const big = ruling.answers.filter((a) => a && a.wrongSize);
const NAMED = 12;
const names =
  big.slice(0, NAMED).map((a) => a.id).join(", ") + (big.length > NAMED ? `, and ${big.length - NAMED} more` : "");

const ms = rows.map((r) => r.a.ms).sort((x, y) => x - y);
const u3 = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(3)}`;
const u2 = (v) => v.toFixed(2);
const W = 30;
const say = (label, body) => `${label.padEnd(W)} ${body}`;
const band = (c) => `[${u3(c.lo)} – ${u3(c.hi)}]`;
const AXIS = ["across", "down"];
/** Both axes' t statistics on one line, since neither is interesting alone. */
const ts = (pair) =>
  `t = ${pair.map((p, k) => `${p && Number.isFinite(p.t) ? p.t.toFixed(1) : "?"} ${AXIS[k]}`).join(", ")}`;
const anyBig = (pair) => pair.some((p) => p && Number.isFinite(p.t) && Math.abs(p.t) >= 2);

const clears = head.lo > 50;
const readable = Number.isFinite(noise.floor) && noise.floor > 0;
const residual = Math.hypot(flat[0].m, flat[1].m);
const beyondNoise = readable && residual > noise.floor;
/** Read from the clustered intervals, which are the ones the sample supports. */
const real = clust.map((c) => Number.isFinite(c.lo) && (c.lo > 0 || c.hi < 0));

const out = [
  `placements ${path}`,
  `seed ${ruling.seed} · ${rows.length} of ${ruling.count} placed · displacements ${ruling.shiftRan} (${fp})`,
  `median ${(median(ms) / 1000).toFixed(1)}s a placement`,
  "",
  say("pages these can speak for", `${coverage.placed} placed on, of ${coverage.chosen} this session was built over`),
  say("", `the displacements cover ${coverage.measured} of ${MUSHAF_PAGES} pages (${coverage.pct.toFixed(1)}%)`),
  coverage.outside
    ? say("", `${coverage.outside} placements are on unmeasured pages — that should be impossible; read the shift file`)
    : coverage.heldOut
      ? say("", `held out from ${coverage.heldOutFrom} — ${coverage.heldOut} pages, none of them asked about here,`) +
        "\n" +
        say("", `so this is an out-of-sample reading. Pages picked: ${coverage.strategy}.`)
      : say("", "every placement is on a page the correction was fitted to, so nothing below") +
        "\n" +
        say("", "says whether it holds on a page nobody has measured"),
  "",
  `${say("landed nearer our correction", `${head.pct.toFixed(1)}%`.padStart(6))}  [${head.lo.toFixed(1)}% – ${head.hi.toFixed(1)}%]  ${head.k}/${head.n}`,
  say("typical miss, from as-shipped", `${u2(median(toShipped))} units`),
  say("typical miss, from corrected", `${u2(median(toCorrected))} units`),
  "",
  ...[0, 1].flatMap((k) => [
    say(`what is left over, ${AXIS[k]}`, `${"xy"[k]} ${u3(flat[k].m)}  ${band(flat[k])}  as ${flat[k].n} placements`),
    say("  · clustered by page", `   ${" ".repeat(6)}${band(clust[k])}  as ${clust[k].g} pages — read this one`),
  ]),
  readable
    ? say("this hand's own precision", `${u2(noise.floor)} units, from ${noise.n} marks placed twice (typical gap ${u2(noise.typical)})`)
    : "this hand's own precision: unknown — no mark was placed twice, so nothing below has a scale.",
  say("pull of the starting point", `x ${pull.x.toFixed(2)}  y ${pull.y.toFixed(2)}  (0 is none, 1 is 'never moved')`),
  asksSize
    ? say("the box was the wrong size", `${big.length}/${ruling.answers.length}` + (big.length ? ` — ${names}` : ""))
    : "wrong-size: not asked. These placements come from a page built before the question existed, so they say nothing about how big the rectangles are.",
  "",
  "is the proposed move the right size?",
  ...[0, 1].flatMap((k) =>
    gain[k]
      ? [
          say(`  ${AXIS[k]}`, `the reader moved ${gain[k].b.toFixed(2)}× as far as we propose  [${gain[k].lo.toFixed(2)}× – ${gain[k].hi.toFixed(2)}×]`),
          say("", `proposed moves span ${u3(Math.min(...proposed[k]))}…${u3(Math.max(...proposed[k]))}, sd ${sd(proposed[k]).toFixed(3)}`),
        ]
      : [say(`  ${AXIS[k]}`, "no estimate: the proposed move does not vary at all across these placements")],
  ),
  blind
    ? "  Undecidable from this sample. These pages propose nearly the same move as each other, so\n" +
      "  nothing here separates a correction that is exactly right from one that is a fifth short —\n" +
      "  and on pages like these, a wrong gain and a constant residual are the same number. Pages\n" +
      "  whose corrections differ would settle it; more placements on these pages will not."
    : "  Decidable: the proposed moves vary enough across these pages for the gain above to mean something.",
  "",
  "what does not explain what is left over",
  say(
    "  the mark it sits on",
    Number.isFinite(byName[1].many)
      ? `a mean per name leaves ${byName[1].many >= byName[1].one ? "MORE spread, not less" : "less spread — worth a look"}` +
        `\n${say("", `across ${byName[0].many.toFixed(3)} vs ${byName[0].one.toFixed(3)}, down ${byName[1].many.toFixed(3)} vs ${byName[1].one.toFixed(3)}, over ${byName[1].groups} names`)}`
      : `too few placements per name to tell (${byName[1].groups} names over ${rows.length})`,
  ),
  say("  where it sits on the page", `${ts(byPlace)}${anyBig(byPlace) ? " — LOOK: this may be a scale error" : " — a translation, not a stretch"}`),
  say("  how late in the sitting", `${ts(byOrder)}${anyBig(byOrder) ? " — LOOK: the sitting drifted" : " — no drift as it wore on"}`),
  say("  where it started", "see the pull of the starting point above"),
  "",
  clears
    ? "the correction goes the right way: placements land nearer it than they do the shipped box, and the interval clears half"
    : head.hi < 50
      ? "the correction goes the WRONG way: placements land nearer the shipped box than the corrected one"
      : "no direction either way: the interval straddles half, so these placements do not separate the two",
  !readable
    ? "no residual can be read: without a repeated mark there is no telling a real offset from a wandering hand."
    : !beyondNoise
      ? `the residual (${u2(residual)} units) is inside this hand's own precision (${u2(noise.floor)}). Our correction is as close as this session can resolve — which is a result, and it is not the same as being right.`
      : `the residual is ${u2(residual)} units, larger than this hand's precision (${u2(noise.floor)}).\n` +
        `The best guess at a further correction is (${u3(flat[0].m)}, ${u3(flat[1].m)}) on top of what is proposed. How much to trust it:\n` +
        (real[0] || real[1]
          ? `Clustered by page, the ${[real[0] ? "across" : "", real[1] ? "down" : ""].filter(Boolean).join(" and ")} component${real[0] && real[1] ? "s are" : " is"} distinguishable from nought at 95%; anything not named here is not.`
          : "Clustered by page, neither component is distinguishable from nought at 95%. The direction is settled and the\n" +
            "distance is not: this says our correction may be short, not that it is. Do not apply the residual on this."),
  Math.abs(pull.x) > 0.25 || Math.abs(pull.y) > 0.25
    ? `\nCaution: the landings track their starting points (x ${pull.x.toFixed(2)}, y ${pull.y.toFixed(2)}). The starts are\n` +
      "spread evenly, so this does not tilt the residual in any one direction — but it widens every interval\n" +
      "above, and a pull this size usually means the placements were made faster than they were judged."
    : null,
  big.length && rows.length && big.length / rows.length > 0.15
    ? `\nAnd a second finding, which is not about placement: the rectangle was the wrong size on ${big.length} of\n` +
      `${ruling.answers.length}. That is fixed by measuring the boxes again, not by moving them, and nothing above addresses it.`
    : null,
]
  .filter((l) => l !== null)
  .join("\n");

process.stdout.write(`${out}\n`);
process.exit(clears ? 0 : 1);
