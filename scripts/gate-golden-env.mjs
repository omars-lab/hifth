#!/usr/bin/env node
/**
 * CI gate: the machine that renders the golden baselines is the machine that
 * checks them.
 *
 * A visual-regression gate compares a screenshot taken now against one taken
 * once, months ago, on some other computer. Everything about how those two
 * pixels were produced has to match — the browser build, the font set, the
 * rasterizer — or the comparison measures the difference between two machines
 * rather than a change to the app. There is no partial credit here: the gate is
 * either exact or it is noise wearing a threshold.
 *
 * The first CI run of the e2e tier proved it. Baselines rendered in the pinned
 * `mcr.microsoft.com/playwright` container, checked on a bare ubuntu-latest with
 * `playwright install --with-deps`: same Playwright version, all ten diffs
 * failed at 5–11% of pixels against a 0.5% tolerance, and the same commit passed
 * 10/10 back inside the container. `--with-deps` installs the browser's shared
 * libraries, not fonts; an Arabic app on a runner with no Arabic fonts lays out
 * every line at a different width.
 *
 * So CI's e2e job now runs in that container, and this gate keeps the three
 * facts that have to agree from drifting apart:
 *
 *   1. Makefile's GOLDEN_IMAGE — what `make golden-linux` renders baselines in.
 *   2. The `container.image` of ci.yml's e2e job — what checks them.
 *   3. The installed @playwright/test version — the tests' own runner.
 *
 * (3) is what makes this worth a gate rather than a comment. Bumping Playwright
 * is a one-line lockfile change that nobody would think to pair with a Docker
 * tag, and the failure it causes is not "the image is stale" — it is ten red
 * image diffs that look exactly like a UI regression and cost an afternoon
 * before anyone suspects the environment. Bumping any one of the three now fails
 * here, in a second, naming the other two.
 *
 * When it fails because you meant to upgrade: bump all three, then re-render the
 * linux baselines with `make golden-linux` and commit them. New browser, new
 * pixels — that is expected, and it is the only moment those files should
 * change without a UI change.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

/** `mcr.microsoft.com/playwright:v1.61.1-noble` → `1.61.1` */
const IMAGE = /mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)(?:-\w+)?/;

const problems = [];
const found = [];

// 1 — the generator.
const makefile = read("Makefile");
const makeLine = makefile.match(/^GOLDEN_IMAGE\s*:?=\s*(\S+)/m)?.[1];
if (!makeLine) {
  problems.push("Makefile no longer defines GOLDEN_IMAGE — `make golden-linux` has lost its pin");
} else {
  const v = makeLine.match(IMAGE)?.[1];
  if (!v) problems.push(`Makefile GOLDEN_IMAGE is "${makeLine}", which is not a pinned mcr.microsoft.com/playwright:v<x.y.z> tag`);
  else found.push({ what: "Makefile GOLDEN_IMAGE", version: v });
}

// 2 — the checker. Scoped to the e2e job so an unrelated container elsewhere in
// the workflow cannot satisfy this by accident.
const ci = read(".github/workflows/ci.yml");
// Up to the next top-level job key, or the end of the file if e2e is last.
const e2eJob = ci.match(/^ {2}e2e:\n([\s\S]*?)(?=^ {2}\S|(?![\s\S]))/m)?.[1];
if (!e2eJob) {
  problems.push(".github/workflows/ci.yml has no `e2e:` job — the golden baselines are checked by nothing");
} else {
  const image = e2eJob.match(/^\s*image:\s*(\S+)/m)?.[1];
  if (!image) {
    problems.push(
      "ci.yml's e2e job declares no `container.image`. It runs on a bare runner with no Arabic fonts, " +
        "which is what made all ten golden diffs fail at 5–11% of pixels the first time this tier ran in CI.",
    );
  } else {
    const v = image.match(IMAGE)?.[1];
    if (!v) problems.push(`ci.yml e2e container.image is "${image}", which is not a pinned mcr.microsoft.com/playwright:v<x.y.z> tag`);
    else found.push({ what: "ci.yml e2e container.image", version: v });
  }
}

// 3 — the runner. The installed version, not package.json's range: `^1.49.1`
// resolves to whatever the lockfile pinned, and it is the resolved build that
// rasterized the committed baselines.
const installed = "apps/web/node_modules/@playwright/test/package.json";
if (!existsSync(join(ROOT, installed))) {
  problems.push(`${installed} is missing — run \`pnpm install\` before this gate`);
} else {
  found.push({ what: "@playwright/test (installed)", version: JSON.parse(read(installed)).version });
}

const versions = [...new Set(found.map((f) => f.version))];
if (problems.length === 0 && versions.length > 1) {
  problems.push(
    "Playwright versions disagree, so the golden baselines are rendered and checked by different builds:\n" +
      found.map((f) => `      ${f.version}  ← ${f.what}`).join("\n") +
      "\n    Bring all three to the same version, then re-render with `make golden-linux` and commit the new baselines.",
  );
}

if (problems.length > 0) {
  console.error("gate:golden-env — FAIL:");
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}
console.log(`gate:golden-env — OK (Playwright ${versions[0]}: baselines rendered and checked by the same image)`);
