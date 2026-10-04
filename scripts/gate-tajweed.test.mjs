/**
 * The tajweed check must refuse shipped tajweed files the app cannot paint: a
 * rule the files use but the rule list does not describe (it would silently
 * show nothing), a described rule no file uses, a rule pointing at a colour
 * group the app does not have, a colour group with no colour or no dash
 * pattern, a group no rule reaches, a rule named twice, a malformed letter
 * range, and a rule list that is missing, unreadable, unattributed or empty.
 * It must pass a tree where all of these agree, and refuse a tree with no
 * tajweed files at all rather than passing nothing.
 *
 * The tree is made up: two colour groups, three rules, two ayahs of letter
 * ranges. The group labels in the app's own list are Arabic, but the check
 * only reads the ids, so the made-up list uses Latin labels.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const SKINS_TS = "packages/core/src/skins.ts";
const TOKENS = "apps/web/src/styles/tokens.css";
const DIR = "apps/web/public/assets/skins/hafs-kfqc/tajweed";

const skins = (ids) =>
  `export const TAJWEED_RULES = [\n${ids.map((id) => `  { id: "${id}", label: "${id}", latin: "${id}", salience: 0 },`).join("\n")}\n];\n`;
const tokens = (ids) => `:root {\n${ids.map((id) => `  --tj-${id}: #123456;\n  --tj-dash-${id}: 2 1;`).join("\n")}\n}\n`;

const cleanRules = {
  source: "made-up tajweed source",
  rules: [
    { id: "ghunnah", family: "ghunnah" },
    { id: "madd_2", family: "madd" },
    { id: "madd_6", family: "madd" },
  ],
};
const cleanShard = { 1: { ghunnah: [0, 2], madd_2: [3, 4] }, 2: { madd_6: [1, 2, 5, 6] } };

/**
 * Build the tree and run the check. Pass `null` for a part to leave it out;
 * `rules` and `shard` may be strings, written as they are.
 */
function run({ families = ["ghunnah", "madd"], colours = families, rules = cleanRules, shard = cleanShard, extra = {} } = {}) {
  const files = { [SKINS_TS]: skins(families), [TOKENS]: tokens(colours), ...extra };
  const text = (v) => (typeof v === "string" ? v : JSON.stringify(v));
  if (rules !== null) files[`${DIR}/rules.json`] = text(rules);
  if (shard !== null) files[`${DIR}/1.json`] = text(shard);
  const root = makeFixture(files);
  try {
    return runGate("tajweed", root);
  } finally {
    dropFixture(root);
  }
}

test("gate:tajweed passes shipped files whose every rule is described and painted", () => {
  const r = run();
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /hafs-kfqc: 3 rule ids → 2 families, 2 marked ayahs across 1 shards/);
  assert.match(r.out, /OK \(1 edition\(s\), 2 families\)/);
});

test("gate:tajweed refuses a rule the files use but the rule list does not describe", () => {
  const r = run({ shard: { ...cleanShard, 3: { iqlab: [0, 1] } } });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /the shards use 1 rule id\(s\) rules\.json does not describe — iqlab/);
});

test("gate:tajweed refuses a described rule no file uses", () => {
  const r = run({ rules: { ...cleanRules, rules: [...cleanRules.rules, { id: "madd_4", family: "madd" }] } });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /rules\.json describes 1 rule id\(s\) no shard uses — madd_4/);
});

test("gate:tajweed refuses a rule pointing at a colour group the app does not paint, and a rule named twice", () => {
  const rules = {
    ...cleanRules,
    rules: [...cleanRules.rules, { id: "ghunnah", family: "qalqalah" }],
  };
  const r = run({ rules });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /rules\.json names "ghunnah" twice, with families "ghunnah" and "qalqalah"/);
  assert.match(r.out, /maps "ghunnah" onto the family "qalqalah", which core does not paint/);
});

test("gate:tajweed refuses a colour group with no colour, no dash pattern, or no rule reaching it", () => {
  const r = run({ families: ["ghunnah", "madd", "silent"], colours: ["ghunnah", "madd"] });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /core paints the family "silent" but tokens\.css declares no --tj-silent/);
  assert.match(r.out, /the family "silent" has no --tj-dash-silent dash pattern/);
  assert.match(r.out, /no rule paints as "silent", so that colour and its legend row are unreachable/);
});

test("gate:tajweed refuses a letter range that is not a flat list of pairs", () => {
  const r = run({ shard: { 1: { ghunnah: [0, 2, 3], madd_2: [] }, 2: { madd_6: [1, 2] } } });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /hafs-kfqc\/1\.json ayah 1: "ghunnah" is not a non-empty flat list/);
  assert.match(r.out, /hafs-kfqc\/1\.json ayah 1: "madd_2" is not a non-empty flat list/);
  const broken = run({ shard: "{ not json" });
  assert.equal(broken.status, 1, broken.out);
  assert.match(broken.out, /hafs-kfqc\/1\.json: not valid JSON/);
});

test("gate:tajweed refuses a rule list that is missing, unreadable, unattributed or empty", () => {
  const missing = run({ rules: null });
  assert.equal(missing.status, 1, missing.out);
  assert.match(missing.out, /hafs-kfqc: the shards ship without rules\.json/);
  const unreadable = run({ rules: "{ not json" });
  assert.equal(unreadable.status, 1, unreadable.out);
  assert.match(unreadable.out, /hafs-kfqc: rules\.json is not valid JSON/);
  const unattributed = run({ rules: { rules: cleanRules.rules } });
  assert.equal(unattributed.status, 1, unattributed.out);
  assert.match(unattributed.out, /hafs-kfqc: rules\.json carries no "source"/);
  const empty = run({ rules: { source: "made-up", rules: [] } });
  assert.equal(empty.status, 1, empty.out);
  assert.match(empty.out, /hafs-kfqc: rules\.json declares no rules/);
  const shapeless = run({ rules: { ...cleanRules, rules: [...cleanRules.rules, { id: 7 }] } });
  assert.equal(shapeless.status, 1, shapeless.out);
  assert.match(shapeless.out, /rules\.json has an entry that is not \{id, family\}/);
});

test("gate:tajweed refuses a tree with no tajweed files, or a colour list it cannot read", () => {
  const none = run({ rules: null, shard: null, extra: { "apps/web/public/assets/skins/hafs-kfqc/plain/1.json": "{}" } });
  assert.equal(none.status, 1, none.out);
  assert.match(none.out, /no edition under apps\/web\/public\/assets\/skins\/ ships a tajweed tree/);
  const unread = run({ families: [] });
  assert.equal(unread.status, 1, unread.out);
  assert.match(unread.out, /could not read TAJWEED_RULES out of packages\/core\/src\/skins\.ts/);
});
