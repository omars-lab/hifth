#!/usr/bin/env node
/**
 * CI gate: every gate this repo owns is actually invoked, in all three places.
 *
 * This exists because `gate:pages` shipped and then did nothing. It was written,
 * reviewed, merged, documented in the code map, and named in a PR — and it was
 * wired into neither `make ci`, nor `pnpm gates`, nor any workflow job. For one
 * merge the repo believed it was checking that every glyph of scripture falls
 * inside a tappable polygon, and nothing was checking anything. The same audit
 * found `gate:edges` in the Makefile but in no workflow: green locally, absent
 * in CI, which is the worse direction — the author sees a pass the branch
 * protection never saw.
 *
 * `gate:ci-artifacts` already carries the sentence this file enforces: "a gate
 * nobody runs is a comment". It was written about two other gates that had
 * lived in `pnpm gates` without a job. Three separate instances of one defect
 * is not carelessness, it is a missing invariant — a gate is added in one file
 * and has to be remembered in three others, and memory is not a mechanism.
 *
 * The invariant, in both directions:
 *
 *   1. Every `gate:*` script in package.json is invoked by the `gates`
 *      composite, by the Makefile `ci` target, and by some workflow job. Those
 *      are the three ways a gate ever runs here — `pnpm gates` for a quick
 *      sweep, `make ci` for the local mirror, the workflow for the one that
 *      actually blocks a merge. Present in some but not all is the defect: the
 *      gate looks wired, and its coverage depends on which command you happen
 *      to type.
 *   2. Every `gate:*` named by the Makefile or a workflow exists in
 *      package.json. Catches a rename or a typo before it is a red CI run, and
 *      before a Makefile-only reference becomes a local-only failure.
 *
 * There is deliberately no exemption list. A gate too slow or too
 * environment-bound to run in CI is a real thing, and when one exists the right
 * answer is a conversation about what it is for — not a quiet line in an array
 * here, which is how an allow-list starts every time.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const WORKFLOWS = join(ROOT, ".github", "workflows");

// `i18n` has digits in it, and the first version of this check was written with
// [a-z-]+ and silently read `gate:i18n` as `gate:i` — a matcher that cannot
// spell one of the names it is auditing reports that name missing everywhere.
const NAME = /gate:[a-z0-9-]+/g;

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const owned = Object.keys(pkg.scripts).filter((s) => s.startsWith("gate:"));
if (owned.length === 0) {
  console.error("gate:gates — FAIL: package.json declares no gate:* scripts at all");
  process.exit(1);
}

/** What `pnpm gates` runs. */
const composite = new Set((pkg.scripts.gates ?? "").match(NAME) ?? []);

/**
 * What `make ci` runs.
 *
 * Scoped to the `ci` target's own recipe: recipe lines are tab-indented, so the
 * block ends at the first line that starts in column zero. Without that scope
 * the Makefile's *prose* would count — `make audit-edges` has a comment
 * mentioning gate:edges, and a gate satisfied by a comment is this file's whole
 * subject.
 */
const makefile = readFileSync(join(ROOT, "Makefile"), "utf8");
const ciTarget = makefile.match(/^ci:.*\n((?:[\t ].*\n|\n)*)/m);
if (!ciTarget) {
  console.error("gate:gates — FAIL: no `ci:` target found in the Makefile");
  process.exit(1);
}
const make = new Set(
  ciTarget[1]
    .split("\n")
    .filter((line) => !line.trim().startsWith("@#") && !line.trim().startsWith("#"))
    .join("\n")
    .match(NAME) ?? [],
);

/**
 * What the workflows run.
 *
 * Only `run:` lines count, never comments — ci.yml explains most of its gates in
 * prose above the step, and half those paragraphs name a *different* gate than
 * the step they introduce.
 */
let workflowRunsComposite = false;
const workflow = new Set();
for (const name of readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f))) {
  const text = readFileSync(join(WORKFLOWS, name), "utf8");
  for (const [, gate] of text.matchAll(/run:\s*pnpm\s+(gate:[a-z0-9-]+)/g)) workflow.add(gate);
  // A job that runs the composite covers everything the composite covers. No
  // job does that today — each gate gets its own named step so a red run says
  // which invariant broke — but a repo that changed its mind should not be told
  // its gates are unwired.
  if (/run:\s*pnpm\s+gates\s*$/m.test(text)) workflowRunsComposite = true;
}

const problems = [];

for (const gate of owned) {
  const missing = [];
  if (!composite.has(gate)) missing.push("`pnpm gates`");
  if (!make.has(gate)) missing.push("the Makefile `ci` target");
  if (!workflow.has(gate) && !workflowRunsComposite) missing.push("any .github/workflows job");
  if (missing.length > 0) {
    problems.push(
      `${gate} is declared in package.json but not invoked by ${missing.join(", ")}. ` +
        "A gate that nothing invokes is a script.",
    );
  }
}

for (const gate of [...make, ...workflow, ...composite]) {
  if (!owned.includes(gate)) {
    problems.push(
      `${gate} is invoked by the Makefile, a workflow or \`pnpm gates\`, but package.json declares no such script — a rename or a typo.`,
    );
  }
}

if (problems.length > 0) {
  console.error("gate:gates — FAIL:");
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}
console.log(`gate:gates — OK (${owned.length} gates, each invoked by pnpm gates, make ci and CI)`);
