// The check on the file the apps read at launch (app-status.mjs, launch item 21). The files here
// are made up; the real one, apps/landing/app-status.json, is checked last against the version
// in native/project.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_STATUS_FILE, appStatusProblems } from "./app-status.mjs";
import { current } from "../../release-app/scripts/app-version.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const ok = (file) => JSON.stringify({ format: 1, lowest: { ios: "0.1.0", macos: "0.1.0" }, notice: null, off: [], ...file });

test("a plain file with nothing switched off passes", () => {
  assert.deepEqual(appStatusProblems(ok({}), { shipping: "0.1.0" }), []);
});

test("a full notice and a part switched off pass", () => {
  const file = ok({ notice: { id: "made-up-1", en: "A made-up notice.", ar: "اشعار للتجربة", upTo: "0.1.0" }, off: ["pencil", "links"] });
  assert.deepEqual(appStatusProblems(file, { shipping: "0.1.0" }), []);
});

test("a missing file, or one that is not JSON, is refused", () => {
  assert.equal(appStatusProblems(null).length, 1);
  assert.match(appStatusProblems("<!doctype html>")[0], /not JSON/);
  assert.match(appStatusProblems("[]")[0], /one object/);
});

test("a format the apps out today cannot read is refused", () => {
  assert.match(appStatusProblems(ok({ format: 2 })).join("\n"), /format must be the number 1/);
  assert.match(appStatusProblems(ok({ format: "1" })).join("\n"), /format must be the number 1/);
});

test("a field no app reads is refused, so a new meaning goes in a new file", () => {
  assert.match(appStatusProblems(ok({ message: "hi" })).join("\n"), /"message", which no app reads/);
});

test("a lowest version above the one being shipped is refused", () => {
  const problems = appStatusProblems(ok({ lowest: { ios: "0.2.0" } }), { shipping: "0.1.0" });
  assert.match(problems.join("\n"), /above the version being shipped/);
  assert.deepEqual(appStatusProblems(ok({ lowest: { ios: "0.1.0" } }), { shipping: "0.10.0" }), []);
});

test("a version the apps could not read, or a platform they are not, is refused", () => {
  assert.match(appStatusProblems(ok({ lowest: { ios: "one" } })).join("\n"), /not a version/);
  assert.match(appStatusProblems(ok({ lowest: { android: "1.0.0" } })).join("\n"), /names "android"/);
});

test("a notice the apps would not show is refused", () => {
  assert.match(appStatusProblems(ok({ notice: { id: "x", en: "words" } })).join("\n"), /no "ar"/);
  assert.match(appStatusProblems(ok({ notice: { id: "x", en: "a", ar: "ب", upTo: "soon" } })).join("\n"), /upTo/);
  assert.match(appStatusProblems(ok({ notice: "words" })).join("\n"), /must be the notice/);
});

test("a notice's Arabic with vowel marks is refused", () => {
  assert.match(appStatusProblems(ok({ notice: { id: "x", en: "a", ar: "حِفْظ" } })).join("\n"), /vowel marks/);
});

test("a part the apps cannot switch off is refused", () => {
  assert.match(appStatusProblems(ok({ off: ["audio"] })).join("\n"), /names "audio"/);
  assert.match(appStatusProblems(ok({ off: "pencil" })).join("\n"), /list of parts/);
});

test("sign-in can be switched on, and nothing else can", () => {
  assert.deepEqual(appStatusProblems(ok({ on: ["sign-in"] })), []);
  assert.deepEqual(appStatusProblems(ok({ on: [] })), []);
  assert.match(appStatusProblems(ok({ on: ["marks-copy"] })).join("\n"), /names "marks-copy"/);
  assert.match(appStatusProblems(ok({ on: "sign-in" })).join("\n"), /"on" must be a list/);
});

test("the real file passes against the version in the project file", () => {
  const text = readFileSync(join(root, "apps/landing", APP_STATUS_FILE), "utf8");
  const { version: shipping } = current(readFileSync(join(root, "native/project.yml"), "utf8"));
  assert.deepEqual(appStatusProblems(text, { shipping }), []);
});
