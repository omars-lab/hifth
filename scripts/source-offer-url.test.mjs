/**
 * The address a reader is sent to for a release's source. Every address here is made up.
 *
 * Run with: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { releaseTag, treeUrl } from "./source-offer-url.mjs";

const commit = "0123456789abcdef0123456789abcdef01234567";

test("a release is tagged with the first twelve characters of its commit", () => {
  // Written out, not rebuilt from the rule: the app's colophon test pins the same string.
  assert.equal(releaseTag(commit), "release-0123456789ab");
});

test("with a public copy, the address is the release's tag in that copy", () => {
  assert.equal(
    treeUrl({ copy: "https://example.com/made-up/source", repo: "https://example.com/made-up/work", commit }),
    "https://example.com/made-up/source/tree/release-0123456789ab",
  );
});

test("with no public copy, the address is the commit in the working repo", () => {
  assert.equal(
    treeUrl({ copy: "", repo: "https://example.com/made-up/work", commit }),
    `https://example.com/made-up/work/tree/${commit}`,
  );
});
