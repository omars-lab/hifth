// The release check, run against stand-in app folders: a made-up Info.plist
// and a made-up "binary" that is just bytes with or without the capture's
// signs in it. The real builds are checked by `make app-release-check`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
  for (const [file, text] of Object.entries(inFolder)) {
    mkdirSync(dirname(join(at, "WebBundle", file)), { recursive: true });
    writeFileSync(join(at, "WebBundle", file), text);
  }
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

// A store build must be the public one. The copy step leaves a one-word file in
// the web folder saying which build it is, and that file ships inside the app,
// so the check reads it from the built app: the thing that would be uploaded.
//
// A store build must also carry Apple's privacy file. Apple refuses an upload
// without one, so the check reads it from the built app, the same way.
function privacyFile({ tracking = false, domains = [], apis = [] } = {}) {
  const api = apis
    .map(
      ({ type, reasons }) =>
        `<dict><key>NSPrivacyAccessedAPIType</key><string>${type}</string><key>NSPrivacyAccessedAPITypeReasons</key><array>${reasons
          .map((r) => `<string>${r}</string>`)
          .join("")}</array></dict>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>NSPrivacyTracking</key><${tracking}/>
<key>NSPrivacyTrackingDomains</key><array>${domains.map((d) => `<string>${d}</string>`).join("")}</array>
<key>NSPrivacyCollectedDataTypes</key><array/>
<key>NSPrivacyAccessedAPITypes</key><array>${api}</array>
</dict></plist>`;
}

function storeRun(release, { privacy = privacyFile() } = {}) {
  const root = mkdtempSync(join(tmpdir(), "hifth-release-"));
  const debug = app(root, "debug", { keys: KEYS, binaries: { Hifth: everySign } });
  const at = app(root, "release", release);
  if (privacy !== null) writeFileSync(join(at, "PrivacyInfo.xcprivacy"), privacy);
  return spawnSync(process.execPath, [SCRIPT, "--debug", debug, "--release", at, "--flavour", "public"], {
    encoding: "utf8",
  });
}

const PUBLIC = { inFolder: { ".hifth-web-flavour": "public\n" } };

test("asked for the public build, a release app that says public passes", () => {
  const r = storeRun(PUBLIC);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("a store build with no privacy file fails, saying Apple refuses it", () => {
  const r = storeRun(PUBLIC, { privacy: null });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /no privacy file/);
});

test("a store build whose privacy file says it tracks people fails", () => {
  const r = storeRun(PUBLIC, { privacy: privacyFile({ tracking: true }) });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /says the app tracks people/);
});

test("a store build whose privacy file names a tracking address fails, by name", () => {
  const r = storeRun(PUBLIC, { privacy: privacyFile({ domains: ["ads.example.com"] }) });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /ads\.example\.com/);
});

test("a system feature listed with no reason fails, by name; one with a reason passes", () => {
  const bare = storeRun(PUBLIC, { privacy: privacyFile({ apis: [{ type: "NSPrivacyAccessedAPICategoryUserDefaults", reasons: [] }] }) });
  assert.equal(bare.status, 1);
  assert.match(bare.stdout, /NSPrivacyAccessedAPICategoryUserDefaults/);
  const given = storeRun(PUBLIC, { privacy: privacyFile({ apis: [{ type: "NSPrivacyAccessedAPICategoryUserDefaults", reasons: ["CA92.1"] }] }) });
  assert.equal(given.status, 0, given.stdout + given.stderr);
});

test("a privacy file that is not a readable list fails, rather than passing unread", () => {
  const r = storeRun(PUBLIC, { privacy: "not a plist" });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /cannot be read/);
});

test("the Mac app keeps its privacy file one folder down, and that is found too", () => {
  const root = mkdtempSync(join(tmpdir(), "hifth-release-"));
  const debug = app(root, "debug", { keys: KEYS, binaries: { Hifth: everySign } });
  const at = app(root, "release", PUBLIC);
  mkdirSync(join(at, "Contents", "Resources"), { recursive: true });
  writeFileSync(join(at, "Contents", "Resources", "PrivacyInfo.xcprivacy"), privacyFile());
  const r = spawnSync(process.execPath, [SCRIPT, "--debug", debug, "--release", at, "--flavour", "public"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("asked for the public build, a release app that says pitch fails, by name", () => {
  const r = storeRun({ inFolder: { ".hifth-web-flavour": "pitch\n" } });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /pitch build/);
});

test("asked for the public build, a release app that does not say which it is fails", () => {
  const r = storeRun({});
  assert.equal(r.status, 1);
  assert.match(r.stdout, /does not say which build/);
});

test("asked for the public build, a private folder inside the app fails even when it says public", () => {
  const r = storeRun({ inFolder: { ".hifth-web-flavour": "public\n", "assets/private/1.json": "{}" } });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /private folder/);
});

test("not asked, the flavour is not looked at: the check still runs on a laptop holding the pitch build", () => {
  const root = mkdtempSync(join(tmpdir(), "hifth-release-"));
  const debug = app(root, "debug", { keys: KEYS, binaries: { Hifth: everySign } });
  const release = app(root, "release", { inFolder: { ".hifth-web-flavour": "pitch\n" } });
  assert.equal(run(debug, release).status, 0);
});

test("another script can load the check without it running or crashing", () => {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", `import { check } from ${JSON.stringify(SCRIPT)}; console.log(typeof check);`], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), "function");
});

test("a path that is not an app is refused, not passed", () => {
  const root = mkdtempSync(join(tmpdir(), "hifth-release-"));
  const debug = app(root, "debug", { keys: KEYS, binaries: { Hifth: everySign } });
  const r = run(debug, join(root, "nowhere", "Hifth.app"));
  assert.equal(r.status, 2);
  assert.match(r.stdout, /ev=error/);
});
