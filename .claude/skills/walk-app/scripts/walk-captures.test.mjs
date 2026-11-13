// walk-captures copies the captures the debug iPad app keeps when the owner
// takes a screenshot, and draws them as one page on the laptop (walk-app skill).
//
// Apple's device tool is swapped for a stand-in here (HIFTH_DEVICECTL) that
// keeps a made-up iPad's files in a folder, with a made-up device id, made-up
// notes and blank pictures, so no iPad is needed and no book text is involved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const here = new URL(".", import.meta.url).pathname;
const script = join(here, "walk-captures.mjs");
const root = join(here, "../../../..");
const DEVICE = "00000000-FAKE-4000-8000-000000000000";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function where(over) {
  return JSON.stringify({
    at: "2026-11-13T10:15:00.000Z",
    trigger: "screenshot",
    route: "/hafs-kfqc/p7",
    page: 7,
    verse: null,
    open: [],
    settings: {},
    pageAnswered: true,
    screen: { width: 1032, height: 1376, scale: 2, orientation: "portrait" },
    build: { commit: "abcd1234", flavour: "pitch" },
    ...over,
  });
}

const trail = [
  { kind: "touch", phase: "began", at: "10:14:58.000", before: 2, x: 10, y: 20 },
  { kind: "touch", phase: "ended", at: "10:14:58.100", before: 1.9, x: 10, y: 20 },
  { kind: "route", at: "10:14:59.000", before: 1, route: "/hafs-kfqc/2:43" },
].map((l) => JSON.stringify(l)).join("\n") + "\n";

// A made-up iPad: the app's Documents/walk-captures, two captures, a stray file.
function fakeIpad({ grow = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "hifth-fake-ipad-"));
  const captures = join(dir, "container", "Documents", "walk-captures");
  const put = (rel, data) => {
    mkdirSync(join(captures, rel, ".."), { recursive: true });
    writeFileSync(join(captures, rel), data);
  };
  put("20261113-101500/picture.png", PNG);
  put("20261113-101500/trail.jsonl", trail);
  put("20261113-101500/where.json", where({ verse: "2:43", route: "/hafs-kfqc/2:43" }));
  put("20261113-101500/note.txt", "the <b>pen</b> jumped\n");
  put("20261113-100200/where.json", where({ at: "2026-11-13T10:02:00.000Z", pageAnswered: false, page: null }));
  put("20261113-100200/trail.jsonl", "");
  put("20261113-100200/scratch.tmp", "not a capture file");
  put("stray.txt", "not a capture");
  const calls = join(dir, "calls.log");
  const bin = join(dir, "devicectl");
  writeFileSync(
    bin,
    `#!/usr/bin/env node
const a = process.argv.slice(2), at = (k) => a[a.indexOf(k) + 1], fs = require("fs"), path = require("path");
fs.appendFileSync(${JSON.stringify(calls)}, a.join(" ") + "\\n");
if (at("--device") !== ${JSON.stringify(DEVICE)}) { console.error("no such device"); process.exit(1); }
if (at("--domain-type") !== "appDataContainer" || at("--domain-identifier") !== "com.bytesofpurpose.hifth") { console.error("wrong domain"); process.exit(1); }
const container = ${JSON.stringify(join(dir, "container"))};
if (a.includes("info")) {
  const base = path.join(container, at("--subdirectory"));
  const lists = fs.readFileSync(${JSON.stringify(calls)}, "utf8").split("\\n").filter((l) => l.includes("info files")).length;
  if (${grow} && lists === 2) {
    fs.mkdirSync(path.join(base, "20261113-103000"), { recursive: true });
    fs.writeFileSync(path.join(base, "20261113-103000", "where.json"), "{}");
  }
  const files = [];
  const walk = (d) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); const rel = path.relative(base, p);
    if (fs.statSync(p).isDirectory()) { files.push({ name: n, relativePath: rel, metadata: { type: "directory" } }); walk(p); }
    else files.push({ name: n, relativePath: rel, metadata: { size: fs.statSync(p).size } }); } };
  if (fs.existsSync(base)) walk(base);
  fs.writeFileSync(at("--json-output"), JSON.stringify({ result: { files } }));
} else if (a.includes("from")) {
  const src = path.join(container, at("--source"));
  if (process.env.FAKE_FAIL_COPY && src.endsWith(process.env.FAKE_FAIL_COPY)) { console.error("copy failed"); process.exit(1); }
  fs.copyFileSync(src, at("--destination"));
} else if (a.includes("to")) {
  const dest = path.join(container, at("--destination"));
  if (at("--remove-existing-content") === "true") fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const n of fs.readdirSync(at("--source"))) fs.cpSync(path.join(at("--source"), n), path.join(dest, n), { recursive: true });
}
`,
  );
  chmodSync(bin, 0o755);
  return { bin, captures, calls };
}

function run(args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
}

test("pull copies each capture's own files, and nothing else on the iPad", () => {
  const ipad = fakeIpad();
  const out = mkdtempSync(join(tmpdir(), "hifth-walks-"));
  const r = run(["pull", "--device", DEVICE, "--dir", out], { HIFTH_DEVICECTL: ipad.bin });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const names = readdirSync(out).filter((n) => /^\d{8}-/.test(n)).sort();
  assert.deepEqual(names, ["20261113-100200", "20261113-101500"]);
  assert.deepEqual(readdirSync(join(out, "20261113-101500")).sort(), ["note.txt", "picture.png", "trail.jsonl", "where.json"]);
  assert.deepEqual(readdirSync(join(out, "20261113-100200")).sort(), ["trail.jsonl", "where.json"]);
  assert.equal(existsSync(join(out, "stray.txt")), false);
  assert.match(r.stdout, /ev=done .*captures=2 .*copied=6/);
  assert.ok(existsSync(join(out, "index.html")), "a pull also draws the page");
});

