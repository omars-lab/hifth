#!/usr/bin/env node
/**
 * CI gate: no asset SVG page may contain a <text> element.
 *
 * Rationale (research §2): an SVG with <text> under `content-visibility: auto`
 * can fail to paint in Safari. Our virtualization strategy depends on
 * content-visibility, so outlined <path> glyphs are a hard requirement. The
 * quran-svg corpus uses outlined paths; this gate keeps it that way.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ASSETS = join(ROOT, "apps", "web", "public", "assets", "pages");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".svg")) out.push(p);
  }
  return out;
}

const files = walk(ASSETS);
if (files.length === 0) {
  console.error("gate:notext — no SVG pages found under", ASSETS);
  process.exit(1);
}

const offenders = files.filter((f) => /<text[\s>]/.test(readFileSync(f, "utf8")));
if (offenders.length > 0) {
  console.error("gate:notext — FAIL: <text> found in:");
  for (const f of offenders) console.error("  ", f.replace(ROOT, ""));
  process.exit(1);
}

console.log(`gate:notext — OK (${files.length} pages, all outlined paths)`);
