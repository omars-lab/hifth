// The operate-app skill only points at commands other skills own. This test
// fails when it names a make command that no Makefile has, or a skill that is
// not there, so a renamed command cannot leave the page quietly wrong.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../../..");
const skill = readFileSync(join(here, "../SKILL.md"), "utf8");
const makefiles = ["Makefile", "env.mk", "native/Makefile.native"]
  .map((f) => join(root, f))
  .filter(existsSync)
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");
const targets = new Set([...makefiles.matchAll(/^([a-z0-9][a-z0-9-]*):/gm)].map((m) => m[1]));

test("every make command the skill names is a real target", () => {
  const named = [...new Set([...skill.matchAll(/`make ([a-z0-9-]+)/g)].map((m) => m[1]))];
  assert.ok(named.length >= 6, `expected the skill to name its commands, found ${named.length}`);
  const missing = named.filter((t) => !targets.has(t));
  assert.deepEqual(missing, [], `make targets named in operate-app that no Makefile has: ${missing.join(", ")}`);
});

test("every skill the skill hands over to is there", () => {
  const named = [...new Set([...skill.matchAll(/the `([a-z-]+)` skill/g)].map((m) => m[1]))];
  assert.ok(named.length >= 4, `expected the skill to name the skills it hands over to, found ${named.length}`);
  const missing = named.filter((s) => !existsSync(join(root, ".claude/skills", s, "SKILL.md")));
  assert.deepEqual(missing, [], `skills named in operate-app that are not there: ${missing.join(", ")}`);
});

test("the first line says when to use it", () => {
  const description = skill.match(/^description: (.+)$/m)?.[1] ?? "";
  assert.match(description, /Use when/);
  assert.ok(description.length < 1024, "Claude Code cuts a description past 1024 characters");
});
