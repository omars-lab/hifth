#!/usr/bin/env node
// The last step of `make app-release-ipad`: open the freshly installed app on
// the plugged-in iPad with its output saved, watch it, and fail when
//   - the app closes by itself during the watch,
//   - its output shows an error nobody caught ("Terminating app due to …"),
//   - or a new Hifth crash report appears on the iPad (crash-logs skill).
// The crash that reached the owner's hands (docs/issues/ipad-crash-on-verse-touch.md)
// printed the second and left the third.
//
//   release-watch.mjs --device <id> --route <route> --log <file> --out <crash dir> [--watch <seconds>] [--unlock-wait <seconds>]
//
// --unlock-wait: how long to wait for a locked iPad to be unlocked, trying the
// launch again every 5 seconds (default 180; HIFTH_UNLOCK_RETRY_MS shortens it in tests).
//
// Exit 0 pass · 1 the app closed, threw, or the iPad could not be reached · 3 new crash report.
// HIFTH_DEVICECTL swaps Apple's device tool for a stand-in (the tests use one).
// The watch counts from the app's first line of output, not from when the device tool was
// started, so a tool that is slow to start cannot use the watch up before the app has said
// anything (docs/issues/release-watch-counted-from-the-wrong-moment.md). A tool that prints
// nothing is waited for 30 seconds first; HIFTH_START_WAIT_MS shortens that in tests.
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, readFileSync } from "node:fs";
import { join } from "node:path";

const BUNDLE_ID = "com.bytesofpurpose.hifth";
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const device = opt("--device");
const route = opt("--route", "");
const logFile = opt("--log");
const out = opt("--out");
const watchSeconds = Number(opt("--watch", "60"));
const unlockWait = Number(opt("--unlock-wait", "180"));
const retryMs = Number(process.env.HIFTH_UNLOCK_RETRY_MS || 5000);
// How long a device tool that prints nothing is waited for before the watch starts.
const startWaitMs = Number(process.env.HIFTH_START_WAIT_MS || 30_000);
if (!device || !logFile || !out || !(watchSeconds > 0)) {
  console.error("usage: release-watch.mjs --device <id> --route <route> --log <file> --out <crash dir> [--watch <seconds>]");
  process.exit(2);
}

const log = (ev, fields = {}) =>
  console.log(`${new Date().toISOString()} pid=${process.pid} ev=${ev} ${Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(" ")}`.trimEnd());

const devicectl = process.env.HIFTH_DEVICECTL;
const cmd = devicectl ? devicectl : "xcrun";
const launchArgs = ["device", "process", "launch", "--console", "--terminate-existing", "--device", device, BUNDLE_ID];

// A little before the launch, so a crash in the first second still counts.
const since = new Date(Date.now() - 2000).toISOString();

// One launch with its output saved; resolves to whether it closed early.
async function launchOnce() {
  const sink = createWriteStream(logFile);
  const child = spawn(cmd, devicectl ? launchArgs : ["devicectl", ...launchArgs], {
    env: { ...process.env, DEVICECTL_CHILD_HIFTH_ROUTE: route },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(sink, { end: false });
  child.stderr.pipe(sink, { end: false });
  const exited = new Promise((resolve) => child.on("exit", (code) => resolve(code)));
  // The watch counts from the first line of output, not from the moment the
  // device tool is started: on a busy laptop the tool took longer to start than
  // a short watch lasted, and an error it then printed was never seen
  // (2026-11-11). A tool that prints nothing is watched from startWaitMs on.
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const spoke = new Promise((resolve) => {
    child.stdout.once("data", resolve);
    child.stderr.once("data", resolve);
  });
  const finished = await Promise.race([
    exited.then((code) => ({ code })),
    Promise.race([spoke, sleep(startWaitMs)]).then(() => sleep(watchSeconds * 1000)).then(() => null),
  ]);
  if (finished) log("launch_exit", { code: finished.code, after: "early" });
  else {
    child.kill("SIGINT");
    await Promise.race([exited, new Promise((r) => setTimeout(r, 3000))]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  await new Promise((r) => sink.end(r));
  return Boolean(finished);
}
const lockedOut = (text) => /failed to launch|Unable to launch/i.test(text) && /unlocked|Locked/.test(text);

// The build takes long enough for the iPad to lock itself, so a locked iPad
// is waited for (saying so once), not given up on at the first try.
log("launch_start", { route: route || "none", watch: watchSeconds, log: JSON.stringify(logFile) });
const waitUntil = Date.now() + unlockWait * 1000;
let closedEarly = await launchOnce();
let said = false;
while (closedEarly && lockedOut(readFileSync(logFile, "utf8")) && Date.now() < waitUntil) {
  if (!said) {
    log("unlock_wait", { seconds: unlockWait });
    console.error(`The iPad is locked. Unlock it; waiting up to ${unlockWait} seconds, then the app opens by itself.`);
    said = true;
  }
  await new Promise((r) => setTimeout(r, retryMs));
  closedEarly = await launchOnce();
}

const text = readFileSync(logFile, "utf8");
let failed = false;
if (/Terminating app due to uncaught exception|uncaught exception of type/i.test(text)) {
  const line = text.split("\n").find((l) => /uncaught exception/i.test(l));
  log("fail", { why: "uncaught", msg: JSON.stringify(line.trim().slice(0, 300)) });
  console.error(`The app's output shows an uncaught error: ${line.trim()}`);
  failed = true;
}
// devicectl gave up before the app ever opened: say that, not "it closed".
const neverOpened = closedEarly && /failed to launch|Unable to launch/i.test(text);
if (neverOpened) {
  const locked = lockedOut(text);
  log("fail", { why: "not_opened", locked });
  console.error(
    locked
      ? `Could not open the app: the iPad stayed locked for ${unlockWait} seconds. Unlock it and run again (installed already). Output in ${logFile}.`
      : `Could not open the app on the iPad. Devicectl's reason is in ${logFile}.`,
  );
  failed = true;
} else if (closedEarly) {
  log("fail", { why: "closed", msg: JSON.stringify(`the app closed by itself before the ${watchSeconds}s watch ended`) });
  console.error(`The app closed by itself before the ${watchSeconds}-second watch ended. Its output is in ${logFile}.`);
  failed = true;
}

const pull = spawnSync(
  process.execPath,
  [join(new URL("../..", import.meta.url).pathname, ".claude/skills/crash-logs/scripts/pull-crashes.mjs"),
    "--device", device, "--out", out, "--since", since, "--fail-on-new"],
  { encoding: "utf8", env: process.env, timeout: 120_000 },
);
process.stdout.write(pull.stdout ?? "");
process.stderr.write(pull.stderr ?? "");

if (pull.status === 3) {
  log("watch_done", { result: "fail", why: "new_crash_report" });
  process.exit(3);
}
if (pull.status !== 0) failed = true;
log("watch_done", { result: failed ? "fail" : "pass" });
process.exit(failed ? 1 : 0);
