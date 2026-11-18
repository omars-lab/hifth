#!/usr/bin/env node
// Does the release build of the iPad app carry none of the walk capture?
//
// The capture (the picture, the trail, the five seconds of video, the Files
// app folder) is for builds installed from this laptop only. This compares a
// Debug and a Release build of the same code:
//
//   - the Debug build must have both file-sharing settings and every sign of
//     the capture code below; if it lacks one, this list is out of date, and
//     not finding it in Release would prove nothing;
//   - the Release build must have none of them.
//
// Only the app's own top-level files are searched (its code, and since Xcode 15
// the debug build's second code file); the web pages inside are not, since they
// are not the capture.
//
//   node release-check.mjs --debug <Hifth.app> --release <Hifth.app> [--flavour public] [--store | --exported]
//
// With --flavour public it also fails unless the web build inside the release
// app is the public one, with no private folder. `make app-archive` asks for
// that; the plain check does not, since it also runs on the pitch build.
//
// With --store it also fails if the app still answers the laptop tools' launch
// settings (STORE_SIGNS below). `make app-archive` asks for that on the app
// inside the archive; a plain Release build keeps them for the reviewer walk.
// On the iPad and iPhone app, --store also reads the permissions it was signed
// with: Sign in with Apple and hifth.app links (IPAD_NEEDS), the team's signing
// marks, and nothing anybody did not choose. It must be signed under the team
// the laptop's signing script finds, which hifth.app's links file names. Only
// key names are ever printed, never an id.
//
// --exported is --store for the app inside the file that would be uploaded
// (`make app-export`): there the debugger permission must be off as well.
//
// Exit 0 when Release is clean, 1 when it is not (or Debug is missing a sign),
// 2 when a path is not an app. Built and run by `make app-release-check`.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { signingTeam } from "../../../../scripts/lib/signing-team.mjs";

/** The two Info.plist settings that put the captures in the Files app. */
export const KEYS = ["UIFileSharingEnabled", "LSSupportsOpeningDocumentsInPlace"];

/**
 * What each sign means, the text that is in the app's code when it is there,
 * and what kind of text it is. Each was seen to fire on a real Release build
 * with the capture forced in (2026-11-13; the capture-folder switch was added
 * after that run, and is held by the same rule). A string of 15 bytes or less is not
 * a sign: an optimized Swift build packs a string that short into the machine
 * code itself, so the folder name and the video's file name were found in
 * Debug and missed in Release. A type's name is kept whole whatever its length.
 */
export const SIGNS = [
  ["the launch switch that takes a capture in a test", "HIFTH_WALK_CAPTURE_AT_START", "string"],
  ["the launch switch that turns the video off", "HIFTH_WALK_VIDEO", "string"],
  ["the launch switch that moves where captures go", "HIFTH_WALK_CAPTURE_FOLDER", "string"],
  ["the video recorder", "ClipRecorder", "type"],
  // The last field marks a sign the Mac app never has: its Debug build was
  // searched on 2026-11-17 and had every other sign, but not these two.
  ["the touch trail", "TouchTrailRecorder", "type", "ipad"],
  ["Apple's screen recorder library", "ReplayKit.framework", "library", "ipad"],
  ["the code behind the capture and current-to-file links", "CaptureLinkWaiting", "type"],
];

/**
 * The permissions a Mac store build is signed with (launch item 8). The Mac
 * store takes only sandboxed apps; the app asks for the network (recitation
 * audio) and the files the reader picks in the open and save panels, and for
 * nothing else. The team's signing adds its own two marks. Xcode adds the
 * debugger permission to every laptop build, and store signing takes it out.
 */
export const MAC_NEEDS = [
  ["com.apple.security.app-sandbox", "the sandbox, without which the Mac store refuses the app"],
  ["com.apple.security.network.client", "the network, which the recitation audio needs"],
  ["com.apple.security.files.user-selected.read-write", "the files the reader picks, which saving and loading need"],
];
const MAC_SIGNING_MARKS = ["com.apple.application-identifier", "com.apple.developer.team-identifier"];
const DEBUGGER = "com.apple.security.get-task-allow";

/**
 * The permissions the iPad and iPhone store build is signed with (launch item
 * 9; the owner said yes to both on 2026-11-17), each with the one value it may
 * carry. The links permission names hifth.app alone: the site's own file says
 * which of its addresses open the app (only the reader under /read/).
 */
export const IPAD_NEEDS = [
  ["com.apple.developer.applesignin", ["Default"], "Sign in with Apple"],
  ["com.apple.developer.associated-domains", ["applinks:hifth.app"], "hifth.app links opening the app"],
];
/**
 * The marks the team's signing adds. A store build must carry both, so an app
 * that was never signed for the store fails rather than passing with nothing
 * to read. Their values hold the team id, so they are never printed.
 */
