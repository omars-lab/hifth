#!/usr/bin/env node
/**
 * CI gate: docs/backlog.md was built from the registers as they stand today.
 *
 * Same rule as docs/issues.md, docs/use-cases.md, the decisions README and the
 * validation guide, and it exists for the reason all of those do: a generated
 * page that nothing re-checks is a page that keeps looking authoritative for
 * months after it stopped being true. This one is worse than most if it rots,
 * because it is the page somebody opens to decide what to spend an hour on —
 * a stale row sends them at something already done, and a missing one hides
 * the thing that was actually waiting.
 *
 * It checks one thing only. Whether each item is real, resolves, and is named
 * in the right register is `gate:issues`, `gate:decisions` and
 * `gate:validation`'s job, and duplicating any of that here would give this
 * repo two gates with an opinion about the same fact.
 *
 * `--list` prints the same summary without failing, which is what `make tasks`
 * runs.
 */
import { docHash, tasksHash, payload } from "./tasks.mjs";
import { docWaitingHash, readRecommendations, readShots, waitingHash } from "./waiting.mjs";

const p = payload();
const mine = p.issues.filter((i) => i.owner === "user").length;
const summary =
  `${p.decisions.length} decision(s) open, ${p.checks.length} check(s) only a person can run, ` +
  `${mine} other item(s) yours, ${p.issues.length - mine} for whoever picks them up, ` +
  `${p.loops.length} loop(s) unfinished`;

if (process.argv.includes("--list")) {
  console.log(summary);
  console.log("  docs/backlog.md and docs/waiting-on-you.md — re-render with `make tasks-doc`");
  process.exit(0);
}

// Two pages are built from the same registers: the backlog, and the note of
// what is waiting on the owner (which also reads each record's recommendation
// and the pictures of each options page). Either one falling behind fails.
const pages = [
  ["docs/backlog.md", docHash(), tasksHash()],
  ["docs/waiting-on-you.md", docWaitingHash(), waitingHash(p, readShots(), readRecommendations(p.decisions))],
];
const stale = pages.filter(([, have, want]) => have !== want);
if (stale.length) {
  console.error("gate:tasks — FAIL:");
  for (const [path, have, want] of stale) {
    console.error(
      have === null
        ? `  - ${path} is missing or unstamped. Run \`make tasks-doc\`.`
        : `  - ${path} was built from ${have}, the source is now ${want}. Run \`make tasks-doc\`.`,
    );
  }
  process.exit(1);
}

console.log(`gate:tasks — OK (${summary})`);
