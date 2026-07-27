/**
 * Where this build's source lives — the GPL §6 offer, as data.
 *
 * Its own module, free of React and CSS, for the same reason `coach.ts` is: the
 * e2e tier asserts on the link the app renders, and a spec that retypes the URL
 * proves only that two strings were typed the same way twice. Importing it
 * makes a wrong repo a compile error.
 *
 * Nothing here is decoration. Publishing a static site conveys the program (the
 * browser receives the JS, and `assets/roots/**` is a GPL-covered derivative of
 * the Quranic Arabic Corpus), so the reader is owed the Corresponding Source
 * for *the build they are running*. That is why the link carries a commit and
 * not a branch.
 */

/** Injected by Vite at build time — see `sourceCommit()` in `vite.config.ts`. */
declare const __SOURCE_COMMIT__: string;

export const SOURCE_REPO = "https://github.com/omars-lab/hifth";

/**
 * The commit this bundle was built from, or `"dev"` when there is none.
 *
 * `"dev"` is not a failure: an unpublished dev server corresponds to a working
 * tree, which is not a thing anyone can be offered. It is a failure only for a
 * *deployed* build, which is why `sourceUrl()` degrades to the repository root
 * rather than minting a link to a commit that does not exist.
 */
export const SOURCE_COMMIT: string =
  typeof __SOURCE_COMMIT__ === "string" ? __SOURCE_COMMIT__ : "dev";

/*
 * The three questions below are answered twice: once for an arbitrary commit,
 * and once for this build's. The parameterised half is not indirection for its
 * own sake — a unit test running under `vitest` has no `define`, so
 * `SOURCE_COMMIT` there is always "dev", and the branch that actually ships (a
 * real 40-hex SHA baked in by the build) would otherwise be the one branch
 * nothing exercises.
 */

/** True when `commit` names a commit rather than an unpublished working tree. */
export function isCommit(commit: string): boolean {
  return /^[0-9a-f]{7,40}$/.test(commit);
}

/** The URL that satisfies the offer for `commit`: that tree, or the repo root. */
export function urlFor(commit: string): string {
  return isCommit(commit) ? `${SOURCE_REPO}/tree/${commit}` : SOURCE_REPO;
}

/** True when this build can name the exact commit it came from. */
export function hasCommit(): boolean {
  return isCommit(SOURCE_COMMIT);
}

/** The seven characters a human reads back; the link always carries the full SHA. */
export function shortCommit(): string {
  return hasCommit() ? SOURCE_COMMIT.slice(0, 7) : SOURCE_COMMIT;
}

/** The URL that satisfies the offer: this exact tree, or the repository root. */
export function sourceUrl(): string {
  return urlFor(SOURCE_COMMIT);
}
