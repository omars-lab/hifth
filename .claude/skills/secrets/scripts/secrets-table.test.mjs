// Every saved entry has a row in the secrets skill's table.
//
// The skill says, for each entry in the committed encrypted settings, where its value comes
// from and which command saves, checks and replaces it. A new entry saved without a row
// would leave the next person guessing which command is safe to run, so this fails until the
// row is written. It reads only the entry names (the text before "="), never a value.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..", "..");

const names = readFileSync(join(root, ".env.encrypted"), "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => l.replace(/^export\s+/, "").split("=")[0]);

const skill = readFileSync(join(here, "..", "SKILL.md"), "utf8");
const rows = new Set([...skill.matchAll(/^\| `([A-Z][A-Z0-9_]*)` \|/gm)].map((m) => m[1]));

test("the encrypted settings hold at least one entry", () => {
  assert.ok(names.length > 0);
});

for (const name of names) {
  test(`${name} has a row in the secrets skill's table`, () => {
    assert.ok(rows.has(name), `add a row for ${name} to .claude/skills/secrets/SKILL.md`);
  });
}
