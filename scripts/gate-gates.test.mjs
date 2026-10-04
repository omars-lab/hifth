/**
 * The check-of-checks must pass a project where every check it declares is run
 * by the quick sweep and reached by the commit or push hook, and every check
 * named anywhere is one that exists. It must refuse a check nothing runs, a
 * check the sweep runs but no hook reaches, a check reached only by a comment,
 * a name in the Makefile, a workflow or the sweep that no script defines, a
 * missing hook target, a hook file that is missing or does more than call its
 * target, and a project that declares no checks at all. A check name with a
 * digit in it must still be read whole (docs/design/robust-validation.md ⑦).
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const SCRIPTS = {
  "gate:a": "node scripts/gate-a.mjs",
  "gate:b": "node scripts/gate-b.mjs",
  "gate:i18n": "node scripts/gate-i18n.mjs",
  "gates:fast": "pnpm gate:a && pnpm gate:i18n",
  gates: "pnpm gates:fast && pnpm gate:b",
};

const MAKEFILE = [
  "pre-commit: lint ## Run before each commit",
  "\t@$(PNPM) gates:fast",
  "",
  "pre-push:",
  "\t@$(MAKE) -s slow",
  "",
  "slow:",
  "\t@pnpm gate:b",
  "",
  "lint:",
  "\t@echo lint",
  "",
].join("\n");

const hook = (t) => `#!/bin/sh\n# Everything this hook does lives in the Makefile.\nmake -s ${t}\n`;

/** Each check's own test, beside it. */
const TESTS = {
  "scripts/gate-a.test.mjs": "",
  "scripts/gate-b.test.mjs": "",
  "scripts/gate-i18n.test.mjs": "",
};

const files = ({ scripts = SCRIPTS, makefile = MAKEFILE, hooks = {}, workflow, tests = TESTS } = {}) => {
  const tree = {
    ...tests,
    "package.json": JSON.stringify({ scripts }),
    Makefile: makefile,
    ".githooks/pre-commit": hook("pre-commit"),
    ".githooks/pre-push": hook("pre-push"),
    ".github/workflows/deploy.yml": workflow ?? "jobs:\n  deploy:\n    steps:\n      - run: pnpm gate:a\n",
  };
  for (const [name, body] of Object.entries(hooks)) {
    if (body === null) delete tree[`.githooks/${name}`];
    else tree[`.githooks/${name}`] = body;
  }
  return tree;
};

function run(tree) {
  const root = makeFixture(tree);
  try {
    return runGate("gates", root);
  } finally {
    dropFixture(root);
  }
}

function refuses(tree, pattern) {
  const r = run(tree);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /gate:gates — FAIL/);
  assert.match(r.out, pattern);
}

test("gate:gates passes when every check is in the sweep and reached by a hook", () => {
  const r = run(files());
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /OK \(3 gates, each in pnpm gates and reached by the pre-commit or pre-push hook\)/);
});

test("gate:gates refuses a project that declares no checks at all", () => {
  refuses(files({ scripts: { build: "vite build" }, makefile: "pre-commit:\n\t@echo\n\npre-push:\n\t@echo\n" }), /declares no gate:\* scripts at all/);
});

test("gate:gates refuses a check nothing runs", () => {
  refuses(files({ scripts: { ...SCRIPTS, "gate:c": "node c" } }), /gate:c is declared in package\.json but not invoked by `pnpm gates`, `make pre-commit` or `make pre-push`/);
});

test("gate:gates refuses a check the sweep runs but no hook reaches", () => {
  const scripts = { ...SCRIPTS, "gate:c": "node c", gates: "pnpm gates:fast && pnpm gate:b && pnpm gate:c" };
  refuses(files({ scripts }), /gate:c is declared in package\.json but not invoked by `make pre-commit` or `make pre-push`\./);
});

test("gate:gates refuses a check a hook reaches only through a comment", () => {
  const scripts = { ...SCRIPTS, "gate:c": "node c", gates: "pnpm gates:fast && pnpm gate:b && pnpm gate:c" };
  const makefile = MAKEFILE.replace("\t@pnpm gate:b", "\t@pnpm gate:b\n\t@# gate:c would go here, one day");
  refuses(files({ scripts, makefile }), /gate:c is declared in package\.json but not invoked by `make pre-commit` or `make pre-push`/);
});

test("gate:gates refuses a check with no test beside it, and names the test it wants", () => {
  const { "scripts/gate-b.test.mjs": _b, ...rest } = TESTS;
  refuses(files({ tests: rest }), /gate:b has no test: scripts\/gate-b\.test\.mjs is missing/);
});

test("gate:gates refuses a Makefile naming a check that does not exist", () => {
  refuses(files({ makefile: MAKEFILE.replace("@pnpm gate:b", "@pnpm gate:b && pnpm gate:bb") }), /gate:bb is invoked by the Makefile, a workflow or a `pnpm gates` composite, but package\.json declares no such script/);
});

test("gate:gates refuses a workflow naming a check that does not exist", () => {
  refuses(files({ workflow: "jobs:\n  deploy:\n    steps:\n      - run: pnpm gate:deploy\n" }), /gate:deploy is invoked by the Makefile, a workflow/);
});

test("gate:gates refuses a sweep naming a check that does not exist", () => {
  refuses(files({ scripts: { ...SCRIPTS, "gates:fast": "pnpm gate:a && pnpm gate:i18n && pnpm gate:gone" } }), /gate:gone is invoked by the Makefile, a workflow or a `pnpm gates` composite/);
});

test("gate:gates refuses a Makefile with no target for a hook", () => {
  const makefile = MAKEFILE.replace("pre-push:\n\t@$(MAKE) -s slow\n", "push:\n\t@$(MAKE) -s slow\n");
  refuses(files({ makefile }), /the Makefile has no `pre-push:` target, and the pre-push hook runs it/);
});

test("gate:gates refuses a missing hook file", () => {
  refuses(files({ hooks: { "pre-push": null } }), /\.githooks\/pre-push is missing/);
});

test("gate:gates refuses a hook file that does more than call its target", () => {
  const body = "#!/bin/sh\npnpm gate:a\nmake -s pre-commit\n";
  refuses(files({ hooks: { "pre-commit": body } }), /\.githooks\/pre-commit must be the one command `make -s pre-commit` \(found 2 command line\(s\)\)/);
});

test("gate:gates reads a check name with a digit in it whole", () => {
  // Drop gate:i18n from the hooks only; a matcher that read it as "gate:i"
  // would complain about gate:i instead of naming gate:i18n.
  const scripts = { ...SCRIPTS, "gates:fast": "pnpm gate:a", gates: "pnpm gates:fast && pnpm gate:b && pnpm gate:i18n" };
  const r = run(files({ scripts }));
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /gate:i18n is declared in package\.json but not invoked by `make pre-commit` or `make pre-push`/);
  assert.doesNotMatch(r.out, /gate:i is /);
});
