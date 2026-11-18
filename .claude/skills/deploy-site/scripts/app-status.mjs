/**
 * The file on hifth.app the iPad, iPhone and Mac apps read once each launch (launch item 21 in
 * docs/design/app-store-launch.md): the lowest version still allowed on each platform, a notice
 * to show, and parts of the app to switch off. It is how a bad version is answered without a new
 * build through Apple's review. The app's side is native/Hifth/App/AppStatus.swift.
 *
 * A build's reaction to the file is fixed the day it ships, so the file carries a format number
 * and every build so far reads only format 1. A change that an old build must not misread goes
 * in a new file name, never a new meaning for a field here. This check refuses a file the apps
 * would misread or ignore, and one that would ask readers of the version being shipped to update.
 */
import { compare, isVersion } from "../../release-app/scripts/app-version.mjs";

/** Where the file sits in the release folder, and so on the site. */
export const APP_STATUS_FILE = "app-status.json";
/** The platforms the apps name themselves by. */
export const PLATFORMS = ["ios", "macos"];
/** The parts the apps can switch off (AppStatus.Part). */
export const PARTS = ["pencil", "links"];

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const extra = (object, keys) => Object.keys(object).filter((k) => !keys.includes(k));

/**
 * What is wrong with the file's text, in plain words, or an empty list. `shipping` is the
 * version in native/project.yml: a file that would tell readers of it to update is refused.
 */
export function appStatusProblems(text, { shipping } = {}) {
  if (typeof text !== "string") return ["the file the apps read at launch is missing or unreadable"];
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    return ["the file the apps read at launch is not JSON, so every app would ignore it"];
  }
  if (!isObject(file)) return ["the file the apps read at launch must be one object"];
  const problems = [];
  if (file.format !== 1) problems.push("its format must be the number 1; the apps out today read no other");
  for (const key of extra(file, ["format", "lowest", "notice", "off"])) {
    problems.push(`it has "${key}", which no app reads; a new meaning goes in a new file`);
  }
  if (file.lowest !== undefined) {
    if (!isObject(file.lowest)) problems.push(`"lowest" must name a version for each platform`);
    else {
      for (const [platform, version] of Object.entries(file.lowest)) {
        if (!PLATFORMS.includes(platform)) problems.push(`"lowest" names "${platform}"; the apps are ${PLATFORMS.join(" and ")}`);
        else if (typeof version !== "string" || !isVersion(version)) problems.push(`the lowest ${platform} version is not a version like 1.2.0, so the app would ignore it`);
        else if (shipping && compare(shipping, version) < 0) {
          problems.push(`the lowest ${platform} version, ${version}, is above the version being shipped, ${shipping}: everyone who installs it would be told to update`);
        }
      }
    }
  }
  if (file.notice !== undefined && file.notice !== null) {
    const n = file.notice;
    if (!isObject(n)) problems.push(`"notice" must be the notice, or null for none`);
    else {
      for (const key of ["id", "en", "ar"]) {
        if (typeof n[key] !== "string" || n[key].trim() === "") problems.push(`the notice has no "${key}", so the apps would not show it`);
      }
      if (n.upTo !== undefined && (typeof n.upTo !== "string" || !isVersion(n.upTo))) {
        problems.push(`the notice's "upTo" is not a version like 1.2.0, so the apps would not show it`);
      }
      for (const key of extra(n, ["id", "en", "ar", "upTo"])) problems.push(`the notice has "${key}", which no app reads`);
      if (typeof n.ar === "string" && /[ً-ْٰ]/.test(n.ar)) {
        problems.push("the notice's Arabic carries vowel marks; hifth.app's Arabic is written without them");
      }
    }
  }
  if (file.off !== undefined) {
    if (!Array.isArray(file.off)) problems.push(`"off" must be a list of parts`);
    else {
      for (const part of file.off) {
        if (!PARTS.includes(part)) problems.push(`"off" names "${part}"; the apps can switch off only ${PARTS.join(" and ")}`);
      }
    }
  }
  return problems;
}
