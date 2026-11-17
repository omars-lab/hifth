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

// The two tests below ask make what it would run (`make -n`) and run none of
// it, so no build is made. Only the upload sends anything to Apple, so only the
// upload waits on the licence answer; an archive stays on the laptop.
function plan(target, flavour) {
  const r = spawnSync("make", ["-n", "-C", root, target, `WEB_BUNDLE=${bundle(flavour)}`, "TEAM=ABCDE12345"], {
    encoding: "utf8",
  });
  // A command split over lines with a backslash is printed that way; join it.
  return (r.stdout + r.stderr).replace(/\\\n\s*/g, " ");
}

test("the archive is a real Xcode archive of the public build, not held by the licence lock", () => {
  const said = plan("app-archive", "public");
  assert.match(said, /xcodebuild .*-archivePath .*archive/);
  assert.match(said, /DEVELOPMENT_TEAM=ABCDE12345/);
  assert.doesNotMatch(said, /Not yet/);
  assert.doesNotMatch(said, /not built yet/);
  // The release check reads the app inside the archive, which is what would be uploaded.
  assert.match(said, /release-check\.mjs[^\n]*--release [^\n]*Hifth\.xcarchive\/Products\/Applications\/Hifth\.app[^\n]*--flavour public/);
});

// The export settings: for the App Store, kept on the laptop, and the build
// number left as the repo says, so the one in native/project.yml is the one sent.
test("the export signs for the App Store and keeps the result on this laptop", () => {
  const r = spawnSync("plutil", ["-convert", "json", "-o", "-", join(root, "native/ExportOptions.plist")], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  const o = JSON.parse(r.stdout);
  assert.equal(o.method, "app-store-connect");
  assert.equal(o.destination, "export");
  assert.equal(o.manageAppVersionAndBuildNumber, false);
  assert.equal(o.teamID, undefined, "the team id is read from the keychain, never written in the repo");
});

// The receipt (.claude/skills/release-app/scripts/archive-receipt.mjs): written
// only once the archive's checks have passed, and read before the archive is
// signed and again before it is sent, so only an archive this command made and
// checked, untouched since, goes any further.
test("the archive writes its receipt only after the release check of the app inside it", () => {
  const said = plan("app-archive", "public");
  const checked = said.search(/release-check\.mjs[^\n]*--release [^\n]*Hifth\.xcarchive/);
  const receipt = said.search(/archive-receipt\.mjs --write [^\n]*Hifth\.xcarchive/);
  assert.ok(checked >= 0, "no release check of the archive");
  assert.ok(receipt > checked, "the receipt is written before the archive is checked, or not at all");
  // A run that fails part way leaves no receipt from an earlier archive behind.
  assert.match(said, /rm -rf [^\n]*Hifth\.xcarchive [^\n]*Hifth\.xcarchive\.receipt\.json/);
});

test("the export reads the receipt before it signs anything", () => {
  const said = plan("app-export", "public");
  const receipt = said.search(/archive-receipt\.mjs --check [^\n]*Hifth\.xcarchive/);
  const sign = said.search(/-exportArchive/);
  assert.ok(receipt >= 0, "the export never reads the receipt");
  assert.ok(sign > receipt, "the export signs before it reads the receipt");
});

test("the upload reads the receipt again after the export, just before sending", () => {
  const said = plan("app-testflight", "public");
  const sign = said.lastIndexOf("-exportArchive");
  const lastCheck = said.lastIndexOf("archive-receipt.mjs --check");
  const send = said.indexOf("upload: not built yet");
  assert.ok(sign >= 0 && send >= 0, "the plan has no export, or no upload step");
  assert.ok(lastCheck > sign && lastCheck < send, "no receipt check between the export and the upload");
});

test("the upload meets the licence lock before it archives or exports anything", () => {
  const said = plan("app-testflight", "public");
  const lock = said.indexOf("Not yet");
  assert.ok(lock >= 0, "the upload has no licence lock");
  const firstBuild = said.search(/xcodebuild|xcodegen/);
  assert.ok(firstBuild === -1 || lock < firstBuild, "the upload builds before it checks the licence");
});
