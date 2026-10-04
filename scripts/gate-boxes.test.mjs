/**
 * The ayah-box check must refuse a book whose box count is not 6,236, a box
 * the app's pen cannot draw as lines beyond the 8 it holds (or fewer than 8,
 * which means the pen or the pages changed without anyone saying so), a box
 * like that anywhere but the decorated pages 1 and 2, a rectangle off the
 * page's line grid, and a surah's first ayah reaching up onto the line of the
 * surah before it. It must pass a book where all of these hold, and refuse a
 * book with no pages rather than passing nothing.
 *
 * The book is made up: 6,236 plain one-line boxes written when the test runs,
 * with the 8 hand-drawn shapes on pages 1 and 2. Only the pages are made up;
 * the pen is the app's own, built from packages/core, because the pen is what
 * this check is measuring. If it is not built the check says so and fails.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const PAGES = "apps/web/public/assets/pages/hafs-kfqc";
const LINE = 36;

const tag = (surah, ayah, d) => `<path d="${d}" ayah="${ayah}" class="ayahPolygon" surah="${surah}"/>`;
/** One line of the page, full width, at line `n`. */
const line = (n, { lines = 1, width = 345 } = {}) => `M0 ${n * LINE}h${width}v${lines * LINE}H0Z`;
const L_SHAPE = "M0 0L345 0L345 36L0 72Z";
const SLANTED = "M0 0h345v36h-340Z";
const svg = (paths) => `<svg viewBox="0 0 345 550">\n${paths.join("\n")}\n</svg>\n`;

/**
 * The book: pages 1 and 2 carry four hand-drawn shapes each, page 3 carries
 * the rest of the 6,236 as one-line boxes of surah 2, one per line. `edit`
 * receives the page-3 list and the fallback lists so a test can change one box.
 */
function book(edit = () => {}) {
  const p1 = [1, 2, 3, 4].map((a) => tag(1, a, L_SHAPE));
  const p2 = [5, 6, 7].map((a) => tag(1, a, L_SHAPE)).concat(tag(1, 8, SLANTED));
  const p3 = [];
  for (let a = 1; a <= 6236 - 8; a += 1) p3.push(tag(2, a, line(a)));
  edit({ p1, p2, p3 });
  return { [`${PAGES}/1.svg`]: svg(p1), [`${PAGES}/2.svg`]: svg(p2), [`${PAGES}/3.svg`]: svg(p3) };
}

function run(files) {
  const root = makeFixture(files);
  try {
    return runGate("boxes", root);
  } finally {
    dropFixture(root);
  }
}

test("gate:boxes passes a book of 6,236 boxes with the 8 known shapes on pages 1 and 2", () => {
  // A two-line box and a one-word tail are counted, never refused.
  const r = run(
    book(({ p3 }) => {
      p3[10] = tag(2, 11, line(11, { lines: 2 }));
      p3[20] = tag(2, 21, line(21, { width: 10 }));
    }),
  );
  assert.equal(r.status, 0, r.out);
  assert.match(
    r.out,
    /6236 boxes on 3 pages, 6228 rectangles: 8 fallback \(pages 1, 2; 7 polygon, 1 slanted, 0 other\), 0 off-grid, 1 fused \(up to 2 lines\), 1 dots, 0 reach-back/,
  );
  assert.match(r.out, /gate:boxes — OK/);
});

test("gate:boxes refuses a book with a box missing or one too many", () => {
  const fewer = run(book(({ p3 }) => p3.pop()));
  assert.equal(fewer.status, 1, fewer.out);
  assert.match(fewer.out, /expected 6236 ayah boxes, found 6235/);
  const more = run(book(({ p3 }) => p3.push(tag(2, 6229, line(6229)))));
  assert.equal(more.status, 1, more.out);
  assert.match(more.out, /expected 6236 ayah boxes, found 6237/);
});

test("gate:boxes refuses a ninth box the pen cannot draw, and a missing eighth", () => {
  const ninth = run(book(({ p1, p3 }) => { p3.pop(); p1.push(tag(1, 9, L_SHAPE)); }));
  assert.equal(ninth.status, 1, ninth.out);
  assert.match(ninth.out, /9 boxes fall back to the raw shape; the gate holds 8\. A new box the pen cannot read/);
  const seventh = run(book(({ p2 }) => { p2[0] = tag(1, 5, line(0)); }));
  assert.equal(seventh.status, 1, seventh.out);
  assert.match(seventh.out, /7 boxes fall back to the raw shape; the gate holds 8\. Fewer than held/);
});

test("gate:boxes refuses a box the pen cannot draw anywhere but pages 1 and 2", () => {
  const r = run(book(({ p2, p3 }) => { p2.pop(); p3.push(tag(2, 6229, L_SHAPE)); }));
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /fallback boxes on page\(s\) 3 — only the decorated pages 1 and 2/);
  assert.doesNotMatch(r.out, /boxes fall back to the raw shape/);
});

test("gate:boxes refuses a rectangle that sits off the page's line grid", () => {
  const r = run(book(({ p3 }) => { p3[5] = tag(2, 6, `M0 ${6 * LINE}h345v28H0Z`); }));
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /1 rectangles are off the page's line grid; the gate holds 0/);
});

test("gate:boxes refuses a surah's first ayah reaching up onto the surah before it", () => {
  // The last ayah of surah 2 gives way to surah 3, whose first box starts on
  // that ayah's own line rather than below its foot.
  const opener = (at) =>
    book(({ p3 }) => {
      p3.pop();
      p3.push(tag(3, 1, line(at)));
    });
  const r = run(opener(6227));
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /1 surah opener\(s\) reach back onto the previous surah's last line/);
  // Starting on the next line is where an opener belongs.
  const fair = run(opener(6228));
  assert.equal(fair.status, 0, fair.out);
});

test("gate:boxes refuses a book with no pages", () => {
  const r = run({ [`${PAGES}/README`]: "no pages here" });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /0 boxes on 0 pages/);
  assert.match(r.out, /expected 6236 ayah boxes, found 0/);
});
