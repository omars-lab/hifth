/**
 * Every browser test project either runs before each push or says where else
 * it runs. A project added to the Playwright settings but never named on the
 * push's list runs nowhere: the Firefox one sat like that from 2026-09-28 to
 * 2026-10-11, while the records said it ran on push.
 *
 * Run with the other script tests: node --test scripts/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const config = readFileSync(new URL("apps/web/playwright.config.ts", root), "utf8");
const makefile = readFileSync(new URL("Makefile", root), "utf8");

/** Projects run by a make target of their own, and why they are not on push. */
const elsewhere = {
  pitch: "make pitch-e2e, which the push runs when the private notes are here",
  "pitch-firefox": "make pitch-e2e, the same",
  shots: "make shots, pictures for the docs, not a check",
};

function projectNames(source) {
  return [...source.matchAll(/^\s*name: "([a-z-]+)",/gm)].map((m) => m[1]);
}

function prePushProjects(source) {
  const start = source.indexOf("\npre-push:");
  assert.ok(start >= 0, "the Makefile has a pre-push target");
  const end = source.indexOf("\n.PHONY", start + 1);
  const body = source.slice(start, end < 0 ? undefined : end);
  return new Set([...body.matchAll(/--project=([a-z-]+)/g)].map((m) => m[1]));
}

test("the settings name the projects this check reads", () => {
  const names = projectNames(config);
  assert.ok(names.includes("desktop") && names.includes("iphone"), names.join(" "));
});

test("every test project runs before each push, or says where else it runs", () => {
  const onPush = prePushProjects(makefile);
  const missing = projectNames(config).filter((name) => !onPush.has(name) && !(name in elsewhere));
  assert.deepEqual(missing, [], `on no push list and no other: ${missing.join(", ")}`);
});
