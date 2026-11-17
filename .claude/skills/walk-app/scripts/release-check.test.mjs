// The release check, run against stand-in app folders: a made-up Info.plist
// and a made-up "binary" that is just bytes with or without the capture's
// signs in it. The real builds are checked by `make app-release-check`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { KEYS, SIGNS, STORE_SIGNS } from "./release-check.mjs";

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

// The build made for the store also leaves out the launch settings the
// laptop's tools use. A plain Release build keeps them for the reviewer walk,
// so only --store looks for them.
const everyStoreSign = [...SIGNS, ...STORE_SIGNS].map(([, text]) => text).join("\0");

function archiveRun(releaseCode, { debugCode = everyStoreSign, store = true, permissions = IPAD_STORE_PERMISSIONS, extra = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "hifth-release-"));
  const debug = app(root, "debug", { keys: KEYS, binaries: { Hifth: debugCode } });
  const release = app(root, "release", { binaries: { Hifth: releaseCode } });
  // A stand-in folder cannot be signed, so the test hands in the permissions a
  // signature would carry, as the file the signing tool prints.
  const perms = join(root, "permissions.plist");
  if (permissions !== null) writeFileSync(perms, permissionsFile(permissions));
  return spawnSync(
    process.execPath,
    [SCRIPT, "--debug", debug, "--release", release, ...(store ? ["--store"] : []), ...(permissions !== null ? ["--permissions", perms] : []), ...extra],
    { encoding: "utf8" },
  );
}

// The iPad and iPhone store build is signed with the two permissions the owner
// said yes to on 2026-11-17, and the team's own signing marks. The id values
// are made up: a real one is never written into a test.
const MADE_UP_TEAM = "Q9Z8Y7X6W5";
const IPAD_STORE_PERMISSIONS = {
  "application-identifier": `${MADE_UP_TEAM}.com.example.hifth`,
  "com.apple.developer.team-identifier": MADE_UP_TEAM,
  "com.apple.developer.applesignin": ["Default"],
  "com.apple.developer.associated-domains": ["applinks:hifth.app"],
  "get-task-allow": true,
};

test("an iPad store build signed with the two chosen permissions passes, and prints no id", () => {
  const r = archiveRun("plain app code");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(!r.stdout.includes(MADE_UP_TEAM), "the team id was printed");
});

test("an iPad store build missing Sign in with Apple or the hifth.app links fails, saying which", () => {
  for (const [key, what] of [
    ["com.apple.developer.applesignin", /Sign in with Apple/],
    ["com.apple.developer.associated-domains", /hifth\.app links/],
  ]) {
    const { [key]: _, ...rest } = IPAD_STORE_PERMISSIONS;
    const r = archiveRun("plain app code", { permissions: rest });
    assert.equal(r.status, 1, `missing ${key} was not caught`);
    assert.ok(r.stdout.includes(key), r.stdout);
    assert.match(r.stdout, what);
  }
});

test("an iPad store build whose links name another site, or a second one, fails, naming it", () => {
  for (const domains of [["applinks:example.com"], ["applinks:hifth.app", "webcredentials:example.com"]]) {
    const r = archiveRun("plain app code", { permissions: { ...IPAD_STORE_PERMISSIONS, "com.apple.developer.associated-domains": domains } });
    assert.equal(r.status, 1, `${domains} was not caught`);
    assert.match(r.stdout, /example\.com/);
  }
});

test("an iPad store build whose Sign in with Apple is not the plain kind fails", () => {
  const r = archiveRun("plain app code", { permissions: { ...IPAD_STORE_PERMISSIONS, "com.apple.developer.applesignin": [] } });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /applesignin/);
});

test("an iPad store build asking for a permission nobody chose fails, by name", () => {
  const r = archiveRun("plain app code", { permissions: { ...IPAD_STORE_PERMISSIONS, "aps-environment": "production" } });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /aps-environment, which nobody chose/);
  assert.ok(!r.stdout.includes("production"), "a permission's value was printed");
});

test("an iPad store build without the team's signing marks fails: it was not signed for the store", () => {
  const { "application-identifier": _, "com.apple.developer.team-identifier": __, ...rest } = IPAD_STORE_PERMISSIONS;
  const r = archiveRun("plain app code", { permissions: rest });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /application-identifier/);
});

test("an iPad store build whose permissions cannot be read fails, rather than passing unread", () => {
  const r = archiveRun("plain app code", { permissions: null });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /permissions cannot be read/);
});

