#!/usr/bin/env node
/**
 * CI gate: every bundled asset edition must have a SOURCES.md entry.
 *
 * The gate walks apps/web/public/assets/pages/<edition>/ and asserts each
 * <edition> directory has a matching `### <edition>` heading in SOURCES.md.
 * Also asserts the manifest's `edition` is documented. Build fails otherwise
 * (PLAN §8 licensing gate).
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const PAGES = join(ROOT, "apps", "web", "public", "assets", "pages");
const MANIFEST = join(ROOT, "apps", "web", "public", "assets", "manifest.json");
const SOURCES = join(ROOT, "SOURCES.md");

if (!existsSync(SOURCES)) {
  console.error("gate:license — FAIL: SOURCES.md is missing");
  process.exit(1);
}
const sources = readFileSync(SOURCES, "utf8");
const documented = new Set(
  [...sources.matchAll(/^###\s+([A-Za-z0-9._-]+)\s*$/gm)].map((m) => m[1]),
);

const problems = [];

// 1) Every bundled edition directory must be documented.
const editions = existsSync(PAGES)
  ? readdirSync(PAGES).filter((n) => statSync(join(PAGES, n)).isDirectory())
  : [];
if (editions.length === 0) problems.push("no asset editions found under public/assets/pages");
for (const ed of editions) {
  if (!documented.has(ed)) problems.push(`edition "${ed}" has no "### ${ed}" entry in SOURCES.md`);
}

// 2) The manifest edition must be documented.
if (existsSync(MANIFEST)) {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  if (manifest.edition && !documented.has(manifest.edition)) {
    problems.push(`manifest edition "${manifest.edition}" is not documented in SOURCES.md`);
  }
}

if (problems.length > 0) {
  console.error("gate:license — FAIL:");
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}
console.log(
  `gate:license — OK (${editions.length} edition(s) documented: ${editions.join(", ")})`,
);
