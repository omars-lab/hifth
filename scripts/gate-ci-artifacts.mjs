#!/usr/bin/env node
/**
 * CI gate: every artifact CI uploads is one this repo actually produces.
 *
 * This exists because of a defect that survived several loops in plain sight.
 * The e2e job uploaded `apps/web/playwright-report` on failure, while the
 * Playwright reporter was `line` in CI — a reporter that writes no report. The
 * step was green every time, because uploading nothing is not an error by
 * default, so on every red run the traces and image diffs were discarded and the
 * workflow looked like it had preserved them.
 *
 * An upload step is a promise about a future failure, and a promise nobody
 * exercises until the bad day is exactly the kind that rots. Two invariants:
 *
 *   1. Each uploaded path is claimed by a producer below, and that producer's
 *      proof still holds in the tree. Delete the html reporter and this fails,
 *      naming the upload step that just became a ghost.
 *   2. Each upload sets `if-no-files-found: error`. This is the backstop that
 *      catches the same class at runtime: without it, an upload of nothing is
 *      indistinguishable from an upload that worked, for as long as nobody
 *      needs it.
 *   3. An upload of a dot-path also sets `include-hidden-files: true`.
 *      upload-artifact has excluded hidden files by default since v4, so
 *      `path: .lighthouseci` matches nothing at all. This is invariant 1's
 *      failure — an upload that preserves nothing — reached from the other end:
 *      the producer exists and runs, and the artifact is dropped anyway. The
 *      registry could not see it, because the question is not "who writes this"
 *      but "can the uploader read it". Invariant 2 turned it from a silent loss
 *      into a red job; this turns it into a red gate, before the push.
 *
 * Adding an upload step to CI means adding its producer here. That is the
 * point — the registry is the list of things we claim to keep.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const WORKFLOWS = join(ROOT, ".github", "workflows");

/**
 * What writes each uploaded path, and how to tell it still does.
 *
 * `proof` is deliberately a grep and not an import: the Playwright config is TS
 * with side effects, and a gate that has to build the app to check a one-line
 * invariant is a gate that gets skipped.
 */
const PRODUCERS = [
  {
    path: "apps/web/playwright-report",
    producer: "the Playwright html reporter",
    proof: {
      file: "apps/web/playwright.config.ts",
      pattern: /\[\s*"html"/,
      missing:
        'apps/web/playwright.config.ts no longer declares an ["html", …] reporter, ' +
        "so nothing writes apps/web/playwright-report and the upload preserves nothing",
    },
  },
  {
    path: ".lighthouseci",
    producer: "lhci autorun (@lhci/cli)",
    proof: {
      file: ".lighthouserc.json",
      pattern: /./,
      missing: ".lighthouserc.json is gone, so lhci writes no .lighthouseci directory",
    },
  },
];

const problems = [];
let uploads = 0;

for (const name of readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f))) {
  const file = join(WORKFLOWS, name);
  const text = readFileSync(file, "utf8");

  // Split on list items so each chunk is one step. Enough structure for this
  // one question, and it does not put a YAML parser in the dependency tree for
  // a repo that has deliberately stayed free of one.
  const steps = text.split(/^\s*-\s+/m);
  for (const step of steps) {
    if (!/uses:\s*actions\/upload-artifact/.test(step)) continue;
    uploads++;

    const label = (step.match(/^\s*name:\s*(.+)$/m)?.[1] ?? "unnamed step").trim();
    const where = `${name} › ${label}`;

    const path = step.match(/^\s*path:\s*(.+)$/m)?.[1]?.trim();
    if (!path) {
      // A block scalar (`path: |`) uploads several paths; this gate would read
      // it as none and pass. Fail loudly rather than quietly stop checking.
      problems.push(`${where}: no single-line "path:" found — teach this gate before using a multi-path upload`);
      continue;
    }

    const known = PRODUCERS.find((p) => p.path === path);
    if (!known) {
      problems.push(
        `${where}: uploads "${path}", which no producer in scripts/gate-ci-artifacts.mjs claims. ` +
          "Either nothing writes it (the bug this gate exists for) or the registry needs an entry.",
      );
    } else if (!existsSync(join(ROOT, known.proof.file))) {
      problems.push(`${where}: ${known.proof.missing}`);
    } else if (!known.proof.pattern.test(readFileSync(join(ROOT, known.proof.file), "utf8"))) {
      problems.push(`${where}: ${known.proof.missing}`);
    }

    const ifNone = step.match(/^\s*if-no-files-found:\s*(\S+)/m)?.[1];
    if (ifNone !== "error") {
      problems.push(
        `${where}: needs "if-no-files-found: error" (found ${ifNone ?? "nothing"}). ` +
          "An upload that silently uploads nothing looks exactly like one that works.",
      );
    }

    // Any path segment starting with a dot is hidden as far as the uploader's
    // globber is concerned — `.lighthouseci`, but equally `apps/web/.foo`.
    const hidden = path.split("/").some((segment) => segment.startsWith("."));
    const includesHidden = /^\s*include-hidden-files:\s*true\s*$/m.test(step);
    if (hidden && !includesHidden) {
      problems.push(
        `${where}: uploads the hidden path "${path}" without "include-hidden-files: true". ` +
          "upload-artifact skips dot-paths by default, so this step uploads nothing at all.",
      );
    }
  }
}

if (uploads === 0) {
  console.error("gate:ci-artifacts — FAIL: no upload-artifact steps found; CI keeps no evidence at all");
  process.exit(1);
}
if (problems.length > 0) {
  console.error("gate:ci-artifacts — FAIL:");
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}
console.log(`gate:ci-artifacts — OK (${uploads} upload step(s), each with a producer that still exists)`);
