/**
 * The download-size check must refuse shipped files that nothing weighs (a
 * loose file, an unknown kind of file, a file where an edition folder should
 * be), files for an edition the app does not list or cannot select, a kind of
 * file grown past its size limit, a page too heavy, a whole mus'haf forecast
 * too heavy, an edition with no page count, and a page list (the manifest)
 * that is missing, unreadable or too heavy. It must pass a tree within every
 * limit, skip the private pitch folder, and refuse a tree with nothing to
 * weigh rather than passing it.
 *
 * Weight is measured compressed, so the heavy files are random bytes made when
 * the test runs: random bytes do not compress, so their size is their weight.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const A = "apps/web/public/assets";
const KB = 1024;

/** The editions table, in the shape the app's own source has it. */
const concordance = `export const EDITIONS: readonly EditionMeta[] = [
  {
    id: "hafs-kfqc",
    status: "vendored",
    // The print's own page count.
    pages: 604,
  },
  {
    id: "warsh",
    status: "planned",
  },
  {
    id: "qalun",
    status: "vendored",
    // pages: 604,
  },
];
`;

const manifest = JSON.stringify({ edition: "hafs-kfqc", ayahPages: [0, 1, 1, 2] });
const clean = {
  "packages/core/src/concordance.ts": concordance,
  [`${A}/manifest.json`]: manifest,
  [`${A}/pages/hafs-kfqc/3.svg`]: `<svg viewBox="0 0 345 550"><path d="M0 0h1v1H0Z"/></svg>`,
  [`${A}/adj/hafs-kfqc/1.json`]: "{}",
  [`${A}/roots/hafs-kfqc/ayah/1.json`]: "{}",
  // The pitch's held copy never ships, so nothing in it is weighed or judged.
  [`${A}/private/held.bin`]: "never shipped",
};

function run(files = clean) {
  const root = makeFixture(Object.fromEntries(Object.entries(files).filter(([, v]) => v !== null)));
  try {
    return runGate("assets", root);
  } finally {
    dropFixture(root);
  }
}

test("gate:assets passes a tree within every limit, and skips the private pitch folder", () => {
  const r = run();
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /pages\/hafs-kfqc .*\n.* 604 pages projected from that mean/);
  assert.match(r.out, /manifest\.json {2}\(whole print, ceiling 256\.0 KB\)/);
  assert.match(r.out, /OK \(.* gz across 3 files in 3 trees\)/);
});

test("gate:assets refuses files nothing weighs: loose, of an unknown kind, or not in an edition folder", () => {
  const r = run({ ...clean, [`${A}/stray.json`]: "{}", [`${A}/fonts/hafs-kfqc/a.ttf`]: "x", [`${A}/adj/readme.txt`]: "x" });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /stray\.json sits loose at the top of assets\//);
  assert.match(r.out, /assets\/fonts\/ is a kind this gate has never heard of/);
  assert.match(r.out, /assets\/adj\/readme\.txt is a file where an edition directory should be/);
});

test("gate:assets refuses files for an edition the app does not list, or cannot select", () => {
  const r = run({ ...clean, [`${A}/adj/shubah/1.json`]: "{}", [`${A}/adj/warsh/1.json`]: "{}" });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /assets\/adj\/shubah\/ names an edition EDITIONS does not list/);
  assert.match(r.out, /assets\/adj\/warsh\/ ships assets for an edition still marked "planned"/);
});

test("gate:assets refuses a kind of file grown past its limit", () => {
  const r = run({ ...clean, [`${A}/adj/hafs-kfqc/2.json`]: randomBytes(130 * KB) });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /assets\/adj\/ is 13\d\.\d KB gz against a 128\.0 KB ceiling/);
});

test("gate:assets refuses a page too heavy, and a mus'haf whose pages add up too heavy", () => {
  const heavy = run({ ...clean, [`${A}/pages/hafs-kfqc/4.svg`]: randomBytes(66 * KB) });
  assert.equal(heavy.status, 1, heavy.out);
  assert.match(heavy.out, /pages\/hafs-kfqc\/4\.svg is 66\.\d KB gz, over the 64\.0 KB per-page ceiling/);
  // Under the per-page limit, but 604 of them would be over 32 MB.
  const whole = run({ ...clean, [`${A}/pages/hafs-kfqc/3.svg`]: randomBytes(58 * KB) });
  assert.equal(whole.status, 1, whole.out);
  assert.match(whole.out, /pages\/hafs-kfqc projects to 3\d\.\d MB gz at 604 pages, over 32\.0 MB/);
});

test("gate:assets refuses pages for an edition with no page count, even one left in a comment", () => {
  const r = run({ ...clean, [`${A}/pages/qalun/1.svg`]: "<svg/>" });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /EDITIONS has no page count for "qalun"/);
  const empty = run({ ...clean, [`${A}/pages/hafs-kfqc/3.svg`]: null, [`${A}/pages/hafs-kfqc/README`]: "x" });
  assert.equal(empty.status, 1, empty.out);
  assert.match(empty.out, /pages\/hafs-kfqc\/ holds no page SVGs, so there is no page to weigh/);
});

test("gate:assets refuses a page list that is missing, of an unknown shape, or too heavy", () => {
  const missing = run({ ...clean, [`${A}/manifest.json`]: null });
  assert.equal(missing.status, 1, missing.out);
  assert.match(missing.out, /assets\/manifest\.json is missing/);
  const shapeless = run({ ...clean, [`${A}/manifest.json`]: JSON.stringify({ edition: "hafs-kfqc" }) });
  assert.equal(shapeless.status, 1, shapeless.out);
  assert.match(shapeless.out, /manifest\.json is neither the compact shape/);
  const pad = randomBytes(300 * KB).toString("base64");
  const fat = run({ ...clean, [`${A}/manifest.json`]: JSON.stringify({ edition: "hafs-kfqc", ayahPages: [1], pad }) });
  assert.equal(fat.status, 1, fat.out);
  assert.match(fat.out, /manifest\.json is \d+\.\d KB gz for the whole print, over 256\.0 KB/);
  // The older per-page shape is forecast to the whole print: one page's worth times 604.
  const page = { polygons: randomBytes(KB).toString("base64") };
  const full = run({ ...clean, [`${A}/manifest.json`]: JSON.stringify({ edition: "hafs-kfqc", pages: [page] }) });
  assert.equal(full.status, 1, full.out);
  assert.match(full.out, /manifest\.json projects to \d+\.\d KB gz at 604 pages, over 256\.0 KB/);
});

test("gate:assets refuses a tree with nothing to weigh, or an editions table it cannot read", () => {
  const nothing = run({ "packages/core/src/concordance.ts": concordance, [`${A}/manifest.json`]: manifest });
  assert.equal(nothing.status, 1, nothing.out);
  assert.match(nothing.out, /no assets found; the app has nothing to draw/);
  const unread = run({ ...clean, "packages/core/src/concordance.ts": "export const EDITIONS = [];\n" });
  assert.equal(unread.status, 1, unread.out);
  assert.match(unread.out, /no editions parsed out of packages\/core\/src\/concordance\.ts/);
});
