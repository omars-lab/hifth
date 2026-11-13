// The release check, run against stand-in app folders: a made-up Info.plist
// and a made-up "binary" that is just bytes with or without the capture's
// signs in it. The real builds are checked by `make app-release-check`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { KEYS, SIGNS } from "./release-check.mjs";

const SCRIPT = new URL("./release-check.mjs", import.meta.url).pathname;

function plist(keys) {
  const entries = keys.map((k) => `<key>${k}</key><true/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleName</key><string>Hifth</string>${entries}</dict></plist>`;
}

/** A stand-in Hifth.app: `binaries` maps a top-level file name to the text in it. */
function app(root, name, { keys = [], binaries = { Hifth: "plain app code" }, inFolder = {} } = {}) {
  const at = join(root, name, "Hifth.app");
  mkdirSync(join(at, "WebBundle"), { recursive: true });
  writeFileSync(join(at, "Info.plist"), plist(keys));
  for (const [file, text] of Object.entries(binaries)) writeFileSync(join(at, file), `\0\0${text}\0\0`);
  for (const [file, text] of Object.entries(inFolder)) writeFileSync(join(at, "WebBundle", file), text);
  return at;
}

const everySign = SIGNS.map(([, text]) => text).join("\0");

function run(debug, release) {
  return spawnSync(process.execPath, [SCRIPT, "--debug", debug, "--release", release], { encoding: "utf8" });
}

test("a release build with none of it passes, against a debug build with all of it", () => {
  const root = mkdtempSync(join(tmpdir(), "hifth-release-"));
  // Since Xcode 15 a debug build keeps its code in a second file beside the app.
  const debug = app(root, "debug", { keys: KEYS, binaries: { Hifth: "stub", "Hifth.debug.dylib": everySign } });
  const release = app(root, "release");
  const r = run(debug, release);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /ev=done .*release_clean=yes/);
});

test("a file-sharing setting left in the release build fails, by name", () => {
  const root = mkdtempSync(join(tmpdir(), "hifth-release-"));
  const debug = app(root, "debug", { keys: KEYS, binaries: { Hifth: everySign } });
  const release = app(root, "release", { keys: ["UIFileSharingEnabled"] });
  const r = run(debug, release);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /UIFileSharingEnabled/);
  assert.match(r.stdout, /Files app/);
});

test("any sign of the capture code in the release build fails, saying which", () => {
  for (const [what, text] of SIGNS) {
    const root = mkdtempSync(join(tmpdir(), "hifth-release-"));
    const debug = app(root, "debug", { keys: KEYS, binaries: { Hifth: everySign } });
    const release = app(root, "release", { binaries: { Hifth: `code ${text} code` } });
    const r = run(debug, release);
    assert.equal(r.status, 1, `"${text}" in release was not caught`);
    assert.ok(r.stdout.includes(what), `the failure says ${what}: ${r.stdout}`);
  }
});

test("a debug build missing a sign fails too: looking for it in release would prove nothing", () => {
  const root = mkdtempSync(join(tmpdir(), "hifth-release-"));
  const [, first] = SIGNS[0];
  const debug = app(root, "debug", { keys: KEYS, binaries: { Hifth: everySign.replace(first, "") } });
  const release = app(root, "release");
  const r = run(debug, release);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /out of date/);
  assert.ok(r.stdout.includes(first));
});

test("no string sign is short enough for an optimized build to hide it in the machine code", () => {
  const strings = SIGNS.filter(([, , kind]) => kind === "string");
  assert.ok(strings.length > 0);
  for (const [, text] of strings) assert.ok(Buffer.byteLength(text) > 15, `"${text}" is 15 bytes or less`);
});

test("the web pages inside the app are not searched: only the app's own code", () => {
  const root = mkdtempSync(join(tmpdir(), "hifth-release-"));
  const debug = app(root, "debug", { keys: KEYS, binaries: { Hifth: everySign } });
  const release = app(root, "release", { inFolder: { "index.js": "walk-captures" } });
  assert.equal(run(debug, release).status, 0);
});

test("a path that is not an app is refused, not passed", () => {
  const root = mkdtempSync(join(tmpdir(), "hifth-release-"));
  const debug = app(root, "debug", { keys: KEYS, binaries: { Hifth: everySign } });
  const r = run(debug, join(root, "nowhere", "Hifth.app"));
  assert.equal(r.status, 2);
  assert.match(r.stdout, /ev=error/);
});
