/**
 * The known-answer self-test every grader runs before it scores anything real.
 *
 * A grader's result now names the code that produced it (`grader-code.mjs`), so
 * a changed grader is *detectable* from a result. This is the other half: a
 * changed grader is *stopped*. Each scorer and settler keeps a tiny committed
 * fixture — a made-up sitting with a recorded verdict — and re-scores it every
 * time it starts. If the verdict it prints today is not the verdict on record,
 * it refuses to go on, and says so, rather than shipping a number that moved for
 * a reason nobody named.
 *
 * It is the same move `vendor-pages.mjs --verify-loop0` makes for the printed
 * pages: re-derive three known pages every run, and stop if they drift. Here the
 * known thing is a verdict, and the drift it catches is in arithmetic rather than
 * in bytes — a floor nudged, an interval computed differently, a bucket that
 * quietly stopped being counted.
 *
 * How it runs. The grader spawns itself on the fixture, in a child process
 * marked with an environment variable so the child does not spawn a grandchild.
 * The child's exit code, what it printed, and (for the settler) the ruling it
 * wrote are compared with the recorded ones. Two things are normalised before
 * comparing, because they are not verdicts: absolute paths, which differ by
 * machine, and the code fingerprint, which changes with every edit by design.
 *
 * The fixtures are small enough to read and committed under
 * `packages/etl/scripts/self-test/<name>/`; nothing here reads a cache or a
 * download, so the check runs the same in a clean clone. When a change to a
 * grader is *meant* to change its verdict, `rebuild-grader-self-tests.mjs`
 * re-records the fixture, and the new verdict lands in the diff a reviewer reads.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCRIPTS = join(HERE, "..");
export const ROOT = join(SCRIPTS, "..", "..", "..");
/** Where the committed fixtures live, one directory per grader. */
export const FIXTURES = join(SCRIPTS, "self-test");

/** Set to "child" in the spawned run, so a self-test does not self-test. */
export const CHILD_ENV = "HIFTH_GRADER_SELF_TEST";
/**
 * Points the graders at another fixture directory. It exists so the test can
 * prove a wrong fixture stops a grader; a real run never sets it.
 */
export const DIR_ENV = "HIFTH_GRADER_SELF_TEST_DIR";

/** The graders, by the short name of their fixture directory. */
export const GRADERS = {
  adjudication: "score-mark-adjudication.mjs",
  nudge: "score-mark-nudge.mjs",
  contest: "score-placement-contest.mjs",
  report: "score-mark-report.mjs",
  settle: "settle-mark-report.mjs",
};

/** Where a grader's fixture is: the committed one, unless the test points elsewhere. */
export const fixtureDir = (name) => join(process.env[DIR_ENV] || FIXTURES, name);

/**
 * A case's arguments as written in its `case.json`, made absolute. `fixture:` is
 * relative to the fixture directory and `scripts:` to `packages/etl/scripts`, so
 * the file says nothing about the machine it is read on.
 */
export function resolveArgs(args, dir) {
  return args.map((a) =>
    a.startsWith("fixture:") ? join(dir, a.slice("fixture:".length)) : a.startsWith("scripts:") ? join(SCRIPTS, a.slice("scripts:".length)) : a,
  );
}

/**
 * What is compared. Paths are not verdicts and neither is the code fingerprint,
 * which changes with every edit on purpose; everything else printed is.
 */
