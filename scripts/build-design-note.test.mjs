// Pages made by build-design-note.mjs: every table's headings sit over their own column.
//
// A table whose first heading is blank (a row-label column) once rendered with its
// headings shifted one column left, because the page hid every empty heading cell.
// Only a heading row that is blank all the way across may be hidden.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./code-pointers.mjs";

// Firefox too: the owner reads in it, and the rule that hides a blank heading row needs :has().
const { chromium, firefox } = createRequire(join(ROOT, "apps", "web", "package.json"))("@playwright/test");

const DESIGN = join(ROOT, "docs", "design");
const built = readdirSync(DESIGN)
  .filter((f) => f.endsWith(".html"))
  .filter((f) => readFileSync(join(DESIGN, f), "utf8").includes("Built by scripts/build-design-note.mjs"));

test("the builder has pages to check", () => {
  assert.ok(built.length > 0);
});

for (const engine of [chromium, firefox])
test(`each visible table heading sits over its own column (${engine.name()})`, async () => {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    for (const file of built) {
      await page.goto(pathToFileURL(join(DESIGN, file)).href);
      const shifted = await page.evaluate(() =>
        [...globalThis.document.querySelectorAll("table")].flatMap((table, t) => {
          const heads = [...table.querySelectorAll("thead th")];
          const row = table.querySelector("tbody tr");
          const blank = heads.every((th) => !th.textContent.trim());
          if (blank) return table.querySelector("thead").offsetHeight ? [`table ${t + 1}, blank heading row shows`] : [];
          if (!row) return [];
          const cells = [...row.children];
          return heads
            .map((th, i) => [th.getBoundingClientRect().left, cells[i]?.getBoundingClientRect().left, i])
            .filter(([a, b]) => b === undefined || Math.abs(a - b) > 1)
            .map(([, , i]) => `table ${t + 1}, heading ${i + 1}`);
        }),
      );
      assert.deepEqual(shifted, [], `${file}: headings out of line`);
    }
  } finally {
    await browser.close();
  }
});
