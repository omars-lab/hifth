/**
 * The walk scripts find the app's buttons by the names the app gives them. When a
 * name changes, a search for the old one finds nothing, and the walk says "no
 * roots button" about a screen that has one (the verse's Play became Listen, and
 * Roots became Same roots, and three walks went blind). So each search a walk
 * makes for a named button is checked here against the message it means, in
 * English and in Arabic.
 *
 * Run with the other script tests: node --test scripts/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dir = new URL("../.claude/skills/walk-app/scripts/", import.meta.url);
const messages = (lang) =>
  JSON.parse(readFileSync(new URL(`../apps/web/src/messages/${lang}.json`, import.meta.url), "utf8"));
const en = messages("en");
const ar = messages("ar");

/** Every way a message can read, its placeholders filled with a verse's name. */
function variants(message) {
  const select = /\{(\w+), select, ((?:\w+\{(?:[^{}]|\{[^{}]*\})*\}\s*)+)\}/;
  const m = message.match(select);
  if (m) {
    const branches = [...m[2].matchAll(/\w+\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map((b) => b[1]);
    return branches.flatMap((b) => variants(message.replace(m[0], b)));
  }
  return [message.replace(/\{\w+\}/g, "Verse 3")];
}

/** The regular expressions written on the first line of a script that holds `anchor`. */
function searches(script, anchor) {
  const source = readFileSync(new URL(script, dir), "utf8");
  const line = source.split("\n").find((l) => l.includes(anchor));
  assert.ok(line, `${script} has no line with ${anchor}`);
  const found = [...line.matchAll(/\/(\^[^/]+)\/([a-z]*)/g)].map((r) => new RegExp(r[1], r[2]));
  assert.ok(found.length, `${script}'s line with ${anchor} searches for nothing`);
  // A line written `isAr ? /…/ : /…/` searches Arabic first, then English.
  return /isAr \?/.test(line) && found.length >= 2 ? { ar: [found[0]], en: [found[1]] } : { ar: found, en: found };
}

// script · a piece of the line that makes the search · the message it means to find
const SEARCHES = [
  ["corner-cards.js", "const roots =", "rootsTrigger"],
  ["corner-cards.js", "const share =", "shareAriaAyah"],
  ["corner-cards.js", "const isClose =", "close"],
  ["gap-walk.js", "item = buttons().find", "playAyah"],
  ["gap-walk.js", "const pause =", "pauseAyah"],
  ["heard-keep-walk.js", "const pausing =", "pauseAyah"],
  ["kept-play-walk.js", "const pausing =", "pauseAyah"],
  ["playto-walk.js", "const tools =", "playAyah"],
  ["playto-walk.js", "const stop =", "pauseAyah"],
  ["run-note.js", "const runBtns =", "playAyah"],
  ["run-note.js", "const runBtns =", "pauseAyah"],
  ["run-note.js", "const stop =", "pauseAyah"],
  ["visit-walk.js", "(isAr ? /^(", "playAyah"],
  ["visit-walk.js", "(isAr ? /^(", "pauseAyah"],
  ["visit-walk.js", "const pause =", "pauseAyah"],
  ["visit-walk.js", "const cite =", "goToVerse"],
  ["thread-walk.js", "const refs =", "goToVerse"],
  ["ref-turn-walk.js", "const cite =", "goToVerse"],
  ["ref-walk.js", "const back =", "beadBack"],
  ["settings-walk.js", "const open =", "about"],
];

for (const [script, anchor, key] of SEARCHES) {
  test(`${script} finds the ${key} button by the name the app gives it`, () => {
    const found = searches(script, anchor);
    for (const [lang, book] of [["en", en], ["ar", ar]]) {
      assert.ok(book[key], `${lang} has no message ${key}`);
      const names = variants(book[key]);
      assert.ok(
        found[lang].some((re) => names.some((n) => re.test(n))),
        `${script} (${anchor}) looks for ${found[lang].join(" or ")}, but the ${lang} button is named "${names[0]}"`,
      );
    }
  });
}
