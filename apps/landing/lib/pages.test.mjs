import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
 * What the front pages promise about the list has to match what the list does: one email to
 * confirm the address, then one when the apps ship (docs/design/hifth-app-mailing-list.md ⑤).
 * The form once said only "Nothing else", which stopped being true the day the confirm email
 * came in.
 */
const page = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const notifySection = (html) => html.match(/<section class="notify" id="notify">([\s\S]*?)<\/section>/)[1];

test("the English form promises the confirm email, then one when the apps ship", () => {
  const text = notifySection(page("index.html")).replace(/\s+/g, " ");
  assert.match(text, /one email to confirm/);
  assert.match(text, /one more when they ship/);
});

test("the Arabic form makes the same promise", () => {
  const text = notifySection(page("ar/index.html")).replace(/\s+/g, " ");
  assert.match(text, /رسالة واحدة لتأكيده/);
  assert.match(text, /رسالة أخرى حين يصدران/);
});

test("both privacy pages say an address is on the list only once its owner confirms it", () => {
  assert.match(page("privacy.html").replace(/\s+/g, " "), /confirm/i);
  assert.match(page("ar/privacy.html"), /تأكيد|تؤكد|أكدت/);
});

// The owner picked hello@hifth.app as the address a reader writes to (2026-11-14). Until then
// the pages showed a placeholder, which the release check refuses (docs/design/hifth-app-site.md ③).
test("both privacy pages give hello@hifth.app to write to, and no placeholder", () => {
  for (const path of ["privacy.html", "ar/privacy.html"]) {
    const html = page(path);
    assert.match(html, /href="mailto:hello@hifth\.app"/, path);
    assert.doesNotMatch(html, /contact address to come/, path);
  }
});
