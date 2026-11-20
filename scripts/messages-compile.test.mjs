/**
 * The word compiler writes each language's words as a TypeScript file. A pack
 * whose sentences have no plurals or choices (the account section's, sign-in
 * ⑳) must not import the helpers it never calls: the lint check refuses an
 * unused import, and the commit stops. Written before the fix and seen failing.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyse, emitLocale } from "./messages-compile.mjs";

test("a pack with only plain sentences imports no helpers", () => {
  const out = emitLocale(analyse({ hello: "Hello there." }, "en"), "account");
  assert.doesNotMatch(out, /import \{[^}]*\b(plural|select)\b/);
  assert.doesNotMatch(out, /const LC\b/);
  assert.match(out, /hello: "Hello there\.",/);
});

test("a pack with a plural imports the plural helper and the language tag", () => {
  const out = emitLocale(analyse({ pages: "{n, plural, one{1 page} other{{nText} pages}}" }, "en"), "account");
  assert.match(out, /import \{ plural \} from "\.\.\/plural";/);
  assert.match(out, /const LC = "en";/);
});

test("a choice alone imports only the choice helper", () => {
  const out = emitLocale(analyse({ who: "{g, select, a {A} other {B}}" }, "en"));
  assert.match(out, /import \{ select \} from "\.\/plural";/);
  assert.doesNotMatch(out, /\bplural\b.*from/);
});