test("a second pull does not copy a picture again, but does refresh the note and where", () => {
  const ipad = fakeIpad();
  const out = mkdtempSync(join(tmpdir(), "hifth-walks-"));
  run(["pull", "--device", DEVICE, "--dir", out], { HIFTH_DEVICECTL: ipad.bin });
  writeFileSync(join(ipad.captures, "20261113-101500", "note.txt"), "a later note\n");
  const r = run(["pull", "--device", DEVICE, "--dir", out], { HIFTH_DEVICECTL: ipad.bin });
  assert.equal(r.status, 0, r.stderr);
  const copies = readFileSync(ipad.calls, "utf8").split("\n").filter((l) => l.includes("copy from") && l.includes("picture.png"));
  assert.equal(copies.length, 1);
  assert.equal(readFileSync(join(out, "20261113-101500", "note.txt"), "utf8"), "a later note\n");
});

test("--clear empties the iPad's captures once every one is copied", () => {
  const ipad = fakeIpad();
  const out = mkdtempSync(join(tmpdir(), "hifth-walks-"));
  const r = run(["pull", "--device", DEVICE, "--dir", out, "--clear"], { HIFTH_DEVICECTL: ipad.bin });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.deepEqual(readdirSync(ipad.captures), []);
  assert.match(r.stdout, /ev=cleared .*left=0/);
  assert.equal(readdirSync(join(out, "20261113-101500")).length, 4, "the copies are kept");
});

test("--clear leaves the iPad alone when a copy failed", () => {
  const ipad = fakeIpad();
  const out = mkdtempSync(join(tmpdir(), "hifth-walks-"));
  const r = run(["pull", "--device", DEVICE, "--dir", out, "--clear"], { HIFTH_DEVICECTL: ipad.bin, FAKE_FAIL_COPY: "picture.png" });
  assert.equal(r.status, 1);
  assert.ok(existsSync(join(ipad.captures, "20261113-101500", "picture.png")));
  assert.match(r.stdout, /ev=clear_skipped .*reason=copy_failed/);
});

test("--clear leaves the iPad alone when a capture was taken during the copy", () => {
  const ipad = fakeIpad({ grow: true });
  const out = mkdtempSync(join(tmpdir(), "hifth-walks-"));
  const r = run(["pull", "--device", DEVICE, "--dir", out, "--clear"], { HIFTH_DEVICECTL: ipad.bin });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(ipad.captures, "20261113-103000")));
  assert.ok(existsSync(join(ipad.captures, "20261113-101500")));
  assert.match(r.stdout, /ev=clear_skipped .*reason=new_captures/);
});

test("an iPad that cannot be reached is a failure, not an empty pull", () => {
  const ipad = fakeIpad();
  const out = mkdtempSync(join(tmpdir(), "hifth-walks-"));
  const r = run(["pull", "--device", "not-plugged-in", "--dir", out], { HIFTH_DEVICECTL: ipad.bin });
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /could not list/);
});

test("the page and the list show the captures in the order they were taken", () => {
  const ipad = fakeIpad();
  const out = mkdtempSync(join(tmpdir(), "hifth-walks-"));
  run(["pull", "--device", DEVICE, "--dir", out], { HIFTH_DEVICECTL: ipad.bin });
  const r = run(["list", "--json", "--dir", out]);
  assert.equal(r.status, 0, r.stderr);
  const list = JSON.parse(r.stdout);
  assert.deepEqual(list.map((c) => c.name), ["20261113-100200", "20261113-101500"]);
  const later = list[1];
  assert.equal(later.note, "the <b>pen</b> jumped");
  assert.equal(later.verse, "2:43");
  assert.equal(later.reopen, "hifth:///hafs-kfqc/2:43");
  assert.equal(later.picture, "20261113-101500/picture.png");
  assert.deepEqual(later.trail, { touch: 2, pencil: 0, route: 1 });
  assert.equal(list[0].picture, null, "a capture with no picture is still listed");
  assert.equal(list[0].pageAnswered, false);
  assert.deepEqual(JSON.parse(readFileSync(join(out, "index.json"), "utf8")), list);

  const html = readFileSync(join(out, "index.html"), "utf8");
  assert.ok(html.indexOf("20261113-100200") < html.indexOf("20261113-101500"));
  assert.ok(html.includes("the &lt;b&gt;pen&lt;/b&gt; jumped"), "a note is shown as text, never as markup");
  assert.ok(html.includes('href="hifth:///hafs-kfqc/2:43"'));
  assert.ok(html.includes("<dt>Taken by</dt><dd>a screenshot</dd>"), "what took it is said in words, not the app's own name for it");
});

test("the plain list says one line per capture", () => {
  const ipad = fakeIpad();
  const out = mkdtempSync(join(tmpdir(), "hifth-walks-"));
  run(["pull", "--device", DEVICE, "--dir", out], { HIFTH_DEVICECTL: ipad.bin });
  const r = run(["list", "--dir", out]);
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[1], /20261113-101500 .*page 7 .*verse 2:43 .*the <b>pen<\/b> jumped/);
});

test("captures land where git ignores them, because a pitch capture shows the book's text", () => {
  const r = run(["dir"]);
  assert.equal(r.status, 0, r.stderr);
  const dir = r.stdout.trim();
  assert.equal(dir, join(root, "native/shots/walks"));
  const ignored = spawnSync("git", ["-C", root, "check-ignore", "-q", join(dir, "20261113-101500", "picture.png")]);
  assert.equal(ignored.status, 0, `${dir} must be ignored by git`);
});
