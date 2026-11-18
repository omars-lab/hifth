import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * The sign-in library (jose) runs on hifth.app's server only (.claude/plans/sign-in-build.md).
 * It must never reach the app a reader downloads: the web app and the shared core are what the
 * iPad, iPhone and Mac apps carry, so neither may import it or list it as a dependency.
 */

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SERVER_ONLY = ["jose"];
const READER_FACING = ["apps/web", "packages/core"];
const CODE = /\.(m?[jt]sx?|cjs)$/;

function* codeFiles(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* codeFiles(path);
    else if (CODE.test(name)) yield path;
  }
}

/** Each place under `root`'s reader-facing folders that brings in a server-only library. */
export function serverOnlyLeaks(root) {
  const leaks = [];
  for (const folder of READER_FACING) {
    const pkgPath = join(root, folder, "package.json");
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
        for (const lib of SERVER_ONLY) if (pkg[field]?.[lib]) leaks.push(`${folder}/package.json lists ${lib}`);
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    let src;
    try {
      src = codeFiles(join(root, folder));
      for (const file of src) {
        const text = readFileSync(file, "utf8");
        for (const lib of SERVER_ONLY) {
          const brought = new RegExp(`(from\\s*|import\\s*\\(\\s*|require\\s*\\(\\s*|import\\s+)["']${lib}(/[^"']*)?["']`);
          if (brought.test(text)) leaks.push(`${file.slice(root.length)} imports ${lib}`);
        }
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return leaks;
}

test("the check catches a reader-facing file that imports the sign-in library", () => {
  const fake = mkdtempSync(join(tmpdir(), "server-only-"));
  try {
    mkdirSync(join(fake, "apps/web/src"), { recursive: true });
    writeFileSync(join(fake, "apps/web/src/a.ts"), 'import { jwtVerify } from "jose";\n');
    mkdirSync(join(fake, "packages/core/src"), { recursive: true });
    writeFileSync(join(fake, "packages/core/src/b.ts"), 'const j = await import("jose/jwt/verify");\n');
    writeFileSync(join(fake, "packages/core/package.json"), JSON.stringify({ dependencies: { jose: "6.2.15" } }));
    assert.equal(serverOnlyLeaks(fake).length, 3);
  } finally {
    rmSync(fake, { recursive: true, force: true });
  }
});

test("the web app and the shared core never bring in the sign-in library", () => {
  assert.deepEqual(serverOnlyLeaks(ROOT), []);
});
