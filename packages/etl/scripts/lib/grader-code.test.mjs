/**
 * A result must name the code that produced it, not only the file it read.
 *
 * Every grader already stamps a hash of its INPUT into what it writes, so a
 * ruling re-read against moved displacements is refused. Nothing stamped the
 * grader itself, so a changed scorer returning a different verdict from the same
 * inputs was invisible from the result alone. This is the proof that the code
 * fingerprint closes that: the same code hashes the same, a touched library or
 * entry script hashes differently, and a file nothing imports changes nothing.
 */
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { codeFingerprint, stampOf, UNSTAMPED } from "./grader-code.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(HERE, "..");
const ROOT = join(SCRIPTS, "..", "..", "..");

/** A tiny grader in a scratch directory: an entry, a library, and a library's library. */
let dir;
let entry;
const write = (rel, text) => {
  const p = join(dir, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
  return p;
};
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hifth-grader-code-"));
  write("lib/deep.mjs", "export const deep = 1;\n");
  write("lib/helper.mjs", 'import { deep } from "./deep.mjs";\nexport const helper = deep + 1;\n');
  entry = write(
    "score-thing.mjs",
    'import { helper } from "./lib/helper.mjs";\nimport { createHash } from "node:crypto";\nimport { x } from "@hifth/core";\nconsole.log(helper);\n',
  );
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("what the fingerprint covers", () => {
  it("names the entry and every library it reaches through relative imports, and nothing else", () => {
    const { files, packages } = codeFingerprint(entry, { root: dir });
    expect(files).toEqual(["lib/deep.mjs", "lib/helper.mjs", "score-thing.mjs"]);
    expect(packages).toEqual(["@hifth/core"]);
  });

  it("is the same hash twice for the same code", () => {
    expect(codeFingerprint(entry, { root: dir }).hash).toBe(codeFingerprint(entry, { root: dir }).hash);
    expect(codeFingerprint(entry, { root: dir }).hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it("changes when the grading script itself changes", () => {
    const before = codeFingerprint(entry, { root: dir }).hash;
    write("score-thing.mjs", `${readFileSync(entry, "utf8")}// a verdict-changing edit\n`);
    expect(codeFingerprint(entry, { root: dir }).hash).not.toBe(before);
  });

  it("changes when a library two imports away changes", () => {
    const before = codeFingerprint(entry, { root: dir }).hash;
    write("lib/deep.mjs", "export const deep = 2;\n");
    expect(codeFingerprint(entry, { root: dir }).hash).not.toBe(before);
  });

  it("does not change when a file the grader never imports changes", () => {
    const before = codeFingerprint(entry, { root: dir }).hash;
    write("lib/unrelated.mjs", "export const nothing = 0;\n");
    write("other-grader.mjs", 'import { nothing } from "./lib/unrelated.mjs";\n');
    expect(codeFingerprint(entry, { root: dir }).hash).toBe(before);
  });

  it("stops on an import that does not resolve, rather than quietly hashing less", () => {
    write("score-thing.mjs", 'import { gone } from "./lib/gone.mjs";\n');
    expect(() => codeFingerprint(entry, { root: dir })).toThrow(/lib\/gone\.mjs/);
  });
});

describe("the real graders", () => {
  const graders = {
    "score-mark-adjudication.mjs": "packages/etl/scripts/lib/adjudication.mjs",
    "score-mark-nudge.mjs": "packages/etl/scripts/lib/placement-stats.mjs",
    "score-placement-contest.mjs": "packages/etl/scripts/lib/adjudication.mjs",
    "score-mark-report.mjs": "packages/etl/scripts/lib/mark-settle.mjs",
    "settle-mark-report.mjs": "packages/etl/scripts/lib/mark-settle.mjs",
  };
  for (const [script, lib] of Object.entries(graders)) {
    it(`${script} reaches ${lib.split("/").pop()} and hashes to twelve hex digits`, () => {
      const { hash, files } = codeFingerprint(join(SCRIPTS, script));
      expect(hash).toMatch(/^[0-9a-f]{12}$/);
      expect(files).toContain(`packages/etl/scripts/${script}`);
      expect(files).toContain(lib);
      expect(files).toContain("packages/etl/scripts/lib/grader-code.mjs");
    });
  }

  it("gives the five graders five different fingerprints", () => {
    const hashes = Object.keys(graders).map((s) => codeFingerprint(join(SCRIPTS, s)).hash);
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});

describe("reading a stamp back", () => {
  it("returns the fingerprint a stamped result carries", () => {
    expect(stampOf({ code: { fingerprint: "abc123abc123" } })).toBe("abc123abc123");
  });

  it("calls a result written before stamping existed unstamped, not broken", () => {
    expect(stampOf({})).toBe(UNSTAMPED);
    expect(stampOf(null)).toBe(UNSTAMPED);
    expect(stampOf({ code: {} })).toBe(UNSTAMPED);
  });

  it("reads every committed ruling as either stamped or unstamped, never as an error", () => {
    const dirOfRulings = join(ROOT, "docs", "validation", "rulings");
    const rulings = readdirSync(dirOfRulings).filter((f) => f.endsWith(".json"));
    expect(rulings.length).toBeGreaterThan(0);
    for (const f of rulings) {
      const doc = JSON.parse(readFileSync(join(dirOfRulings, f), "utf8"));
      const stamp = stampOf(doc);
      expect(stamp === UNSTAMPED || /^[0-9a-f]{12}$/.test(stamp)).toBe(true);
    }
  });
});
