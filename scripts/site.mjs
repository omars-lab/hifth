/**
 * Where the app is served — and therefore where every page under docs/ is
 * public, because the build stages them onto the site at the same path they
 * have in this repository (see stage-docs.mjs).
 *
 * One constant, imported rather than retyped. The decision gate derives each
 * open decision's public address from it and refuses a row that says anything
 * else, so the address a reader is sent cannot drift from the page it names.
 *
 * The app's own side of this is `SOURCE_REPO` in apps/web/src/provenance.ts —
 * TypeScript, which these dependency-free scripts cannot import, so it is
 * parsed out of that file by `sourceRepo()` below rather than written twice.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

/** The site, with no trailing slash. GitHub Pages behind a custom domain. */
export const SITE = "https://blog.bytesofpurpose.com/hifth";

/** The public address of a repository path — `docs/design/x.html` and the like. */
export function publicUrl(repoPath) {
  return `${SITE}/${repoPath.replace(/^\/+/, "")}`;
}

/** `SOURCE_REPO` as provenance.ts declares it — read, never retyped. */
export function sourceRepo() {
  const src = readFileSync(join(ROOT, "apps/web/src/provenance.ts"), "utf8");
  const m = src.match(/SOURCE_REPO\s*=\s*"([^"]+)"/);
  if (!m)
    throw new Error(
      "apps/web/src/provenance.ts no longer declares SOURCE_REPO as a string literal",
    );
  return m[1];
}
