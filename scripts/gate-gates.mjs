#!/usr/bin/env node
/**
 * Gate: every gate this repo owns is actually invoked, by the sweep and by the hooks.
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
 * On 2026-09-27 the checks moved off GitHub and into the local hooks (the CI
 * spend plan, items 5 and 6): we are the only developers and the hooks always
 * run, so GitHub keeps only the deploy. "Some workflow job" stopped being a
 * place a gate runs, and the hook targets became the place that blocks. So
 * the invariant now reads:
 *
 *   1. Every `gate:*` script in package.json is invoked by the `gates`
 *      composite (a quick sweep) and is reached by the hooks: the recipe of
 *      `make pre-commit` or `make pre-push`, or of a target either depends on,
 *      counting `pnpm gates:fast` as every gate it lists. Present in the sweep
 *      but not the hooks is the defect: the gate looks wired and nothing
 *      blocks on it.
 *   2. Every `gate:*` named by the Makefile, a workflow or a composite exists
 *      in package.json. Catches a rename or a typo before it is a red push.
 *   3. Each hook file in .githooks/ is one command, `make -s <target>`, and
 *      that target exists. A check written straight into a hook file is a
 *      second list, and a second list is how the first defect happened.
 *
 * There is deliberately no exemption list. A gate too slow for either hook is
 * a real thing, and when one exists the right answer is a conversation about
 * what it is for — not a quiet line in an array here, which is how an
 * allow-list starts every time.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// HIFTH_GATE_ROOT points this check at a made-up tree, so a test can feed it one
// thing it must refuse and one it must pass (scripts/gate-fixture.mjs). Unset,
// it is the repository, as it always was.
const ROOT = process.env.HIFTH_GATE_ROOT
  ? process.env.HIFTH_GATE_ROOT.replace(/\/?$/, "/")
  : new URL("..", import.meta.url).pathname;
const WORKFLOWS = join(ROOT, ".github", "workflows");
const HOOKS = join(ROOT, ".githooks");
const HOOK_TARGETS = ["pre-commit", "pre-push"];

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

/**
 * The gates a package.json composite runs, following `pnpm gates:fast`-style
 * references into the composites they name. `gates` is `gates:fast` plus the
 * three slow ones, so without the expansion it would look like it ran three.
 */
function expand(script, seen = new Set()) {
  if (seen.has(script)) return new Set();
  seen.add(script);
  const out = new Set();
  const body = pkg.scripts[script] ?? "";
  for (const [, ref] of body.matchAll(/pnpm\s+(gates(?::[a-z0-9-]+)?)(?=\s|$)/g)) {
    for (const g of expand(ref, seen)) out.add(g);
  }
  for (const g of body.match(NAME) ?? []) out.add(g);
  return out;
}
const composites = Object.keys(pkg.scripts).filter((s) => s === "gates" || s.startsWith("gates:"));
const composite = expand("gates");

/**
 * The Makefile, as targets: name → { prerequisites, recipe }.
 *
 * Recipe lines are tab-indented, so a target's block ends at the first line
 * that starts in column zero. Comment lines (`#` and `@#`) are dropped — the
 * Makefile's *prose* must not count: `make audit-edges` has a comment
 * mentioning gate:edges, and a gate satisfied by a comment is this file's
 * whole subject.
 */
