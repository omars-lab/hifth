import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The Mac App Store build (launch item 8; the owner's yes to its archive and
// its new installer certificate, 2026-11-17). It follows the iPad and iPhone
// one step for step: only the public build, checked inside the archive, a
// receipt, the export reads it, and nothing is sent to Apple by the archive or
// the export. These tests ask make what it would run (`make -n`) and run none
// of it, except the two refusals, which stop before any build.
const root = fileURLToPath(new URL("..", import.meta.url));
const REFUSAL = /only the public build/;

function bundle(flavour) {
  const dir = mkdtempSync(join(tmpdir(), "bundle-"));
  if (flavour) writeFileSync(join(dir, ".hifth-web-flavour"), `${flavour}\n`);
  return dir;
}

function plan(target, flavour = "public") {
  const r = spawnSync("make", ["-n", "-C", root, target, `WEB_BUNDLE=${bundle(flavour)}`, "TEAM=ABCDE12345"], {
    encoding: "utf8",
  });
  // A command split over lines with a backslash is printed that way; join it.
  return (r.stdout + r.stderr).replace(/\\\n\s*/g, " ");
}

test("archiving the pitch build for the Mac stops at the flavour, before anything is built", () => {
  const r = spawnSync("make", ["-s", "-C", root, "app-archive-mac", `WEB_BUNDLE=${bundle("pitch")}`], { encoding: "utf8" });
  const said = r.stdout + r.stderr;
  assert.notEqual(r.status, 0);
  assert.match(said, REFUSAL);
  assert.doesNotMatch(said, /xcodebuild/);
});

test("the Mac archive is an Xcode archive of the Mac app, signed by the team, built for the store", () => {
  const said = plan("app-archive-mac");
  assert.match(said, /xcodebuild [^\n]*-scheme Hifth-macOS [^\n]*-configuration Release [^\n]*generic\/platform=macOS [^\n]*archive/);
  assert.match(said, /DEVELOPMENT_TEAM=ABCDE12345/);
  // The project signs the everyday Mac app ad hoc; only the archive is signed by the team.
  assert.match(said, /CODE_SIGN_STYLE=Automatic/);
  assert.match(said, /HIFTH_STORE_CONDITION=STORE archive/);
  assert.doesNotMatch(said, /Not yet/, "the archive stays on the laptop, so it does not wait on the licence");
});

test("the Mac archive keeps the real app id: the laptop's .release suffix never reaches it", () => {
  const makefile = spawnSync("cat", [join(root, "native/Makefile.native")], { encoding: "utf8" }).stdout;
  const recipe = makefile.slice(makefile.indexOf("\napp-archive-mac:"), makefile.indexOf("\napp-export-mac:"));
  assert.ok(recipe.length > 0, "the Mac archive recipe was not found");
  assert.doesNotMatch(recipe, /PRODUCT_BUNDLE_IDENTIFIER|MAC_ID/, "the Mac archive overrides the app id");
});

test("the Mac archive has its own place, so it never stands in for the iPad and iPhone one", () => {
  const mac = plan("app-archive-mac").match(/-archivePath (\S+)/)?.[1];
  const ipad = plan("app-archive").match(/-archivePath (\S+)/)?.[1];
  assert.ok(mac && ipad, "an archive path is missing");
  assert.notEqual(mac, ipad);
});

test("the Mac archive runs the Mac release check first, then checks the app inside the archive", () => {
  const said = plan("app-archive-mac");
  const before = said.search(/app-release-check [^\n]*TARGET=mac[^\n]*RELEASE_FLAVOUR=public|app-release-check [^\n]*RELEASE_FLAVOUR=public[^\n]*TARGET=mac/);
  const build = said.search(/xcodebuild [^\n]*-scheme Hifth-macOS [^\n]*archive/);
  const inside = said.search(/release-check\.mjs [^\n]*--release \S*store-mac\/Hifth\.xcarchive\/Products\/Applications\/Hifth\.app [^\n]*--flavour public [^\n]*--store/);
  assert.ok(before >= 0, "no Mac release check before the archive");
  assert.ok(build > before, "the archive is built before the Mac release check");
  assert.ok(inside > build, "the app inside the archive is not checked, or is checked before it exists");
});

test("the Mac archive writes its receipt last, naming the Mac command, and leaves no old one behind", () => {
  const said = plan("app-archive-mac");
  const inside = said.search(/release-check\.mjs [^\n]*store-mac\/Hifth\.xcarchive/);
  const receipt = said.search(/archive-receipt\.mjs --write \S*store-mac\/Hifth\.xcarchive [^\n]*--by "make app-archive-mac"/);
  assert.ok(receipt > inside && inside >= 0, "the receipt is written before the archive is checked, or not at all");
  assert.match(said, /rm -rf \S*store-mac\/Hifth\.xcarchive \S*store-mac\/Hifth\.xcarchive\.receipt\.json/);
});

// Xcode registers every Mac app it builds with macOS, so a hifth:// link could
// open the sandboxed store copy, with its own empty data, instead of the app
// the reader uses. The archive step takes the copy it built off that list.
test("the Mac archive takes its own copy off macOS's list of apps that open hifth:// links", () => {
  assert.match(plan("app-archive-mac"), /lsregister -u /);
});

test("the Mac export reads the receipt before it signs anything", () => {
  const said = plan("app-export-mac");
  const receipt = said.search(/archive-receipt\.mjs --check \S*store-mac\/Hifth\.xcarchive [^\n]*--by "make app-archive-mac"/);
  const sign = said.search(/xcodebuild -exportArchive -archivePath \S*store-mac\/Hifth\.xcarchive/);
  assert.ok(receipt >= 0, "the Mac export never reads the receipt");
  assert.ok(sign > receipt, "the Mac export signs before it reads the receipt");
  assert.match(said, /grep -q "session has expired"/);
  assert.match(said, /Xcode > Settings > Accounts/);
});

// The archive is signed for development; the export signs it again for the
// store, and that signing is what decides the debugger permission. So the app
// that would be sent, the one inside the package, is opened and checked too.
test("the Mac export opens the package it made and checks the app inside, which is what would be sent", () => {
  const said = plan("app-export-mac");
  const sign = said.search(/-exportArchive/);
  const open = said.search(/pkgutil --expand-full \S*store-mac\/export\/Hifth\.pkg /);
  const check = said.search(/release-check\.mjs [^\n]*--release \S*Payload\/Hifth\.app [^\n]*--flavour public [^\n]*--store/);
  assert.ok(open > sign, "the package is not opened after the export");
  assert.ok(check > open, "the app inside the package is not checked");
});

test("Apple's check of the Mac package reads the receipt first and uploads nothing", () => {
  const said = plan("app-store-check-mac");
  const receipt = said.search(/archive-receipt\.mjs --check \S*store-mac\/Hifth\.xcarchive/);
  const send = said.search(/altool --validate-app -f \S*store-mac\/export\/Hifth\.pkg -t macos/);
  assert.ok(receipt >= 0, "the check never reads the receipt");
  assert.ok(send > receipt, "the package goes to Apple before the receipt is read");
  assert.doesNotMatch(said, /--upload-app|--upload-package/);
});

test("Apple's check of the Mac package refuses one made before the archive, and says what to run", () => {
  const dir = mkdtempSync(join(tmpdir(), "store-mac-"));
  const archive = join(dir, "Hifth.xcarchive");
  const exported = join(dir, "export");
  spawnSync("mkdir", ["-p", archive, exported]);
  writeFileSync(join(exported, "Hifth.pkg"), "");
  spawnSync("touch", ["-t", "202601010000", join(exported, "Hifth.pkg")]);
  writeFileSync(`${archive}.receipt.json`, "{}");
  const r = spawnSync(
    "make",
    ["-s", "-C", root, "app-store-check-mac", `MAC_ARCHIVE_PATH=${archive}`, `MAC_EXPORT_PATH=${exported}`],
    { encoding: "utf8" },
  );
  const said = r.stdout + r.stderr;
  assert.notEqual(r.status, 0, said);
  assert.match(said, /Run: make app-export-mac/);
  assert.doesNotMatch(said, /altool/);
});