test("the debugger permission may stay in the archive, never in the exported app that is uploaded", () => {
  assert.equal(archiveRun("plain app code").status, 0);
  const exported = archiveRun("plain app code", { extra: ["--exported"] });
  assert.equal(exported.status, 1);
  assert.match(exported.stdout, /get-task-allow/);
  const clean = { ...IPAD_STORE_PERMISSIONS, "get-task-allow": false, "beta-reports-active": true };
  const r = archiveRun("plain app code", { permissions: clean, extra: ["--exported"] });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("a plain iPad release build, unsigned on the laptop, is not asked for permissions", () => {
  const r = archiveRun("plain app code", { store: false, permissions: null });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("a store build with none of the tools' launch settings passes", () => {
  const r = archiveRun("plain app code");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /ev=start .*store=yes/);
});

test("any of the tools' launch settings left in a store build fails, saying which", () => {
  for (const [what, text] of STORE_SIGNS) {
    const r = archiveRun(`code ${text} code`);
    assert.equal(r.status, 1, `"${text}" in the store build was not caught`);
    assert.ok(r.stdout.includes(what), `the failure says ${what}: ${r.stdout}`);
  }
});

test("a plain release build may keep the tools' launch settings: the reviewer walk uses them", () => {
  const r = archiveRun(STORE_SIGNS.map(([, text]) => text).join("\0"), { store: false });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("a debug build missing a launch setting's name fails the store check: not finding it would prove nothing", () => {
  const [, first] = STORE_SIGNS[0];
  const r = archiveRun("plain app code", { debugCode: everyStoreSign.replace(first, "") });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /out of date/);
  assert.ok(r.stdout.includes(first));
});

test("no launch setting's name is short enough for an optimized build to hide it", () => {
  for (const [, text] of STORE_SIGNS) assert.ok(Buffer.byteLength(text) > 15, `"${text}" is 15 bytes or less`);
});

test("another script can load the check without it running or crashing", () => {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", `import { check } from ${JSON.stringify(SCRIPT)}; console.log(typeof check);`], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), "function");
});

// The Mac app is laid out one folder down: its settings in Contents/Info.plist,
// its code in Contents/MacOS, its web part in Contents/Resources/WebBundle. The
// touch trail, Apple's screen recorder and the Files app settings are iPad
// only, so the Mac's Debug build has none of them and they are not looked for.
const MAC_SIGNS = SIGNS.filter(([, , , only]) => only !== "ipad");
const everyMacSign = [...MAC_SIGNS, ...STORE_SIGNS].map(([, text]) => text).join("\0");

function macApp(root, name, { binaries = { Hifth: "plain app code" }, inFolder = {} } = {}) {
  const at = join(root, name, "Hifth.app");
  mkdirSync(join(at, "Contents", "MacOS"), { recursive: true });
  mkdirSync(join(at, "Contents", "Resources", "WebBundle"), { recursive: true });
  writeFileSync(join(at, "Contents", "Info.plist"), plist([]));
  for (const [file, text] of Object.entries(binaries)) writeFileSync(join(at, "Contents", "MacOS", file), `\0\0${text}\0\0`);
  for (const [file, text] of Object.entries(inFolder)) {
    mkdirSync(dirname(join(at, "Contents", "Resources", "WebBundle", file)), { recursive: true });
    writeFileSync(join(at, "Contents", "Resources", "WebBundle", file), text);
  }
  return at;
}

function macRun(releaseOpts = {}, { debugCode = everyMacSign, permissions = STORE_PERMISSIONS, extra = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "hifth-release-"));
  const debug = macApp(root, "debug", { binaries: { Hifth: "stub", "Hifth.debug.dylib": debugCode } });
  const release = macApp(root, "release", releaseOpts);
  // Stand-in folders cannot be signed, so the test hands the check the
  // permissions a signature would carry, as the file the signing tool prints.
  const perms = join(root, "permissions.plist");
  if (permissions !== null) writeFileSync(perms, permissionsFile(permissions));
  return spawnSync(
    process.execPath,
    [SCRIPT, "--debug", debug, "--release", release, ...(permissions !== null ? ["--permissions", perms] : []), ...extra],
    { encoding: "utf8" },
  );
}

const STORE_PERMISSIONS = {
  "com.apple.security.app-sandbox": true,
  "com.apple.security.network.client": true,
  "com.apple.security.files.user-selected.read-write": true,
};

function permissionsFile(dict) {
  const value = (v) =>
    v === true
      ? "<true/>"
      : v === false
        ? "<false/>"
        : Array.isArray(v)
          ? `<array>${v.map((s) => `<string>${s}</string>`).join("")}</array>`
          : `<string>${v}</string>`;
  const entries = Object.entries(dict)
    .map(([k, v]) => `<key>${k}</key>${value(v)}`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>${entries}</dict></plist>`;
}

test("a clean Mac release build passes, against a Mac debug build with every sign the Mac has", () => {
  const r = macRun();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /ev=start .*platform=mac/);
});

test("on the Mac, a capture sign left in the release build fails, saying which", () => {
  for (const [what, text] of MAC_SIGNS) {
    const r = macRun({ binaries: { Hifth: `code ${text} code` } });
    assert.equal(r.status, 1, `"${text}" in the Mac release was not caught`);
    assert.ok(r.stdout.includes(what), `the failure says ${what}: ${r.stdout}`);
  }
});

test("on the Mac, a debug build missing a sign the Mac has fails as out of date", () => {
  const [, first] = MAC_SIGNS[0];
  const r = macRun({}, { debugCode: everyMacSign.replace(first, "") });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /out of date/);
});

test("the iPad-only signs are marked so, and the Mac keeps the rest", () => {
  const ipadOnly = SIGNS.filter(([, , , only]) => only === "ipad").map(([, text]) => text);
  assert.deepEqual(ipadOnly.sort(), ["ReplayKit.framework", "TouchTrailRecorder"]);
  assert.ok(MAC_SIGNS.length >= 5);
});

test("a Mac release build without the sandbox fails: the Mac store refuses it", () => {
  const { "com.apple.security.app-sandbox": _, ...rest } = STORE_PERMISSIONS;
  const r = macRun({}, { permissions: rest });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /sandbox/);
});

test("a Mac release build missing the network or the reader's files fails, saying which", () => {
  for (const key of ["com.apple.security.network.client", "com.apple.security.files.user-selected.read-write"]) {
    const { [key]: _, ...rest } = STORE_PERMISSIONS;
    const r = macRun({}, { permissions: rest });
    assert.equal(r.status, 1, `missing ${key} was not caught`);
    assert.ok(r.stdout.includes(key), r.stdout);
  }
});

test("a Mac release build asking for a permission nobody chose fails, by name", () => {
  const r = macRun({}, { permissions: { ...STORE_PERMISSIONS, "com.apple.security.device.camera": true } });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /com\.apple\.security\.device\.camera/);
});

test("the debugger permission may stay in a laptop build, never in a store one", () => {
  const withDebugger = { ...STORE_PERMISSIONS, "com.apple.security.get-task-allow": true };
  assert.equal(macRun({}, { permissions: withDebugger }).status, 0);
  const store = macRun({}, { permissions: withDebugger, extra: ["--store"] });
  assert.equal(store.status, 1);
  assert.match(store.stdout, /get-task-allow/);
});

test("the team's own signing marks are allowed in a store build", () => {
  const signed = { ...STORE_PERMISSIONS, "com.apple.application-identifier": "TEAM.com.example", "com.apple.developer.team-identifier": "TEAM" };
  const r = macRun({}, { permissions: signed, extra: ["--store"] });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("a Mac release build whose permissions cannot be read fails, rather than passing unread", () => {
  // No --permissions: the check asks the signing tool, and a stand-in folder is not signed.
  const r = macRun({}, { permissions: null });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /permissions cannot be read/);
});

test("on the Mac, the web part is read one folder down for the public build", () => {
  const root = mkdtempSync(join(tmpdir(), "hifth-release-"));
  const debug = macApp(root, "debug", { binaries: { Hifth: everyMacSign } });
  const release = macApp(root, "release", { inFolder: { ".hifth-web-flavour": "public\n" } });
  mkdirSync(join(release, "Contents", "Resources"), { recursive: true });
  writeFileSync(join(release, "Contents", "Resources", "PrivacyInfo.xcprivacy"), privacyFile());
  const perms = join(root, "permissions.plist");
  writeFileSync(perms, permissionsFile(STORE_PERMISSIONS));
  const r = spawnSync(process.execPath, [SCRIPT, "--debug", debug, "--release", release, "--permissions", perms, "--flavour", "public"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("a debug and a release build of different kinds are refused: one iPad, one Mac", () => {
  const root = mkdtempSync(join(tmpdir(), "hifth-release-"));
  const debug = app(root, "debug", { keys: KEYS, binaries: { Hifth: everySign } });
  const release = macApp(root, "release");
  const r = run(debug, release);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /one is an iPad app and the other a Mac app/);
});

test("a path that is not an app is refused, not passed", () => {
  const root = mkdtempSync(join(tmpdir(), "hifth-release-"));
  const debug = app(root, "debug", { keys: KEYS, binaries: { Hifth: everySign } });
  const r = run(debug, join(root, "nowhere", "Hifth.app"));
  assert.equal(r.status, 2);
  assert.match(r.stdout, /ev=error/);
});
