// feature-check sends each features-page card's link to the app, asks for a
// capture named after the card, and checks the capture says the app went where
// the card said (walk-app skill; docs/design/feature-links.md step 4).
//
// Apple's simulator and device tools are swapped for stand-ins (HIFTH_SIMCTL,
// HIFTH_DEVICECTL) that act like the debug app: they remember the last link
// that opened something and, for a capture link, write where.json the way the
// app does: first unfinished (no answer from the page yet, nothing open), then
// finished a moment later. No simulator, no iPad and no book text are involved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { buildNote, judge, PANEL_SIGNS } from "./feature-check.mjs";

const here = new URL(".", import.meta.url).pathname;
const script = join(here, "feature-check.mjs");
const UDID = "00000000-FAKE-4000-8000-0000000000AA";

/**
 * The made-up app. `wrongTool` makes it put a different tool in hand;
 * `silent` lists card ids whose capture never comes.
 */
function fakeApp(dir, { flavour = "public", wrongTool = false, silent = [], noWords = false } = {}) {
  const state = join(dir, "state.json");
  writeFileSync(state, JSON.stringify({ last: null, n: 0 }));
  const body = `
const fs = require("fs"), path = require("path"), { spawn } = require("child_process");
const a = process.argv.slice(2), at = (k) => a[a.indexOf(k) + 1];
const dir = ${JSON.stringify(dir)}, stateFile = ${JSON.stringify(state)};
fs.appendFileSync(path.join(dir, "calls.log"), a.join(" ") + "\\n");
const container = path.join(dir, "container");
const link = a.includes("openurl") ? a[a.length - 1] : a.includes("--payload-url") ? at("--payload-url") : null;
if (a[0] === "get_app_container") { console.log(container); process.exit(0); }
if (a.includes("info")) {
  const base = path.join(container, at("--subdirectory"));
  const files = [];
  const walk = (d) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) walk(p); else files.push({ name: n, relativePath: path.relative(base, p) }); } };
  if (fs.existsSync(base)) walk(base);
  fs.writeFileSync(at("--json-output"), JSON.stringify({ result: { files } }));
  process.exit(0);
}
if (a.includes("copy")) { fs.copyFileSync(path.join(container, at("--source")), at("--destination")); process.exit(0); }
if (!link) process.exit(0);
const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
const u = new URL(link);
const action = u.pathname.replace(/^\\//, "");
if (action === "open") { state.last = link; fs.writeFileSync(stateFile, JSON.stringify(state)); process.exit(0); }
if (action !== "capture") process.exit(0);
const name = u.searchParams.get("name");
if (${JSON.stringify(silent)}.some((id) => name === "check-" + id)) process.exit(0);
const o = new URL(state.last).searchParams;
const route = "/hafs-kfqc/" + (o.get("verse") ?? (o.get("surah") ? o.get("surah") + ":1" : "p" + o.get("page")));
const open = [];
const tool = o.get("tool");
if (tool) open.push("tool=" + (${wrongTool} ? "crop" : tool === "harakat" ? "sign" : tool));
if (o.get("open")) open.push("dialog:", "panel=" + o.get("open"));
if (o.get("words") && !${noWords}) { const [f, t = f] = o.get("words").split("-"); open.push("words=" + f + "-" + t); }
open.push("pages=" + (o.get("view") === "two" ? 2 : 1));
state.n += 1;
fs.writeFileSync(stateFile, JSON.stringify(state));
const folder = path.join(container, "Documents/walk-captures", "20261113-1000" + String(state.n).padStart(2, "0"));
fs.mkdirSync(folder, { recursive: true });
const base = { at: "2026-11-13T10:00:00Z", trigger: "link", name, route, verse: null, page: null, settings: {},
  screen: { width: 1032, height: 1376, scale: 2, orientation: "upright" }, build: { commit: "abcd1234", flavour: ${JSON.stringify(flavour)} } };
// As CaptureStore writes it: the video's line is there from the first write, empty (null).
fs.writeFileSync(path.join(folder, "where.json"), JSON.stringify({ ...base, open: [], pageAnswered: false, video: null }));
const later = JSON.stringify({ ...base, open, pageAnswered: true, video: "simulator" });
spawn(process.execPath, ["-e", "setTimeout(() => require('fs').writeFileSync(" + JSON.stringify(path.join(folder, "where.json")) + ", " + JSON.stringify(later) + "), 1200)"],
  { detached: true, stdio: "ignore" }).unref();
`;
  const bin = join(dir, "fake-tool");
  writeFileSync(bin, `#!/usr/bin/env node\n${body}`);
  chmodSync(bin, 0o755);
  return bin;
}

