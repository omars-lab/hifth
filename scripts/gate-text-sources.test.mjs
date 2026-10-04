/**
 * The no-NUL check must refuse a source file holding a NUL byte — whether it
 * has been added to git yet or not — and name the file and line. It must pass
 * a tree whose sources are clean, leave vendored data and build output alone,
 * not stumble over a file deleted from disk but still listed by git, and
 * refuse a tree where it found no sources at all. The NUL is made at run time
 * so this file stays plain text.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { makeFixture, dropFixture, runGate, fixtureEnv } from "./gate-fixture.mjs";

const NUL = String.fromCharCode(0);
const keyed = `export const key = \`\${"a"}${NUL}\${"b"}\`;`;

/** The check lists files with git, so the made-up tree has to be a repository. */
function withRepo(files, fn, { stage = [] } = {}) {
  const root = makeFixture(files);
  try {
    execFileSync("git", ["init", "-q"], { cwd: root, env: fixtureEnv() });
    if (stage.length) execFileSync("git", ["add", "--", ...stage], { cwd: root, env: fixtureEnv() });
    return fn(root);
  } finally {
    dropFixture(root);
  }
}

const clean = {
  "packages/core/src/a.ts": "export const a = 1;\n",
  "apps/web/src/b.tsx": "export const b = 2;\n",
  "scripts/c.mjs": "export const c = 3;\n",
};

test("gate:text-sources passes sources with no NUL byte", () => {
  withRepo(clean, (root) => {
    const r = runGate("text-sources", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(3 sources, no NUL bytes\)/);
  });
});

test("gate:text-sources refuses a NUL in a file git has not been told about yet, and names its line", () => {
  withRepo({ ...clean, "apps/web/src/keys.ts": `// keys\n\n${keyed}\n` }, (root) => {
    const r = runGate("text-sources", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /apps\/web\/src\/keys\.ts:3/);
    assert.doesNotMatch(r.out, /a\.ts|b\.tsx|c\.mjs/);
  });
});

test("gate:text-sources refuses a NUL in a file already added to git", () => {
  withRepo(
    { ...clean, "packages/core/src/keys.ts": `${keyed}\n` },
    (root) => {
      const r = runGate("text-sources", root);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /packages\/core\/src\/keys\.ts:1/);
    },
    { stage: ["packages/core/src/keys.ts"] },
  );
});

test("gate:text-sources leaves vendored data and build output alone", () => {
  withRepo(
    {
      ...clean,
      "packages/etl/data/raw/blob.js": `${keyed}\n`,
      "apps/web/dist/assets/index-abc.js": `${keyed}\n`,
      "apps/web/notes.txt": `${keyed}\n`,
    },
    (root) => {
      const r = runGate("text-sources", root);
      assert.equal(r.status, 0, r.out);
      assert.match(r.out, /OK \(3 sources/);
    },
  );
});

test("gate:text-sources does not stumble over a listed file that is gone from disk", () => {
  withRepo(
    { ...clean, "packages/core/src/gone.ts": "export const g = 0;\n" },
    (root) => {
      rmSync(join(root, "packages/core/src/gone.ts"));
      const r = runGate("text-sources", root);
      assert.equal(r.status, 0, r.out);
    },
    { stage: ["packages/core/src/gone.ts"] },
  );
});

test("gate:text-sources refuses a tree where it finds no sources, rather than passing nothing", () => {
  withRepo({ "README.md": "nothing here\n" }, (root) => {
    const r = runGate("text-sources", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /no source files matched/);
  });
});
