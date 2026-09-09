#!/usr/bin/env node
/**
 * CI gate: the built public bundle carries no held Qur'an letters and no road
 * into the development-only store overlay.
 *
 * WHAT THIS PROTECTS. The app ships zero Qur'an text — a standing rule kept by
 * the shipped bytes, not only by policy — and the outside library's page is a
 * held copy that lives only in gitignored files, drawn in a per-page font served
 * by a dev-server-only route. The overlay that draws it is reached through one
 * branch guarded by a build-time constant (`import.meta.env.VITE_QUL_OVERLAY`),
 * so every normal build compiles it to `if (undefined)` and the bundler drops
 * the module whole. `gate:notext` proves the *source* assets carry no <text>;
 * this gate proves the *built* bundle carries neither the store's letters nor
 * the loader that would fetch them — the thing a person cannot see by reading
 * the diff, because it is a fact about what the build emitted.
 *
 * WHY THESE TWO SIGNALS, AND NOT "NO ARABIC". The bundle legitimately carries
 * Arabic: the app's own interface has an Arabic locale — licence notices, the
 * printing's name, provenance lines — and a gate that failed on any Arabic
 * letter would fail on that and be switched off inside a week. So the gate does
 * not look for Arabic. It looks for the two things that can only be the store:
 *
 *   1. The store's per-page font encodes each printed word as one private
 *      character — Arabic Presentation Forms (U+FB50–U+FEFF) and the Private
 *      Use Area (U+E000–U+F8FF). The interface's Arabic locale uses the normal
 *      Arabic block and none of these. A calibrated build measured zero of them
 *      in the shell; one is a leaked glyph.
 *   2. The loader's own words — the dev-fixture route, the overlay module, the
 *      dev font family, the build-time flag. All absent from a normal build,
 *      because the branch that names them is dropped. One present is a road in.
 *
 * SCOPE. The app shell the browser runs: the entry HTML, the service worker,
 * and the hashed JS and CSS under assets/. Not the source maps (debug copies of
 * the source, never executed, and they legitimately carry the flag's name); not
 * the staged pages under docs/ (checked-in design pages, their own subject, kept
 * by the decision gate); not the geometry and image data the app draws from,
 * which is numbers and outlined paths.
 *
 * Run: `pnpm gate:bundle-notext`. Runs after `pnpm build`, beside gate:budget.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "apps", "web", "dist");
const DOCS = join(DIST, "docs");

if (!existsSync(DIST)) {
  console.error("gate:bundle-notext — dist/ not found; run `pnpm --filter @hifth/web build` first");
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

// The app shell the browser runs. Not .map (debug source copies), not docs/
// (checked-in design pages), not the data/image assets the app draws from.
const shell = walk(DIST).filter(
  (f) => /\.(html|js|css)$/.test(f) && !f.endsWith(".map") && !f.startsWith(DOCS + "/"),
);

// The store's font encodes every printed word here; the interface's Arabic
// locale never reaches these blocks.
const HELD_LETTERS = /[ﭐ-﷿ﹰ-﻿-]/g;
// The overlay loader's own fingerprints — the route, the module, the dev font,
// the build-time flag. A normal build drops the branch that names them.
const LOADER_WORDS = [/dev-fixtures/, /qul-diff/, /qul-overlay/, /mountQulOverlay/, /Hifth QUL Dev/, /VITE_QUL_OVERLAY/];

const rel = (f) => relative(ROOT, f);
const glyphOffenders = [];
const wordOffenders = [];
const pathOffenders = [];

for (const f of shell) {
  const r = rel(f);
  if (/dev-fixtures|qul-diff/.test(r)) pathOffenders.push(r);
  const s = readFileSync(f, "utf8");
  const held = s.match(HELD_LETTERS);
  if (held) glyphOffenders.push([r, held.length, [...new Set(held)].slice(0, 8).join(" ")]);
  for (const w of LOADER_WORDS) {
    if (w.test(s)) wordOffenders.push([r, w.source]);
  }
}

if (glyphOffenders.length || wordOffenders.length || pathOffenders.length) {
  console.error("gate:bundle-notext — FAIL: the public bundle carries the store");
  for (const [r, n, sample] of glyphOffenders) {
    console.error(`  held letters — ${r}: ${n} presentation-form/private-use code point(s), e.g. ${sample}`);
  }
  for (const [r, w] of wordOffenders) {
    console.error(`  store loader — ${r}: contains /${w}/`);
  }
  for (const r of pathOffenders) {
    console.error(`  dev path shipped — ${r}`);
  }
  console.error(
    "\n  The overlay is meant to compile out of every public build (make dev-qul is the one road in).",
  );
  console.error("  If this is a real leak, the guard in main.tsx or the dev-only vite route regressed.");
  process.exit(1);
}

console.log(
  `gate:bundle-notext — OK (${shell.length} shell file(s): no held letters, no store loader, no dev-fixture path)`,
);
