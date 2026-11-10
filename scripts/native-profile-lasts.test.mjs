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

const profile = (made, ends) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CreationDate</key>
  <date>${made}</date>
  <key>ExpirationDate</key>
  <date>${ends}</date>
  <key>Name</key>
  <string>Made-up profile</string>
</dict>
</plist>`;

test("a profile that lasts a year lets the install go on, and says how long", () => {
  const out = spawnSync("sh", [script, "-"], {
    input: profile("2026-11-09T12:00:00Z", "2027-11-09T12:00:00Z"),
    encoding: "utf8",
  });
  assert.equal(out.status, 0, out.stdout);
  assert.match(out.stdout, /365 days/);
});

test("a profile that lasts 7 days stops the install, saying a free team signed it", () => {
  const out = spawnSync("sh", [script, "-"], {
    input: profile("2026-11-09T12:00:00Z", "2026-11-16T12:00:00Z"),
    encoding: "utf8",
  });
  assert.equal(out.status, 1);
  assert.match(out.stdout, /7 days/);
  assert.match(out.stdout, /Personal Team/);
});

test("an app with no readable profile stops the install", () => {
  const out = spawnSync("sh", [script, "-"], { input: "", encoding: "utf8" });
  assert.equal(out.status, 1);
});
