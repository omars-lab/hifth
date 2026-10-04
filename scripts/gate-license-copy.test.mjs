/**
 * The colophon check must refuse an app whose credit rows differ from the rows
 * SOURCES.md declares — a changed licence line, a declared row the app never
 * shows, a row the app shows that no entry declares — refuse a source that
 * declares nothing at all, refuse a "non-commercial" claim the record has not
 * signed off, and pass an app that shows exactly the declared rows.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const COLOPHON = "apps/web/src/components/Colophon.tsx";
const FENCE = "```";

const rowA = { what: "Pages", who: "A printer", licence: "Free for digital use", href: "https://example.org/a" };
const rowB = { what: "Pairs", who: "A scholar", licence: "Free with a mention", href: "https://example.org/b" };

/** A SOURCES.md section: a heading and a colophon fence of `key: value` lines. */
const entry = (id, fields) =>
  `### ${id}\n\nWhy we use it.\n\n${FENCE}colophon\n` +
  Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n") +
  `\n${FENCE}\n`;

const sources = (...sections) => `# Sources\n\n${sections.join("\n")}`;

/** Colophon.tsx with a CREDITS array of `rows`, written the way the real one is. */
const colophon = (...rows) =>
  "type Credit = { what: string; who: string; licence: string; href: string };\n" +
  "// The rows the reader sees.\n" +
  "const CREDITS: readonly Credit[] = [\n" +
  rows
    .map(
      (r) =>
        "  {\n" +
        Object.entries(r)
          .map(([k, v]) => `    ${k}: ${JSON.stringify(v)},`)
          .join("\n") +
        "\n  },",
    )
    .join("\n") +
  "\n];\nexport default CREDITS;\n";

const clean = {
  "SOURCES.md": sources(
    entry("source-a", rowA),
    entry("source-b", rowB),
    entry("a-font", { "not-credited": "a typeface used to draw, never named on screen" }),
  ),
  [COLOPHON]: colophon(rowA, rowB),
};

function withFixture(files, fn) {
  const root = makeFixture(files);
  try {
    return fn(root);
  } finally {
    dropFixture(root);
  }
}

test("gate:license-copy passes an app that shows exactly the declared rows", () => {
  withFixture(clean, (root) => {
    const r = runGate("license-copy", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(2 credited row\(s\) match SOURCES\.md; not credited by declaration: a-font\)/);
  });
});

test("gate:license-copy refuses a licence line that differs between the record and the screen", () => {
  const changed = { ...rowA, licence: "Free for any use at all" };
  withFixture({ ...clean, [COLOPHON]: colophon(changed, rowB) }, (root) => {
    const r = runGate("license-copy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /source-a — colophon `licence` differs between the record and the screen/);
    assert.match(r.out, /Colophon\.tsx: Free for any use at all/);
  });
});

test("gate:license-copy refuses a declared row the app never shows", () => {
  withFixture({ ...clean, [COLOPHON]: colophon(rowA) }, (root) => {
    const r = runGate("license-copy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /source-b declares a colophon row the app never shows \(href https:\/\/example\.org\/b\)/);
  });
});

test("gate:license-copy refuses a row the app shows that no entry declares", () => {
  const stray = { what: "Roots", who: "Somebody", licence: "Who knows", href: "https://example.org/c" };
  withFixture({ ...clean, [COLOPHON]: colophon(rowA, rowB, stray) }, (root) => {
    const r = runGate("license-copy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /Colophon\.tsx credits https:\/\/example\.org\/c, which no SOURCES\.md entry declares/);
  });
});

test("gate:license-copy refuses a source that declares nothing about what the app says", () => {
  const bare = "### source-c\n\nNo fence here.\n";
  withFixture({ ...clean, "SOURCES.md": `${clean["SOURCES.md"]}\n${bare}` }, (root) => {
    const r = runGate("license-copy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /SOURCES\.md § source-c — no ```colophon fence/);
  });
});

test("gate:license-copy refuses a non-commercial claim the record has not signed off", () => {
  const nc = { ...rowA, licence: "Non-commercial use only" };
  withFixture(
    { "SOURCES.md": sources(entry("source-a", nc), entry("source-b", rowB)), [COLOPHON]: colophon(nc, rowB) },
    (root) => {
      const r = runGate("license-copy", root);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /source-a — the colophon line claims non-commercial terms/);
    },
  );
});

test("gate:license-copy lets a non-commercial claim through once the record says so", () => {
  const nc = { ...rowA, licence: "Non-commercial use only" };
  withFixture(
    {
      "SOURCES.md": sources(entry("source-a", { ...nc, "commercial-use": "restricted" }), entry("source-b", rowB)),
      [COLOPHON]: colophon(nc, rowB),
    },
    (root) => {
      const r = runGate("license-copy", root);
      assert.equal(r.status, 0, r.out);
    },
  );
});

test("gate:license-copy refuses an app whose credit list it cannot read, rather than matching nothing", () => {
  withFixture({ ...clean, [COLOPHON]: "const CREDITS: readonly Credit[] = [\n];\n" }, (root) => {
    const r = runGate("license-copy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /CREDITS parsed as empty/);
  });
});
