#!/usr/bin/env node
/**
 * The ETL script census, derived — shared by the renderer and the gate.
 *
 * The document that used to draw this by hand (docs/design/etl-pipeline.md §⑤)
 * drifted: it enumerated about fourteen scripts while thirty-odd existed, drew
 * four probes where twelve lived, and named an entire mark-registration family
 * nowhere. The falsification test the document had staked its balance on —
 * "if a script is added and this document does not mention it, the balance was
 * wrong" — fired silently, because `gate:map` validates the pointers that
 * exist and structurally cannot see a script that is absent.
 *
 * So the census is generated instead of written, and the ground truth is the
 * FILESYSTEM, not docs/map.json. The map itself had drifted — it named sixty of
 * the sixty-nine scripts on disk — and a census built from a register that can
 * be short is a census that can be short. Enumerating the directory cannot miss
 * a file; a script added without a mention changes this payload, which changes
 * the doc's stamped hash, which the gate refuses until the doc is re-rendered.
 * That is the anti-drift guarantee the hand-drawn diagram could not give.
 *
 * The map is still read — for the one-line blurb that says what each script is
 * for, which the filesystem does not know. A script on disk with no map entry
 * renders as exactly that, so the map↔disk gap is legible here too rather than
 * hidden.
 *
 * Only the census is derived. The flow diagrams (source→shard, the four
 * encodings, where the gates sit, the one-way boundary) and every prose
 * paragraph in etl-pipeline.md stay hand-written, because their edges and their
 * reasons are not recorded in any register and inventing a structural edge-map
 * would just be another hand-maintained thing that drifts.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const SCRIPTS_DIR = join(ROOT, "packages", "etl", "scripts");
export const DOC_PATH = join(ROOT, "docs", "design", "etl-scripts.md");
const MAP_PATH = join(ROOT, "docs", "map.json");

/** Every `.mjs` under packages/etl/scripts, repo-relative, sorted. */
function scriptFiles() {
  const out = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.endsWith(".mjs")) out.push(relative(ROOT, full));
    }
  };
  walk(SCRIPTS_DIR);
  return out.sort();
}

/**
 * Which family a script belongs to, from its path and name alone. The prefixes
 * are the repo's own conventions (`build-`, `probe-`, `score-`, …); the order
 * of the returned keys is the order the document renders the groups in.
 */
export const GROUPS = [
  ["builders", "Builders — the only scripts that write the committed shards"],
  ["probes", "Probes — measure what a gate structurally cannot"],
  ["scoring", "Scoring & settling — turn a reader's marks into a ledger"],
  ["reports", "Reports & samples — run by hand, output for a person"],
  ["viewers", "Local viewers — serve a report to a browser"],
  ["libs", "Shared libraries — read by the scripts above, write nothing"],
  ["tests", "Tests — assert a library's behaviour"],
  ["other", "Other"],
];

function groupOf(rel) {
  const name = rel.slice("packages/etl/scripts/".length);
  if (name.endsWith(".test.mjs")) return "tests";
  if (name.startsWith("lib/")) return "libs";
  if (/^(build-|extract-|vendor-)/.test(name)) return "builders";
  if (/^probe-/.test(name)) return "probes";
  if (/^(score-|settle-)/.test(name)) return "scoring";
  if (/^serve-/.test(name)) return "viewers";
  if (/^(audit-|sample-)/.test(name)) return "reports";
  return "other";
}

/** map.json note text, keyed by repo-relative file path (first entry wins). */
function mapBlurbs() {
  const { features } = JSON.parse(readFileSync(MAP_PATH, "utf8"));
  const byFile = new Map();
  const visit = (entries) => {
    for (const e of entries ?? []) {
      if (e && typeof e.file === "string" && typeof e.note === "string" && !byFile.has(e.file)) {
        byFile.set(e.file, firstSentence(e.note));
      }
    }
  };
  for (const f of features ?? []) visit(f.entry);
  return byFile;
}

/** First sentence of a map note, backticks stripped, capped so a row stays a row. */
function firstSentence(note) {
  const flat = note.replace(/`/g, "").replace(/\s+/g, " ").trim();
  const m = flat.match(/^(.+?[.?!])(\s|$)/);
  let s = m ? m[1] : flat;
  if (s.length > 200) s = s.slice(0, 197).trimEnd() + "…";
  return s;
}

/**
 * The census payload: one row per script on disk, its family, and its one-line
 * blurb from the code map (null when the map does not name it). Sorted and
 * pure, so the hash is stable across machines and only a real change moves it.
 */
export function payload() {
  const blurbs = mapBlurbs();
  const rows = scriptFiles().map((path) => ({
    path,
    group: groupOf(path),
    blurb: blurbs.get(path) ?? null,
  }));
  return {
    total: rows.length,
    documented: rows.filter((r) => r.blurb !== null).length,
    rows,
  };
}

export function etlScriptsHash() {
  return createHash("sha256").update(JSON.stringify(payload())).digest("hex").slice(0, 12);
}

/** The hash the committed doc was built from, or null if absent/unstamped. */
export function docHash() {
  try {
    const m = readFileSync(DOC_PATH, "utf8").match(/<!-- etl-scripts-hash: ([0-9a-f]+) -->/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
