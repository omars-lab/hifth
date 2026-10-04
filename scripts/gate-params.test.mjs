/**
 * The link check must refuse a link setting the app reads but never writes,
 * writes but never reads, or that the link guide leaves out or invents; a
 * setting the guide says is refused when the app in fact shrugs it off, or
 * the other way round; an example link that does not do what the guide says;
 * a setting read before the # that the guide does not list; and a desk colour
 * that the app's code, its stylesheet, the guide and the first-frame colours
 * do not all agree on. It must pass the real files, and refuse a link reader
 * it can find nothing in.
 *
 * Each test copies the committed files the check reads into a made-up tree and
 * changes one thing. The example links still run through the real built link
 * reader, so the core package must be built (the checks target builds it).
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const ROUTER = "packages/core/src/router.ts";
const FIELD_TS = "packages/core/src/field.ts";
const FIELD_CSS = "apps/web/src/styles/field.css";
const TOKENS = "apps/web/src/styles/tokens.css";
const DOC = "docs/query-params.md";
const WEB_SRC = "apps/web/src";

const repo = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const real = {};
for (const p of [ROUTER, FIELD_TS, FIELD_CSS, TOKENS, DOC]) real[p] = repo(p);
for (const f of readdirSync(new URL(`../${WEB_SRC}`, import.meta.url), { recursive: true })) {
  if (/\.(ts|tsx)$/.test(f) && !/\.test\./.test(f)) real[`${WEB_SRC}/${f}`] = repo(`${WEB_SRC}/${f}`);
}

/** Replace exactly one occurrence, so a test cannot silently change nothing. */
function once(text, from, to) {
  const n = text.split(from).length - 1;
  assert.equal(n, 1, `expected one ${JSON.stringify(from)}, found ${n}`);
  return text.replace(from, to);
}

/** Run the check over the real files with `edits` ({ path: text => text }) applied. */
function check(edits = {}, added = {}) {
  const files = { ...real, ...added };
  for (const [p, edit] of Object.entries(edits)) files[p] = edit(real[p]);
  const root = makeFixture(files);
  try {
    return runGate("params", root);
  } finally {
    dropFixture(root);
  }
}

function refuses(r, ...says) {
  assert.equal(r.status, 1, r.out);
  for (const s of says) assert.ok(r.out.includes(s), `expected the check to say:\n  ${s}\n${r.out}`);
}

const KEY_HEAD = "| Key | Shape | What it does | If the value is wrong | Failure mode |\n| --- | --- | --- | --- | --- |\n";
const SETTING_HEAD = "| Setting | Shape | What it does | If the value is wrong |\n| --- | --- | --- | --- |\n";
const AFTER_OPEN = "if (isOpenPanel(raw)) out.open = raw;\n  }\n";

test("gate:params passes the committed link reader, guide and desk colours", () => {
  const r = check();
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /OK \(8 parameter\(s\): w=strict, .* 2 field\(s\) in step/);
});

test("gate:params refuses a setting the app reads but never writes or documents", () => {
  const r = check({ [ROUTER]: (t) => once(t, AFTER_OPEN, `${AFTER_OPEN}  if (params.has("zz")) {\n    out.zz = 1;\n  }\n`) });
  refuses(r, `parses \`zz=\`, which ${DOC} does not document`, "parses `zz=` but serializeState never emits it");
});

test("gate:params refuses a setting the app writes into links but never reads back", () => {
  const r = check({ [ROUTER]: (t) => once(t, "if (state.open) q.push(`open=${state.open}`);", "if (state.open) q.push(`open=${state.open}`);\n  q.push(`zz=1`);") });
  refuses(r, "emits `zz=` but parseHash never reads it");
});

test("gate:params refuses a guide row for a setting the app does not read", () => {
  const r = check({ [DOC]: (t) => once(t, KEY_HEAD, `${KEY_HEAD}| \`zz\` | x | y | z | reject |\n`) });
  refuses(r, `documents \`zz=\`, which ${ROUTER} does not parse.`);
});

test("gate:params refuses a guide that says a strict setting shrugs off a bad value", () => {
  const r = check({
    [DOC]: (t) => once(t, "(spec §7) | The whole link is refused | reject |", "(spec §7) | The whole link is refused | fall back |"),
  });
  refuses(r, '`w=` is documented as "fall back" and behaves as "reject"');
});

