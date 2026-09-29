/**
 * The backlog page carries each open item's full text, copied out of the page
 * that owns it. Two things can go wrong in the copy, silently: the text can
 * run on into the next item (or stop short of its own end), and a link that
 * worked where it was written can point nowhere once it sits in docs/backlog.md.
 * Both are checked here, on small made-up pages, so a failure names the rule.
 *
 * Run with the other script tests: node --test scripts/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { bodyAfter, planBodyAt, rebaseLinks } from "./issues.mjs";

test("an item's text stops at the next item, and at the end of its section", () => {
  const lines = [
    "## Open questions, and what would answer each",
    "",
    "### ① First? · **open**",
    "",
    "Why it matters.",
    "",
    "#### A detail inside it",
    "",
    "More.",
    "",
    "### ② Second? · **open**",
    "",
    "The second one.",
    "",
    "---",
    "",
    "## What this page is not settling",
    "",
    "Not this.",
  ];
  assert.equal(bodyAfter(lines, 2), "Why it matters.\n\n#### A detail inside it\n\nMore.");
  assert.equal(bodyAfter(lines, 10), "The second one.");
});

test("a roadmap follow-up is its whole numbered paragraph, and no more", () => {
  const lines = [
    "### Open follow-ups",
    "",
    "1. **First thing.** It started here",
    "   and carried on here.",
    "",
    "   A second paragraph of the same item.",
    "2. **Second thing.** Short.",
    "",
    "### Something else",
  ];
  assert.equal(
    planBodyAt(lines, 2),
    "**First thing.** It started here\nand carried on here.\n\nA second paragraph of the same item.",
  );
  assert.equal(planBodyAt(lines, 6), "**Second thing.** Short.");
});

test("links are rewritten so they still work from the backlog page", () => {
  const from = "docs/design/foo.md";
  assert.equal(rebaseLinks("[a](mark-labels.md#x)", from), "[a](design/mark-labels.md#x)");
  assert.equal(rebaseLinks("[b](../PLAN.md)", from), "[b](PLAN.md)");
  assert.equal(rebaseLinks("[c](#a-heading)", from), "[c](design/foo.md#a-heading)");
  assert.equal(rebaseLinks("[d](../../apps/web/x.ts)", from), "[d](../apps/web/x.ts)");
  assert.equal(rebaseLinks("[e](https://example.com/a.md)", from), "[e](https://example.com/a.md)");
  assert.equal(rebaseLinks("[f](PLAN.md)", "docs/performance.md"), "[f](PLAN.md)");
  // An image is a link too.
  assert.equal(rebaseLinks("![g](shot.png)", from), "![g](design/shot.png)");
});

test("a follow-up whose bold title wraps onto the next line keeps all of it", async () => {
  const { planTitleAt } = await import("./issues.mjs");
  const lines = [
    "22. **The commentary sources are merged but not on screen: how do they and the",
    "    pitch drawer become one?** Found 2026-09-29.",
    "23. Plain first clause — then the rest.",
  ];
  assert.equal(
    planTitleAt(lines, 0),
    "The commentary sources are merged but not on screen: how do they and the pitch drawer become one?",
  );
  assert.equal(planTitleAt(lines, 2), "Plain first clause");
});
