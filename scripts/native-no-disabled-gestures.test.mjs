// The iPad app must never switch off one of the web view's own touch handlers.
//
// The shell used to switch off the web view's pinch handler to stop page zoom.
// It was a suspect in the iPad's close-on-touch crash (2026-11-10) and was
// cleared: the real cause was building the web view too early
// (docs/issues/ipad-crash-on-verse-touch.md). Turning off a handler the web
// view owns is still fragile, so it stays out.
//
// Zoom stays blocked by the page's own viewport line and by pinning the zoom
// scale, never by turning a handler off.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dir = join(root, "native/Hifth/Web");

test("no web view touch handler is switched off", () => {
  const offending = [];
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".swift"))) {
    readFileSync(join(dir, name), "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/GestureRecognizer\??\.isEnabled\s*=\s*false/.test(line)) offending.push(`${name}:${i + 1}`);
      });
  }
  assert.deepEqual(offending, [], "a switched-off touch handler closes the app on iPadOS 18");
});

test("page zoom is still blocked by pinning the zoom scale", () => {
  const shell = readFileSync(join(dir, "ShellModel.swift"), "utf8");
  assert.match(shell, /maximumZoomScale\s*=\s*1/);
  assert.match(shell, /minimumZoomScale\s*=\s*1/);
});
