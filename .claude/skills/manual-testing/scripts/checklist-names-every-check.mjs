#!/usr/bin/env node
// Every check in the validation ledger that still waits on a person must be named on the
// parked list (checklist.md), so the owner finds it when they sit down to test.
// Prints the ids it cannot find, and exits 1 if there are any.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export function unnamedChecks(ledger, list) {
  return ledger.checks
    .filter((c) => c.status !== "done")
    .map((c) => c.id)
    .filter((id) => !new RegExp(`(^|[^\\w-])${id.replace(/[-]/g, "\\-")}(?![\\w-])`).test(list));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, "../../../..");
  const ledger = JSON.parse(readFileSync(join(root, "docs/validation/ledger.json"), "utf8"));
  const list = readFileSync(join(here, "../checklist.md"), "utf8");
  const missing = unnamedChecks(ledger, list);
  if (missing.length) {
    console.log(`checklist: ${missing.length} waiting check(s) not on the parked list: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("checklist: every waiting check is on the parked list");
}
