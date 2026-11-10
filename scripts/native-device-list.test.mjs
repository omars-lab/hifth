// Apple lets a developer account register 100 devices of each kind a year, and
// a registered device keeps its slot until the year ends even if removed. The
// device list shows which devices our signing profiles carry, what kind each is,
// and how many slots of each kind are left at most, so adding a device is a
// choice made knowing what it costs.
//
// Profiles and Apple's device tool are stand-ins here, with made-up ids.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const script = join(root, ".claude/skills/add-device/scripts/device-list.mjs");

const profile = (name, devices) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Name</key><string>${name}</string>
  <key>ExpirationDate</key><date>2027-11-10T12:00:00Z</date>
  <key>ProvisionedDevices</key><array>${devices.map((d) => `<string>${d}</string>`).join("")}</array>
</dict></plist>`;

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "hifth-device-list-"));
  const profiles = join(dir, "profiles");
  mkdirSync(profiles);
  writeFileSync(join(profiles, "a.mobileprovision"), profile("Made-up profile A", ["MADE-UP-IPAD", "MADE-UP-WATCH", "MADE-UP-UNSEEN"]));
  writeFileSync(join(profiles, "b.mobileprovision"), profile("Made-up profile B", ["MADE-UP-IPAD"]));
  const devices = [
    { identifier: "C1", deviceProperties: { name: "Made-up iPad" }, hardwareProperties: { udid: "MADE-UP-IPAD", deviceType: "iPad", marketingName: "iPad Pro" } },
    { identifier: "C2", deviceProperties: { name: "Made-up Watch" }, hardwareProperties: { udid: "MADE-UP-WATCH", deviceType: "appleWatch", marketingName: "Apple Watch" } },
    { identifier: "C3", deviceProperties: { name: "Made-up iPhone" }, hardwareProperties: { udid: "MADE-UP-IPHONE", deviceType: "iPhone", marketingName: "iPhone" } },
  ];
  const bin = join(dir, "devicectl");
  writeFileSync(
    bin,
    `#!/usr/bin/env node
const a = process.argv.slice(2);
require("fs").writeFileSync(a[a.indexOf("--json-output") + 1], ${JSON.stringify(JSON.stringify({ result: { devices } }))});
`,
  );
  chmodSync(bin, 0o755);
  return { HIFTH_DEVICECTL: bin, HIFTH_PROFILES_DIR: profiles };
}

const run = (...extra) =>
  spawnSync(process.execPath, [script, ...extra], { encoding: "utf8", env: { ...process.env, ...setup() } });

test("lists each device on a profile once, with its kind and name", () => {
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /iPad\s+Made-up iPad/);
  assert.match(r.stdout, /Apple Watch\s+Made-up Watch/);
  assert.equal(r.stdout.match(/Made-up iPad/g).length, 1);
});

test("a device this Mac never saw is listed as not known, not dropped", () => {
  assert.match(run().stdout, /not known\s+not seen by this Mac/);
});

test("a device this Mac knows but no profile carries is not listed as registered", () => {
  assert.doesNotMatch(run().stdout, /Made-up iPhone/);
});

test("slots left are counted per kind, out of 100", () => {
  const r = run();
  assert.match(r.stdout, /iPad 99/);
  assert.match(r.stdout, /Apple Watch 99/);
  assert.match(r.stdout, /iPhone 100/);
  assert.match(r.stdout, /removed this year/);
});

test("the full ids only appear in the CSV, which has one row per device", () => {
  assert.doesNotMatch(run().stdout, /MADE-UP-IPAD/);
  const csv = run("--csv").stdout.trim().split("\n");
  assert.equal(csv[0], "kind,name,model,hardware_id,profiles");
  assert.equal(csv.length, 4);
  assert.ok(csv.some((l) => l.startsWith("iPad,Made-up iPad,iPad Pro,MADE-UP-IPAD,2")));
});

test("no profiles at all says so plainly", () => {
  const env = { ...process.env, ...setup(), HIFTH_PROFILES_DIR: mkdtempSync(join(tmpdir(), "hifth-empty-")) };
  const r = spawnSync(process.execPath, [script], { encoding: "utf8", env });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /no signing profiles/i);
});