const IPAD_SIGNING_MARKS = ["application-identifier", "com.apple.developer.team-identifier"];
const IPAD_DEBUGGER = "get-task-allow";
/** Added by store signing when the upload is for the test flight. */
const IPAD_TEST_FLIGHT = "beta-reports-active";

const same = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * What is wrong with an iPad or iPhone store build's signed permissions. Only
 * key names and the links' site names are printed, never a value that holds
 * the team id. With `exported`, the app is the one that would be uploaded, and
 * the debugger permission must be off.
 */
export function ipadPermissionProblems(granted, { exported = false, team } = {}) {
  const problems = [];
  for (const key of IPAD_SIGNING_MARKS) {
    if (!(key in granted)) problems.push(`the iPad store build has no ${key}: it was not signed for the store`);
  }
  // hifth.app's links file names the team the laptop's signing script finds
  // (scripts/lib/signing-team.mjs). Signed under another, no link would open it.
  if (team === null) {
    problems.push("this laptop has no signing team to hold the iPad store build to, so hifth.app's links file could not name it");
  } else if (team !== undefined && IPAD_SIGNING_MARKS.every((key) => key in granted)) {
    const sameTeam = granted["com.apple.developer.team-identifier"] === team &&
      String(granted["application-identifier"]).startsWith(`${team}.`);
    if (!sameTeam) {
      problems.push("the iPad store build is signed under another team than the one hifth.app's links file names, so no link would open it");
    }
  }
  for (const [key, want, what] of IPAD_NEEDS) {
    if (!(key in granted)) {
      problems.push(`the iPad store build is not signed with ${key}, which ${what} needs`);
      continue;
    }
    if (same(granted[key], want)) continue;
    const has = Array.isArray(granted[key]) ? granted[key] : [];
    if (key === "com.apple.developer.associated-domains") {
      const extra = has.filter((d) => !want.includes(d));
      problems.push(
        `the iPad store build's ${key} must name ${want.join(", ")} and nothing else` +
          (extra.length ? `, but also names ${extra.join(", ")}` : ""),
      );
    } else {
      problems.push(`the iPad store build's ${key} must be ${want.join(", ")} only`);
    }
  }
  const known = new Set([...IPAD_NEEDS.map(([k]) => k), ...IPAD_SIGNING_MARKS, IPAD_DEBUGGER, IPAD_TEST_FLIGHT]);
  for (const key of Object.keys(granted)) {
    if (!known.has(key)) problems.push(`the iPad store build asks for ${key}, which nobody chose`);
  }
  if (exported && granted[IPAD_DEBUGGER] === true) {
    problems.push(`the exported iPad app still has ${IPAD_DEBUGGER}, the debugger permission, which the uploaded app may not keep`);
  }
  return problems;
}

/** Where an app keeps its parts: the iPad app at its top, the Mac app one folder down. */
export function layout(app) {
  if (existsSync(join(app, "Contents", "Info.plist"))) {
    return {
      platform: "mac",
      plist: join(app, "Contents", "Info.plist"),
      code: join(app, "Contents", "MacOS"),
      web: join(app, "Contents", "Resources", "WebBundle"),
    };
  }
  if (existsSync(join(app, "Info.plist"))) {
    return { platform: "ipad", plist: join(app, "Info.plist"), code: app, web: join(app, "WebBundle") };
  }
  return null;
}

/** What is wrong with a Mac release build's signed permissions. */
export function macPermissionProblems(granted, { store = false } = {}) {
  const problems = [];
  for (const [key, what] of MAC_NEEDS) {
    if (granted[key] !== true) problems.push(`the Mac release build is not signed with ${key}: ${what}`);
  }
  const known = new Set([...MAC_NEEDS.map(([k]) => k), ...MAC_SIGNING_MARKS, DEBUGGER]);
  for (const key of Object.keys(granted)) {
    if (!known.has(key)) problems.push(`the Mac release build asks for ${key}, which nobody chose`);
  }
  if (store && DEBUGGER in granted) {
    problems.push(`the Mac store build still has ${DEBUGGER}, the debugger permission, which only a laptop build may keep`);
  }
  return problems;
}

/**
 * The permissions signed into an app, read with the signing tool. A test hands
 * them in as a file instead, since a stand-in folder cannot be signed. Null
 * when they cannot be read, which the check reports rather than passing.
 */
