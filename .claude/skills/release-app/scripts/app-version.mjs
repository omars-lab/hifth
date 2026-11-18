#!/usr/bin/env node
// What version is the app, and what is its build number? And raise them.
//
// Both apps take their version (what readers see in the store, such as 1.0.0)
// and their build number (a whole number Apple needs higher on every upload)
// from two lines in native/project.yml. This reads and writes only those two.
//
//   node app-version.mjs                    say the version and build
//   node app-version.mjs --next-build       raise the build number by one
//   node app-version.mjs --version 1.0.0    set the version, and raise the build
//   [--file <project.yml>]                  another project file (the tests use this)
//
// Setting a version always raises the build too, since Apple takes no upload
// whose build number it has seen. A version lower than today's is refused; the
// same one is allowed, since a second build of one version is normal.
//
// Exit 0 when done, 1 when a version is refused (nothing is written), 2 when
// the file cannot be read as expected. `make app-version` runs it.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const DEFAULT_FILE = join(ROOT, "native", "project.yml");

const VERSION_KEY = "MARKETING_VERSION";
const BUILD_KEY = "CURRENT_PROJECT_VERSION";

const log = (ev, fields = {}) =>
  console.log(
    [`${new Date().toISOString()} pid=${process.pid} ev=${ev}`, ...Object.entries(fields).map(([k, v]) => `${k}=${v}`)].join(" "),
  );

class Refused extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const lineFor = (key) => new RegExp(`^(\\s*${key}:\\s*)"([^"]*)"\\s*$`, "gm");

function find(text, key) {
  const hits = [...text.matchAll(lineFor(key))];
  if (hits.length === 0) throw new Refused(`the project file has no ${key} line`, 2);
  if (hits.length > 1) throw new Refused(`the project file has ${key} more than once, so which to change is a guess`, 2);
  return hits[0][2];
}

/** The version and build number the project file holds now. */
export function current(text) {
  return { version: find(text, VERSION_KEY), build: find(text, BUILD_KEY) };
}

/** One to three whole numbers with dots between, no leading zeros: what Apple takes. */
export function isVersion(text) {
  return /^(0|[1-9]\d*)(\.(0|[1-9]\d*)){0,2}$/.test(text);
}

/** Negative when a is lower than b, by number, with missing parts as 0. */
export function compare(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function plan(text, { version, nextBuild }) {
  const now = current(text);
  if (!/^[1-9]\d*$/.test(now.build)) throw new Refused(`the build number "${now.build}" is not a whole number`, 2);
  if (version === undefined && !nextBuild) return { current: now, next: null };
  if (version !== undefined) {
    if (!isVersion(version)) throw new Refused(`"${version}" is not a version Apple takes: one to three whole numbers with dots between`, 1);
    if (compare(version, now.version) < 0) throw new Refused(`${version} is lower than today's ${now.version}`, 1);
  }
  return { current: now, next: { version: version ?? now.version, build: String(Number(now.build) + 1) } };
}

export function apply(text, next) {
  return text.replace(lineFor(VERSION_KEY), `$1"${next.version}"`).replace(lineFor(BUILD_KEY), `$1"${next.build}"`);
}

function arg(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : (process.argv[at + 1] ?? "");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = arg("--file") ?? DEFAULT_FILE;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    log("error", { msg: JSON.stringify(`cannot read ${file}`) });
    process.exit(2);
  }
  try {
    const { current, next } = plan(text, { version: arg("--version"), nextBuild: process.argv.includes("--next-build") });
    log("current", { version: current.version, build: current.build });
    if (next) {
      writeFileSync(file, apply(text, next));
      log("set", { version: next.version, build: next.build });
    }
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
    log("refused", { msg: JSON.stringify(e.message) });
    process.exit(e.code);
  }
}
