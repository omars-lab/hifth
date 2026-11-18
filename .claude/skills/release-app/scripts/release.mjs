// One command for a release (launch item 22): from the version number to a
// build Apple has checked, stopping at the upload while the licence keeps it
// locked. It runs the existing make steps in order and stops at the first one
// that fails, so every refusal those steps already make still holds.
//
//   node release.mjs plan  [--version X | --next-build | --keep-version] [--mac] [--mac-check]
//   node release.mjs run   (the same flags) [--dry-run]
//
// `make app-release` calls `run`. Each step writes a line before and after it to
// native/build/release/release.log, so a stall shows which step it was in.
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const LOG_FILE = "native/build/release/release.log";

export class Refused extends Error {}

// Which version this release carries. Exactly one choice, so a release never
// goes out with a build number nobody meant.
export function versionStep({ version, nextBuild, keepVersion }) {
  const chosen = [version !== undefined, Boolean(nextBuild), Boolean(keepVersion)].filter(Boolean).length;
  if (chosen !== 1) {
    throw new Refused(
      "say which version this release is, one of: VERSION=1.0.1 (a new version), NEXT_BUILD=1 " +
        "(another build of the same version), or KEEP_VERSION=1 (carry on after a failed run, with the number it already set)",
    );
  }
  if (keepVersion) return null;
  return {
    id: "version",
    say: version !== undefined ? `set the version to ${version} and raise the build number` : "raise the build number",
    target: "app-version",
    vars: version !== undefined ? [`VERSION=${version}`] : ["NEXT_BUILD=1"],
  };
}

export function steps(opts) {
  const list = [
    { id: "setup", say: "check this laptop has what a release needs", target: "app-release-setup", vars: [] },
  ];
  const version = versionStep(opts);
  if (version) list.push(version);
  list.push(
    { id: "web", say: "put the public build in the app", target: "app-web", vars: ["FLAVOUR=public"] },
    { id: "archive", say: "archive the iPad and iPhone app and check the app inside it", target: "app-archive", vars: [] },
    { id: "export", say: "sign it for the App Store and check the signed app", target: "app-export", vars: [] },
    { id: "check", say: "send it to Apple for its check (no build anyone can install)", target: "app-store-check", vars: [] },
  );
  if (opts.mac || opts.macCheck) {
    list.push(
      { id: "archive-mac", say: "archive the Mac app and check the app inside it", target: "app-archive-mac", vars: [] },
      { id: "export-mac", say: "make the Mac installer package and check the app inside it", target: "app-export-mac", vars: [] },
    );
  }
  // Apple's check of the Mac package waits until the Mac is added to the
  // app's record in App Store Connect, so it is asked for on its own.
  if (opts.macCheck) {
    list.push({ id: "check-mac", say: "send the Mac package to Apple for its check", target: "app-store-check-mac", vars: [] });
  }
  return list;
}

// Files with uncommitted changes, from `git status --porcelain`. The page
// comment threads change as the owner comments, and are never part of a build.
export function uncommitted(porcelain) {
  return porcelain
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => line.slice(3).replace(/^"|"$/g, ""))
    .filter((path) => !path.startsWith(".page-comments/"));
}

function stamp() {
  return new Date().toISOString();
}

export function logLine(ev, fields = {}) {
  const parts = [stamp(), `pid=${process.pid}`, `ev=${ev}`];
  for (const [k, v] of Object.entries(fields)) parts.push(`${k}=${v}`);
  return parts.join(" ");
}

// The run itself. Everything it touches comes in through `io`, so the tests
// drive it with made-up steps and never run make, git or Apple's tools.
export function run(opts, io) {
  const list = steps(opts);
  const dirty = uncommitted(io.gitStatus());
  if (dirty.length > 0) {
    const why =
      `commit the work first, so the build is of a commit anyone can find again. Not committed: ${dirty.slice(0, 5).join(", ")}` +
      (dirty.length > 5 ? ` and ${dirty.length - 5} more` : "");
    if (!opts.dryRun) throw new Refused(why);
    io.say(`\n  A real run would not start yet: ${why}`);
  }
  io.log("start", { steps: list.length, dry: opts.dryRun ? 1 : 0 });
  for (const [i, step] of list.entries()) {
    const n = `${i + 1}/${list.length}`;
    io.say(`\n  ${n}  ${step.say}   (make ${[step.target, ...step.vars].join(" ")})`);
    if (opts.dryRun) continue;
    io.log("step_start", { step: step.id, n });
    const status = io.make(step.target, step.vars);
    io.log("step_end", { step: step.id, n, status });
    if (status !== 0) {
      io.say(`\n  Stopped at step ${n}: ${step.say}. Its own message above says why.`);
      const versionAt = list.findIndex((s) => s.id === "version");
      if (versionAt !== -1 && versionAt < i) {
        io.say("  The version is already set. Once it is fixed, carry on with: make app-release KEEP_VERSION=1");
      }
      io.log("stopped", { step: step.id, status });
      return { ok: false, stoppedAt: step.id, upload: null };
    }
  }
  const allowed = io.uploadAllowed();
  if (opts.dryRun) {
    io.say("\n  Dry run: nothing was run.");
  } else if (allowed) {
    io.say("\n  The build passed Apple's check, and the licence answer allows an upload.");
    io.say("  The upload step itself is not built yet; see the release-app skill.");
  } else {
    io.say("\n  The build passed Apple's check and is ready on this laptop. It stops here: the upload stays");
    io.say("  locked until the licence answer allows it (docs/decisions/native-testflight-licence.md).");
  }
  if (!opts.dryRun && list.some((s) => s.id === "version")) {
    io.say("  Commit native/project.yml now, so the build number in the repo is the one Apple has.");
  }
  io.log("done", { upload: allowed ? "allowed" : "locked", dry: opts.dryRun ? 1 : 0 });
  return { ok: true, stoppedAt: null, upload: allowed ? "allowed" : "locked" };
}

function parse(argv) {
  const at = argv.indexOf("--version");
  return {
    version: at === -1 ? undefined : (argv[at + 1] ?? ""),
    nextBuild: argv.includes("--next-build"),
    keepVersion: argv.includes("--keep-version"),
    mac: argv.includes("--mac"),
    macCheck: argv.includes("--mac-check"),
    dryRun: argv.includes("--dry-run"),
  };
}

function realIo() {
  return {
    gitStatus: () => spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" }).stdout ?? "",
    make: (target, vars) => spawnSync("make", ["--no-print-directory", target, ...vars], { stdio: "inherit" }).status ?? 1,
    uploadAllowed: () => {
      const r = spawnSync("node", ["scripts/testflight-allowed.mjs"]);
      return r.status === 0;
    },
    say: (text) => console.log(text),
    log: (ev, fields) => {
      mkdirSync(dirname(LOG_FILE), { recursive: true });
      appendFileSync(LOG_FILE, `${logLine(ev, fields)}\n`);
    },
  };
}

function main(argv) {
  const [command, ...rest] = argv;
  const opts = parse(rest);
  try {
    if (command === "plan") {
      for (const [i, s] of steps(opts).entries()) console.log(`${i + 1}. ${s.say}   (make ${[s.target, ...s.vars].join(" ")})`);
      return 0;
    }
    if (command === "run") return run(opts, realIo()).ok ? 0 : 1;
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
    console.log(`\n  Not started: ${e.message}\n`);
    return 2;
  }
  console.log("usage: release.mjs plan|run [--version X | --next-build | --keep-version] [--mac] [--mac-check] [--dry-run]");
  return 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
