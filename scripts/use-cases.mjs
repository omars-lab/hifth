/**
 * Shared reader for docs/use-cases.json.
 *
 * Three things read this file — the gate, the terminal renderer and the
 * markdown/mermaid builder — and a use case that says one thing in the terminal
 * and another in the committed doc is worse than no doc, because the
 * disagreement is silent. So the parsing, the hash and the joins live here once.
 * Same shape as scripts/validation-ledger.mjs, for the same reason.
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

export const USE_CASES_PATH = join(ROOT, "docs", "use-cases.json");
export const DOC_PATH = join(ROOT, "docs", "use-cases.md");
export const MAP_PATH = join(ROOT, "docs", "map.json");
export const PKG_PATH = join(ROOT, "package.json");

export function readUseCases() {
  if (!existsSync(USE_CASES_PATH)) {
    console.error(`use-cases missing at ${USE_CASES_PATH}`);
    process.exit(1);
  }
  const { actors, useCases } = JSON.parse(readFileSync(USE_CASES_PATH, "utf8"));
  return { actors, useCases };
}

/** Feature ids the map currently defines — the set a use case may point into. */
export function mapFeatureIds() {
  const { features } = JSON.parse(readFileSync(MAP_PATH, "utf8"));
  return new Set(features.map((f) => f.id));
}

/** Script names package.json currently defines — the set a `gate` proof may name. */
export function scriptNames() {
  return new Set(Object.keys(JSON.parse(readFileSync(PKG_PATH, "utf8")).scripts ?? {}));
}

/**
 * The slice the committed doc renders, and therefore the slice whose change
 * makes docs/use-cases.md stale. Not the whole file: editing `$comment` should
 * not fail a build over a generated page that never shows it.
 */
export function docPayload({ actors, useCases }) {
  return {
    actors: actors.map((a) => ({ id: a.id, name: a.name, what: a.what })),
    useCases: useCases.map((u) => ({
      id: u.id,
      actor: u.actor,
      goal: u.goal,
      feature: u.feature,
      code: u.code ?? [],
      proof: u.proof ?? [],
      includes: u.includes ?? [],
      gap: u.gap ?? null,
    })),
  };
}

/** Stable short hash of the rendered slice; stamped into use-cases.md. */
export function useCasesHash(data) {
  return createHash("sha256").update(JSON.stringify(docPayload(data))).digest("hex").slice(0, 12);
}

/** The hash use-cases.md was built from, or null if there is no doc (or no stamp). */
export function docHash() {
  if (!existsSync(DOC_PATH)) return null;
  const m = readFileSync(DOC_PATH, "utf8").match(/<!-- use-cases-hash: ([0-9a-f]+) -->/);
  return m ? m[1] : null;
}

/** A proof is either a named test in a file, or a named gate script. */
export function isGateProof(p) {
  return typeof p.gate === "string";
}
