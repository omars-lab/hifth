#!/usr/bin/env node
// The laptop side of walk capture. In the debug iPad app, a screenshot keeps a
// folder in the app's Documents/walk-captures/ (native/Hifth/Capture/). This
// copies those folders off the plugged-in iPad and draws them as one page.
//
//   walk-captures.mjs pull --device <id> [--dir <folder>] [--clear]
//       copy every capture off the iPad (pictures once, notes and places each
//       time, since a note can be added after a first pull), then draw the page.
//       --clear empties the iPad's captures afterwards, but only when every
//       file copied and no capture was taken meanwhile.
//       A pull also brings back current.json, where the app last said it was.
//   walk-captures.mjs current --device <id> [--dir <folder>]
//       copy only current.json (written by the hifth://x-callback-url/current-to-file
//       link) and print it: where the app is, without a whole pull.
//   walk-captures.mjs gallery [--dir <folder>]   draw index.html and index.json
//   walk-captures.mjs list [--json] [--dir <folder>]   the captures, oldest first
//   walk-captures.mjs dir                          print the folder used
//
// The folder is native/shots/walks/, which git ignores: a capture from the
// pitch build shows the book's text, so it is never committed or sent.
// Exit 0 done · 1 the iPad could not be reached or a copy failed · 2 usage.
// HIFTH_DEVICECTL swaps Apple's device tool for a stand-in (the tests use one).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// The capture files and Apple's device tool, shared with feature-check.mjs.
// Pictures and video never change once written; the text files can (where.json
// is rewritten when the page answers, the note is added later), so those are
// copied again on every pull. current.json sits beside the captures: where the
// app is, rewritten by each current-to-file link (CaptureStore.keepCurrent).
import { CAPTURE, CURRENT, FILES, ON_IPAD, copyFromIpad, devicectl as tool, domain, listIpad as listFiles } from "./ipad-files.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const [command, ...args] = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const dir = opt("--dir") ?? join(ROOT, "native/shots/walks");

const log = (ev, fields = {}) =>
  console.log(`${new Date().toISOString()} pid=${process.pid} ev=${ev} ${Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(" ")}`.trimEnd());
const quote = (s) => JSON.stringify(String(s ?? "").replace(/\s+/g, " ").trim());

const listIpad = (device) => listFiles(device, { log });

function pull() {
  const device = opt("--device");
  if (!device) {
    console.error("usage: walk-captures.mjs pull --device <id> [--dir <folder>] [--clear]");
    return 2;
  }
  log("list_start", { device: "given" });
  const before = listIpad(device);
  if (!before) {
    console.error("could not list the app's walk captures on the iPad. Is it plugged in, unlocked and trusted, with the debug build installed? (make app-devices shows what the laptop sees)");
    return 1;
  }
  let copied = 0;
  let failed = 0;
  const names = Object.keys(before).sort(byTime);
  for (const capture of names) {
    mkdirSync(join(dir, capture), { recursive: true });
    for (const file of before[capture]) {
      const dest = join(dir, capture, file);
      if (FILES[file] === "once" && existsSync(dest)) continue;
      if (!copyFromIpad(device, `${ON_IPAD}/${capture}/${file}`, dest, { log, fields: { capture, file } })) {
        failed++;
        continue;
      }
      copied++;
    }
    log("capture", { name: capture, files: before[capture].length });
  }
  let current = "no";
  if (before.hasCurrent) {
    if (copyCurrent(device)) current = "yes";
    else failed++;
  }

  if (args.includes("--clear")) {
    if (failed) log("clear_skipped", { reason: "copy_failed", failed });
    else {
      const now = listIpad(device);
      const same = now && Object.keys(now).sort().join() === names.slice().sort().join();
      if (!same) log("clear_skipped", { reason: now ? "new_captures" : "relist_failed", msg: quote("a capture was taken during the copy; pull again to clear") });
      else {
        const empty = mkdtempSync(join(tmpdir(), "hifth-walk-empty-"));
        const r = tool(["device", "copy", "to", ...domain(device), "--source", empty, "--destination", ON_IPAD, "--remove-existing-content", "true"]);
        rmSync(empty, { recursive: true, force: true });
        const left = listIpad(device);
        if (r.status !== 0 || !left) log("error", { step: "clear", msg: quote((r.stderr || "").split("\n")[0]) });
        else log("cleared", { left: Object.keys(left).length });
      }
    }
  }

  const drawn = gallery();
  log("done", { captures: names.length, copied, failed, current, page: quote(drawn) });
  return failed ? 1 : 0;
}

/** Copy current.json off the iPad into the folder; true when it came. */
function copyCurrent(device) {
  mkdirSync(dir, { recursive: true });
  return copyFromIpad(device, `${ON_IPAD}/${CURRENT}`, join(dir, CURRENT), { log, fields: { file: CURRENT } });
}

