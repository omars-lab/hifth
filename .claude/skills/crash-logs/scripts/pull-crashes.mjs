#!/usr/bin/env node
// Copies the app's crash files off a plugged-in iPad and prints one line for
// each, saying what stopped the app. Used by hand (make app-crash-logs) and by
// the release command, which passes --since and --fail-on-new so that a crash
// written after it opened the app fails the release.
//
//   pull-crashes.mjs --device <id> --out <dir> [--since <ISO time>] [--fail-on-new]
//
// Exit 0: done (no new crash, or --fail-on-new not given).
// Exit 1: the iPad could not be reached or a file could not be copied.
// Exit 3: --fail-on-new and at least one crash newer than --since.
//
// HIFTH_DEVICECTL swaps Apple's device tool for a stand-in (the tests use one).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP_PREFIX = "Hifth";
const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const device = opt("--device");
const out = opt("--out");
const since = opt("--since");
const failOnNew = args.includes("--fail-on-new");

const now = () => new Date().toISOString();
const log = (ev, fields) =>
  console.log(`${now()} pid=${process.pid} ev=${ev} ${Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(" ")}`.trimEnd());
const quote = (s) => JSON.stringify(String(s ?? "").replace(/\s+/g, " ").trim());

if (!device || !out) {
  console.error("usage: pull-crashes.mjs --device <id> --out <dir> [--since <ISO time>] [--fail-on-new]");
  process.exit(2);
}
const sinceMs = since ? Date.parse(since) : -Infinity;
if (Number.isNaN(sinceMs)) {
  console.error(`--since is not a time: ${since}`);
  process.exit(2);
}

const devicectl = process.env.HIFTH_DEVICECTL;
const tool = (rest) =>
  devicectl
    ? spawnSync(devicectl, rest, { encoding: "utf8", timeout: 60_000 })
    : spawnSync("xcrun", ["devicectl", ...rest], { encoding: "utf8", timeout: 60_000 });

mkdirSync(out, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "hifth-crash-list-"));
const listFile = join(work, "list.json");
log("list_start", { device: "given" });
const listed = tool(["device", "info", "files", "--device", device, "--domain-type", "systemCrashLogs", "--json-output", listFile]);
if (listed.status !== 0 || !existsSync(listFile)) {
  log("error", { step: "list", msg: quote(`could not list the iPad's crash files: ${(listed.stderr || listed.error?.message || "").split("\n")[0]}`) });
  console.error("could not list the iPad's crash files. Is it plugged in, unlocked and trusted? (make app-devices shows what the laptop sees)");
  process.exit(1);
}
const files = (JSON.parse(readFileSync(listFile, "utf8")).result?.files ?? [])
  .filter((f) => f.name?.startsWith(`${APP_PREFIX}-`) && f.name.endsWith(".ips"))
  .filter((f) => Date.parse(f.metadata?.lastModDate ?? 0) > sinceMs)
  .sort((a, b) => Date.parse(a.metadata.lastModDate) - Date.parse(b.metadata.lastModDate));
rmSync(work, { recursive: true, force: true });

// The first frame past the exception machinery is the one that names the cause.
const MACHINERY = /^(__exceptionPreprocess|_userInfoForFileAndLine|objc_exception_throw|_objc_terminate|std::__terminate|__pthread_kill|pthread_kill|abort|__abort|-\[NSAssertionHandler .*\]|_NSIsNSString|__CFRunLoop.*)$/;

function describe(path) {
  const [head, ...rest] = readFileSync(path, "utf8").split("\n");
  const header = JSON.parse(head);
  const body = JSON.parse(rest.join("\n"));
  const ex = body.exception ?? {};
  const asi = Object.values(body.asi ?? {}).flat().join("; ");
  const images = body.usedImages ?? [];
  const frames = body.lastExceptionBacktrace?.length
    ? body.lastExceptionBacktrace
    : body.threads?.[body.faultingThread ?? 0]?.frames ?? [];
  const named = frames.filter((f) => f.symbol && !MACHINERY.test(f.symbol));
  const top = named[0] ?? frames[0];
  return {
    time: quote(header.timestamp),
    version: quote(`${header.app_version ?? "?"} (${header.build_version ?? "?"})`),
    os: quote(header.os_version),
    exception: `${ex.type ?? "?"}/${ex.signal ?? "?"}`,
    indicator: quote(body.termination?.indicator),
    abort: quote(asi),
    frame: quote(top ? `${images[top.imageIndex]?.name ?? "?"} ${top.symbol ?? "?"}` : ""),
    next: quote(named.slice(1, 4).map((f) => f.symbol).join(" < ")),
  };
}

let failed = false;
for (const f of files) {
  const dest = join(out, f.name);
  const fresh = !existsSync(dest);
  if (fresh) {
    const copied = tool(["device", "copy", "from", "--device", device, "--domain-type", "systemCrashLogs", "--source", f.relativePath ?? f.name, "--destination", dest]);
    if (copied.status !== 0 || !existsSync(dest)) {
      log("error", { step: "copy", file: f.name, msg: quote(copied.stderr?.split("\n")[0]) });
      failed = true;
      continue;
    }
  }
  try {
    log("crash", { file: f.name, copied: fresh ? "now" : "before", ...describe(dest) });
  } catch (e) {
    log("crash", { file: f.name, copied: fresh ? "now" : "before", msg: quote(`could not read it: ${e.message}`) });
  }
}
log("done", { since: since ?? "any", new: files.length, out: quote(out) });
if (failed) process.exit(1);
if (failOnNew && files.length > 0) {
  console.error(`${files.length} new crash report(s) on the iPad since ${since}. Read them in ${out}.`);
  process.exit(3);
}
