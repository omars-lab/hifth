/**
 * Where the source of one release can be opened: the rule the source-offer check follows and
 * the release script tags by. The app's own copy of it is `urlFor()` in
 * apps/web/src/provenance.ts; both are tested against the same written-out tag, so neither can
 * drift from the other unnoticed.
 */

/** The tag the public source copy gives a release: release-<first 12 of the commit>. */
export const releaseTag = (commit) => `release-${commit.slice(0, 12)}`;

/**
 * The address of `commit`'s source: its release tag in the public copy when there is one,
 * otherwise that commit in the working repo.
 */
export function treeUrl({ copy, repo, commit }) {
  return copy ? `${copy}/tree/${releaseTag(commit)}` : `${repo}/tree/${commit}`;
}
