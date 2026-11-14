// The pitch walk asks the window whether it has room for two pages, and must ask it
// the way the app does (apps/web/src/useMediaQuery.ts, DESKTOP_QUERY, the copy of
// record). If the app's rule moves and the walk's does not, the walk expects two
// pages where the app shows one, or the reverse, and calls the app wrong.
//
// Found 2026-11-14: the first iPhone walk failed its first step because the walk
// assumed two pages; the fix asks the window, and this keeps the question honest.
// Run with the other script tests: pnpm -s test:scripts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { helpers } from "./pitch-walk-steps.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const source = readFileSync(resolve(root, "apps/web/src/useMediaQuery.ts"), "utf8");

test("the walk asks the window about two pages with the app's own rule", () => {
  const app = source.match(/export const DESKTOP_QUERY =\s*"([^"]+)"/);
  assert.ok(app, "the app's two-page rule is found in useMediaQuery.ts");
  const asked = [];
  const before = globalThis.matchMedia;
  globalThis.matchMedia = (q) => (asked.push(q), { matches: false });
  try {
    helpers().spread();
  } finally {
    globalThis.matchMedia = before;
  }
  assert.deepEqual(asked, [app[1]]);
});