function signedPermissions(app, file) {
  try {
    const xml = file
      ? readFileSync(file, "utf8")
      : execFileSync("codesign", ["-d", "--entitlements", "-", "--xml", app], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    if (!xml.trim()) return {};
    return JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", "-"], { input: xml, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }));
  } catch {
    return null;
  }
}

/**
 * The launch settings the laptop's tools start the app with: the probe and
 * the walk of steps, the picture, and the forced light or dark look. A plain
 * Release build keeps them, because the reviewer walk drives one with them
 * (`CONFIG=Release`); only the build made for the store leaves them out
 * (`make app-archive` sets the STORE condition), so only `--store` looks for
 * them. Each was seen in a store archive made before they were left out
 * (2026-11-17). The two that point the app at another server (the launch file's
 * and sign-in's) were left out from the start and are listed so they stay out.
 * The two waits and the Mac window size were left out with the rest but only
 * listed on 2026-11-18, when a test began matching this list against the
 * names the app's code reads, so a new setting cannot be missed again.
 * The route and language settings are read in the same place
 * and left out with them, but their names are too short to find, so a test
 * of the app's own code holds them instead (scripts/native-store-launch-settings.test.mjs).
 */
export const STORE_SIGNS = [
  ["the launch setting that walks a list of steps", "HIFTH_PROBE_STEPS", "string"],
  ["the launch setting that asks the page a question", "HIFTH_PROBE_EVAL", "string"],
  ["the launch setting that says where the probe's answer goes", "HIFTH_PROBE_PATH", "string"],
  ["the launch setting that takes a picture with the probe", "HIFTH_PROBE_SHOT", "string"],
  ["the launch setting that takes a picture and quits", "HIFTH_SNAPSHOT_PATH", "string"],
  ["the launch setting that forces the light or dark look", "HIFTH_APPEARANCE", "string"],
  ["the launch setting that points the launch file at another server", "HIFTH_STATUS_URL", "string"],
  ["the launch setting that points sign-in at another server", "HIFTH_SIGN_IN_URL", "string"],
  ["the launch setting that waits before the probe asks", "HIFTH_PROBE_DELAY_MS", "string"],
  ["the launch setting that waits before the picture", "HIFTH_SNAPSHOT_DELAY_MS", "string"],
  ["the launch setting that sizes the Mac window for store pictures", "HIFTH_WINDOW_SIZE", "string", "mac"],
];

/** Is this sign looked for in this kind of app? A fourth column names the one platform it belongs to. */
const onPlatform = (mac) => ([, , , only]) => !only || only === (mac ? "mac" : "ipad");

const log = (ev, fields = {}) =>
  console.log(
    [`${new Date().toISOString()} pid=${process.pid} ev=${ev}`, ...Object.entries(fields).map(([k, v]) => `${k}=${v}`)].join(" "),
  );

function settings(app) {
  const json = execFileSync("plutil", ["-convert", "json", "-o", "-", layout(app).plist], { encoding: "utf8" });
  return JSON.parse(json);
}

/** The app's own code files, read as bytes (the iPad app's top level, the Mac app's Contents/MacOS). */
function code(app) {
  const dir = layout(app).code;
  return readdirSync(dir)
    .filter((name) => name !== "Info.plist" && statSync(join(dir, name)).isFile())
    .map((name) => ({ name, bytes: readFileSync(join(dir, name)) }));
}

function signsIn(files, signs = SIGNS) {
  return signs.filter(([, text]) => files.some((f) => f.bytes.includes(Buffer.from(text, "utf8"))));
}

/**
 * Is the web build inside this app the one asked for? The copy step leaves a
 * one-word file in the web folder saying which build it is, and the folder
 * ships as it is, so this reads the built app: the thing that would be
 * uploaded. A private folder is refused whatever the file says, because the
 * file is only a label and the folder is the held commentary itself.
 */
export function flavourProblems(release, wanted) {
  const web = layout(release)?.web ?? join(release, "WebBundle");
  const stamp = join(web, ".hifth-web-flavour");
  const says = existsSync(stamp) ? readFileSync(stamp, "utf8").trim() : "";
  const problems = [];
  if (!says) problems.push(`the release build does not say which build its web part is, and only the ${wanted} build may be uploaded`);
  else if (says !== wanted) problems.push(`the release build's web part is the ${says} build, and only the ${wanted} build may be uploaded`);
  if (wanted === "public" && existsSync(join(web, "assets", "private"))) {
    problems.push("the release build has the private folder of held commentary in its web part");
  }
  return problems;
}

/**
 * Does this store build carry Apple's privacy file, and does it say what we
 * mean? Apple refuses an upload without one. Ours says the app tracks nobody
 * and names no tracking address, and every system feature it lists must give
 * at least one of Apple's reasons, or Apple refuses that too. The iPad and
 * iPhone app keep it at the top of the app, the Mac app one folder down.
 */
export function privacyProblems(release) {
  const at = [join(release, "PrivacyInfo.xcprivacy"), join(release, "Contents", "Resources", "PrivacyInfo.xcprivacy")].find((p) =>
    existsSync(p),
  );
  if (!at) return ["the release build has no privacy file, and Apple refuses an upload without one"];
  let file;
  try {
    file = JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", at], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    return ["the release build's privacy file cannot be read as a settings list"];
  }
  const problems = [];
  if (file.NSPrivacyTracking !== false) problems.push("the release build's privacy file says the app tracks people, or does not say it does not");
  for (const domain of file.NSPrivacyTrackingDomains ?? []) problems.push(`the release build's privacy file names a tracking address: ${domain}`);
  for (const api of file.NSPrivacyAccessedAPITypes ?? []) {
    if (!(api.NSPrivacyAccessedAPITypeReasons ?? []).length) {
      problems.push(`the release build's privacy file lists ${api.NSPrivacyAccessedAPIType} with no reason, and Apple refuses that`);
    }
  }
  return problems;
}

export function check(debug, release, { flavour, store = false, exported = false, permissions, teamScript } = {}) {
  const mac = layout(release).platform === "mac";
  const problems = flavour ? flavourProblems(release, flavour) : [];
  if (flavour === "public") problems.push(...privacyProblems(release));
  if (mac) {
    const granted = signedPermissions(release, permissions);
    if (granted === null) problems.push("the Mac release build's permissions cannot be read: is it signed?");
    else problems.push(...macPermissionProblems(granted, { store }));
  } else if (store || exported) {
    // A plain iPad release build is made unsigned on the laptop, so only the
    // store builds (the archive and the exported app) are signed to read.
    const granted = signedPermissions(release, permissions);
    if (granted === null) problems.push("the iPad store build's permissions cannot be read: is it signed?");
    else problems.push(...ipadPermissionProblems(granted, { exported, team: signingTeam(teamScript ? { script: teamScript } : {}) }));
  }
  // The Files app settings are the iPad's; the Mac app has no Files app.
  const debugKeys = settings(debug);
  for (const key of mac ? [] : KEYS) {
    if (debugKeys[key] !== true) problems.push(`the check is out of date: the debug build no longer has ${key}`);
  }
  const forThisApp = SIGNS.filter(onPlatform(mac));
  const signs = store ? [...forThisApp, ...STORE_SIGNS.filter(onPlatform(mac))] : forThisApp;
  const debugSigns = signsIn(code(debug), signs);
  for (const [what, text] of signs) {
    if (!debugSigns.some(([, t]) => t === text)) {
      problems.push(`the check is out of date: the debug build has no "${text}" (${what}), so its absence from release proves nothing`);
    }
  }
  const releaseKeys = settings(release);
  for (const key of KEYS) {
    if (key in releaseKeys) problems.push(`the release build has ${key}, which shows the app's files in the Files app`);
  }
  for (const [what, text] of signsIn(code(release), signs)) {
    problems.push(`the release build has "${text}": ${what} is in it`);
  }
  return problems;
}

function arg(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const debug = arg("--debug");
  const release = arg("--release");
  for (const [which, app] of [["debug", debug], ["release", release]]) {
    if (!app || !layout(app)) {
      log("error", { which, msg: `"no app at ${app ?? "(not given)"}"` });
      process.exit(2);
    }
  }
  const platform = layout(release).platform;
  if (layout(debug).platform !== platform) {
    log("error", { msg: '"the two builds are not the same app: one is an iPad app and the other a Mac app"' });
    process.exit(2);
  }
  const flavour = arg("--flavour");
  if (process.argv.includes("--flavour") && !flavour) {
    log("error", { msg: '"--flavour needs a build name, such as public"' });
    process.exit(2);
  }
  // --exported: the app inside the exported file that would be uploaded; it is a store build too.
  const exported = process.argv.includes("--exported");
  const store = exported || process.argv.includes("--store");
  // Only for tests: the permissions a signature would carry, since a stand-in folder cannot be signed.
  const permissions = arg("--permissions");
  // Only for tests: a stand-in for the laptop's signing script, which names the team.
  const teamScript = arg("--team-script");
  log("start", { debug, release, platform, flavour: flavour ?? "any", store: store ? "yes" : "no", exported: exported ? "yes" : "no" });
  const problems = check(debug, release, { flavour, store, exported, permissions, teamScript });
  for (const problem of problems) log("problem", { msg: JSON.stringify(problem) });
  log("done", { release_clean: problems.length === 0 ? "yes" : "no", problems: problems.length });
  process.exit(problems.length === 0 ? 0 : 1);
}
