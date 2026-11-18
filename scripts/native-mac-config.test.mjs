import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The Mac app comes in two builds on this laptop (launch item 8):
//
//   - Debug, the everyday one, with no sandbox and the real app id, so the
//     owner's saved notes stay where they have always been;
//   - Release, sandboxed as the store requires, under its own app id
//     (com.bytesofpurpose.hifth.release), so it keeps its own data folder that
//     can be emptied for a true first open without touching the owner's.
//
// `CONFIG=Release` was once quietly ignored on the Mac, so a reviewer-style
// walk looked at the Debug build while saying it was the store one. These
// tests hold that every Mac command builds and opens the build it names.
const root = fileURLToPath(new URL("..", import.meta.url));
const RELEASE_ID = "com.bytesofpurpose.hifth.release";
const escape = (s) => s.replaceAll(".", "\\.");

/** What `make -n` would run: the plan, with none of it run. */
function plan(...args) {
  const r = spawnSync("make", ["-n", "-C", root, ...args], { encoding: "utf8" });
  return r.stdout + r.stderr;
}

for (const target of ["app-shot", "app-probe"]) {
  test(`${target} on the Mac with CONFIG=Release builds and opens the Release app, never the Debug one`, () => {
    const said = plan(target, "TARGET=mac", "CONFIG=Release");
    assert.match(said, /-scheme Hifth-macOS -configuration Release/, `${target} does not build the Release app\n${said}`);
    assert.match(said, new RegExp(`PRODUCT_BUNDLE_IDENTIFIER=${escape(RELEASE_ID)}\\b`), "the Release build does not get its own app id");
    assert.match(said, /Build\/Products\/Release\/Hifth\.app/, `${target} does not open the Release app`);
    assert.doesNotMatch(said, /Build\/Products\/Debug\/Hifth\.app/, `${target} opens the Debug app while asked for Release`);
    assert.doesNotMatch(said, /Mac app is built in Debug only/, "the old refusal is still there");
  });

  test(`${target} on the Mac still builds and opens the Debug app when CONFIG is left alone`, () => {
    const said = plan(target, "TARGET=mac");
    assert.match(said, /-scheme Hifth-macOS -configuration Debug/, `${target} no longer builds the Debug app\n${said}`);
    assert.match(said, /Build\/Products\/Debug\/Hifth\.app/, `${target} no longer opens the Debug app`);
    assert.doesNotMatch(said, /PRODUCT_BUNDLE_IDENTIFIER=/, "the Debug build must keep the real app id and the owner's saved data");
  });
}

// A sandboxed app may write only inside its own data folder (tried on
// 2026-11-17: a picture written outside it failed with "Operation not
// permitted"), so the Release picture is written there and copied out.
const INSIDE = new RegExp(`Library/Containers/${escape(RELEASE_ID)}/Data/tmp/`);

test("the Release picture is written inside the app's own data folder, then copied to where it was asked for", () => {
  const said = plan("app-shot", "TARGET=mac", "CONFIG=Release", "SHOT_OUT=/tmp/hifth-shot-test.png");
  assert.match(said, new RegExp(`HIFTH_SNAPSHOT_PATH=\\S*${INSIDE.source}`), `the picture is not written inside the app's folder\n${said}`);
  assert.match(said, /cp \S+ \/tmp\/hifth-shot-test\.png/, "the picture is not copied out to where it was asked for");
});

