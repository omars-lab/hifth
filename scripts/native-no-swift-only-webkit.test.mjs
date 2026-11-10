// The app must start on every iPadOS it says it supports, so it must not need
// the Swift-only part of WebKit (libswiftWebKit).
//
// 2026-11-10: the app would not start on an iPadOS 18.5 simulator ("Library
// missing: libswiftWebKit.dylib"), so the touch test there waited forever. The
// app had pulled that library in only by calling the web view's Swift-only form
// of "run this script" (`callAsyncJavaScript(...)` with a Swift result type).
// The system's own form, `__callAsyncJavaScript`, lives in WebKit itself, which
// every iPadOS has. One helper, `runPageScript`, wraps it; nothing else calls
// the Swift-only forms (docs/issues/ipad-crash-on-verse-touch.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dirs = ["native/Hifth", "native/HifthTests"].map((d) => join(root, d));

function swiftFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return swiftFiles(path);
    return name.endsWith(".swift") ? [path] : [];
  });
}

// The Swift-only forms: no leading underscores before the name.
const swiftOnly = /(?<![_\w])(callAsyncJavaScript|evaluateJavaScript)\s*\(/;

test("no Swift-only web view script call is used", () => {
  const offending = [];
  for (const file of dirs.flatMap(swiftFiles)) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("///")) return;
        if (swiftOnly.test(line)) offending.push(`${file.slice(root.length)}:${i + 1}`);
      });
  }
  assert.deepEqual(offending, [], "the Swift-only form needs libswiftWebKit, which iPadOS 18 lacks; use runPageScript");
});
