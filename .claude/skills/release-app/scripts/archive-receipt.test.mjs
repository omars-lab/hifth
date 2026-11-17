// The archive's receipt, tried on a made-up archive folder. The real one is
// native/build/store/Hifth.xcarchive; `make app-archive` writes its receipt
// after the release check passes, and `make app-export` reads it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fixtureEnv } from "../../../../scripts/gate-fixture.mjs";

const SCRIPT = new URL("./archive-receipt.mjs", import.meta.url).pathname;
const COMMIT = "0123456789abcdef0123456789abcdef01234567";

/** A folder shaped like an Xcode archive, with a tiny app inside. */
function archive() {
  const at = join(mkdtempSync(join(tmpdir(), "hifth-archive-")), "Hifth.xcarchive");
  const app = join(at, "Products/Applications/Hifth.app");
  mkdirSync(join(app, "Web"), { recursive: true });
  writeFileSync(join(app, "Info.plist"), "<plist>made up</plist>");
  writeFileSync(join(app, "Hifth"), "made-up program");
  writeFileSync(join(app, "Web/index.html"), "<p>made up</p>");
  writeFileSync(join(at, "Info.plist"), "<plist>the archive's own</plist>");
  return at;
}

function run(...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
}
const write = (at, ...extra) => run("--write", at, "--commit", COMMIT, "--clean", "yes", ...extra);
const check = (at) => run("--check", at);

test("an archive the command made, untouched since, passes", () => {
  const at = archive();
  const w = write(at);
  assert.equal(w.status, 0, w.stdout + w.stderr);
  assert.ok(existsSync(`${at}.receipt.json`), "no receipt beside the archive");
  const c = check(at);
  assert.equal(c.status, 0, c.stdout + c.stderr);
  assert.match(c.stdout, /ev=receipt_ok/);
  assert.match(c.stdout, new RegExp(`commit=${COMMIT.slice(0, 12)}`));
});

test("an archive with no receipt was not made by the archive command, and is refused", () => {
  const at = archive();
  const c = check(at);
  assert.equal(c.status, 1);
  assert.match(c.stdout, /make app-archive/);
});

test("the Mac archive's receipt names the Mac command, and so does its refusal", () => {
  const at = archive();
  const w = write(at, "--by", "make app-archive-mac");
  assert.equal(w.status, 0, w.stdout + w.stderr);
  assert.equal(JSON.parse(readFileSync(`${at}.receipt.json`, "utf8")).madeBy, "make app-archive-mac");
  const bare = archive();
  const c = run("--check", bare, "--by", "make app-archive-mac");
  assert.equal(c.status, 1);
  assert.match(c.stdout, /Run: make app-archive-mac$/m);
});

test("a file changed inside the app after the archive was made is refused", () => {
  const at = archive();
  write(at);
  writeFileSync(join(at, "Products/Applications/Hifth.app/Web/index.html"), "<p>swapped</p>");
  const c = check(at);
  assert.equal(c.status, 1);
  assert.match(c.stdout, /changed since/);
});

test("a file added to, or taken out of, the app is refused too", () => {
  const added = archive();
  write(added);
  writeFileSync(join(added, "Products/Applications/Hifth.app/Web/extra.js"), "1");
  assert.equal(check(added).status, 1);

  const removed = archive();
  write(removed);
  rmSync(join(removed, "Products/Applications/Hifth.app/Web/index.html"));
  assert.equal(check(removed).status, 1);
});

test("a file renamed, with the same bytes, is still a different app", () => {
  const at = archive();
  write(at);
  const app = join(at, "Products/Applications/Hifth.app");
  cpSync(join(app, "Web/index.html"), join(app, "Web/other.html"));
  rmSync(join(app, "Web/index.html"));
  assert.equal(check(at).status, 1);
});

test("a receipt copied from another archive does not pass for this one", () => {
  const first = archive();
  write(first);
  const second = archive();
  writeFileSync(join(second, "Products/Applications/Hifth.app/Hifth"), "a different program");
  cpSync(`${first}.receipt.json`, `${second}.receipt.json`);
  assert.equal(check(second).status, 1);
});

test("a receipt that is not one (unreadable, or missing its fingerprint) is refused", () => {
  const at = archive();
  writeFileSync(`${at}.receipt.json`, "not json");
  assert.equal(check(at).status, 1);
  writeFileSync(`${at}.receipt.json`, JSON.stringify({ commit: COMMIT }));
  assert.equal(check(at).status, 1);
});

test("a folder with no app inside is not an archive, and gets no receipt", () => {
  const at = join(mkdtempSync(join(tmpdir(), "hifth-archive-")), "Empty.xcarchive");
  mkdirSync(at);
  const w = write(at);
  assert.equal(w.status, 2);
  assert.ok(!existsSync(`${at}.receipt.json`));
});

test("the receipt says which commit it was made from and whether the tree was clean", () => {
  const at = archive();
  write(at, "--flavour", "public");
  const r = JSON.parse(readFileSync(`${at}.receipt.json`, "utf8"));
  assert.equal(r.commit, COMMIT);
  assert.equal(r.clean, true);
  assert.equal(r.flavour, "public");
  assert.match(r.fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(r.files, 3);
});

// Asked of a made-up repo, run with git's own variables taken out, so a
// commit hook's pointers at the real repo never reach it.
function repo() {
  const at = mkdtempSync(join(tmpdir(), "hifth-repo-"));
  const g = (...a) => spawnSync("git", ["-C", at, ...a], { encoding: "utf8", env: fixtureEnv() });
  g("init", "-q");
  writeFileSync(join(at, "a.txt"), "1");
  mkdirSync(join(at, ".page-comments/threads"), { recursive: true });
  writeFileSync(join(at, ".page-comments/threads/t.jsonl"), "{}\n");
  g("add", "a.txt", ".page-comments/threads/t.jsonl");
  g("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--no-verify", "-m", "fixture");
  return at;
}
const writeIn = (dir, at) =>
  spawnSync(process.execPath, [SCRIPT, "--write", at, "--commit", COMMIT], { encoding: "utf8", cwd: dir, env: fixtureEnv() });

// The comment server writes into .page-comments/ while the app is built, and
// none of it goes into the app, so it never makes a tree count as uncommitted.
test("a comment written on a page while the archive was made does not count as uncommitted work", () => {
  const dir = repo();
  writeFileSync(join(dir, ".page-comments/threads/t.jsonl"), "{}\n{}\n");
  const at = archive();
  assert.equal(writeIn(dir, at).status, 0);
  assert.equal(JSON.parse(readFileSync(`${at}.receipt.json`, "utf8")).clean, true);
});

test("any other uncommitted change still does", () => {
  const dir = repo();
  writeFileSync(join(dir, "a.txt"), "2");
  const at = archive();
  assert.equal(writeIn(dir, at).status, 0);
  assert.equal(JSON.parse(readFileSync(`${at}.receipt.json`, "utf8")).clean, false);
});

test("run from a folder inside the repo, a change elsewhere in it still counts", () => {
  const dir = repo();
  mkdirSync(join(dir, "native"));
  writeFileSync(join(dir, "a.txt"), "2");
  const at = archive();
  assert.equal(writeIn(join(dir, "native"), at).status, 0);
  assert.equal(JSON.parse(readFileSync(`${at}.receipt.json`, "utf8")).clean, false);
});

test("an archive made from uncommitted work says so when checked", () => {
  const at = archive();
  run("--write", at, "--commit", COMMIT, "--clean", "no");
  const c = check(at);
  assert.equal(c.status, 0, c.stdout + c.stderr);
  assert.match(c.stdout, /clean=no/);
});
