import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// The build made for the store must not answer the launch settings the
// laptop's tools start the app with: the probe, the picture, the forced look,
// the route and the language (launch item 36). `make app-archive` sets the
// STORE condition, and the app's code keeps every read of a launch setting
// inside a part the store build leaves out (`#if !STORE`, or `#if DEBUG`).
//
// The archive's own check finds the long setting names in the built app. The
// route and language names (HIFTH_ROUTE, HIFTH_LANG) are too short for that:
// an optimized build packs them into the machine code. So this test reads the
// app's code instead, and holds every read, long or short.
const root = fileURLToPath(new URL("..", import.meta.url));
const APP = join(root, "native", "Hifth");

/** What counts as reading a launch setting. */
const READ = /processInfo\.environment|CommandLine\.arguments|"HIFTH_[A-Z_]+"/;

/** Does this `#if` condition, in its first branch, leave the store build out? */
function leavesStoreOut(condition) {
  return condition.split("&&").some((part) => ["!STORE", "DEBUG"].includes(part.trim()));
}

/**
 * Each line of Swift source that reads a launch setting, and whether the store
 * build keeps it. Comment lines are skipped: a name in a comment is not read.
 */
export function launchReads(source) {
  const frames = [];
  const reads = [];
  source.split("\n").forEach((text, i) => {
    const line = text.trim();
    const directive = line.match(/^#(if|elseif|else|endif)\b\s*(.*)$/);
    if (directive) {
      const [, kind, condition] = directive;
      if (kind === "if") frames.push({ condition, inElse: false });
      else if (kind === "elseif") frames[frames.length - 1] = { condition, inElse: false };
      else if (kind === "else") frames[frames.length - 1].inElse = true;
      else frames.pop();
      return;
    }
    if (line.startsWith("//") || !READ.test(line)) return;
    const leftOut = frames.some((f) => (f.inElse ? f.condition.trim() === "STORE" : leavesStoreOut(f.condition)));
    reads.push({ line: i + 1, text: line, inStore: !leftOut });
  });
  return reads;
}

function swiftFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return swiftFiles(path);
    return name.endsWith(".swift") ? [path] : [];
  });
}

const appReads = swiftFiles(APP).flatMap((file) =>
  launchReads(readFileSync(file, "utf8")).map((r) => ({ ...r, file: relative(root, file) })),
);

test("the store build reads no launch setting: every read sits in a part it leaves out", () => {
  const kept = appReads.filter((r) => r.inStore).map((r) => `${r.file}:${r.line}  ${r.text}`);
  assert.deepEqual(kept, [], `the store build would still read these:\n${kept.join("\n")}`);
});

test("the reads are really found, so a clean result is not an empty search", () => {
  const texts = appReads.map((r) => r.text).join("\n");
  for (const name of ["HIFTH_ROUTE", "HIFTH_LANG", "HIFTH_PROBE_STEPS", "HIFTH_SNAPSHOT_PATH", "HIFTH_APPEARANCE"]) {
    assert.ok(texts.includes(`"${name}"`), `${name} was not found in the app's code: the search has gone blind`);
  }
  assert.ok(appReads.some((r) => r.text.includes("CommandLine.arguments")), "no read of the launch arguments was found");
});

test("a read outside any condition is caught, and one in a comment is not", () => {
  const reads = launchReads(['// with "HIFTH_X" set', 'let x = ProcessInfo.processInfo.environment["HIFTH_X"]'].join("\n"));
  assert.deepEqual(
    reads.map((r) => [r.line, r.inStore]),
    [[2, true]],
  );
});

test("a read is left out under #if !STORE, under #if DEBUG, and in the #else of #if STORE", () => {
  const source = [
    "#if !STORE",
    'let a = environment["HIFTH_A"]',
    "#endif",
    "#if DEBUG && os(iOS)",
    "let b = CommandLine.arguments",
    "#endif",
    "#if STORE",
    "let c: String? = nil",
    "#else",
    'let c = environment["HIFTH_C"]',
    "#endif",
  ].join("\n");
  assert.deepEqual(
    launchReads(source).map((r) => r.inStore),
    [false, false, false],
  );
});

test("a read in the #else of #if !STORE, or under some other condition, is kept by the store build", () => {
  const source = [
    "#if !STORE",
    "let a: String? = nil",
    "#else",
    'let a = environment["HIFTH_A"]',
    "#endif",
    "#if os(iOS)",
    "let b = CommandLine.arguments",
    "#endif",
  ].join("\n");
  assert.deepEqual(
    launchReads(source).map((r) => r.inStore),
    [true, true],
  );
});

test("the archive step builds with STORE and checks the archive for the launch settings", () => {
  const makefile = readFileSync(join(root, "native", "Makefile.native"), "utf8");
  const recipe = makefile.slice(makefile.indexOf("\napp-archive:"), makefile.indexOf("\napp-export:"));
  assert.match(recipe, /HIFTH_STORE_CONDITION=STORE archive/, "the archive is not built with STORE");
  assert.match(recipe, /release-check\.mjs[\s\S]*--store/, "the archive's check does not look for the launch settings");
  const project = readFileSync(join(root, "native", "project.yml"), "utf8");
  assert.match(
    project,
    /Release:[\s\S]*SWIFT_ACTIVE_COMPILATION_CONDITIONS: "\$\(HIFTH_STORE_CONDITION\)"/,
    "a Release build does not take the STORE condition from the archive step",
  );
});
