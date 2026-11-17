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

// The export signs through Xcode's own sign-in, which expires; the release
// setup check only sees that an account is listed. On 2026-11-17 the export
// died with "Your session has expired" buried in Xcode's log, so it now says
// in plain words what to do.
test("an export stopped by an expired Xcode sign-in says how to sign in again", () => {
  const said = plan("app-export", "public");
  assert.match(said, /xcodebuild -exportArchive [^\n]*tee [^\n]*export\.log/);
  assert.match(said, /grep -q "session has expired" [^\n]*export\.log/);
  assert.match(said, /Xcode > Settings > Accounts/);
});

test("the upload reads the receipt again after the export, just before sending", () => {
  const said = plan("app-testflight", "public");
  const sign = said.lastIndexOf("-exportArchive");
  const lastCheck = said.lastIndexOf("archive-receipt.mjs --check");
  const send = said.indexOf("upload: not built yet");
  assert.ok(sign >= 0 && send >= 0, "the plan has no export, or no upload step");
  assert.ok(lastCheck > sign && lastCheck < send, "no receipt check between the export and the upload");
});

// Apple's own check (launch item 42, owner's yes on 2026-11-17): the exported
// app goes to Apple to be checked, and nothing becomes a build anyone can
// install. So it is not behind the licence lock, but it takes only an export of
// an archive with a good receipt, and it only checks, never uploads.
test("Apple's check reads the receipt, then checks the exported app and uploads nothing", () => {
  const said = plan("app-store-check", "public");
  const receipt = said.search(/archive-receipt\.mjs --check [^\n]*Hifth\.xcarchive/);
  const send = said.search(/altool --validate-app [^\n]*Hifth\.ipa/);
  assert.ok(receipt >= 0, "the check never reads the receipt");
  assert.ok(send > receipt, "the app goes to Apple before the receipt is read");
  assert.doesNotMatch(said, /--upload-app|--upload-package/);
  assert.doesNotMatch(said, /Not yet/, "the check waits on the licence lock, which the owner lifted for it");
});

test("Apple's check refuses an export made before the archive, and says what to run", () => {
  const dir = mkdtempSync(join(tmpdir(), "store-"));
  const archive = join(dir, "Hifth.xcarchive");
  const exported = join(dir, "export");
  spawnSync("mkdir", ["-p", archive, exported]);
  writeFileSync(join(exported, "Hifth.ipa"), "");
  // The receipt is written after the export, as when the archive is made again.
  spawnSync("touch", ["-t", "202601010000", join(exported, "Hifth.ipa")]);
  writeFileSync(`${archive}.receipt.json`, "{}");
  const r = spawnSync("make", ["-s", "-C", root, "app-store-check", `ARCHIVE_PATH=${archive}`, `EXPORT_PATH=${exported}`], {
    encoding: "utf8",
  });
  const said = r.stdout + r.stderr;
  assert.notEqual(r.status, 0, said);
  assert.match(said, /Run: make app-export/);
  assert.doesNotMatch(said, /altool/);
});

test("the upload runs Apple's check after the export and before sending", () => {
  const said = plan("app-testflight", "public");
  const sign = said.lastIndexOf("-exportArchive");
  const check = said.indexOf("altool --validate-app");
  const send = said.indexOf("upload: not built yet");
  assert.ok(check > sign && check < send, "the upload does not run Apple's check between the export and the send");
});

test("the upload meets the licence lock before it archives or exports anything", () => {
  const said = plan("app-testflight", "public");
  const lock = said.indexOf("Not yet");
  assert.ok(lock >= 0, "the upload has no licence lock");
  const firstBuild = said.search(/xcodebuild|xcodegen/);
  assert.ok(firstBuild === -1 || lock < firstBuild, "the upload builds before it checks the licence");
});
