/**
 * Scores a worked placement contest, and says whether the marks a person moved by
 * hand were moved to a better place than the machine would have left them.
 *
 * ## Why the scoring is a separate program
 *
 * Because the answers do not exist until this runs. The page a person works has no
 * key in it and no key was ever written down; this rebuilds the same trials from
 * the seed and the same least-sure file, and only then does it know which panel
 * held the placement the app ships and which held the machine's own guess. That is
 * the whole defence of the result: nobody had to be trusted not to peek, because
 * there was nothing to peek at.
 *
 * It refuses to score a ruling built from a different least-sure file. Rebuilding
 * that file between drawing the page and scoring it would leave every answer
 * attached to a question that is no longer being asked, and the arithmetic would
 * come out clean and mean nothing.
 *
 * ## What the contest is, and how to read the headline
 *
 * Every real trial shows two rectangles for one mark: the one the app draws today,
 * which on these marks is a place a person chose by overruling the machine, and the
 * one the machine would have drawn on its own with the person left out. The reader
 * is not told which is which and is asked only which rectangle sits on the mark. So
 * the headline is not "right vs wrong" — there is no key that says the human was
 * right. It is a preference, and which way it falls is the finding:
 *
 * - **the hand box is preferred** — readers picked the placement a person chose more
 *   often than the machine's guess, and the interval clears half. The overrides did
 *   their job: the app is drawing these marks in a better place than it would have.
 * - **the machine's box is preferred** — the interval sits *below* half. This is the
 *   finding that pays for the whole contest: on these marks the hand placements look
 *   worse than leaving the machine alone, and they are the ones to go back and look
 *   at.
 * - **can't tell them apart** — the interval straddles half. Whether that means the
 *   two placements are genuinely as good as each other, or only that the gap is too
 *   small for anyone to see, is what the decoy line answers.
 *
 * ## The three lines that keep the headline honest
 *
 * - **the decoy** — the shipped box against a copy of itself pushed the same distance
 *   in a neutral direction, so the shipped box is unambiguously the one on the mark.
 *   It is the yardstick: how often a reader resolves a gap this size at all. A
 *   straddled headline over a high decoy is a real toss-up; a straddled headline over
 *   a low decoy only means the test could not see a gap this small.
 * - **the catches** — the shipped box against a copy pushed a whole letter away.
 *   Anyone looking gets these; below the floor the session is not scored at all.
 * - **twins** — the same rectangle shown twice, where "can't tell" is the only honest
 *   answer. Low here means a person who always picks something, and everything above
 *   it is worth less.
 *
 * ## And one line that is not about the contest at all
 *
 * The page also lets a reader say *neither rectangle closes around the mark* — the
 * mark pokes out of both boxes. That is a claim about how big the rectangle is, or
 * that both placements are wrong together, and every trial here is about which of
 * two is closer, so it is reported on its own line and kept out of the headline's
 * arithmetic. The headline is then printed a second time with those trials dropped —
 * not as a stricter verdict (dropping trials only costs power) but because a
 * preference that survives their removal and one that depends on it are different
 * findings.
 *
 * Exits non-zero only when the session fails its own checks (the catches or the
 * twins), so it can be a step in something larger. A headline that falls below half
 * is a valid result, not a failure, so it does not change the exit code.
 *
 *   node packages/etl/scripts/score-placement-contest.mjs contest-ruling.json [--least-sure path]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { planContest } from "./lib/adjudication.mjs";
import { codeLine } from "./lib/grader-code.mjs";
import { wilson } from "./lib/mark-ink.mjs";
import { selfTest } from "./lib/self-test.mjs";

// Before anything real is read: re-score the known fixture, and stop if its
// recorded verdict does not come back.
selfTest(import.meta.url, "contest");

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
  process.stderr.write("usage: score-placement-contest.mjs <contest-ruling.json> [--least-sure path]\n");
  process.exit(2);
}
const lsPath = arg("--least-sure", join(ETL, "out", "least-sure.json"));

/** Below this share of catches right, the session says nothing and is not scored. */
const CATCH_FLOOR = 0.9;
/** Below this share of twins called "can't tell", the answers are suspect. */
const TWIN_FLOOR = 0.5;

const ruling = JSON.parse(readFileSync(rulingPath, "utf8"));
const lsText = readFileSync(lsPath, "utf8");

