#!/usr/bin/env node
/**
 * The pitch demo walked in the real iPad or iPhone app, on its side or upright, in one go
 * (make pitch-walk).
 *
 *   node .claude/skills/walk-app/scripts/pitch-walk.mjs [--step 3,4] [--no-build] [--ipad name] [--upright]
 *
 * --step      only these steps of the pitch script, by number (default: all
 *             that a made-up tap can do; 2 and 14 are walked by hand)
 * --no-build  walk the bundle already in the app, without building the
 *             private pitch bundle first
 * --ipad      the simulator, default the one make app-probe picks; an iPhone's
 *             name ("iPhone 17") walks the phone
 * --upright   hold it upright instead of on its side (no UI test is needed then)
 *
 * The app is started once, turned on its side, and handed the list of steps;
 * it opens each step's link fresh, asks that step's questions, keeps a
 * picture and the answer beside the list, and quits when the last is done.
 * Then this prints one line per step and how many pass.
 *
 * The pictures show the book's text, so they stay in native/shots, which git
 * never sees. The answers are counts, boxes and yes or no, never a word of
 * the note or the verse.
 */
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STEPS, stepEval, stepId } from "./pitch-walk-steps.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "Z");
const dir = join(root, "native/shots", `pitch-walk-${stamp}`);
mkdirSync(dir, { recursive: true });
const logPath = join(dir, "run.log");
const log = (ev, fields = {}) => {
  const kv = Object.entries(fields).map(([k, v]) => `${k}=${/\s/.test(String(v)) ? JSON.stringify(String(v)) : v}`);
  appendFileSync(logPath, `${new Date().toISOString().replace(/\.\d+Z$/, "Z")} pid=${process.pid} ev=${ev}${kv.length ? " " + kv.join(" ") : ""}\n`);
};

const wanted = arg("step", "")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter(Boolean);
const steps = wanted.length ? STEPS.filter((s) => wanted.includes(s.n)) : STEPS;
const unknown = wanted.filter((n) => !STEPS.some((s) => s.n === n));
if (unknown.length) {
  console.error(`  ✗ no step ${unknown.join(", ")} to walk; these can be: ${STEPS.map((s) => s.n).join(", ")} (2 and 14 are walked by hand)`);
  process.exit(2);
}

const make = (args) =>
  new Promise((done) => {
    log("make_start", { target: args[0] });
    const child = spawn("make", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    const out = join(dir, `${args[0]}.out`);
    child.stdout.on("data", (d) => appendFileSync(out, d));
    child.stderr.on("data", (d) => appendFileSync(out, d));
    child.on("close", (code) => {
      log("make_done", { target: args[0], code });
      done({ code, out });
    });
  });

log("walk_start", { steps: steps.length, dir });
console.log(`  Walking ${steps.length} pitch steps in the app; pictures and answers go to ${dir}`);

if (!flag("no-build")) {
  console.log("  Building the private pitch bundle into the app…");
  const built = await make(["app-web", "FLAVOUR=pitch"]);
  if (built.code !== 0) {
    console.error(`  ✗ the pitch bundle did not build; see ${built.out}`);
    process.exit(1);
  }
}
const flavour = join(root, "native/WebBundle/.hifth-web-flavour");
if (!existsSync(flavour) || readFileSync(flavour, "utf8").trim() !== "pitch") {
  console.error("  ✗ the app holds the public bundle, which has no notes to walk; run without --no-build");
  process.exit(1);
}

const list = steps.map((s) => ({ id: stepId(s.n), route: s.route, delayMs: 2500, eval: stepEval(s) }));
const listPath = join(dir, "steps.json");
writeFileSync(listPath, JSON.stringify(list, null, 2));

const upright = flag("upright");
console.log(upright ? "  Starting the app upright…" : "  Starting the app on its side (a restart of the simulator first, about a minute)…");
const probe = [
  "app-probe",
  "TARGET=ipad",
  ...(upright ? [] : ["SIDEWAYS=1"]),
  "LOCALE=en",
  `ROUTE=${steps[0].route}`,
  `STEPS=${listPath}`,
  `PROBE_OUT=${join(dir, "done.json")}`,
  `PROBE_TIMEOUT_S=${Math.max(300, steps.length * 90)}`,
];
const ipad = arg("ipad", "");
if (ipad) probe.push(`IPAD=${ipad}`);
const walked = await make(probe);

let passed = 0;
console.log("");
for (const s of steps) {
  const id = stepId(s.n);
  const file = join(dir, `${id}.json`);
  let answer = null;
  try {
    answer = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    // no answer kept: the walk stopped before this step
  }
  const checks = answer?.eval?.checks;
  const why = !answer ? "no answer: the walk stopped before it" : answer.error ? answer.error : !Array.isArray(checks) ? `the page answered ${JSON.stringify(answer.eval)}` : "";
  const failed = Array.isArray(checks) ? checks.filter((c) => !c.ok) : [];
  const ok = !why && failed.length === 0 && checks.length > 0;
  if (ok) passed += 1;
  log("step_result", { id, ok: ok ? "yes" : "no", checks: checks?.length ?? 0, failed: failed.length });
  console.log(`  ${ok ? "✓" : "✗"} ${String(s.n).padStart(2)}. ${s.title}`);
  if (why) console.log(`        ${why}`);
  for (const c of failed) console.log(`        ✗ ${c.what}${c.got === null ? "" : ` (got ${JSON.stringify(c.got)})`}`);
  // A count reported for a person to judge, not a pass or a fail.
  for (const c of checks ?? []) if (c.ok && /counted, not judged/.test(c.what)) console.log(`        · ${c.what}: ${JSON.stringify(c.got)}`);
}

console.log("");
console.log(`  ${passed} of ${steps.length} steps pass in the app (2 and 14 are walked by hand).`);
console.log(`  Pictures: ${dir} (they show the book's text: look, never commit)`);
if (walked.code !== 0) console.log(`  The app's walk ended badly; its output is ${walked.out}, its log ${join(dir, "walk.log")}`);
log("walk_done", { passed, steps: steps.length, make: walked.code });
process.exit(passed === steps.length && walked.code === 0 ? 0 : 1);