test("gate:params refuses a forgiving setting whose code starts refusing the whole link", () => {
  const r = check({
    [ROUTER]: (t) => once(t, "if (isFieldId(raw)) out.field = raw;", "if (!isFieldId(raw)) return null;\n    out.field = raw;"),
  });
  refuses(r, '`field=` is documented as "fall back" and behaves as "reject"');
});

test("gate:params refuses a failure mode that is neither refuse nor fall back", () => {
  const r = check({ [DOC]: (t) => once(t, "(spec §8) | The whole link is refused | reject |", "(spec §8) | The whole link is refused | maybe |") });
  refuses(r, '`skin` declares failure mode "maybe"');
});

test("gate:params refuses an example link that does not do what the guide says", () => {
  const r = check({ [DOC]: (t) => once(t, "| `#/hafs-kfqc/2:255?w=abc` | refuses |", "| `#/hafs-kfqc/2:255?w=abc` | opens |") });
  refuses(r, "`#/hafs-kfqc/2:255?w=abc` says it opens, but the app refuses it.");
});

test("gate:params refuses a setting read before the # that the guide does not list", () => {
  const reader = 'export const zz = new URLSearchParams(location.search).get("zz");\n';
  refuses(check({}, { [`${WEB_SRC}/extra.ts`]: reader }), `${WEB_SRC}/extra.ts reads \`?zz=\` before the #`);
  // The same line in a test file is not the app reading it.
  assert.equal(check({}, { [`${WEB_SRC}/extra.test.ts`]: reader }).status, 0);
});

test("gate:params refuses a setting the guide lists but nothing reads", () => {
  const r = check({ [DOC]: (t) => once(t, SETTING_HEAD, `${SETTING_HEAD}| \`zz\` | x | y | z |\n`) });
  refuses(r, "`zz` is in the Settings table, but nothing reads it.");
});

test("gate:params refuses a desk the code lists and the stylesheet never paints", () => {
  const r = check({ [FIELD_CSS]: (t) => t.replace(/:root\[data-field="dark"\]\s*\{[^}]*\}/, "") });
  refuses(r, `${FIELD_CSS} has no \`:root[data-field="dark"]\` block, but core lists it.`);
});

test("gate:params refuses a desk with no ink named for it", () => {
  const r = check({ [FIELD_CSS]: (t) => once(t, "  --ink-on-field: var(--paper);\n", "") });
  refuses(r, "`dark` does not set --ink-on-field");
});

test("gate:params refuses a desk the guide does not list", () => {
  const r = check({ [DOC]: (t) => t.replace(/^\| `dark` \| `#[0-9a-f]{6}` → .*\n/m, "") });
  refuses(r, `${DOC} has no row for the field \`dark\`, but core lists it.`);
});

test("gate:params refuses a desk colour or ink the guide and the stylesheet disagree on", () => {
  const near = check({ [DOC]: (t) => once(t, "| `dark` | `#221e1a`", "| `dark` | `#221e1b`") });
  refuses(near, "`dark` near stop: ");
  const ink = check({ [DOC]: (t) => once(t, "→ `#35302a` | `--paper` |", "→ `#35302a` | `--ink` |") });
  refuses(ink, "`dark` ink: ");
});

test("gate:params refuses a painted desk that no link can choose", () => {
  const r = check({ [FIELD_TS]: (t) => once(t, '["tan", "dark"]', '["tan"]') });
  refuses(r, 'styles `data-field="dark"`, which is not in FIELDS', `${DOC} documents the field \`dark\`, which is not in FIELDS.`);
});

test("gate:params refuses first-frame colours that differ from the default desk", () => {
  const drift = check({ [TOKENS]: (t) => once(t, "--field-near: #af8a68;", "--field-near: #af8a69;") });
  refuses(drift, `--field-near: ${TOKENS} says #af8a69, but \`tan\` (DEFAULT_FIELD) says #af8a68.`);
  const twice = check({ [TOKENS]: (t) => once(t, "--field-far: #c9ab8d;", "--field-far: #c9ab8d;\n  --field-far: #c9ab8d;") });
  refuses(twice, `${TOKENS} declares --field-far 2 time(s)`);
  const stray = check({ [FIELD_TS]: (t) => once(t, 'DEFAULT_FIELD: FieldId = "tan"', 'DEFAULT_FIELD: FieldId = "sunk"') });
  refuses(stray, "DEFAULT_FIELD is `sunk`, which is not in FIELDS.");
});

test("gate:params refuses a link reader it can find nothing in, rather than passing nothing", () => {
  const r = check({ [ROUTER]: () => "export {};\n" });
  refuses(r, `${ROUTER} — found no`);
});
