// The install names the iPad the way the owner does (its name, or the id Apple's
// device tool prints), but the signing profile lists iPads by their hardware id.
// This finds the hardware id for whichever name was given, so the install can
// check the profile lists that iPad before it spends a build on it.
//
// Apple's device tool is a stand-in here (HIFTH_DEVICECTL) with made-up ids.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const script = join(root, "native/scripts/device-udid.mjs");

function fakeDevicectl(devices) {
  const dir = mkdtempSync(join(tmpdir(), "hifth-fake-devicectl-"));
  const bin = join(dir, "devicectl");
  writeFileSync(
    bin,
    `#!/usr/bin/env node
const a = process.argv.slice(2);
require("fs").writeFileSync(a[a.indexOf("--json-output") + 1], ${JSON.stringify(JSON.stringify({ result: { devices } }))});
`,
  );
  chmodSync(bin, 0o755);
  return bin;
}

const DEVICES = [
  { identifier: "MADE-UP-COREDEVICE-1", deviceProperties: { name: "Made-up iPad" }, hardwareProperties: { udid: "MADE-UP-HARDWARE-1" } },
  { identifier: "MADE-UP-COREDEVICE-2", deviceProperties: { name: "Made-up iPhone" }, hardwareProperties: { udid: "MADE-UP-HARDWARE-2" } },
];

const run = (device) =>
  spawnSync(process.execPath, [script, "--device", device], {
    encoding: "utf8",
    env: { ...process.env, HIFTH_DEVICECTL: fakeDevicectl(DEVICES) },
  });

test("finds the hardware id from the iPad's name", () => {
  const r = run("Made-up iPad");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), "MADE-UP-HARDWARE-1");
});

test("finds it from the id the device tool prints, and from the hardware id itself", () => {
  assert.equal(run("MADE-UP-COREDEVICE-2").stdout.trim(), "MADE-UP-HARDWARE-2");
  assert.equal(run("MADE-UP-HARDWARE-1").stdout.trim(), "MADE-UP-HARDWARE-1");
});

test("a device that is not connected stops with a plain message", () => {
  const r = run("Nobody's iPad");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no device called "Nobody's iPad"/);
});
