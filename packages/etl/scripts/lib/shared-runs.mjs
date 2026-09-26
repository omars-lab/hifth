/**
 * The shared-run finder, on its own so that importing it reads no corpus.
 * `morphology.mjs` re-exports it for the callers that already had it there.
 */

/**
 * Longest run of words present, in order and adjacent, in both ayahs — and
 * **every** place that run occurs, on both sides.
 *
 * Contiguous matters: mutashabihat are shared *phrasing*, and two ayahs both
 * containing "الله" and "من" separately are not similar — two ayahs sharing
 * four words in a row are.
 *
 * Classic LCS-of-substrings over two short sequences — ayahs are tens of words,
 * so the quadratic table costs nothing and is far clearer than the alternatives.
 *
 * Returns `{ len, runs: [{ a, b }] }` where `a` and `b` are **1-based**
 * positions of the run's first word on each side (index i is word i+1). It
 * compares any two arrays of equal-testable words: the corpus's skeletons in
 * `gate:edges`, the print's numbered words in `build-adjacency.mjs`.
 *
 * `runs.length > 1` is not a defect — it means the two ayahs share their longest
 * phrase in more than one place, and therefore that *which* words the pair is
 * about has no single answer. Callers that need one answer must reject those
 * rather than pick; see `build-adjacency.mjs`.
 */
export function sharedRuns(a, b) {
  if (!a?.length || !b?.length) return { len: 0, runs: [] };
  let best = 0;
  let runs = [];
  let prev = new Uint16Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    const row = new Uint16Array(b.length + 1);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        row[j] = prev[j - 1] + 1;
        if (row[j] > best) {
          best = row[j];
          runs = [{ a: i - best + 1, b: j - best + 1 }];
        } else if (row[j] === best) {
          runs.push({ a: i - best + 1, b: j - best + 1 });
        }
      }
    }
    prev = row;
  }
  return { len: best, runs };
}

/**
 * How long the longest shared run is, ignoring where it falls. `gate:edges` and
 * `sample-edges.mjs` ask only this; it is {@link sharedRuns} so the number a
 * reader sees beside a sampled pair and the number CI enforces cannot diverge.
 */
export function longestSharedRun(a, b) {
  return sharedRuns(a, b).len;
}
