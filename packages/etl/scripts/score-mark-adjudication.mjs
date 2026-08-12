/**
 * Scores a worked session, and says whether the displacement correction survived
 * it.
 *
 * ## Why the scoring is a separate program
 *
 * Because the answers do not exist until this runs. The page a person works has
 * no key in it, and no key was ever written down; this rebuilds the session from
 * the seed and the same displacement file, and only then does it know which
 * panel was which. That is the whole defence of the result. Nobody had to be
 * trusted not to peek, because there was nothing to peek at.
 *
 * It refuses to score a ruling built from different displacements. Re-measuring
 * between building the page and scoring it would leave every answer attached to
 * a question that is no longer being asked, and the arithmetic would come out
 * clean and mean nothing.
 *
 * ## What comes out, and how to read it
 *
 * Four numbers, and only the first is the verdict:
 *
 * - **as shipped** — how often the corrected rectangle was picked over the one
 *   the app draws today, with an interval. The correction is supported if that
 *   interval is entirely above half.
 * - **the decoy** — the same count against a displacement of the same size in
 *   another direction. This is the ceiling: it is what "can see a shift this
 *   small" looks like for this person on this screen. A low headline with a high
 *   decoy is the informative failure — the person could see fine and did not
 *   prefer our correction, which means the correction is wrong rather than the
 *   test being blunt.
 * - **the catches** — got obviously-wrong rectangles right. Below the floor the
 *   session is not scored at all.
 * - **twins** — said "can't tell" when shown the same rectangle twice. Low here
 *   means a person who always picks something, and everything above it is worth
 *   less.
 *
 * ## And one number that is not about the correction at all
 *
 * The page also lets a reader say *neither rectangle closes around the mark* — the
 * mark pokes out of both copies. That is a claim about how big the rectangle is,
 * and every trial here is about where it sits, so it is reported on its own line
 * and kept out of the headline's arithmetic. Two faults, two repairs: a placement
 * that is off is fixed by moving the box, an extent that is short is fixed by
 * measuring it again, and a single count that mixed them would recommend neither.
 *
 * The headline is then printed a second time with those trials dropped. Not as a
 * stricter verdict — dropping trials only costs power, so a narrower result that
 * fails to clear half proves nothing — but because a headline that survives the
 * removal and one that depends on it are different findings, and only one of them
 * should be allowed to release a correction quietly.
 *
 * Exits non-zero when the session fails its checks or the headline does not
 * clear half, so it can be a step in something larger without anyone having to
 * read it.
 *
 *   node packages/etl/scripts/score-mark-adjudication.mjs ruling.json
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { planSession } from "./lib/adjudication.mjs";
import { wilson } from "./lib/mark-ink.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ETL = join(HERE, "..");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
let rulingPath = null;
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) i += 1;
  else if (!rulingPath) rulingPath = argv[i];
}
if (!rulingPath) {
  process.stderr.write("usage: score-mark-adjudication.mjs <ruling.json> [--shift path]\n");
  process.exit(2);
}
const shiftPath = arg("--shift", join(ETL, "out", "mark-shift.json"));

/** Below this share of catches right, the session says nothing and is not scored. */
const CATCH_FLOOR = 0.9;
/** Below this share of twins called "can't tell", the answers are suspect. */
const TWIN_FLOOR = 0.5;

const ruling = JSON.parse(readFileSync(rulingPath, "utf8"));
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
    `this ruling was worked against different displacements (${ruling.shiftFingerprint}, measured ${ruling.shiftRan})\n` +
      `${shiftPath} is now ${fp}. Score it against the file it was built from, or build a fresh session.\n`,
  );
  process.exit(2);
}

const shift = JSON.parse(shiftText);
const { trials } = planSession({ seed: ruling.seed, count: ruling.count, shifts: shift.shifts });

const byIndex = new Map(trials.map((t) => [t.i, t]));
const buckets = { shipped: [], decoy: [], catch: [], twin: [] };
for (const a of ruling.answers) {
  const t = byIndex.get(a.i);
  if (!t) throw new Error(`answer ${a.i} has no trial; the ruling and the seed disagree`);
  if (t.id !== a.id) throw new Error(`trial ${a.i} is ${t.id} but the ruling says ${a.id}`);
  buckets[t.kind].push({ t, a });
}

/**
 * Can't-tell is not counted as a miss. It is an honest answer to a question that
 * really was too close, and folding it in as a wrong answer would punish exactly
 * the care this asks for. It is reported separately instead, where a reader can
 * see how much of the session it was.
 */
function share(rows, right) {
  const told = rows.filter((r) => r.a.choice >= 0);
  const k = told.filter(right).length;
  const n = told.length;
  const [lo, hi] = wilson(k, n);
  return { k, n, abstained: rows.length - n, pct: n ? (100 * k) / n : 0, lo: 100 * lo, hi: 100 * hi };
}

const correct = (r) => r.a.choice === r.t.answer;
const s = {
  shipped: share(buckets.shipped, correct),
  decoy: share(buckets.decoy, correct),
  catch: share(buckets.catch, correct),
};

