#!/usr/bin/env node
/**
 * CI gate: JS bundle budget. The web app's total gzipped JS must stay under
 * 150 KB (PLAN §6 / delivery-plan hard budget). Runs after `pnpm build`.
 *
 * The budget alone was not enough, and backlog ⑤ named why: **it notices at the
 * cliff rather than on the slope.** At 108 KB against 150 there are forty
 * kilobytes of headroom, and nothing distinguishes a PR that spends nine of them
 * from a PR that spends none — both print "OK". Loop 6b's pack manager and Loop
 * 7's polish both land in the bundle, and the first time anyone would have been
 * told is the commit that runs out.
 *
 * So the gate carries a **baseline**: `scripts/budget-baseline.json`, committed,
 * holding what each chunk weighed last time someone looked. Every run prints the
 * delta, and a move of more than a kilobyte in **either direction** fails until
 * the baseline is updated and committed. That is the whole mechanism, and it is
 * chosen for where the number ends up: a reviewer reading a diff sees
 *
 *     -  "assets/index.js": 100249,
 *     +  "assets/index.js": 109461,
 *
 * which is "this PR adds 9 KB" in the one place a human is already looking. A
 * printed line in a CI log is not that. It is the same trade the golden images
 * already make — an accepted baseline is the gate agreeing with you, which is
 * worth nothing unless you looked.
 *
 * **Why a committed baseline and not a build of `main`.** Diffing against the
 * merge base is the obvious alternative and it was rejected: it doubles the build
 * in CI, it cannot run at all on a machine that is offline or on a detached
 * checkout, and — decisively — it puts the number nowhere a person reads. The
 * committed file costs one `make budget-update` on the PRs that move bytes, and
 * in exchange the history of this bundle's weight is `git log -p` on one file.
 *
 * **Why a tolerance rather than an exact match.** The chunk *hash* is not stable
 * even where the bytes are: three builds of this app's app chunk — one in CI, two
 * here — produced `index-CywQJkCX.js`, `index-C_PRj0XG.js` and `index-M-HaqE5a.js`,
 * all 97.9 KB gz. Which is why the baseline is keyed on the name with the hash
 * removed, and why the *size* is compared with room in it. A kilobyte is under 1%
 * of the bundle, comfortably above any compression noise, and small enough that
 * nothing anyone would call a feature slips under it. It absorbs drift; it does
 * not absorb a change.
 *
 * Run: `pnpm gate:budget`. Accept a new baseline with `make budget-update`.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "apps", "web", "dist");
const BASELINE = join(ROOT, "scripts", "budget-baseline.json");
const BUDGET_GZ = 150 * 1024;

/** How far the total may drift before someone has to look. See the docblock. */
const TOLERANCE_GZ = 1024;

const UPDATE = process.argv.includes("--update");

if (!existsSync(DIST)) {
  console.error("gate:budget — dist/ not found; run `pnpm --filter @hifth/web build` first");
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/**
 * Vite hashes the content into the filename, so `assets/index-C_PRj0XG.js` names
 * a different file on every build of a changed chunk. The baseline is keyed by
 * the name with that hash removed — otherwise every entry would be "new" and the
 * delta would be unreadable exactly when it matters most.
 */
const stable = (name) => name.replace(/-[A-Za-z0-9_-]{8}(?=\.js$)/, "");

// Count all shipped .js (app + workbox + SW). Exclude sourcemaps.
const jsFiles = walk(DIST).filter((f) => f.endsWith(".js") && !f.endsWith(".map"));
let totalGz = 0;
const rows = [];
const measured = {};
for (const f of jsFiles) {
  const gz = gzipSync(readFileSync(f)).length;
  const name = f.replace(DIST + "/", "");
  totalGz += gz;
  rows.push([name, gz]);
  measured[stable(name)] = gz;
}
rows.sort((a, b) => b[1] - a[1]);

const kb = (b) => (b / 1024).toFixed(1);
const signed = (b) => `${b >= 0 ? "+" : "−"}${kb(Math.abs(b))}`;

if (UPDATE) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        $comment: [
          "What the shipped JS weighed, gzipped, the last time someone accepted it.",
          "gate:budget fails when the total moves more than 1 KB in either direction,",
          "so this file's diff is where a PR's effect on bundle size is read.",
          "Keys have vite's content hash stripped; see `stable` in gate-budget.mjs.",
          "Regenerate with `make budget-update` — and look at the diff before committing.",
        ],
        totalGz,
        chunks: Object.fromEntries(Object.entries(measured).sort(([a], [b]) => a.localeCompare(b))),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`gate:budget — baseline rewritten: ${kb(totalGz)} KB gz across ${rows.length} files`);
  console.log("  Review `git diff -- scripts/budget-baseline.json` before committing.");
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(
    "gate:budget — FAIL: no baseline at scripts/budget-baseline.json.\n" +
      "  The gate compares this build against what was last accepted; without the file it\n" +
      "  can only tell you whether you have hit the cliff. Run `make budget-update`.",
  );
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
const was = baseline.chunks ?? {};

for (const [name, gz] of rows) {
  const before = was[stable(name)];
  const note = before === undefined ? "new" : signed(gz - before);
  console.log(`  ${kb(gz).padStart(6)} KB gz  ${note.padStart(7)}  ${name}`);
}
for (const name of Object.keys(was)) {
  if (!(name in measured)) console.log(`  ${"—".padStart(6)} KB gz  ${"gone".padStart(7)}  ${name}`);
}

const budgetKb = (BUDGET_GZ / 1024).toFixed(0);
if (totalGz > BUDGET_GZ) {
  console.error(`gate:budget — FAIL: ${kb(totalGz)} KB gz > ${budgetKb} KB budget`);
  process.exit(1);
}

const drift = totalGz - baseline.totalGz;
if (Math.abs(drift) > TOLERANCE_GZ) {
  console.error(
    `gate:budget — FAIL: the bundle moved ${signed(drift)} KB ` +
      `(${kb(baseline.totalGz)} → ${kb(totalGz)} KB gz), more than the ` +
      `${kb(TOLERANCE_GZ)} KB the baseline absorbs quietly.\n` +
      `  This is not the budget — there are still ${kb(BUDGET_GZ - totalGz)} KB of headroom.\n` +
      "  It is the slope rather than the cliff, which is the whole reason the baseline\n" +
      "  exists. If the move is intended, run `make budget-update` and commit\n" +
      "  scripts/budget-baseline.json so the number lands in the diff a reviewer reads.\n" +
      "  A shrink fails too, on purpose: unrecorded headroom is headroom the next change\n" +
      "  spends without anyone seeing it go.",
  );
  process.exit(1);
}

console.log(
  `gate:budget — OK (${kb(totalGz)} KB gz / ${budgetKb} KB budget, ` +
    `${signed(drift)} KB against the baseline)`,
);
