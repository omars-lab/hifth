#!/usr/bin/env node
/**
 * CI gate: the revision record never leaves the device, and neither does the
 * confusion-jump record, which is the same kind of thing (see RECORDS below).
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

// HIFTH_GATE_ROOT points the check at a made-up tree, so a test can feed it one
// thing it must refuse and one it must pass (scripts/gate-fixture.mjs).
const ROOT = process.env.HIFTH_GATE_ROOT
  ? process.env.HIFTH_GATE_ROOT.replace(/\/?$/, "/")
  : new URL("..", import.meta.url).pathname;

/**
 * The records this check guards, each with the modules that hold it and the
 * closed list of who may import them, and why each one is allowed to.
 *
 * The revision record: `App.tsx` is where a tap lands; `RevisionMap.tsx` is the
 * picture the record exists for — it reads the record and draws it, with no
 * route and no link, and it is the module a "share your progress" button would
 * be added to first.
 *
 * The confusion-jump record (docs/design/confusion-jumps.md) is the same kind
 * of thing: a list of where one person's memory of the Qur'an slips, and how
 * often. It leaves the device only in a saved file the reader chooses to make
 * (docs/decisions/confusion-map-export.md), which is why the saved file's
 * module is on its list. Its store is the device's notes store, so that is
 * held to the same rule. The wavy arrow's drawing rule is not the record and is
 * not listed.
 */
const RECORDS = [
  {
    name: "the revision record",
    why: "The record is a log of when someone was reading Qur'an",
    modules: ["packages/core/src/revision.ts", "apps/web/src/revision-store.ts"],
    files: ["revision", "revision-store"],
    symbols: ["rollUp", "lastSeen", "scopesOf", "dayOf", "daysBetween", "editionOf", "RevisionEvent", "RevisionScope", "DayStamp"],
    allowed: new Map([
      ["apps/web/src/App.tsx", "where a deliberate tap becomes a recorded look"],
      ["apps/web/src/components/RevisionMap.tsx", "the picture; reads the record, sends nothing"],
      ["apps/web/src/revision-store.ts", "the store is built on the pure module"],
      ["packages/core/src/index.ts", "the barrel that exports it"],
    ]),
  },
  {
    name: "the confusion-jump record",
    why: "The record is a list of where someone's memory of the Qur'an slips",
    modules: ["packages/core/src/confusions.ts", "apps/web/src/bookmark-store.ts"],
    files: ["confusions", "bookmark-store"],
    symbols: [
      "markConfusion",
      "againConfusion",
      "setDestination",
      "setConfusionState",
      "removeConfusion",
      "restoreConfusion",
      "removeLastTime",
      "confusionMarks",
      "confusionsFrom",
      "allConfusions",
      "dismissedConfusions",
      "waslMarks",
      "jumpArrows",
      "arrowsShown",
      "mergeConfusions",
      "isConfusion",
      "Confusion",
      "readConfusions",
      "writeConfusions",
    ],
    allowed: new Map([
      ["apps/web/src/App.tsx", "where a marked jump is made and drawn"],
      ["apps/web/src/useBookmarks.ts", "holds the device's notes and jumps for the app"],
      ["apps/web/src/bookmark-store.ts", "the store is built on the pure module"],
      ["packages/core/src/bookmarks.ts", "the saved file the reader chooses to make"],
      ["packages/core/src/index.ts", "the barrel that exports it"],
    ]),
  },
];

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
//
// The extension is optional, and that is not a nicety: core is authored with the
// `.js` suffix ESM requires, but the app is bundled by Vite and omits it — which
// is how `App.tsx`, the one production importer this gate was written for, slipped
// past the pattern meant to catch it. The gate still passed, because it passes
// when it finds nothing. (This comment may not spell an import out: invariant 1
// reads the file as text, and prose is text.)
const importsOf = (record) => ({
  file: new RegExp(`\\bfrom\\s+["'][^"']*\\/(${record.files.join("|")})(\\.(js|ts|tsx))?["']`),
  barrel: new RegExp(
    `\\bimport\\s*(?:type\\s*)?\\{[^}]*\\b(${record.symbols.join("|")})\\b[^}]*\\}\\s*from\\s*["']@hifth\\/core["']`,
    "s",
  ),
});

for (const record of RECORDS) {
  const imports = importsOf(record);
  for (const file of sources()) {
    const rel = relative(ROOT, file);
    // A test proving the record stays put has to be able to see it.
    if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
    const text = readFileSync(file, "utf8");
    if (!imports.file.test(text) && !imports.barrel.test(text)) continue;
    if (record.allowed.has(rel)) continue;
    failures.push(
      `${rel} imports ${record.name}.\n` +
        `    ${record.why}, and it does not\n` +
        `    leave the device. If this module genuinely needs it and cannot send it\n` +
        `    anywhere, add it to that record's allowed list in this file with the reason.`,
    );
  }
}

// ── Invariant 2: no way out inside the record's own modules ──────────────────
for (const rel of RECORDS.flatMap((r) => r.modules)) {
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
for (const [rel] of RECORDS.flatMap((r) => [...r.allowed])) {
  try {
    statSync(join(ROOT, rel));
  } catch {
    failures.push(`The allowed list names ${rel}, which no longer exists — prune it.`);
  }
}

if (failures.length > 0) {
  console.error("gate:revision-privacy — FAILED\n");
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}

console.error(
  `gate:revision-privacy — OK (${RECORDS.flatMap((r) => r.modules).length} record modules, ` +
    `${RECORDS.reduce((n, r) => n + r.allowed.size, 0)} permitted importers, ${ESCAPE_HATCHES.length} hatches checked)`,
);
