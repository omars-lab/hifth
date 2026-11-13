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
//   node release-check.mjs --debug <Hifth.app> --release <Hifth.app>
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
 * with the capture forced in (2026-11-13). A string of 15 bytes or less is not
 * a sign: an optimized Swift build packs a string that short into the machine
 * code itself, so the folder name and the video's file name were found in
 * Debug and missed in Release. A type's name is kept whole whatever its length.
 */
export const SIGNS = [
  ["the launch switch that takes a capture in a test", "HIFTH_WALK_CAPTURE_AT_START", "string"],
  ["the launch switch that turns the video off", "HIFTH_WALK_VIDEO", "string"],
  ["the video recorder", "ClipRecorder", "type"],
  ["the touch trail", "TouchTrailRecorder", "type"],
  ["Apple's screen recorder library", "ReplayKit.framework", "library"],
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

function signsIn(files) {
  return SIGNS.filter(([, text]) => files.some((f) => f.bytes.includes(Buffer.from(text, "utf8"))));
}

export function check(debug, release) {
  const problems = [];
  const debugKeys = settings(debug);
  for (const key of KEYS) {
    if (debugKeys[key] !== true) problems.push(`the check is out of date: the debug build no longer has ${key}`);
  }
  const debugSigns = signsIn(code(debug));
  for (const [what, text] of SIGNS) {
    if (!debugSigns.some(([, t]) => t === text)) {
      problems.push(`the check is out of date: the debug build has no "${text}" (${what}), so its absence from release proves nothing`);
    }
  }
  const releaseKeys = settings(release);
  for (const key of KEYS) {
    if (key in releaseKeys) problems.push(`the release build has ${key}, which shows the app's files in the Files app`);
  }
  for (const [what, text] of signsIn(code(release))) {
    problems.push(`the release build has "${text}": ${what} is in it`);
  }
  return problems;
}

function arg(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const debug = arg("--debug");
  const release = arg("--release");
  for (const [which, app] of [["debug", debug], ["release", release]]) {
    if (!app || !existsSync(join(app, "Info.plist"))) {
      log("error", { which, msg: `"no app at ${app ?? "(not given)"}"` });
      process.exit(2);
    }
  }
  log("start", { debug, release });
  const problems = check(debug, release);
  for (const problem of problems) log("problem", { msg: JSON.stringify(problem) });
  log("done", { release_clean: problems.length === 0 ? "yes" : "no", problems: problems.length });
  process.exit(problems.length === 0 ? 0 : 1);
}
