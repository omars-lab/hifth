/**
 * What may go up to hifth.app, and what must never (owner, 2026-11-11: "ensuring the bare
 * minimum is deployed, in prod, no dev functionality").
 *
 * The check reads the exact folder a release would upload. A file is refused unless it is on
 * a short list of what the site needs, and a text file is refused if it carries a sign of a
 * development feature. The tests use made-up folders. A clean one passes, and each refusal is
 * a case that could really happen on this laptop. For example, a pitch build leaves a pitch/
 * folder inside the app's build folder, and it was found there on 2026-11-11.
 *
 * Written before shipped.mjs and seen failing. Run with: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { auditShipped } from "./shipped.mjs";

const HEAD = "0123456789abcdef0123456789abcdef01234567";

/** The smallest folder that is a whole release: the front page and the app under /read/. */
function cleanFolder() {
  return [
    { path: "index.html", text: '<div class="cf-turnstile" data-sitekey="0x4AAAAAAAreal-key"></div>' },
    { path: "privacy.html", text: "<p>Write to <a href=\"mailto:someone@example.com\">us</a>.</p>" },
    { path: "styles.css", text: "body { margin: 0 }" },
    { path: "notify.js", text: "fetch('/api/notify')" },
    { path: "shots/feature-notes.jpg", text: null },
    { path: "fonts/aref-ruqaa-wordmark.woff2", text: null },
    { path: "fonts/aref-ruqaa-OFL.txt", text: "SIL Open Font License" },
    { path: "404.html", text: "<h1>No page here</h1><a href=\"/\">Hifth</a>" },
    { path: "ar/index.html", text: '<html lang="ar" dir="rtl"><h1>حفظ</h1>' },
    { path: "ar/privacy.html", text: "<p>privacy</p>" },
    { path: "_headers", text: "/read/assets/*\n  Cache-Control: immutable\n" },
    { path: "read/index.html", text: '<script type="module" src="./assets/index-abc.js"></script>' },
    { path: "read/sw.js", text: "self.addEventListener('fetch', () => {})" },
    { path: "read/workbox-4e9e9954.js", text: "/* workbox */" },
    { path: "read/manifest.webmanifest", text: '{"name":"Hifth"}' },
    { path: "read/favicon.svg", text: "<svg/>" },
    { path: "read/icons/icon-192.png", text: null },
    { path: "read/assets/index-abc.js", text: `const c="${HEAD}";` },
    { path: "read/assets/index-abc.css", text: "a{}" },
    { path: "read/assets/pages/hafs/p1.svg", text: "<svg/>" },
  ];
}

const refusals = (files, opts = { commit: HEAD }) => auditShipped(files, opts).problems;
const paths = (problems) => problems.map((p) => p.path);

test("a clean release folder passes, and says what it holds", () => {
  const result = auditShipped(cleanFolder(), { commit: HEAD });
  assert.deepEqual(result.problems, []);
  assert.equal(result.files, 20);
});

test("a file that is not on the list of what the site needs is refused", () => {
  const files = [...cleanFolder(), { path: "notes.txt", text: "hello" }, { path: "read/stray.json", text: "{}" }];
  assert.deepEqual(paths(refusals(files)), ["notes.txt", "read/stray.json"]);
});

// The Arabic front page and its privacy page sit in ar/ (owner, 2026-11-12, the language bar).
// Only those two pages: the pictures, styles and script are shared from the root.
test("the Arabic pages pass, and nothing else in their folder", () => {
  const files = [...cleanFolder(), { path: "ar/notify.js", text: "" }, { path: "ar/shots/a.jpg", text: null }, { path: "ar/404.html", text: "" }];
  assert.deepEqual(paths(refusals(files)), ["ar/notify.js", "ar/shots/a.jpg", "ar/404.html"]);
});

// The old single phone picture at the top of the page gave way to the two-page opening picture
// in shots/ (t_9200ae); a leftover copy must not ship.
test("the retired opening picture does not ship", () => {
  assert.deepEqual(paths(refusals([...cleanFolder(), { path: "page-shot.png", text: null }])), ["page-shot.png"]);
});