/**
 * "Neither rectangle closed around the mark", counted on its own axis.
 *
 * `asks` says what was on the screen. A ruling worked before the tick existed has
 * no flags in it, and reporting that as nought-in-a-hundred would turn a page that
 * could not ask into a page that asked and was told no — a strong claim about the
 * boxes, manufactured out of a missing feature. So an older ruling gets a sentence
 * saying the question was not put, and no number.
 */
const asksExtent = (ruling.asks || ["choice"]).includes("neither");
const flagged = ruling.answers.filter((a) => a.neither);
const extent = {
  n: flagged.length,
  of: ruling.answers.length,
  pct: ruling.answers.length ? (100 * flagged.length) / ruling.answers.length : 0,
};
/**
 * The headline again with those trials removed.
 *
 * Reported, never enforced. Dropping trials only narrows the sample, so a subset
 * that fails to clear half has not refuted anything — it may simply be smaller.
 * What it is good for is the comparison: a correction supported by the whole
 * hundred and by the trials where the rectangle fitted is a different, stronger
 * finding than one that evaporates when the awkward ones leave.
 */
const clean = share(buckets.shipped.filter((r) => !r.a.neither), correct);
const twin = {
  n: buckets.twin.length,
  cantTell: buckets.twin.filter((r) => r.a.choice < 0).length,
};
twin.pct = twin.n ? (100 * twin.cantTell) / twin.n : 0;

const ms = ruling.answers.map((a) => a.ms).sort((x, y) => x - y);
const median = ms.length ? ms[Math.floor(ms.length / 2)] : 0;

const pc = (v) => `${v.toFixed(1)}%`;
const W = 26;
const line = (label, x) =>
  `${label.padEnd(W)} ${pc(x.pct).padStart(6)}  [${pc(x.lo)} – ${pc(x.hi)}]  ${x.k}/${x.n}` +
  (x.abstained ? `  (${x.abstained} can't tell)` : "");

const validCatch = s.catch.n > 0 && s.catch.pct >= 100 * CATCH_FLOOR;
const validTwin = twin.n === 0 || twin.pct >= 100 * TWIN_FLOOR;
const clears = s.shipped.n > 0 && s.shipped.lo > 50;
const cleanClears = clean.n > 0 && clean.lo > 50;

/** Enough of them to name, few enough to read. The rest are countable from the line above. */
const NAMED = 12;
const names = flagged.slice(0, NAMED).map((a) => a.id).join(", ") +
  (flagged.length > NAMED ? `, and ${flagged.length - NAMED} more` : "");

const out = [
  `ruling ${rulingPath}`,
  `seed ${ruling.seed} · ${ruling.answers.length} of ${ruling.count} answered · displacements ${ruling.shiftRan} (${fp})`,
  `median ${(median / 1000).toFixed(1)}s a trial`,
  "",
  line("as shipped", s.shipped),
  line("the decoy", s.decoy),
  line("the catches", s.catch),
  `${"twins called can't tell".padEnd(W)} ${pc(twin.pct).padStart(6)}  ${twin.cantTell}/${twin.n}`,
  "",
  !asksExtent
    ? "neither-closed: not asked. This ruling was worked on a page built before the question existed, so it says nothing either way about how big the rectangles are."
    : `${"neither box closed on it".padEnd(W)} ${pc(extent.pct).padStart(6)}  ${extent.n}/${extent.of}`,
  asksExtent && extent.n ? line("as shipped, minus those", clean) : "",
  asksExtent && extent.n
    ? `\nthe mark poked out of both rectangles on ${extent.n} of ${extent.of} trials. That is a\n` +
      `question about how big a rectangle is, and every trial here is about where it sits —\n` +
      `so it is not folded into anything above, and nothing above answers it. It is its own\n` +
      `finding, and the marks to go and look at are: ${names}.` +
      (clears === cleanClears
        ? "\nDropping them does not change the verdict."
        : `\nDropping them DOES change the verdict — it ${cleanClears ? "clears" : "no longer clears"} half without them.\n` +
          "Read that as a caution, not a result: a smaller sample has a wider interval, so this\n" +
          "may be arithmetic rather than a finding. It is a reason to say so out loud in the record.")
    : "",
  "",
  validCatch ? "session valid: the catches were caught" : `SESSION INVALID: catches ${pc(s.catch.pct)} < ${pc(100 * CATCH_FLOOR)}`,
  validTwin ? "" : `SUSPECT: only ${pc(twin.pct)} of twins drew a can't-tell; this reads as a person always picking one`,
  "",
  clears
    ? `the correction is supported: the interval on "as shipped" clears half`
    : s.shipped.n === 0
      ? "nothing to say: no as-shipped trials were answered"
      : s.decoy.lo > 50
        ? "the correction is NOT supported, and the decoys say why: the displacement was visible and the corrected box still was not preferred"
        : "the correction is not supported, and the decoys do not clear half either — this session cannot see a shift this small, so it says nothing about the correction",
]
  .filter((l) => l !== "")
  .join("\n");

process.stdout.write(`${out}\n`);
process.exit(validCatch && validTwin && clears ? 0 : 1);
