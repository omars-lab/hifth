import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// A build made for the App Store must be the public one. The app's web part is
// built as the private pitch by default, and the private build carries The
// Study Quran's commentary, so an archive made without thinking would put the
// book in a store build. The archive step refuses any build but the public one.
//
// Every refusal below is matched by its own words. "It failed" proves nothing
// here: the archive step also fails on the licence lock, and a target that
// does not exist fails too.
const root = fileURLToPath(new URL("..", import.meta.url));
const REFUSAL = /only the public build/;

function bundle(flavour) {
  const dir = mkdtempSync(join(tmpdir(), "bundle-"));
  if (flavour) writeFileSync(join(dir, ".hifth-web-flavour"), `${flavour}\n`);
  return dir;
}

function make(target, flavour) {
  return spawnSync("make", ["-s", "-C", root, target, `WEB_BUNDLE=${bundle(flavour)}`], { encoding: "utf8" });
}

test("the store check refuses the pitch build, and says how to get the public one", () => {
  const r = make("app-store-flavour", "pitch");
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, REFUSAL);
  assert.match(r.stdout + r.stderr, /make app-web FLAVOUR=public/);
});

test("the store check refuses a build that does not say which it is", () => {
  const r = make("app-store-flavour", null);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, REFUSAL);
});

test("the store check passes the public build", () => {
  const r = make("app-store-flavour", "public");
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Only the pitch build is tried here. On the public build the archive step
// goes on to the licence lock today, and to a full Xcode build once that opens.
test("archiving the pitch build stops at the flavour, before anything else is tried", () => {
  const r = make("app-archive", "pitch");
  const said = r.stdout + r.stderr;
  assert.notEqual(r.status, 0);
  assert.match(said, REFUSAL);
  assert.doesNotMatch(said, /Not yet/, "the licence lock was reached first");
});