test("the front page's pictures and wordmark font pass, and only in the kinds the page uses", () => {
  const files = [
    ...cleanFolder(),
    { path: "shots/device-phone.png", text: null },
    { path: "shots/notes.md", text: "draft" },
    { path: "shots/deep/feature.jpg", text: null },
    { path: "fonts/wordmark.ttf", text: null },
  ];
  assert.deepEqual(paths(refusals(files)), ["shots/notes.md", "shots/deep/feature.jpg", "fonts/wordmark.ttf"]);
});

test("a front-page picture named for the pitch build is refused, with the reason", () => {
  const files = [...cleanFolder(), { path: "shots/pitch-commentary.jpg", text: null }];
  const [problem] = refusals(files);
  assert.equal(problem.path, "shots/pitch-commentary.jpg");
  assert.match(problem.why, /pitch/);
});

test("a pitch build left in the app's folder is refused, with the reason", () => {
  const files = [...cleanFolder(), { path: "read/pitch/index.html", text: "<html>" }];
  const [problem] = refusals(files);
  assert.equal(problem.path, "read/pitch/index.html");
  assert.match(problem.why, /pitch/);
});

test("debug copies of the source, the design pages and hidden files are refused", () => {
  const files = [
    ...cleanFolder(),
    { path: "read/sw.js.map", text: "{}" },
    { path: "read/assets/index-abc.js.map", text: "{}" },
    { path: "read/docs/index.html", text: "<html>" },
    { path: ".intent/picture/index.html", text: "<html>" },
    { path: "read/.DS_Store", text: null },
  ];
  assert.deepEqual(paths(refusals(files)), [
    "read/sw.js.map",
    "read/assets/index-abc.js.map",
    "read/docs/index.html",
    ".intent/picture/index.html",
    "read/.DS_Store",
  ]);
});

test("the server's own code is never served as a plain file", () => {
  const files = [...cleanFolder(), { path: "functions/api/notify.js", text: "export {}" }, { path: "lib/notify.js", text: "" }];
  assert.deepEqual(paths(refusals(files)), ["functions/api/notify.js", "lib/notify.js"]);
});

test("a development feature named in a shipped file is refused, each with its reason", () => {
  const cases = [
    ["/@vite/client", /live reload/],
    ["import pageComments from './page-comments'", /comment/],
    ["fetch('/intent/')", /commit picture|what each commit/],
    ["fetch('/dev-fixtures/qul-page-1.json')", /outside library|page data/],
    ['data-sitekey="1x00000000000000000000AA"', /test key/],
    ['data-sitekey="2x00000000000000000000AB"', /test key/],
    ["http://127.0.0.1:7122/", /this laptop/],
    ["http://localhost:4190/", /this laptop/],
    ["<span class=\"contact\">[contact address to come]</span>", /placeholder/],
  ];
  for (const [text, why] of cases) {
    const files = cleanFolder().map((f) => (f.path === "read/assets/index-abc.css" ? { ...f, text } : f));
    const problems = refusals(files);
    assert.equal(problems.length, 1, `expected one refusal for ${text}, got ${JSON.stringify(problems)}`);
    assert.equal(problems[0].path, "read/assets/index-abc.css");
    assert.match(problems[0].why, why, text);
  }
});

// The old address opens hifth.app/read in a new tab and hands it the reader's
// marks through the link between the two tabs. This header cuts that link, and
// the carry would then fail for every reader, quietly, falling back to a file.
test("a header that cuts the link between the old tab and the new one is refused", () => {
  const files = cleanFolder().map((f) =>
    f.path === "_headers" ? { ...f, text: `${f.text}/*\n  Cross-Origin-Opener-Policy: same-origin\n` } : f,
  );
  const got = refusals(files);
  assert.deepEqual(paths(got), ["_headers"]);
  assert.match(got[0].why, /carry/);
});

test("a release missing a page the site needs is refused", () => {
  const files = cleanFolder().filter((f) => !["read/index.html", "privacy.html", "404.html"].includes(f.path));
  assert.deepEqual(paths(refusals(files)), ["privacy.html", "404.html", "read/index.html"]);
});

test("the app must carry the commit being released, so its source-code offer is true", () => {
  const files = cleanFolder();
  assert.deepEqual(refusals(files, { commit: HEAD }), []);
  const [problem] = refusals(files, { commit: "f".repeat(40) });
  assert.equal(problem.path, "read/assets");
  assert.match(problem.why, /commit/);
});
