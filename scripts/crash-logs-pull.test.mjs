// The crash-log command copies the app's crash files off a plugged-in iPad and
// says, one line each, what stopped the app. The release command runs it after
// opening the app and fails when a new one appears (crash-logs skill).
//
// Apple's device tool is swapped for a stand-in here (HIFTH_DEVICECTL), with a
// made-up device id and a made-up crash file, so no iPad is needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readdirSync, existsSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const script = join(root, ".claude/skills/crash-logs/scripts/pull-crashes.mjs");
const DEVICE = "00000000-FAKE-4000-8000-000000000000";

function crashFile({ when }) {
  const header = { app_name: "Hifth", bundleID: "com.bytesofpurpose.hifth", os_version: "iPhone OS 18.5 (22F76)", timestamp: when };
  const body = {
    exception: { type: "EXC_CRASH", signal: "SIGABRT" },
    termination: { indicator: "Abort trap: 6" },
    asi: { "libsystem_c.dylib": ["abort() called"] },
    usedImages: [{ name: "CoreFoundation" }, { name: "UIKitCore" }, { name: "Hifth" }],
    lastExceptionBacktrace: [
      { imageIndex: 0, symbol: "__exceptionPreprocess" },
      { imageIndex: 0, symbol: "_userInfoForFileAndLine" },
      { imageIndex: 1, symbol: "-[UIGestureGraphEdge initWithLabel:sourceNode:targetNode:directed:]" },
      { imageIndex: 2, symbol: "made-up frame" },
    ],
    faultingThread: 0,
    threads: [{ frames: [{ imageIndex: 0, symbol: "abort" }] }],
  };
  return JSON.stringify(header) + "\n" + JSON.stringify(body);
}

// A fake `devicectl`: answers the file list and the copy from a folder.
function fakeDevice(files) {
  const dir = mkdtempSync(join(tmpdir(), "hifth-fake-ipad-"));
  const store = join(dir, "store");
  spawnSync("mkdir", [store]);
  const list = [];
  for (const [name, mod, text] of files) {
    writeFileSync(join(store, name), text);
    list.push({ name, relativePath: name, metadata: { lastModDate: mod } });
  }
  writeFileSync(join(dir, "list.json"), JSON.stringify({ result: { files: list } }));
  const bin = join(dir, "devicectl");
  writeFileSync(
    bin,
    `#!/usr/bin/env node
const a = process.argv.slice(2), at = (k) => a[a.indexOf(k) + 1], fs = require("fs");
if (a[a.indexOf("--device") + 1] !== ${JSON.stringify(DEVICE)}) { console.error("no such device"); process.exit(1); }
if (a.includes("info")) fs.copyFileSync(${JSON.stringify(join(dir, "list.json"))}, at("--json-output"));
else if (a.includes("copy")) fs.copyFileSync(${JSON.stringify(store)} + "/" + at("--source"), at("--destination"));
`,
  );
  chmodSync(bin, 0o755);
  return bin;
}

function run(bin, args) {
  return spawnSync(process.execPath, [script, "--device", DEVICE, ...args], {
    encoding: "utf8",
    env: { ...process.env, HIFTH_DEVICECTL: bin },
  });
}

const files = [
  ["Hifth-2026-11-10-132059.ips", "2026-11-10T19:20:59.000Z", crashFile({ when: "2026-11-10 13:20:59.00 -0600" })],
  ["Hifth-2026-11-10-135200.ips", "2026-11-10T19:52:00.000Z", crashFile({ when: "2026-11-10 13:52:00.00 -0600" })],
  ["SomeOtherApp-2026-11-10-140000.ips", "2026-11-10T20:00:00.000Z", "{}\n{}"],
];

test("copies only the app's crash files, and says what stopped it", () => {
  const out = mkdtempSync(join(tmpdir(), "hifth-crashes-"));
  const r = run(fakeDevice(files), ["--out", out]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readdirSync(out).sort(), ["Hifth-2026-11-10-132059.ips", "Hifth-2026-11-10-135200.ips"]);
  const lines = r.stdout.split("\n").filter((l) => l.includes("ev=crash"));
  assert.equal(lines.length, 2);
  assert.match(lines[0], /exception=EXC_CRASH\/SIGABRT/);
  assert.match(lines[0], /abort=.abort\(\) called/);
  assert.match(lines[0], /frame="UIKitCore -\[UIGestureGraphEdge/, "names the first frame past the throw");
  assert.match(r.stdout, /ev=done .*new=2/);
});

test("--since leaves out older crashes, and --fail-on-new fails when one is newer", () => {
  const out = mkdtempSync(join(tmpdir(), "hifth-crashes-"));
  const r = run(fakeDevice(files), ["--out", out, "--since", "2026-11-10T19:30:00Z", "--fail-on-new"]);
  assert.equal(r.status, 3);
  assert.deepEqual(readdirSync(out), ["Hifth-2026-11-10-135200.ips"]);
  assert.match(r.stdout, /ev=done .*new=1/);
});

test("no crash since the time given is a pass, and says so", () => {
  const out = mkdtempSync(join(tmpdir(), "hifth-crashes-"));
  const r = run(fakeDevice(files), ["--out", out, "--since", "2026-11-10T21:00:00Z", "--fail-on-new"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ev=done .*new=0/);
  assert.equal(existsSync(join(out, "Hifth-2026-11-10-135200.ips")), false);
});

test("a device that cannot be reached is a failure, not an empty pass", () => {
  const out = mkdtempSync(join(tmpdir(), "hifth-crashes-"));
  const r = spawnSync(process.execPath, [script, "--device", "not-plugged-in", "--out", out], {
    encoding: "utf8",
    env: { ...process.env, HIFTH_DEVICECTL: fakeDevice(files) },
  });
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /could not list/);
});
