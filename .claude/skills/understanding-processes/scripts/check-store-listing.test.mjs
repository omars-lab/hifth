import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The store listing check, run on the real listing page and on made-up broken
// copies of it. Every broken copy is the real page with one thing changed, so
// each test shows that one fault, and only it, is caught.
const script = fileURLToPath(new URL("./check-store-listing.mjs", import.meta.url));
const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const real = readFileSync(join(repo, "docs/design/store-listing.md"), "utf8");

function run(page, root = repo) {
  const dir = mkdtempSync(join(tmpdir(), "listing-"));
  const file = join(dir, "store-listing.md");
  writeFileSync(file, page);
  const out = spawnSync(process.execPath, [script, "--file", file, "--root", root], { encoding: "utf8" });
  return { code: out.status, out: out.stdout };
}

/** The real page with one field's text replaced. */
function withField(name, text) {
  const pattern = new RegExp(`(<!-- field: ${name} -->\\n\`\`\`text\\n)[\\s\\S]*?(\\n\`\`\`)`);
  assert.match(real, pattern, `the real page has a ${name} box`);
  return real.replace(pattern, `$1${text}$2`);
}

test("the real listing fits Apple's limits and agrees with the app", () => {
  const { code, out } = run(real);
  assert.equal(code, 0, out);
  assert.match(out, /^subtitle: \d+ of 30$/m);
  assert.match(out, /^description: \d+ of 4000$/m);
});

test("it prints lengths and names, never a field's words", () => {
  const { out } = run(real);
  assert.doesNotMatch(out, /look-alike/);
});

test("a subtitle over 30 characters is refused, with how far over", () => {
  const { code, out } = run(withField("subtitle", "A made-up subtitle that runs well past the limit"));
  assert.equal(code, 1);
  assert.match(out, /problem: subtitle: 48 characters, 18 over Apple's 30/);
});

test("a missing field is refused", () => {
  const { code, out } = run(real.replace("<!-- field: promotional-text -->", ""));
  assert.equal(code, 1);
  assert.match(out, /problem: promotional-text: missing/);
});

test("a long dash is refused", () => {
  const { code, out } = run(withField("promotional-text", "Made-up words — with a long dash"));
  assert.equal(code, 1);
  assert.match(out, /problem: promotional-text: has a long dash/);
});

test("a keyword that repeats a subtitle word, or itself, is refused", () => {
  const { code, out } = run(withField("keywords", "quran,verses,quran"));
  assert.equal(code, 1);
  assert.match(out, /keywords: a keyword is listed twice/);
  assert.match(out, /keywords: 1 keyword\(s\) repeat a word already in the name or subtitle/);
});

test("a name that is not the app's display name is refused", () => {
  const { code, out } = run(withField("name", "Madeup"));
  assert.equal(code, 1);
  assert.match(out, /name: differs from the iPad and iPhone app's display name/);
});

test("declaring collected data the privacy file does not list is refused", () => {
  const { code, out } = run(withField("privacy-answer", "Data Linked to You"));
  assert.equal(code, 1);
  assert.match(out, /privacy-answer: declares collected data, but the privacy file lists none/);
});

test("a category the Mac app does not carry is refused", () => {
  const { code, out } = run(real.replace("**Category:** Education first", "**Category:** Reference first"));
  assert.equal(code, 1);
  assert.match(out, /category: differs from the Mac app's category/);
});

test("a hifth.app page the site does not have is refused", () => {
  const { code, out } = run(real.replace("https://hifth.app/support.html", "https://hifth.app/madeup.html"));
  assert.equal(code, 1);
  assert.match(out, /addresses: hifth.app\/madeup.html is not in the site's files/);
});

test("settings that stop saying the app uses only exempt encryption are refused", () => {
  const root = mkdtempSync(join(tmpdir(), "listing-root-"));
  for (const path of ["native/Hifth/Resources", "apps/landing", "apps/web/src/messages"]) {
    cpSync(join(repo, path), join(root, path), { recursive: true });
  }
  const plist = join(root, "native/Hifth/Resources/Info-macOS.plist");
  writeFileSync(plist, readFileSync(plist, "utf8").replace(
    /(<key>ITSAppUsesNonExemptEncryption<\/key>\s*)<false\/>/, "$1<true/>"));
  const { code, out } = run(real, root);
  assert.equal(code, 1);
  assert.match(out, /export answer: the Mac settings do not say/);
  assert.doesNotMatch(out, /iPad and iPhone settings do not say/);
});