function run(args, env) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [script, ...args], { env: { ...process.env, ...env } });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (status) => done({ status, out }));
  });
}

const results = (file) => Object.fromEntries(JSON.parse(readFileSync(file, "utf8")).results.map((r) => [r.id, r]));

test("each card is judged on the finished capture, not the first one the app writes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hifth-feature-check-"));
  const out = join(dir, "out.json");
  const r = await run(["--simulator", UDID, "--only", "place-page,place-verse,tool-note,tool-harakat", "--wait", "10", "--out", out], {
    HIFTH_SIMCTL: fakeApp(dir),
  });
  assert.equal(r.status, 0, r.out);
  const got = results(out);
  assert.deepEqual(Object.values(got).map((x) => x.result), ["pass", "pass", "pass", "pass"], r.out);
  assert.deepEqual(got["tool-note"].where.open, ["tool=note", "pages=1"]);
  assert.match(r.out, /ev=wait_start id=tool-note/);
  assert.match(r.out, /ev=done pass=4 fail=0/);
});

test("a tool the link did not put in hand fails, saying which tool was in hand", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hifth-feature-check-"));
  const out = join(dir, "out.json");
  const r = await run(["--simulator", UDID, "--only", "tool-note", "--wait", "10", "--out", out], { HIFTH_SIMCTL: fakeApp(dir, { wrongTool: true }) });
  assert.equal(r.status, 1, r.out);
  assert.equal(results(out)["tool-note"].result, "fail");
  assert.match(results(out)["tool-note"].why, /crop/);
});

test("a capture that never comes is reported, and the next card still runs", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hifth-feature-check-"));
  const out = join(dir, "out.json");
  const r = await run(["--simulator", UDID, "--only", "place-page,place-verse", "--wait", "3", "--out", out], {
    HIFTH_SIMCTL: fakeApp(dir, { silent: ["place-page"] }),
  });
  assert.equal(r.status, 1, r.out);
  assert.equal(results(out)["place-page"].result, "no-capture");
  assert.equal(results(out)["place-verse"].result, "pass");
});

test("on an iPad, only the card's own link restarts the app", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hifth-feature-check-"));
  const out = join(dir, "out.json");
  const r = await run(["--device", "FAKE-IPAD", "--only", "place-verse", "--wait", "10", "--out", out], { HIFTH_DEVICECTL: fakeApp(dir) });
  assert.equal(r.status, 0, r.out);
  assert.equal(results(out)["place-verse"].result, "pass");
  const launches = readFileSync(join(dir, "calls.log"), "utf8").split("\n").filter((l) => l.includes("--payload-url"));
  assert.equal(launches.length, 2);
  assert.match(launches[0], /--terminate-existing .*open\?verse=2:255/);
  assert.doesNotMatch(launches[1], /--terminate-existing/);
});

test("an unknown card or a missing device is a usage error", async () => {
  assert.equal((await run(["--simulator", UDID, "--only", "no-such-card"], {})).status, 2);
  assert.equal((await run([], {})).status, 2);
});

const card = (over) => ({ id: "x", group: "places", key: "page", route: "/hafs-kfqc/p7", pitchOnly: false, ...over });
const where = (over) => ({ route: "/hafs-kfqc/p7", open: [], build: { flavour: "public" }, pageAnswered: true, ...over });

test("judge: the place is compared without the link's extras", () => {
  assert.equal(judge(card({ route: "/hafs-kfqc/p7?open=context" }), where()).result, "pass");
  assert.match(judge(card({ route: "/hafs-kfqc/2:255" }), where()).why, /at \/hafs-kfqc\/p7, not \/hafs-kfqc\/2:255/);
});

test("judge: the harakat card accepts the code's own name for that tool", () => {
  const harakat = card({ group: "tools", key: "harakat", route: "/hafs-kfqc/p7?tool=harakat" });
  assert.equal(judge(harakat, where({ open: ["tool=sign"] })).result, "pass");
  assert.equal(judge(harakat, where({ open: ["tool=select"] })).result, "fail");
});

test("judge: a page that never answered is a fail, whatever else it says", () => {
  assert.match(judge(card(), where({ pageAnswered: false })).why, /did not answer/);
});

test("judge: a pitch-only panel on a public build is not in the build, not a fail", () => {
  const panel = card({ group: "panels", key: "commentary", pitchOnly: true, route: "/hafs-kfqc/2:255?open=commentary" });
  assert.equal(judge(panel, where({ route: "/hafs-kfqc/2:255" })).result, "not-in-build");
});

