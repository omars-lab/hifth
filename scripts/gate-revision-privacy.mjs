#!/usr/bin/env node
/**
 * CI gate: the revision record never leaves the device.
 *
 * Every other thing this app stores is a preference — a language, a skin, a
 * dismissed notice. The revision record is different in kind: it is a log of
 * when a particular person was reading Qur'an, at what time of night, and which
 * passages they kept going back to. That is a record of someone's worship, and
 * the promise attached to it is that it is theirs alone.
 *
 * A promise like that written in a doc comment is a promise until the first
 * refactor. The failure mode is not malice, it is convenience: a share sheet
 * that wants to include "last revised", a URL builder that takes a state object
 * and gets handed one field too many, an analytics call added to measure
 * engagement. Each is one import away, and none of them looks wrong in review.
 *
 * So the promise is a gate. Two invariants:
 *
 *   1. **Nothing that can reach the network may import the record.** The set of
 *      modules allowed to import `revision.ts` or `revision-store.ts` is listed
 *      below, explicitly. Adding an importer means adding it here, which is the
 *      point — it turns "should this see the record?" from something nobody asks
 *      into something the build asks on every push.
 *   2. **The record's own modules contain no way out.** No `fetch`, no beacon,
 *      no WebSocket, no URL or query-string construction. Even reachable only
 *      from allowed callers, a serialiser inside the store is a loaded gun.
 *
 * Deliberately NOT an ESLint rule. `import/no-restricted-paths` can say "this
 * directory may not import that one", which is the wrong shape: the rule here is
 * a closed allow-list of importers, and expressing it as a growing list of
 * forbidden directories means every new file that builds a URL is unguarded
 * until someone remembers to add it. A gate that is wrong by default is not a
 * gate.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

/** The modules that hold the record. */
const RECORD_MODULES = ["packages/core/src/revision.ts", "apps/web/src/revision-store.ts"];

/**
 * Who may import them, and why each one is allowed to.
 *
 * `App.tsx` is the only production importer, and only because it is where a tap
 * lands. When the picture arrives (task #91) `RevisionMap.tsx` joins it — a
 * component that reads the record and renders it, with no route and no link.
 */
const ALLOWED_IMPORTERS = new Map([
  ["apps/web/src/App.tsx", "where a deliberate tap becomes a recorded look"],
  ["apps/web/src/revision-store.ts", "the store is built on the pure module"],
  ["packages/core/src/index.ts", "the barrel that exports it"],
]);

/** Ways out of the device. Matched as plain substrings — a grep, not a parse. */
const ESCAPE_HATCHES = [
  "fetch(",
  "XMLHttpRequest",
  "sendBeacon",
  "WebSocket",
  "EventSource",
  "new URL(",
  "URLSearchParams",
  "location.href",
  "location.hash",
  "location.search",
  "serializeState",
];

/** Every source file that could plausibly import anything. Tests included. */
function sources() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|mts|mjs)$/.test(entry)) out.push(full);
    }
  };
  for (const root of ["packages", "apps", "scripts"]) walk(join(ROOT, root));
  return out;
}

const failures = [];

// ── Invariant 1: a closed allow-list of importers ────────────────────────────
//
// Matches the module by basename rather than by resolved path: `./revision.js`,
// `../revision-store.js` and `@hifth/core/revision.js` are the same reach, and a
// gate that only knew one spelling would be trivially side-stepped by another.
const IMPORTS_RECORD = /\bfrom\s+["'][^"']*\/(revision|revision-store)\.(js|ts)["']/;
const IMPORTS_BARREL_SYMBOL =
  /\bimport\s*\{[^}]*\b(rollUp|lastSeen|scopesOf|dayOf|daysBetween|editionOf|RevisionEvent|RevisionScope|DayStamp)\b[^}]*\}\s*from\s*["']@hifth\/core["']/s;

for (const file of sources()) {
  const rel = relative(ROOT, file);
  // A test proving the record stays put has to be able to see it.
  if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
  const text = readFileSync(file, "utf8");
  if (!IMPORTS_RECORD.test(text) && !IMPORTS_BARREL_SYMBOL.test(text)) continue;
  if (ALLOWED_IMPORTERS.has(rel)) continue;
  failures.push(
    `${rel} imports the revision record.\n` +
      `    The record is a log of when someone was reading Qur'an, and it does not\n` +
      `    leave the device. If this module genuinely needs it and cannot send it\n` +
      `    anywhere, add it to ALLOWED_IMPORTERS in this file with the reason.`,
  );
}

// ── Invariant 2: no way out inside the record's own modules ──────────────────
for (const rel of RECORD_MODULES) {
  const text = readFileSync(join(ROOT, rel), "utf8");
  // Strip block comments: this very file's prose names every hatch it forbids,
  // and so does the store's header. A gate that cannot survive being explained
  // is a gate that gets deleted.
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const hatch of ESCAPE_HATCHES) {
    if (code.includes(hatch)) {
      failures.push(
        `${rel} contains \`${hatch}\` — the record's own modules must hold no way ` +
          `off the device, even one only reachable from an allowed caller.`,
      );
    }
  }
}

// A gate whose allow-list points at deleted files silently guards nothing.
for (const [rel] of ALLOWED_IMPORTERS) {
  try {
    statSync(join(ROOT, rel));
  } catch {
    failures.push(`ALLOWED_IMPORTERS names ${rel}, which no longer exists — prune it.`);
  }
}

if (failures.length > 0) {
  console.error("gate:revision-privacy — FAILED\n");
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}

console.error(
  `gate:revision-privacy — OK (${RECORD_MODULES.length} record modules, ` +
    `${ALLOWED_IMPORTERS.size} permitted importers, ${ESCAPE_HATCHES.length} hatches checked)`,
);
