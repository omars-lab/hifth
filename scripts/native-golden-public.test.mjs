import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The app's comparison pictures are committed to a public repository, so they
// must be taken of the public build. Taken of the pitch build, a picture of a
// verse with its note open carries The Study Quran's words in its pixels, and
// no text check can see them (native-shell.md ⑲).
const root = fileURLToPath(new URL("..", import.meta.url));

function check(flavour) {
  const bundle = mkdtempSync(join(tmpdir(), "bundle-"));
  if (flavour) writeFileSync(join(bundle, ".hifth-web-flavour"), `${flavour}\n`);
  return spawnSync("make", ["-s", "-C", root, "app-golden-public", `WEB_BUNDLE=${bundle}`], { encoding: "utf8" });
}

test("the comparison refuses the pitch build", () => {
  const r = check("pitch");
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /FLAVOUR=public/);
});

test("the comparison refuses a build that does not say which it is", () => {
  assert.notEqual(check(null).status, 0);
});

test("the comparison runs on the public build", () => {
  const r = check("public");
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Switching the app from the pitch build to the public one used to keep the
// pitch's private folder: the copy skipped it, and a skipped folder is also
// one the copy never deletes. The check after the copy refused it, but a
// switch should simply work.
function copy(flavour, { dist, bundle }) {
  return spawnSync("make", ["-s", "-C", root, "app-web-copy", `FLAVOUR=${flavour}`, `DIST=${dist}`, `WEB_BUNDLE=${bundle}`], {
    encoding: "utf8",
  });
}

test("switching the app from the pitch build to the public one leaves no private folder behind", () => {
  const dist = mkdtempSync(join(tmpdir(), "dist-"));
  writeFileSync(join(dist, "index.html"), "<!doctype html>");
  const bundle = mkdtempSync(join(tmpdir(), "bundle-"));
  mkdirSync(join(bundle, "assets", "private"), { recursive: true });
  writeFileSync(join(bundle, "assets", "private", "1.json"), "{}");
  writeFileSync(join(bundle, ".hifth-web-flavour"), "pitch\n");
  const r = copy("public", { dist, bundle });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(!existsSync(join(bundle, "assets", "private")));
  assert.ok(existsSync(join(bundle, "index.html")));
  assert.equal(readFileSync(join(bundle, ".hifth-web-flavour"), "utf8").trim(), "public");
});

test("a public build that itself carries the private folder is copied without it", () => {
  const dist = mkdtempSync(join(tmpdir(), "dist-"));
  mkdirSync(join(dist, "assets", "private"), { recursive: true });
  writeFileSync(join(dist, "assets", "private", "1.json"), "{}");
  const bundle = mkdtempSync(join(tmpdir(), "bundle-"));
  const r = copy("public", { dist, bundle });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(!existsSync(join(bundle, "assets", "private")));
});