const makefile = readFileSync(join(ROOT, "Makefile"), "utf8");
const targets = new Map();
for (const m of makefile.matchAll(/^([a-zA-Z0-9_-]+):(?!=)([^#\n]*)(?:##.*)?\n((?:\t.*\n|[ ]+.*\n|\n)*)/gm)) {
  const recipe = m[3]
    .split("\n")
    .filter((line) => !line.trim().startsWith("@#") && !line.trim().startsWith("#"))
    .join("\n");
  targets.set(m[1], { prereqs: m[2].trim().split(/\s+/).filter(Boolean), recipe });
}

/** Every gate a target reaches: its recipe, its prerequisites, `$(MAKE) x`, `pnpm gates:*`. */
function reach(target, seen = new Set()) {
  const out = new Set();
  if (seen.has(target) || !targets.has(target)) return out;
  seen.add(target);
  const { prereqs, recipe } = targets.get(target);
  const next = [...prereqs, ...[...recipe.matchAll(/\$\(MAKE\)\s+(?:-s\s+)?([a-zA-Z0-9_-]+)/g)].map((m) => m[1])];
  for (const t of next) for (const g of reach(t, seen)) out.add(g);
  for (const g of recipe.match(NAME) ?? []) out.add(g);
  for (const [, ref] of recipe.matchAll(/\$\(PNPM\)\s+(gates(?::[a-z0-9-]+)?)(?=\s|$)/gm)) {
    for (const g of expand(ref)) out.add(g);
  }
  return out;
}

const problems = [];

for (const t of HOOK_TARGETS) {
  if (!targets.has(t)) problems.push(`the Makefile has no \`${t}:\` target, and the ${t} hook runs it`);
}
const hooked = new Set(HOOK_TARGETS.flatMap((t) => [...reach(t)]));

/** Everything any Makefile recipe names, for the typo direction. */
const make = new Set([...targets.values()].flatMap(({ recipe }) => recipe.match(NAME) ?? []));

/**
 * What the workflows name. Only `run:` lines count, never comments. No gate
 * has to be here any more; this is only the typo direction.
 */
const workflow = new Set();
if (existsSync(WORKFLOWS)) {
  for (const name of readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f))) {
    const text = readFileSync(join(WORKFLOWS, name), "utf8");
    for (const [, gate] of text.matchAll(/run:\s*pnpm\s+(gate:[a-z0-9-]+)/g)) workflow.add(gate);
  }
}

/** Each hook is `make -s <target>` and nothing else. */
for (const t of HOOK_TARGETS) {
  const file = join(HOOKS, t);
  if (!existsSync(file)) {
    problems.push(`.githooks/${t} is missing, so \`make ${t}\` never runs on its own`);
    continue;
  }
  const lines = readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  const want = new RegExp(`^(exec\\s+)?make\\s+-s\\s+${t}$`);
  if (lines.length !== 1 || !want.test(lines[0])) {
    problems.push(
      `.githooks/${t} must be the one command \`make -s ${t}\` (found ${lines.length} command line(s)). ` +
        `Move the check into the \`${t}\` Makefile target.`,
    );
  }
}

for (const gate of owned) {
  const missing = [];
  if (!composite.has(gate)) missing.push("`pnpm gates`");
  if (!hooked.has(gate)) missing.push("`make pre-commit` or `make pre-push`");
  if (missing.length > 0) {
    problems.push(
      `${gate} is declared in package.json but not invoked by ${missing.join(", ")}. ` +
        "A gate that nothing invokes is a script.",
    );
  }
  // A check with no test can stop refusing anything and nobody would know.
  const script = /node\s+(scripts\/gate-[a-z0-9-]+)\.mjs/.exec(pkg.scripts[gate]);
  if (script && !existsSync(join(ROOT, `${script[1]}.test.mjs`))) {
    problems.push(
      `${gate} has no test: ${script[1]}.test.mjs is missing, so if it broke and passed everything nothing would say so.`,
    );
  }
}

const allComposites = new Set(composites.flatMap((c) => [...expand(c)]));
for (const gate of [...make, ...workflow, ...allComposites]) {
  if (!owned.includes(gate)) {
    problems.push(
      `${gate} is invoked by the Makefile, a workflow or a \`pnpm gates\` composite, but package.json declares no such script — a rename or a typo.`,
    );
  }
}

if (problems.length > 0) {
  console.error("gate:gates — FAIL:");
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}
console.log(`gate:gates — OK (${owned.length} gates, each in pnpm gates and reached by the pre-commit or pre-push hook)`);
