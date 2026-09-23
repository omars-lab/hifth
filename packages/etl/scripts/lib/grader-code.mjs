/**
 * The fingerprint of a grader's own code, so a result names what produced it.
 *
 * Every scorer and settler already stamps a hash of its INPUT into what it
 * writes — the displacements file, the least-sure list, the rows — and refuses
 * to run against a file that no longer matches. That guards the data. It does
 * not guard the arithmetic: a scorer edited between two runs returns a different
 * verdict from the same inputs, and nothing in either result says so. This is
 * the other half of that stamp — a hash of the grading script and every library
 * it reaches through its own imports — written beside the input fingerprint, so
 * a verdict can be read back to the exact code that reached it.
 *
 * It is the same move `scripts/etl-scripts.mjs` makes for the script census (a
 * sha256 over a deterministic payload, cut to twelve hex digits), pointed at one
 * script's import closure instead of the whole directory. Deliberately NOT the
 * FNV-1a each instrument keeps its own copy of: those stay per-file on purpose,
 * because a shared helper for the input hash would let one edit silently re-bless
 * every old ruling. The code hash has no such trap — an edit to this file changes
 * every grader's fingerprint, which is what it should do, since this file is part
 * of every grader's code.
 *
 * What it follows: static `import … from "./x.mjs"` and `"../x.mjs"` lines,
 * transitively. What it names but does not hash: bare package imports such as
 * `@hifth/core`, listed in `packages` so a reader knows the stamp stops there.
 * Node's own modules are neither hashed nor listed.
 *
 * A result written before this existed carries no stamp. `stampOf` reads that as
 * "unstamped", never as an error: old rulings stay readable and are not rewritten.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/** The repository root, so stamped paths read the same from any machine. */
export const ROOT = join(HERE, "..", "..", "..", "..");

export const UNSTAMPED = "unstamped";

/**
 * Every static import specifier in a module's source, in order of appearance.
 * Both `import x from "…"` and `export { x } from "…"` count, and so does a bare
 * `import "…"` for its side effects; a `require` does not exist in these files.
 */
function specifiersOf(source) {
  const out = [];
  const re = /^\s*(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']/gm;
  let m;
  while ((m = re.exec(source))) out.push(m[1] ?? m[2]);
  return out;
}

/**
 * The entry script plus everything it reaches through relative imports, as
 * absolute paths, each read once. Throws on an import that does not resolve —
 * a fingerprint over fewer files than the grader actually runs would be a stamp
 * that says less than it appears to.
 */
export function closureOf(entryFile) {
  const seen = new Map();
  const packages = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    let source;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      throw new Error(`grader code fingerprint: cannot read ${file}`);
    }
    seen.set(file, source);
    for (const spec of specifiersOf(source)) {
      if (spec.startsWith("./") || spec.startsWith("../")) walk(resolve(dirname(file), spec));
      else if (!spec.startsWith("node:")) packages.add(spec);
    }
  };
  walk(resolve(entryFile));
  return { sources: seen, packages: [...packages].sort() };
}

/**
 * `{ hash, files, packages }` for one grader. `files` are repo-relative (or
 * relative to `root`), sorted; the hash is over those paths and their bytes, so
 * a renamed file and an edited file both change it, and the order on disk does
 * not.
 */
export function codeFingerprint(entryFile, { root = ROOT } = {}) {
  const { sources, packages } = closureOf(entryFile);
  const files = [...sources.keys()].map((f) => relative(root, f)).sort();
  const payload = files.map((rel) => [rel, sources.get(resolve(root, rel))]);
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 12);
  return { hash, files, packages };
}

/**
 * The stamp a grader writes into a ruling. One object, so a reader of the file
 * sees the script, the hash, and the list of files the hash covers side by side.
 */
export function codeStamp(entryFile) {
  const { hash, files, packages } = codeFingerprint(entryFile);
  return { script: relative(ROOT, resolve(entryFile)), fingerprint: hash, files, packages };
}

/** One line for a printed result, beside the input-fingerprint line it already prints. */
export function codeLine(entryFile) {
  const s = codeStamp(entryFile);
  return `graded by ${s.script} · code ${s.fingerprint} (${s.files.length} files)`;
}

/** The fingerprint a result carries, or "unstamped" for one written before there was a stamp. */
export function stampOf(doc) {
  const fp = doc?.code?.fingerprint;
  return typeof fp === "string" && fp ? fp : UNSTAMPED;
}
