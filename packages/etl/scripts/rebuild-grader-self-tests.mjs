#!/usr/bin/env node
/**
 * Re-record the known verdicts the graders check themselves against.
 *
 * Every scorer and settler re-scores a tiny committed fixture before it runs,
 * and stops if the verdict is not the one on record (`lib/self-test.mjs`). When
 * a change to a grader is *meant* to change what it prints — a new line, a
 * renamed heading, a corrected floor — this is how the record catches up: it
 * runs each grader on its fixture exactly as the self-test would, and writes
 * what came out over `expected.txt` (and `expected.json` for the settler), and
 * the exit code into `case.json`.
 *
 * It never touches the fixture's *inputs* — the invented sitting, its answers,
 * the displacements — only the recorded output. A reviewer reads the diff of
 * the record to see what the change did to the verdict, which is the point.
 *
 * Usage:
 *   node packages/etl/scripts/rebuild-grader-self-tests.mjs            all five
 *   node packages/etl/scripts/rebuild-grader-self-tests.mjs settle     one
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GRADERS, SCRIPTS, fixtureDir, runCase } from "./lib/self-test.mjs";

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(GRADERS);
for (const name of names) {
  if (!GRADERS[name]) {
    console.error(`no grader called ${name}; one of ${Object.keys(GRADERS).join(", ")}`);
    process.exit(2);
  }
  const dir = fixtureDir(name);
  const casePath = join(dir, "case.json");
  const c = JSON.parse(readFileSync(casePath, "utf8"));
  const got = runCase(join(SCRIPTS, GRADERS[name]), dir, c);
  if (got.code !== 0 && !got.stdout) {
    console.error(`${name}: the grader printed nothing and exited ${got.code} — that is a failure, not a verdict:\n${got.stderr}`);
    process.exit(1);
  }
  const before = c.code;
  c.code = got.code;
  writeFileSync(casePath, `${JSON.stringify(c, null, 2)}\n`);
  writeFileSync(join(dir, c.stdout), got.stdout);
  if (c.writes) writeFileSync(join(dir, c.writes), `${JSON.stringify(got.written, null, 1)}\n`);
  console.log(
    `${name}: recorded exit ${got.code}${before !== got.code ? ` (was ${before})` : ""}, ` +
      `${got.stdout.split("\n").length - 1} lines${c.writes ? `, and the written ruling` : ""} → ${dir.replace(`${SCRIPTS}/`, "")}`,
  );
}
