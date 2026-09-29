/**
 * What the performance reminder looks for (scripts/hook-perf-nudge.mjs).
 *
 * Nothing runs the optimizing-performance skill on its own: the size check only
 * fails at the cap, and the start-up check only runs when someone asks. So the
 * app can creep up to the cap with every check green and nobody looking. This
 * reads what a build, push or check just printed, plus the last accepted size,
 * and names what is worth acting on. It never builds or measures anything.
 */

/** How close to the cap, in KB, before the reminder speaks up. */
export const NEAR_KB = 15;

/** Commands whose output or aftermath says something about the app's size or start-up. */
const WATCHED = [
  /\bmake\s+(?:build|site|lighthouse|budget-update|pitch|perf-report|perf-sweep)\b/,
  /\bvite\s+build\b/,
  /\bgate:budget\b/,
  /\bgit\b.*\bpush\b/,
];

export function isWatched(command) {
  const cmd = String(command ?? "");
  // A commit message that merely mentions "build" is not a build.
  const withoutQuoted = cmd.replace(/'[^']*'|"[^"]*"/g, "''");
  return WATCHED.some((re) => re.test(withoutQuoted));
}

/** The size a command just measured, if it printed one; else null. */
export function measuredGz(output) {
  const m = String(output ?? "").match(/gate:budget — (?:OK \(|FAIL: )([\d.]+) KB gz/);
  return m ? Math.round(Number(m[1]) * 1024) : null;
}

/**
 * What is worth acting on. Each finding has a `key` (so the hook says it once per
 * session) and `say` (the sentence the session reads).
 */
export function findings({ totalGz, capGz, output }) {
  const out = String(output ?? "");
  const kb = (b) => (b / 1024).toFixed(1);
  const found = [];

  // Over the cap only; "FAIL: the bundle moved" is a baseline to accept, not a size problem.
  if (/gate:budget — FAIL: [\d.]+ KB gz/.test(out)) {
    found.push({ key: "budget-fail", say: "The size check failed: the app is over its code-size cap." });
  } else if (totalGz != null && capGz - totalGz < NEAR_KB * 1024) {
    found.push({
      key: "near-cap",
      // The hook remembers key + seen, so it speaks again only when the size moves.
      seen: Math.round(totalGz / 1024),
      say: `The app is ${kb(totalGz)} KB against a ${kb(capGz)} KB cap: ${kb(capGz - totalGz)} KB of room left.`,
    });
  }

  if (/\binteractive\b.*\bfailure\b|expected:\s*<=\s*2500/i.test(out)) {
    found.push({ key: "startup-slow", say: "The start-up check missed its 2.5 second goal." });
  }

  return found;
}
