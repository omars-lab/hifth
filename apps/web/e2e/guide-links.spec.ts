import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { LINKS, gotoLink } from "./links";

// Every link the checks guide hands a person opens what the guide says it
// opens. The guide's link and the test's are the same address, found in the
// same list, so the day one stops opening what it names, this goes red and the
// guide step was wrong at the same moment. Owner, 2026-09-28: "our tests
// should use this too".

type Step = { open?: { path: string } };
const ledger = JSON.parse(
  readFileSync(new URL("../../../docs/validation/ledger.json", import.meta.url), "utf8"),
) as unknown;

function guidePaths(node: unknown, out: string[] = []): string[] {
  if (node && typeof node === "object") {
    const path = (node as Step).open?.path;
    if (typeof path === "string") out.push(path);
    for (const v of Object.values(node)) guidePaths(v, out);
  }
  return out;
}

const paths = [...new Set(guidePaths(ledger))];

test.describe("Hifth · every link in the checks guide", () => {
  test("the guide has links, and each one is in the tests' list", () => {
    expect(paths.length).toBeGreaterThan(0);
    const known = new Set<string>(Object.values(LINKS).map((l) => l.path));
    const missing = paths.filter((p) => !known.has(p));
    expect(missing, "add these to e2e/links.ts, with what each one shows").toEqual([]);
  });

  for (const path of paths) {
    const name = Object.entries(LINKS).find(([, l]) => l.path === path)?.[0];
    test(`${path} opens what it names`, async ({ page }) => {
      test.skip(!name, "not in the list — the test above names it");
      await gotoLink(page, name as keyof typeof LINKS);
    });
  }
});
