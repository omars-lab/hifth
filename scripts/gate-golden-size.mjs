#!/usr/bin/env node
/**
 * CI gate: the committed golden baselines stay small enough to stay committed.
 *
 * The recurring question is "shouldn't these be Git LFS?", and the answer today
 * is a clear no — for reasons that are about this repo specifically, not about
 * binaries in general. Writing them down once, here, next to the number that
 * would change the answer:
 *
 *   - CI could not check them. The e2e job runs inside
 *     mcr.microsoft.com/playwright:v1.61.1-noble, which ships git 2.43 and no
 *     git-lfs. An LFS checkout there leaves ~130-byte pointer files on disk, and
 *     every golden diff would compare a mushaf page against a line of text. The
 *     image is pinned by gate:golden-env precisely so it cannot drift, so this
 *     is not a one-line fix.
 *   - It would put the GPL offer behind a quota. This repo is the corresponding
 *     source for a GPL work (SOURCES.md, Colophon). LFS bandwidth on GitHub is
 *     metered; when the quota is out, `git clone` hands the recipient pointer
 *     files instead of the work. A licence obligation that silently degrades on
 *     the 1st of a month is not one we control.
 *   - The economics do not apply. LFS pays for itself when large files CHURN;
 *     it does not compress anything, it moves bytes off the clone path and each
 *     revision still costs full size. These baselines change only when highlight
 *     geometry legitimately changes, which the Makefile already treats as a
 *     reviewed event — two commits have touched them in the repo's life.
 *
 * So: keep them in git, and put a number on the assumption instead of trusting
 * that it stays true. Every full refresh of the set costs its whole size in
 * permanent history, forever, because PNGs do not delta-compress. At the budget
 * below, twenty refreshes is a few hundred MB — the point where clone time
 * starts to be felt and LFS (or dropping a platform, see below) becomes a real
 * conversation rather than a reflex. This gate is what makes that conversation
 * happen on the commit that crosses the line instead of two years later.
 *
 * The cheapest lever if it ever trips: the darwin set is checked by no CI job.
 * It exists so `make golden` gives a local signal without Docker. Dropping it
 * halves the footprint and the refresh burden at the cost of making
 * `make golden-linux` the only way to run the visual gate.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SHOTS = join(ROOT, "apps", "web", "e2e", "__screenshots__");

/** Bytes. Generous against today's ~3.5 MB; see the docblock for what it buys. */
const BUDGET = 12 * 1024 * 1024;

const byPlatform = new Map();
let total = 0;
let count = 0;

for (const platform of readdirSync(SHOTS, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const dir = join(SHOTS, platform.name);
  const files = readdirSync(dir).filter((f) => f.endsWith(".png"));
  const bytes = files.reduce((sum, f) => sum + statSync(join(dir, f)).size, 0);
  byPlatform.set(platform.name, { files: files.length, bytes });
  total += bytes;
  count += files.length;
}

const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;

for (const [platform, { files, bytes }] of byPlatform) {
  console.log(`  ${mb(bytes).padStart(8)}  ${String(files).padStart(3)} shots  ${platform}`);
}

if (count === 0) {
  console.error("gate:golden-size — FAIL: no baselines found; the visual gate compares against nothing");
  process.exit(1);
}

if (total > BUDGET) {
  console.error(
    `gate:golden-size — FAIL: ${mb(total)} of baselines over a ${mb(BUDGET)} budget.\n` +
      "  Every refresh of this set costs its full size in permanent history — PNGs do not\n" +
      "  delta-compress. Before raising the number, read the docblock in this file: the\n" +
      "  cheap fix is dropping the darwin set (checked by no CI job), and the expensive\n" +
      "  one is Git LFS, which the pinned Playwright container cannot read and which puts\n" +
      "  the GPL source offer behind a bandwidth quota.",
  );
  process.exit(1);
}

console.log(`gate:golden-size — OK (${mb(total)} / ${mb(BUDGET)} budget, ${count} baselines)`);
