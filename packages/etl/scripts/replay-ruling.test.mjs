/**
 * The replay: a committed ruling re-scored from its seed, and the answer checked
 * against the receipt beside it.
 *
 * What is held here is the promise the closer makes to a stranger — that one
 * command either reproduces our number or says, in words, which of the three
 * things (input, code, headline) does not match — and the two ways a replay could
 * lie: by inventing a record to agree with when there is none, and by quietly
 * doing less than a replay when handed a file it cannot rebuild. So a ruling with
 * no receipt is *unstamped* and stops; a settled table stops; a tampered answer,
 * a tampered headline and a tampered code fingerprint each come back as DIFFERS
 * with a non-zero exit.
 *
 * Most of the cases run on the nudge grader's own known-answer fixture, with the
 * invented pages of `lib/self-test-io.mjs`, so they need no cache and run the same
 * in a clean clone. The last case replays the real committed sitting of 2026-08-12
 * against its committed receipt, and skips itself where the word-corpus download
 * is absent, since that is the one thing the rebuild reads that is not committed.
 *
 * The script is run rather than imported, as the other graders' tests do: its
 * refusals live in the top-level flow where `process.exit` ends the run.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { codeFingerprint } from "./lib/grader-code.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "replay-ruling.mjs");
const ROOT = join(HERE, "../../..");
const FIXTURE = join(HERE, "self-test", "nudge");
const IO = join(HERE, "lib", "self-test-io.mjs");
const RULINGS = join(ROOT, "docs", "validation", "rulings");
const REAL = "2026-08-12T1650-placement-residual-by-hand.seed23";
/** The one uncommitted thing the real rebuild reads: the pinned word-corpus download. */
const WORDS_PRESENT = existsSync(join(ROOT, "packages", "etl", "data", "pages", ".cache", "words", "001.svg"));

function run(...args) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out: stdout, err: "" };
  } catch (e) {
    return { code: e.status, out: e.stdout ?? "", err: e.stderr ?? "" };
  }
}

