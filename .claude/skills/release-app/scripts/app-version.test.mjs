// The version command, run against a made-up copy of the project file. The
// real file is native/project.yml; `make app-version` runs this on it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const SCRIPT = new URL("./app-version.mjs", import.meta.url).pathname;

function project({ version = "0.1.0", build = "1", extra = "" } = {}) {
  const at = join(mkdtempSync(join(tmpdir(), "hifth-version-")), "project.yml");
  writeFileSync(
    at,
    `name: Hifth
settings:
  base:
    SWIFT_VERSION: "6.0"
    MARKETING_VERSION: "${version}"
    CURRENT_PROJECT_VERSION: "${build}"
    ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon
${extra}`,
  );
  return at;
}

function run(file, ...args) {
  return spawnSync(process.execPath, [SCRIPT, "--file", file, ...args], { encoding: "utf8" });
}

const read = (file) => readFileSync(file, "utf8");

test("with nothing asked, it says the version and build and changes nothing", () => {
  const file = project();
  const before = read(file);
  const r = run(file);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /ev=current version=0\.1\.0 build=1/);
  assert.equal(read(file), before);
});

test("--next-build raises the build number by one and leaves the version", () => {
  const file = project({ build: "41" });
  const r = run(file, "--next-build");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(read(file), /CURRENT_PROJECT_VERSION: "42"/);
  assert.match(read(file), /MARKETING_VERSION: "0\.1\.0"/);
  assert.match(r.stdout, /ev=set version=0\.1\.0 build=42/);
});

test("--version sets the version and raises the build too, since Apple needs a new build for any upload", () => {
  const file = project({ build: "7" });
  const r = run(file, "--version", "1.0.0");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(read(file), /MARKETING_VERSION: "1\.0\.0"/);
  assert.match(read(file), /CURRENT_PROJECT_VERSION: "8"/);
});

test("only those two lines change; the rest of the file is kept as it was", () => {
  const file = project({ extra: "# a comment kept\n" });
  const before = read(file).split("\n");
  run(file, "--version", "1.2.3");
  const after = read(file).split("\n");
  assert.equal(after.length, before.length);
  const changed = after.filter((line, i) => line !== before[i]);
  assert.deepEqual(changed, ['    MARKETING_VERSION: "1.2.3"', '    CURRENT_PROJECT_VERSION: "2"']);
});

test("a version lower than today's is refused, and nothing is written", () => {
  for (const lower of ["0.0.9", "0.1"]) {
    const file = project({ version: "0.1.1" });
    const before = read(file);
    const r = run(file, "--version", lower);
    assert.equal(r.status, 1, `${lower} was not refused`);
    assert.match(r.stdout, /lower than/);
    assert.equal(read(file), before);
  }
});

test("the same version is allowed: a second build of one version is normal", () => {
  const file = project({ version: "1.0.0", build: "3" });
  const r = run(file, "--version", "1.0.0");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(read(file), /CURRENT_PROJECT_VERSION: "4"/);
});

test("10 is higher than 9: versions compare as numbers, not as words", () => {
  const file = project({ version: "1.9.0" });
  assert.equal(run(file, "--version", "1.10.0").status, 0);
});

test("a version Apple would refuse is refused here first", () => {
  for (const bad of ["1.0.0.0", "v1.0", "1.0-beta", "", "1..0", "01.0.0"]) {
    const file = project();
    const before = read(file);
    const r = run(file, "--version", bad);
    assert.equal(r.status, 1, `"${bad}" was not refused`);
    assert.match(r.stdout, /not a version Apple takes/);
    assert.equal(read(file), before);
  }
});

test("a file with no version line, or two of them, is refused rather than guessed at", () => {
  const none = join(mkdtempSync(join(tmpdir(), "hifth-version-")), "project.yml");
  writeFileSync(none, "name: Hifth\n");
  assert.equal(run(none, "--next-build").status, 2);
  const two = project({ extra: '    MARKETING_VERSION: "9.9.9"\n' });
  const r = run(two, "--next-build");
  assert.equal(r.status, 2);
  assert.match(r.stdout, /more than once/);
});

test("a build number that is not a whole number is refused", () => {
  const file = project({ build: "1.2" });
  const r = run(file, "--next-build");
  assert.equal(r.status, 2);
  assert.match(r.stdout, /whole number/);
});
