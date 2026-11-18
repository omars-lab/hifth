import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// A store build can only carry a permission, such as Sign in with Apple, that
// its signing profile allows, and Apple writes that into the profile when the
// app's ID has the box ticked on Apple's site. On 2026-11-18 nobody could say
// whether the Mac store profile allowed Sign in with Apple, because reading a
// profile by hand prints the team id with everything else. This answers yes or
// no for one permission and prints the profile's name and kind, never a value.
const root = fileURLToPath(new URL("..", import.meta.url));
const script = join(root, "native/scripts/profile-allows.sh");

const run = (input, key) =>
  spawnSync("sh", [script, "-", key], { input, encoding: "utf8" });

// Made-up team id; the real one never goes in the repo.
const TEAM = "Q9Z8Y7X6W5";

const profile = ({ name, platform, devices, entitlements }) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Name</key>
  <string>${name}</string>
  <key>Platform</key>
  <array><string>${platform}</string></array>
  <key>TeamIdentifier</key>
  <array><string>${TEAM}</string></array>
  ${devices ? `<key>ProvisionedDevices</key><array>${devices.map((d) => `<string>${d}</string>`).join("")}</array>` : ""}
  <key>Entitlements</key>
  <dict>
    <key>com.apple.application-identifier</key>
    <string>${TEAM}.app.example.hifth</string>
    <key>com.apple.developer.team-identifier</key>
    <string>${TEAM}</string>
    ${entitlements}
  </dict>
</dict>
</plist>`;

const SIGN_IN = "com.apple.developer.applesignin";
const signIn = `<key>${SIGN_IN}</key><array><string>Default</string></array>`;

test("a Mac store profile that allows Sign in with Apple says yes, and its kind", () => {
  const out = run(profile({ name: "Made-up Mac store profile", platform: "OSX", entitlements: signIn }), SIGN_IN);
  assert.equal(out.status, 0, out.stdout);
  assert.match(out.stdout, /Made-up Mac store profile/);
  assert.match(out.stdout, /Mac/);
  assert.match(out.stdout, /store/);
  assert.match(out.stdout, /allows com\.apple\.developer\.applesignin: yes/);
});

test("a profile without the permission says no and fails, naming where to tick it", () => {
  const out = run(profile({ name: "Made-up Mac store profile", platform: "OSX", entitlements: "" }), SIGN_IN);
  assert.equal(out.status, 1);
  assert.match(out.stdout, /allows com\.apple\.developer\.applesignin: no/);
  assert.match(out.stdout, /Identifiers/);
});

test("a profile that lists devices is for development, not the store", () => {
  const out = run(
    profile({ name: "Made-up iPad profile", platform: "iOS", devices: ["MADE-UP-IPAD"], entitlements: signIn }),
    SIGN_IN,
  );
  assert.equal(out.status, 0, out.stdout);
  assert.match(out.stdout, /iPad and iPhone/);
  assert.match(out.stdout, /development/);
});

test("the team id never appears, whatever the answer", () => {
  for (const entitlements of [signIn, ""]) {
    const out = run(profile({ name: "Made-up", platform: "OSX", entitlements }), SIGN_IN);
    assert.doesNotMatch(out.stdout + out.stderr, new RegExp(TEAM));
  }
  const asked = run(profile({ name: "Made-up", platform: "OSX", entitlements: "" }), "com.apple.developer.team-identifier");
  assert.doesNotMatch(asked.stdout + asked.stderr, new RegExp(TEAM));
});

test("an unreadable profile fails with a plain message", () => {
  const out = run("", SIGN_IN);
  assert.equal(out.status, 2);
  assert.match(out.stdout, /cannot read/);
});
