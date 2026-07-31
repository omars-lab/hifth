#!/usr/bin/env node
/**
 * Compile the ICU catalogs to TypeScript.  `pnpm i18n:build`
 *
 * The generated `apps/web/src/messages/*.gen.ts` are **committed on purpose**:
 * `tsc` has to see them (they are the completeness guarantee — messages-compile.mjs
 * says how), and so does code review, because a reviewer who cannot see the
 * emitted code cannot tell a wording change from a compiler change.
 *
 * `gate:i18n` re-runs this into memory and fails on any difference, so a catalog
 * edited without running this does not reach main.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { relative } from "node:path";
import { compileAll, ROOT } from "./messages-compile.mjs";

const { files, problems } = compileAll();

if (problems.length > 0) {
  console.error("i18n:build — FAIL:");
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}

let changed = 0;
for (const [path, contents] of files) {
  const before = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (before === contents) continue;
  writeFileSync(path, contents);
  changed += 1;
  console.log(`  wrote ${relative(ROOT, path)}`);
}
console.log(`i18n:build — ${files.size} file(s), ${changed} changed`);
