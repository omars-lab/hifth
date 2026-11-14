#!/usr/bin/env node
// Does each link on the features page put the app where its card says?
// (docs/design/feature-links.md, step 4.)
//
// For each card: start the app afresh with the card's own link, send a capture
// link named after the card, wait until that capture's where.json is written,
// and compare it with the card. The capture link is in builds put on from this
// laptop only, so this runs against a debug build.
//
//   node feature-check.mjs --simulator <udid> [--only id,id] [--wait 20] [--out file]
//   node feature-check.mjs --device <id> [--only id,id] [--wait 45] [--out file]
//
// Each card waits for its own capture before the next link goes: links sent
// back to back run together, and a capture waits for the last page asked for,
// so every capture would show the last card (seen in the simulator, 2026-11-13).
// The app is closed between cards so a panel or tool left open by one card
// cannot make the next one pass.
//
// Prints one ev= line per card and writes the results (no picture, no text off
// the page: places, tools and panels by name) to --out, by default
// native/shots/feature-check/latest.json, which git ignores.
// Exit 0 every card passed or is not in this build · 1 a card failed or no
// capture came · 2 usage. HIFTH_SIMCTL and HIFTH_DEVICECTL swap Apple's tools for
// stand-ins (the tests use them).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cards, readContract } from "./feature-links.mjs";
import { CAPTURE, ON_IPAD, copyFromIpad, listIpad } from "./ipad-files.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const BUNDLE_ID = "com.bytesofpurpose.hifth";

const log = (ev, fields = {}) =>
  console.log(`${new Date().toISOString()} pid=${process.pid} ev=${ev} ${Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(" ")}`.trimEnd());
const quote = (s) => JSON.stringify(String(s ?? "").replace(/\s+/g, " ").trim());
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** The name a card's capture is given: the capture link keeps letters, digits and dashes. */
export const captureName = (card) => `check-${card.id}`;

