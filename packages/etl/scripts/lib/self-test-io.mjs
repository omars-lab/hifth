/**
 * Three invented pages, for the graders' known-answer self-tests.
 *
 * The real readers behind a sitting want the ligature-corpus cache and the
 * shipped pages — hundreds of megabytes of gitignored download — and a self-test
 * that only runs on a machine that has them is a self-test that does not run in
 * a clean clone. So the two scorers that plan a session from marks and ink take
 * `--io <module>` and are handed this instead: twenty marks a page on three
 * pages, every one of them on solid ink, so every mark passes the ink floor and
 * the session the planner builds is a pure function of the seed.
 *
 * The same idea as the invented pages in `adjudication.test.mjs`, kept as a
 * module so a script can be pointed at it from the command line.
 */
import { shapeOf } from "./ink.mjs";

/** Twenty marks on a page, laid out on a grid, sized like the real ones. */
export function marksFor(page) {
  return Array.from({ length: 20 }, (_, k) => ({
    page,
    k,
    name: k % 3 === 0 ? "fatha" : k % 3 === 1 ? "kasra" : "damma",
    surah: 1,
    aya: 1 + (k % 7),
    idx: k,
    box: [20 + (k % 5) * 60, 30 + Math.floor(k / 5) * 90, 4 + (k % 3), 3 + (k % 2)],
    d: "M0 0",
    fit: { sx: 1, sy: 1, tx: 0, ty: 0 },
  }));
}

/** One solid rectangle of ink covering the whole page. */
export function inkFor() {
  return [shapeOf([[0, 0, 400, 0, 400, 600, 0, 600]], "nonzero")];
}