test("the Release probe's picture is written inside the app's own data folder too", () => {
  const said = plan("app-probe", "TARGET=mac", "CONFIG=Release", "PROBE_SHOT=/tmp/hifth-probe-test.png");
  assert.match(said, new RegExp(`HIFTH_PROBE_SHOT='\\S*${INSIDE.source}`), `the probe's picture is not written inside the app's folder\n${said}`);
  assert.match(said, /cp \S+ '?\/tmp\/hifth-probe-test\.png/, "the probe's picture is not copied out");
});

test("the Debug picture is still written straight where it was asked for", () => {
  const said = plan("app-shot", "TARGET=mac", "SHOT_OUT=/tmp/hifth-shot-test.png");
  assert.match(said, /HIFTH_SNAPSHOT_PATH=\/tmp\/hifth-shot-test\.png/);
  assert.doesNotMatch(said, INSIDE);
});

// The project: the sandbox is on for Release only, and the id the store sees
// is the real one. The suffix is added on the command line by the laptop's
// commands, never in the project, so the archive cannot pick it up.
const project = readFileSync(join(root, "native", "project.yml"), "utf8");
const macTarget = project.slice(project.indexOf("\n  Hifth-macOS:\n"), project.indexOf("\n  HifthTests"));

test("the Mac app's Release build is signed with the store's permissions, and Debug with none", () => {
  assert.ok(macTarget.length > 0, "the Mac target was not found in the project");
  assert.match(macTarget, /CODE_SIGN_ENTITLEMENTS: Hifth\/Resources\/Hifth-macOS\.entitlements/, "Debug lost its empty permissions file");
  assert.match(
    macTarget,
    /configs:\s*\n\s*Release:\s*\n\s*CODE_SIGN_ENTITLEMENTS: Hifth\/Resources\/Hifth-macOS-Store\.entitlements/,
    "the Release build is not signed with the store's permissions",
  );
});

test("the store's permissions file turns the sandbox on and asks only for the network, the files the reader picks, and Sign in with Apple", () => {
  const read = (name) =>
    JSON.parse(
      spawnSync("plutil", ["-convert", "json", "-o", "-", join(root, "native", "Hifth", "Resources", name)], { encoding: "utf8" }).stdout ||
        "null",
    );
  assert.deepEqual(read("Hifth-macOS-Store.entitlements"), {
    "com.apple.security.app-sandbox": true,
    "com.apple.security.network.client": true,
    "com.apple.security.files.user-selected.read-write": true,
    "com.apple.developer.applesignin": ["Default"],
  });
  // The everyday build is signed on the laptop with no profile from Apple. Sign in with Apple
  // needs one, so asking for it there would stop the app from opening.
  assert.deepEqual(read("Hifth-macOS.entitlements"), {}, "the everyday Debug build must stay out of the sandbox and ask for nothing");
  // The laptop's Release copy is signed on the laptop too, so it gets the store's permissions
  // minus Sign in with Apple; with it, Xcode refuses to build ("requires a provisioning profile",
  // 2026-11-18). Kept equal to the store's file otherwise, so the sandbox it tries is the real one.
  const { "com.apple.developer.applesignin": _signIn, ...storeWithoutSignIn } = read("Hifth-macOS-Store.entitlements");
  assert.deepEqual(read("Hifth-macOS-Laptop.entitlements"), storeWithoutSignIn, "the laptop's Release copy drifted from the store's permissions");
});

test("the laptop's Release copy is signed with its own permissions file; the store archive never is", () => {
  const makefile = readFileSync(join(root, "native", "Makefile.native"), "utf8");
  const idArg = makefile.match(/^MAC_ID_ARG\s*=.*$/m)?.[0] ?? "";
  assert.match(idArg, /CODE_SIGN_ENTITLEMENTS=Hifth\/Resources\/Hifth-macOS-Laptop\.entitlements/, "the laptop's Release copy is not given its own permissions file");
  const archive = makefile.slice(makefile.indexOf("\napp-archive:"), makefile.indexOf("\napp-export:"));
  assert.doesNotMatch(archive, /Laptop\.entitlements|MAC_ID_ARG/, "the store archive picks up the laptop's permissions file");
});

test("the app id the store sees stays the real one: the suffix lives only in the laptop's commands", () => {
  assert.doesNotMatch(project, new RegExp(escape(RELEASE_ID)), "the project names the laptop's Release id");
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER: com\.bytesofpurpose\.hifth\n/);
  const makefile = readFileSync(join(root, "native", "Makefile.native"), "utf8");
  const archive = makefile.slice(makefile.indexOf("\napp-archive:"), makefile.indexOf("\napp-export:"));
  assert.ok(archive.length > 0, "the archive recipe was not found");
  assert.doesNotMatch(archive, /PRODUCT_BUNDLE_IDENTIFIER|MAC_ID/, "the archive overrides the app id");
});
