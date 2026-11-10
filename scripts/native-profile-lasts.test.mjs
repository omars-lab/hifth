import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// An app built for a real iPad carries the signing profile Apple gave it. A
// profile from a free "Personal Team" stops the app opening after 7 days; a
// paid team's lasts a year. The iPad shown in the pitch must not expire the
// week of the meeting, so the install reads the profile's dates first.
//
// Why here and not in Xcode's settings: on 2026-11-09 Xcode's Accounts screen
// showed the paid Developer Team while its saved settings still said
// "Personal Team", so a check on the settings stopped a good install. The
// profile is what the iPad itself will go by.
const root = fileURLToPath(new URL("..", import.meta.url));
const script = join(root, "native/scripts/profile-lasts.sh");

// The check counts from today, so a profile Xcode reuses months later is
// judged by what it has left. PROFILE_NOW stands in for today in the tests.
const run = (input, now, device) =>
  spawnSync("sh", [script, "-", ...(device ? [device] : [])], {
    input,
    encoding: "utf8",
    env: { ...process.env, PROFILE_NOW: now },
  });

const profile = (made, ends, devices = []) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CreationDate</key>
  <date>${made}</date>
  <key>ExpirationDate</key>
  <date>${ends}</date>
  <key>ProvisionedDevices</key>
  <array>${devices.map((d) => `<string>${d}</string>`).join("")}</array>
  <key>Name</key>
  <string>Made-up profile</string>
</dict>
</plist>`;

test("a profile that lasts a year lets the install go on, and says how long", () => {
  const out = run(profile("2026-11-09T12:00:00Z", "2027-11-09T12:00:00Z"), "2026-11-09T12:00:00Z");
  assert.equal(out.status, 0, out.stdout);
  assert.match(out.stdout, /365 days/);
});

test("a profile that lasts 7 days stops the install, saying a free team signed it", () => {
  const out = run(profile("2026-11-09T12:00:00Z", "2026-11-16T12:00:00Z"), "2026-11-09T12:00:00Z");
  assert.equal(out.status, 1);
  assert.match(out.stdout, /7 days/);
  assert.match(out.stdout, /Personal Team/);
});

test("a paid team's profile made long ago, with under 30 days left, stops the install", () => {
  const out = run(profile("2025-12-01T12:00:00Z", "2026-12-01T12:00:00Z"), "2026-11-09T12:00:00Z");
  assert.equal(out.status, 1);
  assert.match(out.stdout, /22 days/);
  assert.doesNotMatch(out.stdout, /Personal Team/);
});

// On 2026-11-10 the install built for "any iPad", so Xcode never added the
// plugged-in iPad to the profile, and the iPad refused it ("This provisioning
// profile cannot be installed on this device") only after a full build.
test("a profile that does not list the plugged-in iPad stops the install, naming the fix", () => {
  const out = run(
    profile("2026-11-10T12:00:00Z", "2027-11-10T12:00:00Z", ["MADE-UP-OTHER-1", "MADE-UP-OTHER-2"]),
    "2026-11-10T12:00:00Z",
    "MADE-UP-THIS-IPAD",
  );
  assert.equal(out.status, 1);
  assert.match(out.stdout, /does not list this iPad/);
});

test("a profile that lists the plugged-in iPad lets the install go on", () => {
  const out = run(
    profile("2026-11-10T12:00:00Z", "2027-11-10T12:00:00Z", ["MADE-UP-OTHER-1", "MADE-UP-THIS-IPAD"]),
    "2026-11-10T12:00:00Z",
    "MADE-UP-THIS-IPAD",
  );
  assert.equal(out.status, 0, out.stdout);
});

test("an app with no readable profile stops the install", () => {
  const out = spawnSync("sh", [script, "-"], { input: "", encoding: "utf8" });
  assert.equal(out.status, 1);
});