describe("replay-ruling", () => {
  let tmp;
  let ruling;
  let receipt;
  const fixtureArgs = () => [ruling, "--shift", join(FIXTURE, "shift.json"), "--io", IO];

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), "hifth-replay-"));
    ruling = join(tmp, "sitting.json");
    receipt = join(tmp, "sitting.replay.json");
    copyFileSync(join(FIXTURE, "ruling.json"), ruling);
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("a ruling with no receipt is unstamped, and it says so rather than inventing one", () => {
    const r = run(...fixtureArgs());
    expect(r.code).toBe(4);
    expect(r.out).toMatch(/unstamped, cannot be replayed/);
    expect(existsSync(receipt)).toBe(false);
  });

  it("--record writes a receipt holding the three things a replay checks", () => {
    const r = run(...fixtureArgs(), "--record");
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/recorded .*sitting\.replay\.json/);
    const doc = JSON.parse(readFileSync(receipt, "utf8"));
    expect(doc.built).toBe("replay-receipt");
    expect(doc.gradedBy).toBe("packages/etl/scripts/score-mark-nudge.mjs");
    expect(doc.input).toEqual({ file: "shift.json", fingerprint: "aaa8372b" });
    expect(doc.code.fingerprint).toBe(codeFingerprint(join(HERE, "score-mark-nudge.mjs")).hash);
    expect(doc.headline).toBe("100.0% [72.2% – 100.0%] 10/10");
    expect(doc.exit).toBe(0);
    // The receipt is checked in; nothing in it may name the machine it was written on.
    expect(doc.verdict).not.toContain(ROOT);
    expect(doc.verdict).toMatch(/· code <fingerprint> \(/);
  });

  it("the same bytes replay to the same number, and every row says so", () => {
    const r = run(...fixtureArgs());
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/input fingerprint\s+aaa8372b\s+aaa8372b\s+same/);
    expect(r.out).toMatch(/code fingerprint\s+[0-9a-f]{12}\s+[0-9a-f]{12}\s+same/);
    expect(r.out).toMatch(/landed nearer our correction\s+100\.0% \[72\.2% – 100\.0%\] 10\/10\s+100\.0% \[72\.2% – 100\.0%\] 10\/10\s+same/);
    expect(r.out).toMatch(/every other printed figure .* same/);
    expect(r.out).toMatch(/everything agrees/);
  });

  it("a tampered headline in the receipt is a mismatch, not a rounding", () => {
    const doc = JSON.parse(readFileSync(receipt, "utf8"));
    writeFileSync(`${receipt}.good`, JSON.stringify(doc));
    doc.headline = "90.0% [72.2% – 100.0%] 9/10";
    writeFileSync(receipt, JSON.stringify(doc));
    const r = run(...fixtureArgs());
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/landed nearer our correction\s+90\.0% .* 9\/10\s+100\.0% .* 10\/10\s+DIFFERS/);
    expect(r.out).toMatch(/input fingerprint .* same/);
    expect(r.out).toMatch(/code fingerprint .* same/);
    expect(r.out).toMatch(/This is not a reproduction/);
    copyFileSync(`${receipt}.good`, receipt);
  });

  it("a receipt recorded by other grading code is a mismatch on the code row, with the way out named", () => {
    const doc = JSON.parse(readFileSync(receipt, "utf8"));
    doc.code.fingerprint = "000000000000";
    writeFileSync(receipt, JSON.stringify(doc));
    const r = run(...fixtureArgs());
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/code fingerprint\s+000000000000\s+[0-9a-f]{12}\s+DIFFERS/);
    expect(r.out).toMatch(/landed nearer our correction .* same/);
    expect(r.out).toMatch(/re-record with --record/);
    copyFileSync(`${receipt}.good`, receipt);
  });

  it("one changed answer in the ruling moves the headline, and the replay catches it", () => {
    const doc = JSON.parse(readFileSync(ruling, "utf8"));
    // Send the first answer far from every correction, so it lands nearer the shipped box.
    doc.answers[0].u = [5, 5];
    writeFileSync(ruling, JSON.stringify(doc));
    const r = run(...fixtureArgs());
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/landed nearer our correction\s+100\.0% .* 10\/10\s+90\.0% .* 9\/10\s+DIFFERS/);
    expect(r.out).toMatch(/input fingerprint .* same/);
    expect(r.out).toMatch(/code fingerprint .* same/);
    expect(r.out).toMatch(/the same inputs no longer give the recorded number/);
    copyFileSync(join(FIXTURE, "ruling.json"), ruling);
  });

  it("a ruling whose measurement is not committed cannot be rebuilt, and says so", () => {
    // The fixture's fingerprint names no file under docs/validation/rulings, so without --shift there is nothing to rebuild from.
    const r = run(ruling);
    expect(r.code).toBe(4);
    expect(r.out).toMatch(/aaa8372b\) is not under docs\/validation\/rulings/);
    expect(r.out).toMatch(/cannot be replayed from committed bytes/);
  });

  it("a settled table is refused in those words, not replayed as something smaller", () => {
    const r = run("2026-08-14-placement-what-kind-of-wrong-fallback.seed23.settled");
    expect(r.code).toBe(4);
    expect(r.out).toMatch(/a settled table/);
    expect(r.out).toMatch(/can be re-counted; it cannot be re-scored/);
    expect(r.out).toMatch(/cannot be replayed from committed bytes/);
  });

  it("a file that is not a sitting is refused", () => {
    const r = run("mark-shift.40pages.c8528da9");
    expect(r.code).toBe(4);
    expect(r.out).toMatch(/not a sitting/);
  });

  it("a name that is nothing is an error, not a silent pass", () => {
    const r = run("no-such-ruling");
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/no ruling at no-such-ruling/);
  });

  it("--list names every ruling in the directory and what can be done with it", () => {
    const r = run("--list");
    expect(r.code).toBe(0);
    expect(r.out).toMatch(new RegExp(`${REAL}\\.json\\n\\s+a placing sitting — replayable; receipt recorded \\d{4}-\\d{2}-\\d{2}`));
    expect(r.out).toMatch(/settled\.json\n\s+settled table — cannot be replayed/);
    expect(r.out).toMatch(/mark-shift\.40pages\.c8528da9\.json\n\s+not a sitting/);
    expect(r.out).not.toMatch(/replay\.json\n/);
  });

  it.skipIf(!WORDS_PRESENT)("the committed sitting of 2026-08-12 replays to its committed receipt", () => {
    const r = run(REAL);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/input fingerprint\s+c8528da9\s+c8528da9\s+same/);
    expect(r.out).toMatch(/landed nearer our correction\s+98\.3% \[91\.1% – 99\.7%\] 59\/60\s+98\.3% \[91\.1% – 99\.7%\] 59\/60\s+same/);
    expect(r.out).toMatch(/everything agrees/);
    const doc = JSON.parse(readFileSync(join(RULINGS, `${REAL}.replay.json`), "utf8"));
    expect(doc.code.fingerprint).toBe(codeFingerprint(join(HERE, "score-mark-nudge.mjs")).hash);
  });
});