test("judge: every panel in the contract has a sign to look for", () => {
  const contract = JSON.parse(readFileSync(join(here, "../../../../docs/design/app-url-scheme.openapi.json"), "utf8"));
  const panels = contract.paths["/x-callback-url/open"].get.parameters.find((p) => p.name === "open").schema.enum;
  assert.deepEqual(Object.keys(PANEL_SIGNS).sort(), [...panels].sort());
});

test("judge: a panel passes only on its own name, not on another dialog", () => {
  const jump = card({ group: "panels", key: "jump", route: "/hafs-kfqc/p7?open=jump" });
  assert.equal(judge(jump, where({ open: ["dialog:", "panel=jump", "pages=1"] })).result, "pass");
  assert.match(judge(jump, where({ open: ["dialog:", "panel=about"] })).why, /jump panel is not open; panel=about is/);
  assert.match(judge(jump, where({ open: ["pages=1"] })).why, /jump panel is not open; no panel is/);
});

test("judge: the one-page and two-page cards are told apart by the pages on screen", () => {
  const two = card({ key: "view-two", route: "/hafs-kfqc/p7?view=two" });
  assert.equal(judge(two, where({ open: ["pages=2"] })).result, "pass");
  assert.match(judge(two, where({ open: ["pages=1"] })).why, /1 page on screen, not 2/);
  const one = card({ key: "view-one", route: "/hafs-kfqc/p7?view=one" });
  assert.equal(judge(one, where({ open: ["pages=1"] })).result, "pass");
  assert.match(judge(one, where({ open: [] })).why, /no count of pages/);
});

test("judge: the word-range card passes only when the page shows those words", () => {
  const words = card({ key: "words", route: "/hafs-kfqc/2:255?w=3-7" });
  assert.equal(judge(words, where({ route: "/hafs-kfqc/2:255", open: ["words=3-7"] })).result, "pass");
  const none = judge(words, where({ route: "/hafs-kfqc/2:255", open: [] }));
  assert.equal(none.result, "fail");
  assert.match(none.why, /no words are laid on the verse, not 3-7/);
  assert.match(judge(words, where({ route: "/hafs-kfqc/2:255", open: ["words=3-6"] })).why, /words 3-6 are laid, not 3-7/);
  assert.equal(judge(words, where({ route: "/hafs-kfqc/p7", open: ["words=3-7"] })).result, "fail");
  const one = card({ key: "word", route: "/hafs-kfqc/2:255?w=5" });
  assert.equal(judge(one, where({ route: "/hafs-kfqc/2:255", open: ["words=5-5"] })).result, "pass");
});

test("a run where the word card shows its words exits 0; one where it does not, 1", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hifth-feature-check-"));
  const out = join(dir, "out.json");
  const r = await run(["--simulator", UDID, "--only", "place-words,place-view-two,panel-jump", "--wait", "10", "--out", out], {
    HIFTH_SIMCTL: fakeApp(dir),
  });
  assert.equal(r.status, 0, r.out);
  const got = results(out);
  assert.equal(got["place-words"].result, "pass");
  assert.equal(got["place-view-two"].result, "pass");
  assert.equal(got["panel-jump"].result, "pass");

  const dir2 = mkdtempSync(join(tmpdir(), "hifth-feature-check-"));
  const out2 = join(dir2, "out.json");
  const r2 = await run(["--simulator", UDID, "--only", "place-words", "--wait", "10", "--out", out2], {
    HIFTH_SIMCTL: fakeApp(dir2, { noWords: true }),
  });
  assert.equal(r2.status, 1, r2.out);
  assert.equal(results(out2)["place-words"].result, "fail");
});

test("an app whose web pages were built from another commit is named, so a failure is not blamed on the link", () => {
  // The iPad build copies in whatever web pages were built last; on 2026-11-13 nine
  // panels failed as "no panel is" because the web pages predated the panel names.
  assert.equal(buildNote({ commit: "2365bc6c", flavour: "public" }, "2365bc6c"), null);
  assert.equal(buildNote({ commit: "2365bc6c+changes", flavour: "public" }, "2365bc6c"), null);
  assert.match(
    buildNote({ commit: "6ef91b5b+changes", flavour: "public" }, "2365bc6c"),
    /built from commit 6ef91b5b.*this checkout is at 2365bc6c.*make app-web/,
  );
  assert.equal(buildNote(null, "2365bc6c"), null);
  assert.equal(buildNote({ commit: "6ef91b5b" }, null), null);
});
