/**
 * The app-wording check must refuse generated wording files that are stale or
 * missing; a language that leaves out a message the Arabic has, or adds one
 * it does not; a count that does not handle every form its language uses
 * (Arabic has six), or handles one its language never uses; a choice that
 * branches differently from the Arabic; a sentence that drops a name the
 * Arabic fills in; a language the platform does not know; a message that
 * does not parse; and a folder with no Arabic at all. It must pass a small
 * set of messages in step.
 *
 * Each test writes two tiny catalogs (in plain ASCII — the check is about
 * shape, not wording), generates the files the real build would, and then
 * changes one thing.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeFixture, dropFixture, runGate, fixtureEnv } from "./gate-fixture.mjs";

const DIR = "apps/web/src/messages";
const BUILD = new URL("./build-messages.mjs", import.meta.url).pathname;

const ar = {
  hello: "Hello {name}",
  pages:
    "{n, plural, zero {no pages} one {one page} two {two pages} few {{nText} pages} many {{nText} pages} other {{nText} pages}}",
  mood: "{m, select, calm {calm} other {restless}}",
};
const en = {
  hello: "Hi {name}",
  // `=0` is an exact match, not one of the language's forms: extra, and allowed.
  pages: "{n, plural, =0 {no pages} one {one page} other {{nText} pages}}",
  mood: "{m, select, calm {calm} other {restless}}",
};

const json = (o) => JSON.stringify(o, null, 2) + "\n";

/**
 * A tree holding the catalogs, with the generated files built from `built`
 * (default: the same catalogs), then `catalogs` written over them — so a test
 * can change a catalog after the build, as someone who forgot to rebuild would.
 */
function withCatalogs(catalogs, fn, { built = catalogs } = {}) {
  const root = makeFixture(Object.fromEntries(Object.entries(built).map(([id, c]) => [`${DIR}/${id}.json`, json(c)])));
  try {
    const b = spawnSync(process.execPath, [BUILD], { encoding: "utf8", env: { ...fixtureEnv(), HIFTH_GATE_ROOT: root } });
    assert.equal(b.status, 0, `${b.stdout}${b.stderr}`);
    for (const [id, c] of Object.entries(catalogs)) writeFileSync(join(root, DIR, `${id}.json`), json(c));
    return fn(root);
  } finally {
    dropFixture(root);
  }
}

/** Catalogs changed after a clean build: the build is of the good pair. */
const changed = (catalogs, fn) => withCatalogs(catalogs, fn, { built: { ar, en } });

function refuses(r, ...says) {
  assert.equal(r.status, 1, r.out);
  for (const s of says) assert.ok(r.out.includes(s), `expected the check to say:\n  ${s}\n${r.out}`);
}

test("gate:i18n passes catalogs in step with their generated files", () => {
  withCatalogs({ ar, en }, (root) => {
    const r = runGate("i18n", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(2 locales × 3 messages, generated code in step\)/);
  });
});

test("gate:i18n refuses a catalog edited without rebuilding", () => {
  changed({ ar, en: { ...en, hello: "Hey {name}" } }, (root) => {
    refuses(runGate("i18n", root), `${DIR}/en.gen.ts is stale`);
  });
});

test("gate:i18n refuses a generated file that is missing", () => {
  withCatalogs({ ar, en }, (root) => {
    rmSync(join(root, DIR, "catalogs.gen.ts"));
    refuses(runGate("i18n", root), `${DIR}/catalogs.gen.ts is missing`);
  });
});

test("gate:i18n refuses a language that leaves out a message the Arabic has", () => {
  const { mood: _gone, ...short } = en;
  changed({ ar, en: short }, (root) => {
    refuses(runGate("i18n", root), "en.json — missing key 'mood' (it is in ar.json)");
  });
});

test("gate:i18n refuses a language that adds a message the Arabic does not have", () => {
  changed({ ar, en: { ...en, extra: "Extra" } }, (root) => {
    refuses(runGate("i18n", root), "en.json — key 'extra' is not in ar.json");
  });
});

test("gate:i18n refuses a count that leaves out one of the language's forms", () => {
  const four = "{n, plural, zero {no pages} one {one page} two {two pages} other {{nText} pages}}";
  changed({ ar: { ...ar, pages: four }, en }, (root) => {
    refuses(runGate("i18n", root), "ar.json — pages:n handles [zero, one, two, other]", "missing few, many");
  });
});

test("gate:i18n refuses a count with a form its language never uses", () => {
  const extra = "{n, plural, one {one page} few {some pages} other {{nText} pages}}";
  changed({ ar, en: { ...en, pages: extra } }, (root) => {
    refuses(runGate("i18n", root), "en.json — pages:n has case(s) few, which en never selects");
  });
});

test("gate:i18n refuses a choice that branches differently from the Arabic", () => {
  changed({ ar, en: { ...en, mood: "{m, select, calm {calm} angry {angry} other {restless}}" } }, (root) => {
    refuses(runGate("i18n", root), "en.json — mood:m offers [calm, angry, other], ar.json offers [calm, other]");
  });
  changed({ ar, en: { ...en, mood: "{m}" } }, (root) => {
    refuses(runGate("i18n", root), "en.json — mood:m is a select in ar.json and not here");
  });
});

test("gate:i18n refuses a sentence that drops a name the Arabic fills in", () => {
  changed({ ar, en: { ...en, hello: "Hi there" } }, (root) => {
    refuses(runGate("i18n", root), "en.json — 'hello' never uses {name}, which ar.json does.");
  });
});

test("gate:i18n refuses a language the platform has no plural rules for", () => {
  withCatalogs({ ar, en, qqq: en }, (root) => {
    refuses(runGate("i18n", root), "qqq.json — the platform has no CLDR plural data for 'qqq'");
  });
});

test("gate:i18n refuses a message that does not parse", () => {
  changed({ ar, en: { ...en, pages: "{n, plural, one {one page}" } }, (root) => {
    refuses(runGate("i18n", root), "en.json — pages: ");
  });
});

test("gate:i18n refuses a folder with no Arabic to measure the others against", () => {
  const root = makeFixture({ [`${DIR}/en.json`]: json(en) });
  try {
    refuses(runGate("i18n", root), "the reference locale ar.json is missing");
  } finally {
    dropFixture(root);
  }
});
