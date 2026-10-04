/**
 * The notices check must refuse a shipped data folder whose terms come from
 * someone else when its notice is missing or leaves a source out, when the
 * licence table leaves a source out, when the code that builds it quietly
 * starts reading a new outside file, when it still claims to read one it no
 * longer does, or when it leans on a question that has since been closed. It
 * must also refuse anything shipped that nothing declares, and pass a tree
 * where every shipped folder is accounted for. The folder names and sources it
 * checks are written into the check itself, so the made-up tree below copies
 * their shape.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const ASSETS = "apps/web/public/assets";
const DATA = "packages/etl/data";
const ETL = "packages/etl/scripts";
const q = (s) => JSON.stringify(s);

const MORPHOLOGY = "quranic-corpus-morphology-0.4.txt";
const PAGES_TABLE = "ayah-pages.json";
const TAJWEED = "tajweed.hafs.uthmani-pause-sajdah.json";
const PAIRS = "mutashabiha_data.json";
const WORD_IDS = "print-word-ids.json";
const PAGINATION = "the-pagination-question-covers-three-outputs";
const ADJ_PAGES = "adj-shards-carry-a-third-upstream";

const ROW_ROOTS = "| `assets/roots/**` | GPL (inherited) | Quranic Arabic Corpus |";
const ROW_SKINS = "| `assets/skins/**` | CC BY (inherited) | quran-tajweed |";
const ROW_ADJ = "| `assets/adj/**` | attribution (inherited) | Waqar144, Tanzil, MushafDatabase |";

const licenses = (rows) =>
  "# Licences\n\n| Tree | Terms | Whose choice |\n| --- | --- | --- |\n" +
  rows.join("\n") +
  "\n\n## Also shipped\n\n" +
  ["pages", "words", "marks", "letters", "manifest.json"].map((e) => `- assets/${e}`).join("\n") +
  "\n";

const sourceIds = [
  "quranic-arabic-corpus",
  "quran-tajweed-cpfair",
  "mutashabihat-waqar144",
  "tanzil-quran-metadata",
  "word-geometry-mushafdatabase",
  "hafs-kfqc",
];

const issues = (closed = []) =>
  JSON.stringify({
    issues: [PAGINATION, ADJ_PAGES].map((id) => ({ id, status: closed.includes(id) ? "fixed" : "open" })),
  });

const clean = {
  "LICENSES.md": licenses([ROW_ROOTS, ROW_SKINS, ROW_ADJ]),
  "SOURCES.md": sourceIds.map((id) => `### ${id}\n\nWords.\n`).join("\n"),
  "docs/issues.json": issues(),

  // The outside files the builders read, each in a folder that records where it came from.
  [`${DATA}/morphology/PROVENANCE.md`]: "from the corpus",
  [`${DATA}/morphology/${MORPHOLOGY}`]: "x",
  [`${DATA}/pages/PROVENANCE.md`]: "from the print",
  [`${DATA}/pages/${PAGES_TABLE}`]: "{}",
  // Our own pins are not outside files, so naming one in a builder needs no verdict.
  [`${DATA}/pages/pages.pin.json`]: "{}",
  [`${DATA}/tajweed/PROVENANCE.md`]: "from the tajweed data",
  [`${DATA}/tajweed/${TAJWEED}`]: "{}",
  [`${DATA}/mutashabihat/PROVENANCE.md`]: "from the pairs",
  [`${DATA}/mutashabihat/${PAIRS}`]: "{}",
  [`${DATA}/words/PROVENANCE.md`]: "from the print",
  [`${DATA}/words/${WORD_IDS}`]: "{}",

  // The builders. The roots one reaches the morphology through a helper, the
  // way the real one does, so the trace has to follow the import.
  [`${ETL}/build-roots.mjs`]: `import { morphology } from "./lib/morph.mjs";\nconst pages = ${q(PAGES_TABLE)};\n`,
  [`${ETL}/lib/morph.mjs`]: `export const morphology = ${q(MORPHOLOGY)};\n`,
  [`${ETL}/build-tajweed.mjs`]: `const rules = ${q(TAJWEED)};\n`,
  [`${ETL}/build-adjacency.mjs`]: `const a = ${q(PAIRS)};\nconst b = ${q(WORD_IDS)};\nconst c = ${q(PAGES_TABLE)};\nconst pin = ${q("pages.pin.json")};\n`,

  // What ships.
  [`${ASSETS}/roots/ed/NOTICE.txt`]: "Built from the Quranic Arabic Corpus.",
  [`${ASSETS}/roots/ed/r1.json`]: "{}",
  [`${ASSETS}/skins/ed/NOTICE.txt`]: "Built from quran-tajweed.",
  [`${ASSETS}/adj/ed/NOTICE.txt`]: "Built from Waqar144's pairs, Tanzil's tables and MushafDatabase's words.",
  [`${ASSETS}/adj/ed/e1.json`]: "{}",
  [`${ASSETS}/pages/ed/p1.svg`]: "<svg/>",
  [`${ASSETS}/words/ed/w1.json`]: "{}",
  [`${ASSETS}/marks/ed/m1.json`]: "{}",
  [`${ASSETS}/letters/ed/l1.json`]: "{}",
  [`${ASSETS}/manifest.json`]: "{}",
  // The pitch's private copy never ships, so the check must not ask about it.
  [`${ASSETS}/private/held.json`]: "{}",
};

function withFixture(files, fn) {
  const root = makeFixture(files);
  try {
    return fn(root);
  } finally {
    dropFixture(root);
  }
}

/** The fixture minus the named paths. */
const without = (...paths) => Object.fromEntries(Object.entries(clean).filter(([p]) => !paths.includes(p)));

