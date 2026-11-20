import { test } from "node:test";
import assert from "node:assert/strict";
import { unnamedChecks } from "./checklist-names-every-check.mjs";

const ledger = { checks: [
  { id: "made-up-done", status: "done" },
  { id: "made-up-named", status: "pending" },
  { id: "made-up-missing", status: "pending" },
] };

test("a check still waiting on a person must be named on the parked list", () => {
  const list = "1. **Something.** Ledger id `made-up-named`.\n";
  assert.deepEqual(unnamedChecks(ledger, list), ["made-up-missing"]);
});

test("a finished check need not be named", () => {
  const list = "`made-up-named` `made-up-missing`";
  assert.deepEqual(unnamedChecks(ledger, list), []);
});

test("a check named only inside a longer id does not count", () => {
  const list = "`made-up-named` `made-up-missing-twice`";
  assert.deepEqual(unnamedChecks(ledger, list), ["made-up-missing"]);
});

test("the real parked list names every check still waiting on a person", async () => {
  const { readFileSync } = await import("node:fs");
  const root = new URL("../../../../", import.meta.url);
  const real = JSON.parse(readFileSync(new URL("docs/validation/ledger.json", root), "utf8"));
  const list = readFileSync(new URL("../checklist.md", import.meta.url), "utf8");
  assert.deepEqual(unnamedChecks(real, list), []);
});
