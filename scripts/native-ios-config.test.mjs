import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { IPAD_NEEDS } from "../.claude/skills/walk-app/scripts/release-check.mjs";

// The iPad and iPhone app asks Apple for two permissions (launch item 9; the
// owner said yes to both on 2026-11-17): Sign in with Apple, and hifth.app
// links opening the app. These tests hold that the project signs every build
// of the app with them, that the file asks for those two and nothing else,
// and that the file and the release check agree on what is allowed.
const root = fileURLToPath(new URL("..", import.meta.url));
const project = readFileSync(join(root, "native", "project.yml"), "utf8");
const iosTarget = project.slice(project.indexOf("\n  Hifth-iOS:\n"), project.indexOf("\n  Hifth-macOS:\n"));

const readPlist = (name) =>
  JSON.parse(
    spawnSync("plutil", ["-convert", "json", "-o", "-", join(root, "native", "Hifth", "Resources", name)], { encoding: "utf8" }).stdout ||
      "null",
  );

test("the iPad and iPhone app is signed with its own permissions file", () => {
  assert.ok(iosTarget.length > 0, "the iPad and iPhone target was not found in the project");
  assert.match(iosTarget, /CODE_SIGN_ENTITLEMENTS: Hifth\/Resources\/Hifth-iOS\.entitlements/);
});

test("the permissions file asks for Sign in with Apple and hifth.app links, and nothing else", () => {
  assert.deepEqual(readPlist("Hifth-iOS.entitlements"), {
    "com.apple.developer.applesignin": ["Default"],
    "com.apple.developer.associated-domains": ["applinks:hifth.app"],
  });
});

test("the permissions file and the release check allow the same two, with the same values", () => {
  const file = readPlist("Hifth-iOS.entitlements");
  assert.deepEqual(Object.fromEntries(IPAD_NEEDS.map(([key, value]) => [key, value])), file);
});

test("the export opens the file that would be uploaded and checks the app inside it as the uploaded one", () => {
  const r = spawnSync("make", ["-n", "-C", root, "app-export"], { encoding: "utf8" });
  const said = r.stdout + r.stderr;
  assert.match(said, /unzip -q -o \S*Hifth\.ipa -d \S*opened/, "the export does not open the uploaded file");
  const afterOpen = said.slice(said.search(/unzip -q -o/));
  assert.match(afterOpen, /release-check\.mjs/, "nothing checks the app after the file is opened");
  assert.match(afterOpen, /--release \S*opened\/Payload\/Hifth\.app[^\n]*--exported/, "the app inside it is not checked as the uploaded one");
});
