// The SessionStart hook that reports review-md threads waiting on claude. Written before
// the hook, so the first run fails for the real reason (no hook yet), not a mirror of it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOOK = new URL("./hook-reviews.mjs", import.meta.url).pathname;

const SIDECAR = `---
review:
  uid: t3stvau1t000
  threads:
    - id: ab12cd
      anchor:
        type: text
        quote: "# A page"
        line: 0
        blockId: ab12cd
      resolved: false
      messages:
        - author: Omar Eid
          ts: 2026-09-30T10:00:00.000Z
          body: Could this option be drawn at phone size?
      rev:
        bodyHash: 0000000000aa
        ts: 2026-09-30T09:59:59.000Z
    - id: ef34gh
      anchor:
        type: text
        quote: "Some line"
        line: 2
        blockId: ef34gh
      resolved: false
      messages:
        - author: Omar Eid
          ts: 2026-09-30T10:01:00.000Z
          body: Already handled?
        - author: claude
          ts: 2026-09-30T10:02:00.000Z
          body: Yes, in 1234567.
      rev:
        bodyHash: 0000000000bb
        ts: 2026-09-30T10:00:59.000Z
---

# Comments — page.md
`;

function vault(withComments) {
  const root = mkdtempSync(join(tmpdir(), "hifth-reviews-"));
  mkdirSync(join(root, "docs", ".obsidian"), { recursive: true });
  writeFileSync(join(root, "docs", "page.md"), "# A page\n\nSome line\n");
  if (withComments) writeFileSync(join(root, "docs", ".page.comments.md"), SIDECAR);
  return root;
}

function run(root) {
  return execFileSync("node", [HOOK], {
    cwd: root,
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    encoding: "utf8",
  });
}

test("says nothing when no doc has review comments", () => {
  const root = vault(false);
  try {
    assert.equal(run(root), "");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("names the doc and the thread the reviewer is waiting on, not the one claude answered", () => {
  const root = vault(true);
  try {
    const out = run(root);
    assert.match(out, /page\.md/);
    assert.match(out, /ab12cd/);
    assert.match(out, /drawn at phone size/);
    assert.doesNotMatch(out, /ef34gh/);
    assert.match(out, /reviews reply|make reviews/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