function current() {
  const device = opt("--device");
  if (!device) {
    console.error("usage: walk-captures.mjs current --device <id> [--dir <folder>]");
    return 2;
  }
  const found = listIpad(device);
  if (!found) {
    console.error("could not list the app's walk captures on the iPad. Is it plugged in, unlocked and trusted, with the debug build installed?");
    return 1;
  }
  if (!found.hasCurrent) {
    console.error(`no ${CURRENT} on the iPad yet: open hifth://x-callback-url/current-to-file on it first`);
    return 1;
  }
  if (!copyCurrent(device)) return 1;
  process.stdout.write(readFileSync(join(dir, CURRENT), "utf8").trimEnd() + "\n");
  return 0;
}

// Captures sort by the time in their name; -10 comes after -9 in one second.
function byTime(a, b) {
  const key = (name) => {
    const [, stamp, n] = name.match(/^(\d{8}-\d{6})(?:-(\d+))?$/);
    return [stamp, Number(n ?? 1)];
  };
  const [ta, na] = key(a);
  const [tb, nb] = key(b);
  return ta < tb ? -1 : ta > tb ? 1 : na - nb;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** Every capture in the folder, oldest first, in the shape the page and the list share. */
function captures() {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => CAPTURE.test(n))
    .sort(byTime)
    .map((name) => {
      const at = (f) => join(dir, name, f);
      const place = readJson(at("where.json")) ?? {};
      const lines = existsSync(at("trail.jsonl"))
        ? readFileSync(at("trail.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => {
            try {
              return JSON.parse(l);
            } catch {
              return {};
            }
          })
        : [];
      const count = (kind) => lines.filter((l) => l.kind === kind).length;
      const route = typeof place.route === "string" && place.route.startsWith("/") ? place.route : null;
      return {
        name,
        at: place.at ?? null,
        trigger: place.trigger ?? null,
        // The name a capture link gave it; a screenshot has none.
        named: typeof place.name === "string" ? place.name : null,
        route,
        page: place.page ?? null,
        verse: place.verse ?? null,
        open: place.open ?? [],
        settings: place.settings ?? {},
        pageAnswered: place.pageAnswered ?? null,
        screen: place.screen ?? null,
        build: place.build ?? null,
        note: existsSync(at("note.txt")) ? readFileSync(at("note.txt"), "utf8").trim() : null,
        picture: existsSync(at("picture.png")) ? `${name}/picture.png` : null,
        video: existsSync(at("before.mp4")) ? `${name}/before.mp4` : null,
        // What the app said happened to the five seconds before. The app
        // writes null until Apple's recorder answers, so a null that stayed is
        // "unsettled"; no key at all is a capture from before the video existed.
        videoWas: "video" in place ? (place.video ?? "unsettled") : null,
        trail: { touch: count("touch"), pencil: count("pencil"), route: count("route") },
        reopen: route ? `hifth://${route}` : null,
      };
    });
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// What the app writes as the trigger (native/Hifth/Capture/WalkCapture.swift), in words.
const TAKEN_BY = {
  screenshot: "a screenshot",
  launch: "the launch switch (a test, not the owner)",
  link: "a capture link from the laptop",
};

// Why there is no video of the five seconds before, from the word the app
// writes (ClipVideo.word in native/Hifth/Capture/ClipRecorder.swift).
const NO_VIDEO = {
  off: "recording was switched off for that launch",
  simulator: "the simulator cannot record the screen",
  "not-on-this-device": "the Mac app does not record the screen",
  refused: "you said no when iOS asked to record the screen",
  blocked: "screen recording is turned off on this iPad (Screen Time)",
  interrupted: "another app, the screen changing size or the iPad sleeping stopped the recording",
  "not-recording": "the recorder was not running yet",
  kept: "the iPad saved it, but it has not been copied here (pull again)",
  unsettled: "the app was closed before the video finished saving",
};

function noVideo(word) {
  const failed = /^failed (-?\d+)$/.exec(word);
  if (failed) return `not kept: Apple's recorder failed (code ${failed[1]})`;
  return `not kept: ${NO_VIDEO[word] ?? word}`;
}

function card(c) {
  const rows = [
    ["Page", c.page],
    ["Verse", c.verse],
    ["Open", c.open.length ? c.open.join(", ") : "nothing"],
    ["Settings", Object.entries(c.settings).map(([k, v]) => `${k} ${v}`).join(" · ") || "none read"],
    ["Screen", c.screen ? `${c.screen.orientation}, ${c.screen.width}×${c.screen.height}` : null],
    ["Last 10 s", `${c.trail.touch} touches, ${c.trail.pencil} Pencil, ${c.trail.route} page moves`],
    ["Build", c.build ? `${c.build.flavour} · ${c.build.commit}` : null],
    ["Taken by", TAKEN_BY[c.trigger] ?? c.trigger],
    ["Named", c.named],
    // A kept video is shown above; only a missing one is explained.
    ["5 s before", c.videoWas && !c.video ? noVideo(c.videoWas) : null],
  ].filter(([, v]) => v !== null && v !== undefined);
  const when = c.at ? new Date(c.at).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC") : c.name;
  const media = c.video
    ? `<video src="${esc(c.video)}"${c.picture ? ` poster="${esc(c.picture)}"` : ""} muted loop playsinline preload="metadata"></video>`
    : c.picture
      ? `<a href="${esc(c.picture)}"><img src="${esc(c.picture)}" alt="The app's picture at ${esc(when)}" loading="lazy"></a>`
      : `<div class="missing">No picture was kept.</div>`;
  return `<article id="${esc(c.name)}">
  <header><h2>${esc(when)}</h2><span class="name">${esc(c.name)}</span></header>
  ${media}
  ${c.note ? `<p class="note">${esc(c.note)}</p>` : ""}
  ${c.pageAnswered === false ? `<p class="warn">The page did not answer, so where you were comes from the address only.</p>` : ""}
  <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
  ${c.reopen ? `<a class="reopen" href="${esc(c.reopen)}">Open this place in the app</a>` : ""}
</article>`;
}

function gallery() {
  const list = captures();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.json"), JSON.stringify(list, null, 2) + "\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Walk captures</title>
<style>
:root { --bg: #f6f4ef; --card: #fff; --ink: #1d1b16; --soft: #6b665b; --line: #e3ded3; --note: #fff6d8; --warn: #9a3412; --link: #1d4ed8; }
@media (prefers-color-scheme: dark) { :root { --bg: #15140f; --card: #1f1d17; --ink: #ece8de; --soft: #a39d8f; --line: #34312a; --note: #3a3218; --warn: #fdba74; --link: #93c5fd; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px 16px 48px; background: var(--bg); color: var(--ink); font: 15px/1.5 system-ui, sans-serif; }
h1 { margin: 0 0 4px; font-size: 22px; }
.lead { margin: 0 0 24px; color: var(--soft); }
main { display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); }
article { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
header { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
h2 { margin: 0; font-size: 15px; }
.name { color: var(--soft); font-size: 12px; font-family: ui-monospace, monospace; }
img, video { width: 100%; height: auto; border-radius: 6px; border: 1px solid var(--line); display: block; }
.missing { padding: 40px 8px; text-align: center; color: var(--soft); border: 1px dashed var(--line); border-radius: 6px; }
.note { margin: 0; padding: 8px 10px; background: var(--note); border-radius: 6px; white-space: pre-wrap; }
.warn { margin: 0; color: var(--warn); font-size: 13px; }
dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; font-size: 13px; }
dt { color: var(--soft); }
dd { margin: 0; overflow-wrap: anywhere; }
.reopen { color: var(--link); font-size: 13px; }
</style></head><body>
<h1>Walk captures</h1>
<p class="lead">${list.length ? `${list.length} capture${list.length === 1 ? "" : "s"}, oldest first. Kept on this laptop only.` : "No captures yet. Take a screenshot in the debug app on the iPad, then run make walk-pull."}</p>
<main>
${list.map(card).join("\n")}
</main>
<script>
for (const v of document.querySelectorAll("video")) {
  v.addEventListener("mouseenter", () => v.play());
  v.addEventListener("mouseleave", () => { v.pause(); v.currentTime = 0; });
  v.addEventListener("click", () => (v.paused ? v.play() : v.pause()));
}
</script>
</body></html>
`;
  const page = join(dir, "index.html");
  writeFileSync(page, html);
  return page;
}

function list() {
  const all = captures();
  if (args.includes("--json")) {
    console.log(JSON.stringify(all, null, 2));
    return 0;
  }
  if (!all.length) console.error(`no captures in ${dir}`);
  for (const c of all) {
    const bits = [c.name, c.page !== null ? `page ${c.page}` : "page ?", c.verse ? `verse ${c.verse}` : null, c.open.length ? `open ${c.open.join(",")}` : null, c.note ? `“${c.note}”` : null];
    console.log(bits.filter(Boolean).join("  "));
  }
  return 0;
}

const commands = {
  pull,
  current,
  gallery: () => (console.log(gallery()), 0),
  list,
  dir: () => (console.log(dir), 0),
};
if (!commands[command]) {
  console.error("usage: walk-captures.mjs pull --device <id> [--clear] | current --device <id> | gallery | list [--json] | dir   (each takes --dir <folder>)");
  process.exit(2);
}
process.exit(commands[command]());