/** The same FNV-1a the builder stamps into the head, so the two agree byte-for-byte. */
function fingerprint(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const fp = fingerprint(lsText);
if (fp !== ruling.leastSureFingerprint) {
  process.stderr.write(
    `this ruling was worked against a different least-sure file (${ruling.leastSureFingerprint}, built ${ruling.leastSureBuilt})\n` +
      `${lsPath} is now ${fp}. Score it against the file it was built from, or build a fresh session.\n`,
  );
  process.exit(2);
}

const ls = JSON.parse(lsText);
const marks = ls.marks;

/**
 * The trials, replayed rather than chosen again. `planContest` is a pure function
 * of the seed and these marks, and that replay is what makes the answer key exist
 * at all. The builder narrows nothing up front — it hands the whole least-sure list
 * to `planContest`, which picks the trials round-robin across pages — so this hands
 * the same whole list and gets the same trials back.
 *
 * The page set that comes out is then checked against the one the ruling recorded.
 * The file fingerprint above already proves the marks are identical, so this second
 * guard is a belt-and-braces on the rebuild itself: if a change to how trials are
 * chosen ever moved which pages come up, this catches it here rather than letting
 * every trial resolve to a different mark and reporting a rate that moved for a
 * reason nobody could name.
 */
const { trials } = planContest({ seed: ruling.seed, count: ruling.count, marks });
const rebuiltPages = [...new Set(trials.map((t) => t.page))].sort((a, b) => a - b);
const rebuiltFp = fingerprint(rebuiltPages.join(","));
if (ruling.select && rebuiltFp !== ruling.select.fp) {
  process.stderr.write(
    `the rebuilt session covers a different set of pages than this ruling was worked over\n` +
      `(ruling ${ruling.select.fp}, rebuilt ${rebuiltFp}). The least-sure file matches its fingerprint,\n` +
      `so this is the builder and the scorer choosing trials differently — do not trust the numbers.\n`,
  );
  process.exit(2);
}

const byIndex = new Map(trials.map((t) => [t.i, t]));
const buckets = { shipped: [], decoy: [], catch: [], twin: [] };
for (const a of ruling.answers) {
  const t = byIndex.get(a.i);
  if (!t) throw new Error(`answer ${a.i} has no trial; the ruling and the seed disagree`);
  if (t.id !== a.id) throw new Error(`trial ${a.i} is ${t.id} but the ruling says ${a.id}`);
  buckets[t.kind].push({ t, a });
}

/**
 * Can't-tell is not folded into a share. It is an honest answer to a question that
 * really was too close, and counting it as a miss would punish exactly the care
 * this asks for. It is reported as the abstained count instead.
 */
function share(rows, right) {
  const told = rows.filter((r) => r.a.choice >= 0);
  const k = told.filter(right).length;
  const n = told.length;
  const [lo, hi] = wilson(k, n);
  return { k, n, abstained: rows.length - n, pct: n ? (100 * k) / n : 0, lo: 100 * lo, hi: 100 * hi };
}

/** On every real trial `answer` is the panel holding the shipped (hand) rectangle. */
const pickedShipped = (r) => r.a.choice === r.t.answer;

const s = {
  shipped: share(buckets.shipped, pickedShipped),
  decoy: share(buckets.decoy, pickedShipped),
  catch: share(buckets.catch, pickedShipped),
};

/**
 * "Neither rectangle closed around the mark", counted on its own axis. `asks` says
 * what the page was able to ask; a ruling worked before the tick existed has no
 * flags in it, and reporting that as nought-in-a-hundred would turn a page that
 * could not ask into a page that asked and was told no.
 */
const asksExtent = (ruling.asks || ["choice"]).includes("neither");
const flagged = ruling.answers.filter((a) => a.neither);
const extent = {
  n: flagged.length,
  of: ruling.answers.length,
  pct: ruling.answers.length ? (100 * flagged.length) / ruling.answers.length : 0,
};
/** The headline again with the neither-closed trials removed — reported, never enforced. */
const clean = share(buckets.shipped.filter((r) => !r.a.neither), pickedShipped);
const twin = {
  n: buckets.twin.length,
  cantTell: buckets.twin.filter((r) => r.a.choice < 0).length,
};
twin.pct = twin.n ? (100 * twin.cantTell) / twin.n : 0;

const ms = ruling.answers.map((a) => a.ms).sort((x, y) => x - y);
const median = ms.length ? ms[Math.floor(ms.length / 2)] : 0;

const pc = (v) => `${v.toFixed(1)}%`;
const W = 28;
const line = (label, x) =>
  `${label.padEnd(W)} ${pc(x.pct).padStart(6)}  [${pc(x.lo)} – ${pc(x.hi)}]  ${x.k}/${x.n}` +
  (x.abstained ? `  (${x.abstained} can't tell)` : "");

const validCatch = s.catch.n > 0 && s.catch.pct >= 100 * CATCH_FLOOR;
const validTwin = twin.n === 0 || twin.pct >= 100 * TWIN_FLOOR;

/** Which way the preference fell, read off the interval rather than the point. */
const handPreferred = s.shipped.n > 0 && s.shipped.lo > 50;
const machinePreferred = s.shipped.n > 0 && s.shipped.hi < 50;
const decoyResolves = s.decoy.n > 0 && s.decoy.lo > 50;

/** Enough of the neither-closed marks to name, few enough to read. */
const NAMED = 12;
const names = flagged.slice(0, NAMED).map((a) => a.id).join(", ") +
  (flagged.length > NAMED ? `, and ${flagged.length - NAMED} more` : "");

const verdict = s.shipped.n === 0
  ? "nothing to say: no hand-vs-machine trials were answered"
  : handPreferred
    ? 'the hand overrides are supported: the interval on "the hand box" clears half, so on these marks a person placed the mark better than the machine would have'
    : machinePreferred
      ? "the machine's own guess was preferred: on these marks the hand overrides look worse than leaving the machine alone, and they are the ones to go back and look at"
      : decoyResolves
        ? "a real toss-up: the reader could resolve a gap this size (the decoy clears half) and still could not prefer either box, so on these marks the two placements are about as good as each other"
        : "inconclusive: the reader could not reliably tell a gap this size even on the decoy, so this session cannot say whether the hand box or the machine's is better — it needs marks with a wider gap or a sharper eye";

const out = [
  `ruling ${rulingPath}`,
  `seed ${ruling.seed} · ${ruling.answers.length} of ${ruling.count} answered · least-sure ${ruling.leastSureBuilt} (${fp})`,
  // The other fingerprint: the code that reached this verdict, beside the input it read.
  codeLine(fileURLToPath(import.meta.url)),
  `${ruling.classes ? `over the ${ruling.classes.join(", ")} marks · ` : ""}median ${(median / 1000).toFixed(1)}s a trial`,
  "",
  line("the hand box preferred", s.shipped),
  line("the decoy (a gap this size)", s.decoy),
  line("the catches", s.catch),
  `${"twins called can't tell".padEnd(W)} ${pc(twin.pct).padStart(6)}  ${twin.cantTell}/${twin.n}`,
  "",
  !asksExtent
    ? "neither-closed: not asked. This ruling was worked on a page built before the question existed, so it says nothing either way about whether both boxes missed the mark."
    : `${"neither box closed on it".padEnd(W)} ${pc(extent.pct).padStart(6)}  ${extent.n}/${extent.of}`,
  asksExtent && extent.n ? line("the hand box, minus those", clean) : "",
  asksExtent && extent.n
    ? `\nthe mark poked out of both rectangles on ${extent.n} of ${extent.of} trials. That is a\n` +
      `question about whether either box is even the right size, and every trial here is about\n` +
      `which of the two is closer — so it is not folded into anything above. It is its own\n` +
      `finding, and the marks to go and look at are: ${names}.` +
      ((clean.n > 0 && clean.lo > 50) === handPreferred
        ? "\nDropping them does not change which way the preference falls."
        : "\nDropping them DOES change which way the preference falls — read that as a caution, not a\n" +
          "result: a smaller sample has a wider interval, so this may be arithmetic rather than a\n" +
          "finding. It is a reason to say so out loud in the record.")
    : "",
  "",
  validCatch ? "session valid: the catches were caught" : `SESSION INVALID: catches ${pc(s.catch.pct)} < ${pc(100 * CATCH_FLOOR)}`,
  validTwin ? "" : `SUSPECT: only ${pc(twin.pct)} of twins drew a can't-tell; this reads as a person always picking one`,
  "",
  verdict,
]
  .filter((l) => l !== "")
  .join("\n");

process.stdout.write(`${out}\n`);
process.exit(validCatch && validTwin ? 0 : 1);
