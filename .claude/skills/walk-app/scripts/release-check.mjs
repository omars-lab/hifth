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
//   node release-check.mjs --debug <Hifth.app> --release <Hifth.app> [--flavour public] [--store]
//
// With --flavour public it also fails unless the web build inside the release
// app is the public one, with no private folder. `make app-archive` asks for
// that; the plain check does not, since it also runs on the pitch build.
//
// With --store it also fails if the app still answers the laptop tools' launch
// settings (STORE_SIGNS below). `make app-archive` asks for that on the app
// inside the archive; a plain Release build keeps them for the reviewer walk.
//
// Exit 0 when Release is clean, 1 when it is not (or Debug is missing a sign),
// 2 when a path is not an app. Built and run by `make app-release-check`.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

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
  ["the touch trail", "TouchTrailRecorder", "type"],
  ["Apple's screen recorder library", "ReplayKit.framework", "library"],
  ["the code behind the capture and current-to-file links", "CaptureLinkWaiting", "type"],
];

/**
 * The launch settings the laptop's tools start the app with: the probe and
 * the walk of steps, the picture, and the forced light or dark look. A plain
 * Release build keeps them, because the reviewer walk drives one with them
 * (`CONFIG=Release`); only the build made for the store leaves them out
 * (`make app-archive` sets the STORE condition), so only `--store` looks for
 * them. Each was seen in a store archive made before they were left out
 * (2026-11-17). The route and language settings are read in the same place
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
];

const log = (ev, fields = {}) =>
  console.log(
    [`${new Date().toISOString()} pid=${process.pid} ev=${ev}`, ...Object.entries(fields).map(([k, v]) => `${k}=${v}`)].join(" "),
  );

function settings(app) {
  const json = execFileSync("plutil", ["-convert", "json", "-o", "-", join(app, "Info.plist")], { encoding: "utf8" });
  return JSON.parse(json);
}

/** The app's own top-level files, read as bytes. */
function code(app) {
  return readdirSync(app)
    .filter((name) => name !== "Info.plist" && statSync(join(app, name)).isFile())
    .map((name) => ({ name, bytes: readFileSync(join(app, name)) }));
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
  const web = join(release, "WebBundle");
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

export function check(debug, release, { flavour, store = false } = {}) {
  const problems = flavour ? flavourProblems(release, flavour) : [];
  if (flavour === "public") problems.push(...privacyProblems(release));
  const debugKeys = settings(debug);
  for (const key of KEYS) {
    if (debugKeys[key] !== true) problems.push(`the check is out of date: the debug build no longer has ${key}`);
  }
  const signs = store ? [...SIGNS, ...STORE_SIGNS] : SIGNS;
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
    if (!app || !existsSync(join(app, "Info.plist"))) {
      log("error", { which, msg: `"no app at ${app ?? "(not given)"}"` });
      process.exit(2);
    }
  }
  const flavour = arg("--flavour");
  if (process.argv.includes("--flavour") && !flavour) {
    log("error", { msg: '"--flavour needs a build name, such as public"' });
    process.exit(2);
  }
  const store = process.argv.includes("--store");
  log("start", { debug, release, flavour: flavour ?? "any", store: store ? "yes" : "no" });
  const problems = check(debug, release, { flavour, store });
  for (const problem of problems) log("problem", { msg: JSON.stringify(problem) });
  log("done", { release_clean: problems.length === 0 ? "yes" : "no", problems: problems.length });
  process.exit(problems.length === 0 ? 0 : 1);
}
