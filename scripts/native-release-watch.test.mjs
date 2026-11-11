// The iPad release command opens the freshly installed app with its output
// saved, watches it for a while, and fails when the app closes by itself, when
// its output shows an error nobody caught, or when a new crash report appears
// on the iPad (docs/issues/ipad-crash-on-verse-touch.md: the crash that reached
// the owner's hands would have failed all three).
//
// Apple's device tool is a stand-in here (HIFTH_DEVICECTL) with a made-up
// device id, so no iPad is needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const script = join(root, "native/scripts/release-watch.mjs");
const DEVICE = "00000000-FAKE-4000-8000-000000000000";

const CRASH = JSON.stringify({ app_name: "Hifth", timestamp: "made up" }) + "\n" +
  JSON.stringify({ exception: { type: "EXC_CRASH", signal: "SIGABRT" }, asi: {}, usedImages: [], lastExceptionBacktrace: [] });

// behaviour: "calm" keeps running and prints a line; "throws" prints an
// uncaught-exception line; "quits" exits at once; "crash-file" keeps running
// but leaves a new crash report on the device.
function fakeDevice(behaviour) {
  const dir = mkdtempSync(join(tmpdir(), "hifth-fake-ipad-"));
  mkdirSync(join(dir, "store"));
  writeFileSync(join(dir, "list.json"), JSON.stringify({ result: { files: [] } }));
  const bin = join(dir, "devicectl");
  writeFileSync(
    bin,
    `#!/usr/bin/env node
const a = process.argv.slice(2), at = (k) => a[a.indexOf(k) + 1], fs = require("fs");
const dir = ${JSON.stringify(dir)};
if (at("--device") !== ${JSON.stringify(DEVICE)}) { console.error("no such device"); process.exit(1); }
const tries = a.includes("launch") ? (fs.existsSync(dir + "/tries") ? Number(fs.readFileSync(dir + "/tries", "utf8")) : 0) + 1 : 0;
if (tries) fs.writeFileSync(dir + "/tries", String(tries));
const stillLocked = ${JSON.stringify(behaviour)} === "locked" || (${JSON.stringify(behaviour)} === "unlocked-later" && tries <= 2);
if (a.includes("launch") && stillLocked) {
  console.log("ERROR: The application failed to launch. Unable to launch com.bytesofpurpose.hifth because the device was not, or could not be, unlocked.");
  process.exit(1);
} else if (a.includes("launch")) {
  console.log("Launched application with com.bytesofpurpose.hifth bundle identifier.");
  console.log("route=" + process.env.DEVICECTL_CHILD_HIFTH_ROUTE + " console=" + a.includes("--console"));
  const b = ${JSON.stringify(behaviour)};
  if (b === "quits") process.exit(0);
  if (b === "throws") console.log("*** Terminating app due to uncaught exception 'NSInternalInconsistencyException', reason: 'made up'");
  if (b === "crash-file") {
    fs.writeFileSync(dir + "/store/Hifth-made-up.ips", ${JSON.stringify(CRASH)});
    fs.writeFileSync(dir + "/list.json", JSON.stringify({ result: { files: [{ name: "Hifth-made-up.ips", metadata: { lastModDate: new Date(Date.now() + 1000).toISOString() } }] } }));
  }
  setInterval(() => {}, 1000);
} else if (a.includes("info")) fs.copyFileSync(dir + "/list.json", at("--json-output"));
else if (a.includes("copy")) fs.copyFileSync(dir + "/store/" + at("--source"), at("--destination"));
`,
  );
  chmodSync(bin, 0o755);
  return bin;
}

function run(behaviour, extra = ["--unlock-wait", "1"]) {
  const work = mkdtempSync(join(tmpdir(), "hifth-release-"));
  const logFile = join(work, "console.log");
  const r = spawnSync(
    process.execPath,
    [script, "--device", DEVICE, "--route", "/made-up/1:1", "--log", logFile, "--out", join(work, "crashes"), "--watch", "2", ...extra],
    { encoding: "utf8", env: { ...process.env, HIFTH_DEVICECTL: fakeDevice(behaviour), HIFTH_UNLOCK_RETRY_MS: "200" }, timeout: 30_000 },
  );
  return { ...r, log: readFileSync(logFile, "utf8") };
}

test("a calm launch passes, with the app's output saved and the route passed on", () => {
  const r = run("calm");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.log, /route=\/made-up\/1:1 console=true/);
  assert.match(r.stdout, /ev=watch_done .*result=pass/);
});

test("an error nobody caught in the app's output fails it", () => {
  const r = run("throws");
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /uncaught/);
});

test("the app closing by itself during the watch fails it", () => {
  const r = run("quits");
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /closed by itself/);
});

test("a new crash report on the iPad fails it", () => {
  const r = run("crash-file");
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stdout, /ev=crash file=Hifth-made-up.ips/);
});

test("a locked iPad says the app could not be opened, not that it closed", () => {
  const r = run("locked");
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /could not open the app.*unlock/is);
  assert.doesNotMatch(r.stdout + r.stderr, /closed by itself/);
});

// The build takes long enough for the iPad to lock itself (2026-11-10), so the
// release waits for someone to unlock it rather than giving up at once.
test("a locked iPad is waited for, and the app opens once it is unlocked", () => {
  const r = run("unlocked-later", ["--unlock-wait", "20"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /locked.*unlock it/is);
  assert.equal((r.stdout.match(/ev=unlock_wait /g) ?? []).length, 1, "says it is waiting once, not on every try");
  assert.match(r.stdout, /ev=watch_done .*result=pass/);
});
