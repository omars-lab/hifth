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

/*
 * The apps keep Apple's crash and freeze reports on the device (launch item 17) and the problem
 * report lists them, so both privacy pages must say so, in the report's section, and give the
 * same count the app keeps. The count is read from the app's own code, so keeping more fails
 * here before the page under-promises.
 */
test("both privacy pages say how many crash and freeze reports the apps keep, and that they leave only in a report", () => {
  const swift = readFileSync(new URL("../../../native/Hifth/App/DeviceReports.swift", import.meta.url), "utf8");
  const keep = Number(swift.match(/static let keep = (\d+)/)?.[1]);
  assert.equal(keep, 5, "the app's count is read, and the pages below say five");
  const section = (html) => html.slice(html.indexOf('id="problem-report"'), html.indexOf('id="accounts"'));
  assert.match(section(page("privacy.html")), /last five short reports[\s\S]*only\s+inside a problem report you choose to send/);
  assert.match(section(page("ar/privacy.html")), /آخر خمسة تقارير[\s\S]*إلا داخل بلاغ عن مشكلة تختار أنت إرساله/);
});

/*
 * The app asks for a verse's sound before it is played (when its tools open, and the next few
 * while one plays), so the policy must say so and name the setting that stops it. It names the
 * setting by the words the app shows, so renaming the setting fails here, not on a reader. The
 * site's Arabic is written without vowel marks, so the app's words are compared without them.
 */
const withoutVowelMarks = (text) => text.replace(/[ً-ْٰ]/g, "");

test("both privacy pages say the sound is asked for early, and name the setting that stops it", () => {
  for (const [path, lang] of [["privacy.html", "en"], ["ar/privacy.html", "ar"]]) {
    const section = page(path).match(/<h2 id="recitation">[\s\S]*?<\/p>/)?.[0].replace(/\s+/g, " ") ?? "";
    const words = appWords(lang);
    for (const key of ["runAheadTitle", "runAheadOff"]) {
      const want = withoutVowelMarks(words[key]);
      assert.ok(section.includes(want), `${path}'s recitation section should say "${want}", the app's ${key}`);
    }
  }
});

test("the English and Arabic privacy pages have the same sections, in the same order", () => {
  assert.deepEqual(sectionIds(page("ar/privacy.html")), sectionIds(page("privacy.html")));
});

/*
 * The design check of 2026-11-16 (docs/design/app-layout.md ⑩, backlog front-page-comments-of-nov-12)
 * measured six faults on the served front page. Each test below holds one of them shut: the
 * styles are read as text, the page's named colours are read from its :root blocks, and the
 * contrast is worked out the way WCAG does, so a colour change that makes a ring or an edge
 * faint again fails here before anyone has to see it.
 */
const styles = () => page("styles.css");
const tokensIn = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]));
const schemes = () => {
  const css = styles();
  const light = tokensIn(css.match(/^:root\s*\{([\s\S]*?)\}/m)[1]);
  const dark = { ...light, ...tokensIn(css.match(/:root:not\(\[data-theme="light"\]\)\s*\{([\s\S]*?)\}/)[1]) };
  return { light, dark };
};
const resolve = (tokens, value) => {
  for (let v = value, i = 0; i < 5; i++) {
    const ref = v.match(/^var\(--([\w-]+)\)$/);
    if (!ref) return v;
    v = tokens[ref[1]];
  }
  return value;
};
const luminance = (hex) => {
  const [r, g, b] = hex.replace("#", "").match(/../g).map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const outsideRoot = () => styles().replace(/:root[^{]*\{[^}]*\}/g, "");
const ruleFor = (selector) => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\#:]/g, "\\$&");
  return outsideRoot().match(new RegExp(`(?:^|[},]\\s*)${esc}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, "m"))?.[1] ?? "";
};

test("every control shows a keyboard ring at 3:1 or better, in light and dark", () => {
  const ring = ruleFor(":focus-visible");
  assert.match(ring, /outline:\s*\d+px solid var\(--focus\)/, "one :focus-visible rule for every control, drawn in --focus");
  for (const [name, tokens] of Object.entries(schemes())) {
    for (const surface of ["paper", "card"]) {
      const ratio = contrast(resolve(tokens, tokens.focus), resolve(tokens, tokens[surface]));
      assert.ok(ratio >= 3, `${name}: the ring is ${ratio.toFixed(2)}:1 on --${surface}`);
    }
  }
  assert.doesNotMatch(outsideRoot(), /outline:\s*[^;]*var\(--ochre\)/, "the faint ochre ring is gone from the device tabs");
});

test("the email box's edge is 3:1 or better against the page, in light and dark", () => {
  assert.match(ruleFor("#notify-email"), /border:\s*1px solid var\(--field-edge\)/);
  for (const [name, tokens] of Object.entries(schemes())) {
    for (const surface of ["paper", "card"]) {
      const ratio = contrast(resolve(tokens, tokens["field-edge"]), resolve(tokens, tokens[surface]));
      assert.ok(ratio >= 3, `${name}: the box's edge is ${ratio.toFixed(2)}:1 on --${surface}`);
    }
  }
});

test("a button's words never break onto a second line", () => {
  assert.match(ruleFor(".button"), /white-space:\s*nowrap/);
});

test("headings and the opening line balance their lines, so none ends on one word", () => {
  for (const selector of ["h1, h2, h3", ".lead"]) {
    assert.match(ruleFor(selector), /text-wrap:\s*balance/, selector);
  }
});

test("the front page's styles use three weights of type at most", () => {
  const weights = new Set([
    ...[...styles().matchAll(/font:\s*(\d00)\s/g)].map(([, w]) => w),
    ...[...styles().matchAll(/font-weight:\s*(\d00)/g)].map(([, w]) => w),
    "400",
  ]);
  assert.ok(weights.size <= 3, `weights in use: ${[...weights].sort().join(", ")}`);
});

test("no colour is written in place: shadows and the rest come from the named colours", () => {
  assert.doesNotMatch(outsideRoot(), /rgba?\(|#[0-9a-f]{3,8}\b/i);
  for (const [name, tokens] of Object.entries(schemes())) {
    for (const key of ["shadow-soft", "shadow-raised"]) assert.ok(tokens[key], `${name} names --${key}`);
  }
});

test("the front page's footer links are a list, not a row joined by dots", () => {
  for (const path of ["index.html", "ar/index.html"]) {
    const footer = page(path).match(/<footer>[\s\S]*?<\/footer>/)[0];
    assert.doesNotMatch(footer, /·/, `${path}'s footer joins links with dots`);
    assert.match(footer, /<ul class="footer-links">[\s\S]*<li><a /, `${path}'s footer lists its links`);
  }
});
