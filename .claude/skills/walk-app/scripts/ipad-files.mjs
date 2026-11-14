// Reading the debug app's walk captures off a plugged-in iPad, with Apple's
// devicectl. Shared by walk-captures.mjs (pull, current) and feature-check.mjs.
// HIFTH_DEVICECTL swaps Apple's tool for a stand-in (the tests use one).
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const BUNDLE_ID = "com.bytesofpurpose.hifth";
/** Where the app keeps its captures, inside its own folder on the iPad. */
export const ON_IPAD = "Documents/walk-captures";
/** A capture folder's name: the time it was taken, and a count within one second. */
export const CAPTURE = /^\d{8}-\d{6}(-\d+)?$/;
/** Beside the captures: where the app last said it was (the current-to-file link). */
export const CURRENT = "current.json";
/** The files a capture can hold: pictures and video once, the text files again on every pull. */
export const FILES = { "picture.png": "once", "before.mp4": "once", "trail.jsonl": "again", "where.json": "again", "note.txt": "again" };

const quote = (s) => JSON.stringify(String(s ?? "").replace(/\s+/g, " ").trim());

export function devicectl(rest) {
  const fake = process.env.HIFTH_DEVICECTL;
  return fake
    ? spawnSync(fake, rest, { encoding: "utf8", timeout: 120_000 })
    : spawnSync("xcrun", ["devicectl", ...rest], { encoding: "utf8", timeout: 120_000 });
}

export const domain = (device) => ["--device", device, "--domain-type", "appDataContainer", "--domain-identifier", BUNDLE_ID];

/**
 * The capture files on the iPad, as { capture: [file, …] } (with a hidden
 * `hasCurrent` when current.json is there), or null when it cannot be read.
 */
export function listIpad(device, { log }) {
  const work = mkdtempSync(join(tmpdir(), "hifth-walk-list-"));
  const listFile = join(work, "list.json");
  try {
    const r = devicectl(["device", "info", "files", ...domain(device), "--subdirectory", ON_IPAD, "--json-output", listFile]);
    if (r.status !== 0 || !existsSync(listFile)) {
      log("error", { step: "list", msg: quote((r.stderr || r.error?.message || "").split("\n")[0]) });
      return null;
    }
    const found = {};
    for (const f of JSON.parse(readFileSync(listFile, "utf8")).result?.files ?? []) {
      // Apple's tool may give the path from the folder asked for, or from the
      // app's own folder; both come down to <capture>/<file>.
      const rel = String(f.relativePath ?? f.name ?? "").replace(/^\/?(Documents\/walk-captures\/)?/, "");
      if (rel === CURRENT) {
        Object.defineProperty(found, "hasCurrent", { value: true });
        continue;
      }
      const [capture, file, ...deeper] = rel.split("/");
      if (deeper.length || !CAPTURE.test(capture) || !(file in FILES)) continue;
      (found[capture] ??= []).push(file);
    }
    return found;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Copy one file from the app's folder on the iPad; true when it came. */
export function copyFromIpad(device, source, dest, { log, fields = {} }) {
  const r = devicectl(["device", "copy", "from", ...domain(device), "--source", source, "--destination", dest]);
  if (r.status !== 0 || !existsSync(dest)) {
    log("error", { step: "copy", ...fields, msg: quote((r.stderr || "").split("\n")[0]) });
    return false;
  }
  return true;
}