export function normalise(text, outPath = null) {
  let s = text;
  if (outPath) s = s.split(outPath).join("<out>");
  s = s.split(ROOT).join("<root>");
  s = s.replace(/· code [0-9a-f]{12} \(/g, "· code <fingerprint> (");
  return s;
}

/** The fields of a written ruling that are not part of its verdict. */
const VOLATILE = ["settledAt", "code"];

/**
 * Run one grader on one case and return what it did: exit code, normalised
 * output, and the ruling it wrote, if the case says it writes one. A writing
 * case gets `--out` into a scratch directory that is removed afterwards, so a
 * self-test can never leave a real ruling behind.
 */
export function runCase(script, dir, c) {
  const args = resolveArgs(c.args, dir);
  let tmp = null;
  let outPath = null;
  if (c.writes) {
    tmp = mkdtempSync(join(tmpdir(), "hifth-self-test-"));
    outPath = join(tmp, "out.json");
    args.push("--out", outPath);
  }
  let code = 0;
  let stdout = "";
  let stderr = "";
  try {
    stdout = execFileSync(process.execPath, [script, ...args], {
      encoding: "utf8",
      env: { ...process.env, [CHILD_ENV]: "child" },
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    code = e.status ?? 1;
    stdout = e.stdout ?? "";
    stderr = e.stderr ?? "";
  }
  let written = null;
  if (outPath && existsSync(outPath)) {
    written = JSON.parse(readFileSync(outPath, "utf8"));
    for (const k of VOLATILE) delete written[k];
  }
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  return { code, stdout: normalise(stdout, outPath), stderr, written };
}

/** The recorded verdict for a fixture: its case, exit code, output and written ruling. */
export function recordOf(dir) {
  const c = JSON.parse(readFileSync(join(dir, "case.json"), "utf8"));
  const stdoutPath = join(dir, c.stdout);
  return {
    c,
    code: c.code,
    stdout: existsSync(stdoutPath) ? readFileSync(stdoutPath, "utf8") : null,
    written: c.writes && existsSync(join(dir, c.writes)) ? JSON.parse(readFileSync(join(dir, c.writes), "utf8")) : null,
  };
}

/** The first line where two texts part company, for a message a person can act on. */
function firstDiff(want, got) {
  const a = want.split("\n");
  const b = got.split("\n");
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) return `  line ${i + 1}\n    recorded: ${a[i] ?? "<end of output>"}\n    now:      ${b[i] ?? "<end of output>"}`;
  }
  return "  (same lines, different bytes)";
}

/**
 * Run at the top of a grader, before it reads a single real argument. Returns
 * only when the fixture reproduces its recorded verdict; otherwise it says what
 * moved and exits 3, and nothing real is scored. A missing fixture is a refusal
 * too: a grader with no known answer to check itself against does not run.
 */
export function selfTest(scriptUrl, name) {
  if (process.env[CHILD_ENV] === "child") return;
  const script = fileURLToPath(scriptUrl);
  const dir = fixtureDir(name);
  const stop = (why) => {
    process.stderr.write(
      `self-test (${name}): ${why}\n` +
        `  Nothing was scored. If the grader is wrong, fix it. If the change is meant, re-record the\n` +
        `  fixture with \`node packages/etl/scripts/rebuild-grader-self-tests.mjs ${name}\` and commit it\n` +
        `  beside the change, so the new verdict lands in the diff a reviewer reads.\n`,
    );
    process.exit(3);
  };
  if (!existsSync(join(dir, "case.json"))) stop(`no fixture at ${dir} — a grader with no known answer does not run.`);
  const want = recordOf(dir);
  if (want.stdout === null) stop(`the fixture at ${dir} has no recorded verdict (${want.c.stdout} is missing).`);
  const got = runCase(script, dir, want.c);
  if (got.code !== want.code) {
    stop(
      `the known fixture exited ${got.code}; its recorded verdict exited ${want.code}.` +
        (got.stderr ? `\n${got.stderr.replace(/^/gm, "  | ")}` : ""),
    );
  }
  if (got.stdout !== want.stdout) stop(`the known fixture no longer prints its recorded verdict.\n${firstDiff(want.stdout, got.stdout)}`);
  if (want.c.writes && JSON.stringify(got.written) !== JSON.stringify(want.written)) {
    stop(`the ruling written for the known fixture is not the one on record (${want.c.writes}).`);
  }
  const lines = want.stdout.split("\n").length - 1;
  process.stderr.write(`self-test (${name}): the known fixture reproduces its recorded verdict (exit ${want.code}, ${lines} lines)\n`);
}