/** The place part of an address: `/hafs-kfqc/p7?tool=note` → `/hafs-kfqc/p7`. */
const placeOf = (route) => String(route ?? "").replace(/^#/, "").split("?")[0];

/**
 * What a capture must say for each panel card: each sheet a link can open
 * carries its link name (`data-panel`), which the capture lists as
 * `panel=<name>`. A tool card's tool shows as `tool=<name>`; places are
 * compared by address; the view cards by the count of pages on screen; the
 * word card by the words the page says it laid (`words=3-7`).
 */
export const PANEL_SIGNS = Object.fromEntries(
  ["jump", "about", "record", "shelf", "key", "editions", "tips", "lookalikes", "roots", "commentary", "context"].map((n) => [n, `panel=${n}`]),
);

/** A tool whose name in the code differs from its name in a link (App.tsx, restoreState). */
const TOOL_IN_CODE = { harakat: "sign" };

/**
 * Does the capture say the app is where the card's link said?
 * Returns { result: "pass" | "fail" | "not-in-build", why }.
 * A word-range card (`?w=3-7`) passes only when the page says it laid those
 * very words (`words=3-7` in the capture's open list).
 */
export function judge(card, where) {
  const flavour = where?.build?.flavour ?? null;
  if (card.pitchOnly && flavour !== "pitch") {
    return { result: "not-in-build", why: `a ${flavour ?? "unknown"} build has no ${card.key} panel` };
  }
  if (where.pageAnswered !== true) {
    return { result: "fail", why: "the page did not answer the capture, so where the app is cannot be told" };
  }
  const misses = [];
  const want = placeOf(card.route);
  const got = placeOf(where.route);
  if (got !== want) misses.push(`the app is at ${got || "nowhere"}, not ${want}`);
  const open = where.open ?? [];
  if (card.group === "tools" && !open.includes(`tool=${TOOL_IN_CODE[card.key] ?? card.key}`)) {
    misses.push(`the tool in hand is ${open.find((o) => o.startsWith("tool="))?.slice(5) ?? "none"}, not ${card.key}`);
  }
  if (card.group === "panels") {
    const sign = PANEL_SIGNS[card.key];
    const shown = open.filter((o) => o.startsWith("panel="));
    if (!sign) misses.push(`no sign is known for the ${card.key} panel yet`);
    else if (!open.includes(sign)) misses.push(`the ${card.key} panel is not open; ${shown.length ? `${shown.join(", ")} is` : "no panel is"}`);
  }
  const query = new URLSearchParams(String(card.route).split("?")[1] ?? "");
  if (query.has("w")) {
    const [from, to = from] = String(query.get("w")).split("-");
    const laid = open.find((o) => o.startsWith("words="))?.slice(6);
    if (laid !== `${from}-${to}`) misses.push(laid ? `words ${laid} are laid, not ${from}-${to}` : `no words are laid on the verse, not ${from}-${to}`);
  }
  const view = query.get("view");
  if (view) {
    const want = view === "two" ? 2 : 1;
    const count = open.find((o) => o.startsWith("pages="));
    if (!count) misses.push("the capture has no count of pages on screen");
    else if (Number(count.slice(6)) !== want) misses.push(`${count.slice(6)} page on screen, not ${want}`);
  }
  if (misses.length) return { result: "fail", why: misses.join("; ") };
  return { result: "pass", why: "" };
}

function run(cmd, rest) {
  return spawnSync(cmd, rest, { encoding: "utf8", timeout: 120_000 });
}

/** The iPad simulator, driven with simctl; captures are read from its folder directly. */
function simulator(udid) {
  const simctl = (rest) => (process.env.HIFTH_SIMCTL ? run(process.env.HIFTH_SIMCTL, rest) : run("xcrun", ["simctl", ...rest]));
  let folder = null;
  const captures = () => {
    folder ??= join(simctl(["get_app_container", udid, BUNDLE_ID, "data"]).stdout.trim(), ON_IPAD);
    if (!existsSync(folder)) return {};
    const out = {};
    for (const name of readdirSync(folder).filter((n) => CAPTURE.test(n))) {
      const file = join(folder, name, "where.json");
      if (existsSync(file)) out[name] = file;
    }
    return out;
  };
  return {
    kind: "simulator",
    close: () => simctl(["terminate", udid, BUNDLE_ID]),
    send: (link) => simctl(["openurl", udid, link]),
    /** Capture folder → a function that reads its where.json, or null on failure. */
    captures: () => {
      const found = captures();
      return Object.fromEntries(Object.entries(found).map(([n, f]) => [n, () => readJson(f)]));
    },
  };
}

/** A plugged-in iPad, driven with devicectl; each where.json is copied off to read it. */
function ipad(device) {
  const devicectl = (rest) => (process.env.HIFTH_DEVICECTL ? run(process.env.HIFTH_DEVICECTL, rest) : run("xcrun", ["devicectl", ...rest]));
  const work = mkdtempSync(join(tmpdir(), "hifth-feature-check-"));
  process.on("exit", () => rmSync(work, { recursive: true, force: true }));
  return {
    kind: "ipad",
    close: () => ({ status: 0 }),
    // --terminate-existing restarts the app with the link; only the card's
    // own link does that, so its capture link reaches the page it opened.
    send: (link, { fresh = false } = {}) =>
      devicectl(["device", "process", "launch", "--device", device, ...(fresh ? ["--terminate-existing"] : []), "--payload-url", link, BUNDLE_ID]),
    captures: () => {
      const found = listIpad(device, { log });
      if (!found) return null;
      return Object.fromEntries(
        Object.entries(found)
          .filter(([, files]) => files.includes("where.json"))
          .map(([n]) => [
            n,
            () => {
              const dest = join(work, `${n}.json`);
              return copyFromIpad(device, `${ON_IPAD}/${n}/where.json`, dest, { log }) ? readJson(dest) : null;
            },
          ]),
      );
    },
  };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * A line saying the app's web pages were built from another commit than this
 * checkout, or null. The iPad build copies in whatever `make app-web` built
 * last, so a card can fail for code that is simply not in the app yet.
 */
export function buildNote(build, head) {
  const built = String(build?.commit ?? "").split("+")[0];
  if (!built || !head) return null;
  if (built.startsWith(head) || head.startsWith(built)) return null;
  return `the app's web pages were built from commit ${built}, and this checkout is at ${head}: run make app-web (then the app build) first, or a card may fail for code that is not in the app`;
}

/** Wait for a capture not in `before` that carries `name`; null after `seconds`. */
async function waitFor(target, name, before, seconds) {
  const until = Date.now() + seconds * 1000;
  const seen = new Set(before);
  while (Date.now() < until) {
    const now = target.captures() ?? {};
    for (const [folder, read] of Object.entries(now)) {
      if (seen.has(folder)) continue;
      const where = read();
      // The app writes where.json first with nothing from the page (nothing
      // open, pageAnswered false), again when the page answers, and last with
      // what happened to the video. Read it again next round until the page
      // has answered or the last write is in; the first write alone made every
      // tool look put down (simulator, 2026-11-13). The video's line is in
      // every write, empty (null) until the last.
      if (!where || !(where.pageAnswered === true || where.video != null)) continue;
      seen.add(folder);
      if (where.name === name) return { folder, where };
    }
    await pause(500);
  }
  return null;
}

async function main(argv) {
  const opt = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : undefined);
  const udid = opt("--simulator");
  const device = opt("--device");
  if (!udid === !device) {
    console.error("usage: feature-check.mjs --simulator <udid> | --device <id>  [--only id,id] [--wait seconds] [--out file]");
    return 2;
  }
  const target = udid ? simulator(udid) : ipad(device);
  const contract = readContract(JSON.parse(readFileSync(join(repo, "docs/design/app-url-scheme.openapi.json"), "utf8")));
  const only = opt("--only")?.split(",");
  const all = cards(contract).filter((c) => !only || only.includes(c.id));
  if (only && all.length !== only.length) {
    console.error(`no card called ${only.filter((id) => !all.some((c) => c.id === id)).join(", ")}`);
    return 2;
  }
  const wait = Number(opt("--wait") ?? (udid ? 20 : 45));
  const out = opt("--out") ?? join(repo, "native/shots/feature-check/latest.json");

  log("start", { on: target.kind, cards: all.length });
  const head = spawnSync("git", ["-C", repo, "rev-parse", "--short=8", "HEAD"], { encoding: "utf8" }).stdout?.trim() || null;
  let stale = null;
  const results = [];
  for (const card of all) {
    const name = captureName(card);
    const before = Object.keys(target.captures() ?? {});
    target.close();
    log("send", { id: card.id, link: quote(card.link) });
    const opened = target.send(card.link, { fresh: true });
    const captured = opened.status === 0 ? target.send(`hifth://x-callback-url/capture?name=${name}`) : opened;
    if (captured.status !== 0) {
      const why = (captured.stderr || captured.error?.message || "").split("\n")[0];
      log("card", { id: card.id, result: "not-sent", msg: quote(why) });
      results.push({ id: card.id, result: "not-sent", why });
      continue;
    }
    log("wait_start", { id: card.id, seconds: wait });
    const got = await waitFor(target, name, before, wait);
    log("wait_end", { id: card.id, found: got ? got.folder : "none" });
    if (!got) {
      results.push({ id: card.id, result: "no-capture", why: `no capture named ${name} within ${wait} s` });
      log("card", { id: card.id, result: "no-capture" });
      continue;
    }
    if (stale === null) {
      stale = buildNote(got.where.build, head) ?? false;
      if (stale) log("stale_build", { msg: quote(stale) });
    }
    const verdict = judge(card, got.where);
    const where = { route: got.where.route ?? null, page: got.where.page ?? null, verse: got.where.verse ?? null, open: got.where.open ?? [] };
    results.push({ id: card.id, ...verdict, where, build: got.where.build ?? null });
    log("card", { id: card.id, result: verdict.result, ...(verdict.why ? { msg: quote(verdict.why) } : {}) });
  }

  const count = (r) => results.filter((x) => x.result === r).length;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), on: target.kind, ...(stale ? { stale } : {}), results }, null, 2) + "\n");
  log("done", { pass: count("pass"), fail: count("fail"), not_in_build: count("not-in-build"), no_capture: count("no-capture"), not_sent: count("not-sent"), stale_build: stale ? 1 : 0, out });
  return results.every((r) => ["pass", "not-in-build"].includes(r.result)) ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await main(process.argv.slice(2)));
}