test("gate:notices passes a tree where every shipped folder is accounted for", () => {
  withFixture(clean, (root) => {
    const r = runGate("notices", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(3 inherited trees/);
    assert.match(r.out, /8 entries under assets\/, each one declared/);
  });
});

test("gate:notices refuses an inherited folder that ships without its notice", () => {
  withFixture(without(`${ASSETS}/adj/ed/NOTICE.txt`), (root) => {
    const r = runGate("notices", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /assets\/adj\/ed\/ ships 1 files and no NOTICE\.txt/);
  });
});

test("gate:notices refuses a notice that leaves one of its sources out", () => {
  withFixture({ ...clean, [`${ASSETS}/adj/ed/NOTICE.txt`]: "Built from Waqar144's pairs and MushafDatabase." }, (root) => {
    const r = runGate("notices", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /assets\/adj\/ed\/NOTICE\.txt does not name "Tanzil"/);
  });
});

test("gate:notices refuses a licence table row that leaves one of its sources out", () => {
  const row = "| `assets/adj/**` | attribution (inherited) | Tanzil, MushafDatabase |";
  withFixture({ ...clean, "LICENSES.md": licenses([ROW_ROOTS, ROW_SKINS, row]) }, (root) => {
    const r = runGate("notices", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /assets\/adj\/\*\* row does not name "Waqar144"/);
  });
});

test("gate:notices refuses a builder that quietly starts reading a new outside file", () => {
  const reached = `${clean[`${ETL}/build-adjacency.mjs`]}import { r } from "./lib/rules.mjs";\n`;
  withFixture(
    { ...clean, [`${ETL}/build-adjacency.mjs`]: reached, [`${ETL}/lib/rules.mjs`]: `export const r = ${q(TAJWEED)};\n` },
    (root) => {
      const r = runGate("notices", root);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /build-adjacency\.mjs reads packages\/etl\/data\/tajweed\/tajweed\.hafs\.uthmani-pause-sajdah\.json and gate-notices\.mjs has no verdict for it/);
    },
  );
});

// A helper pulled in only for what it does when loaded (`import "./x.mjs"`)
// reads its file just the same, so the trace has to follow it too.
test("gate:notices follows a helper imported only for what it does when loaded", () => {
  const reached = `${clean[`${ETL}/build-adjacency.mjs`]}import "./lib/rules.mjs";\n`;
  withFixture(
    { ...clean, [`${ETL}/build-adjacency.mjs`]: reached, [`${ETL}/lib/rules.mjs`]: `globalThis.r = ${q(TAJWEED)};\n` },
    (root) => {
      const r = runGate("notices", root);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /build-adjacency\.mjs reads packages\/etl\/data\/tajweed\/tajweed\.hafs\.uthmani-pause-sajdah\.json and gate-notices\.mjs has no verdict for it/);
    },
  );
});

test("gate:notices refuses a declared read the builder no longer makes", () => {
  withFixture({ ...clean, [`${ETL}/build-tajweed.mjs`]: "const rules = null;\n" }, (root) => {
    const r = runGate("notices", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /says packages\/etl\/scripts\/build-tajweed\.mjs reads tajweed\.hafs\.uthmani-pause-sajdah\.json, and the trace does not find it/);
  });
});

test("gate:notices refuses leaning on a question that has since been closed", () => {
  withFixture({ ...clean, "docs/issues.json": issues([ADJ_PAGES]) }, (root) => {
    const r = runGate("notices", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /still defers ayah-pages\.json to issue "adj-shards-carry-a-third-upstream", which is now closed/);
  });
});

test("gate:notices refuses a source name SOURCES.md has no entry for", () => {
  withFixture({ ...clean, "SOURCES.md": sourceIds.filter((id) => id !== "tanzil-quran-metadata").map((id) => `### ${id}\n`).join("\n") }, (root) => {
    const r = runGate("notices", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /names "tanzil-quran-metadata", which SOURCES\.md has no entry for/);
  });
});

test("gate:notices refuses an inherited row in the licence table the check does not know", () => {
  const extra = "| `assets/glosses/**` | CC BY (inherited) | Someone |";
  withFixture({ ...clean, "LICENSES.md": licenses([ROW_ROOTS, ROW_SKINS, ROW_ADJ, extra]) }, (root) => {
    const r = runGate("notices", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /LICENSES\.md buckets assets\/glosses\/\*\* under inherited terms, and gate-notices\.mjs does not declare it/);
  });
});

test("gate:notices refuses a shipped folder nothing declares", () => {
  withFixture({ ...clean, [`${ASSETS}/glosses/g1.json`]: "{}" }, (root) => {
    const r = runGate("notices", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /apps\/web\/public\/assets\/glosses ships and nothing declares it/);
  });
});

test("gate:notices refuses a shipped folder the licence table never mentions", () => {
  const table = clean["LICENSES.md"].replace("- assets/words\n", "");
  withFixture({ ...clean, "LICENSES.md": table }, (root) => {
    const r = runGate("notices", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /LICENSES\.md never mentions assets\/words, which ships/);
  });
});

test("gate:notices refuses an empty asset folder rather than passing nothing", () => {
  const noAssets = Object.fromEntries(Object.entries(clean).filter(([p]) => !p.startsWith(ASSETS)));
  withFixture(noAssets, (root) => {
    const r = runGate("notices", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /apps\/web\/public\/assets\/ is empty or missing/);
  });
});
