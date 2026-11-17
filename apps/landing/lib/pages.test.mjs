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

/*
 * The site's own headers (the security review of 2026-11-14, docs/design/hifth-app-security.md).
 * Every address: no framing by another site, no guessing a file's type. The front pages also
 * name every place a script, frame or font may come from: this site, and Cloudflare's spam
 * check. The app under /read/ has a rule of its own, tested below.
 */
const headerRules = () => {
  const rules = {};
  let path;
  for (const line of page("_headers").split("\n")) {
    if (/^\s*(#|$)/.test(line)) continue;
    if (!/^\s/.test(line)) rules[(path = line.trim())] = {};
    else {
      const [name, ...value] = line.trim().split(":");
      rules[path][name.toLowerCase()] = value.join(":").trim();
    }
  }
  return rules;
};

test("every address refuses another site's frame and a guessed file type", () => {
  const all = headerRules()["/*"];
  assert.ok(all, "_headers has no rule for every address");
  assert.equal(all["x-frame-options"], "DENY");
  assert.equal(all["x-content-type-options"], "nosniff");
  assert.equal(all["referrer-policy"], "strict-origin-when-cross-origin");
  assert.doesNotMatch(page("_headers"), /cross-origin-opener-policy/i);
});

test("each front page lets scripts come only from this site and the spam check", () => {
  const rules = headerRules();
  for (const path of ["/", "/privacy", "/sources", "/support", "/ar/", "/ar/privacy", "/ar/sources", "/ar/support"]) {
    const csp = rules[path]?.["content-security-policy"] || "";
    assert.match(csp, /default-src 'self'/, path);
    assert.match(csp, /script-src 'self' https:\/\/challenges\.cloudflare\.com(;|$)/, path);
    assert.match(csp, /frame-src https:\/\/challenges\.cloudflare\.com(;|$)/, path);
    assert.match(csp, /frame-ancestors 'none'/, path);
    assert.match(csp, /object-src 'none'/, path);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/, path);
  }
});

/*
 * The app under /read/ (hifth-app-csp-for-the-app): scripts from this site only, plus the one
 * script written into its page, whose fingerprint the release fills in where the gap is. The
 * recitation comes from verses.quran.com. Nothing else from another site, no frames.
 */
// Apple reads the file naming which links open the app only when it is served as JSON, and it
// keeps its own copy, so ours must never be held by a cache (launch item 9).
test("Apple's links file is served as JSON and never held by a cache", () => {
  const rule = headerRules()["/.well-known/apple-app-site-association"];
  assert.ok(rule, "_headers has no rule for Apple's links file");
  assert.equal(rule["content-type"], "application/json");
  assert.equal(rule["cache-control"], "no-cache");
});

test("the app lets scripts come only from this site, and sounds only from the recitation's site", () => {
  const csp = headerRules()["/read/"]?.["content-security-policy"] || "";
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self' \{app-inline-scripts\}(;|$)/);
  assert.match(csp, /media-src 'self' blob: https:\/\/verses\.quran\.com(;|$)/);
  assert.match(csp, /connect-src 'self' https:\/\/verses\.quran\.com(;|$)/);
  assert.match(csp, /frame-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|https:\/\/(?!verses\.quran\.com)/);
});

test("no front page carries a script or style written into the page itself", () => {
  for (const path of ["index.html", "privacy.html", "sources.html", "support.html", "404.html", "ar/index.html", "ar/privacy.html", "ar/sources.html", "ar/support.html"]) {
    const html = page(path);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, `${path} has a script with no src`);
    assert.doesNotMatch(html, /<style|\sstyle="|\son[a-z]+="/, `${path} has a style or handler in the page`);
  }
});

/*
 * The support page (launch item 20, launch-support-page). Apple asks every listing for a support
 * address with a working way to reach us. The page tells a reader which button in the app makes
 * a problem report, so it names that button by the words the app shows, read from the app's own
 * message files: rename the button and this test says the page is out of date.
 */
const appWords = (lang) => JSON.parse(readFileSync(new URL(`../../web/src/messages/${lang}.json`, import.meta.url), "utf8"));

test("both support pages give hello@hifth.app to write to, and link the privacy page", () => {
  for (const [path, privacy] of [["support.html", "/privacy.html"], ["ar/support.html", "/ar/privacy.html"]]) {
    const html = page(path);
    assert.match(html, /href="mailto:hello@hifth\.app"/, path);
    assert.ok(html.includes(`href="${privacy}"`), `${path} links ${privacy}`);
  }
});

test("each support page names the app's report buttons by the words the app shows", () => {
  for (const [path, lang] of [["support.html", "en"], ["ar/support.html", "ar"]]) {
    const html = page(path);
    const words = appWords(lang);
    for (const key of ["reportOpen", "reportSend"]) {
      assert.ok(html.includes(words[key]), `${path} should say "${words[key]}", the app's ${key}`);
    }
  }
});

test("every page of the site links its support page", () => {
  for (const [path, href] of [
    ["index.html", "/support.html"],
    ["privacy.html", "/support.html"],
    ["sources.html", "/support.html"],
    ["support.html", "/sources.html"],
    ["ar/index.html", "/ar/support.html"],
    ["ar/privacy.html", "/ar/support.html"],
    ["ar/sources.html", "/ar/support.html"],
    ["ar/support.html", "/ar/sources.html"],
  ]) {
    const footer = page(path).match(/<footer>[\s\S]*?<\/footer>/)?.[0] ?? "";
    assert.ok(footer.includes(`href="${href}"`), `${path}'s footer links ${href}`);
  }
});

/*
 * The privacy page covers the apps, not only the list (launch item 29, launch-app-privacy-policy):
 * what stays on the device, the one thing the app fetches from another site, the report only the
 * reader sends, and that there are no accounts yet. Each part is a section with its own id, and
 * the two languages must have the same ones, so neither copy can quietly fall behind the other.
 */
const sectionIds = (html) => [...html.matchAll(/<h2 id="([\w-]+)"/g)].map(([, id]) => id);

test("both privacy pages cover the apps: the device, the recitation, the report and accounts", () => {
  for (const path of ["privacy.html", "ar/privacy.html"]) {
    const ids = sectionIds(page(path));
    for (const id of ["on-your-device", "recitation", "problem-report", "accounts", "list", "spam-check", "no-tracking"]) {
      assert.ok(ids.includes(id), `${path} has no section "${id}"`);
    }
    assert.match(page(path), /verses\.quran\.com/, `${path} names the site the recitation comes from`);
  }
});

test("the English and Arabic privacy pages have the same sections, in the same order", () => {
  assert.deepEqual(sectionIds(page("ar/privacy.html")), sectionIds(page("privacy.html")));
});
