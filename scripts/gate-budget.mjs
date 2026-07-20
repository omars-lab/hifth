#!/usr/bin/env node
/**
 * CI gate: JS bundle budget. The web app's total gzipped JS must stay under
 * 150 KB (PLAN §6 / delivery-plan hard budget). Runs after `pnpm build`.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "apps", "web", "dist");
const BUDGET_GZ = 150 * 1024;

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

// Count all shipped .js (app + workbox + SW). Exclude sourcemaps.
const jsFiles = walk(DIST).filter((f) => f.endsWith(".js") && !f.endsWith(".map"));
let totalGz = 0;
const rows = [];
for (const f of jsFiles) {
  const gz = gzipSync(readFileSync(f)).length;
  totalGz += gz;
  rows.push([f.replace(DIST + "/", ""), gz]);
}

rows.sort((a, b) => b[1] - a[1]);
for (const [name, gz] of rows) {
  console.log(`  ${(gz / 1024).toFixed(1).padStart(6)} KB gz  ${name}`);
}
const kb = (totalGz / 1024).toFixed(1);
const budgetKb = (BUDGET_GZ / 1024).toFixed(0);
if (totalGz > BUDGET_GZ) {
  console.error(`gate:budget — FAIL: ${kb} KB gz > ${budgetKb} KB budget`);
  process.exit(1);
}
console.log(`gate:budget — OK (${kb} KB gz / ${budgetKb} KB budget)`);
