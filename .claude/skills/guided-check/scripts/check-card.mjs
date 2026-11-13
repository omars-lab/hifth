#!/usr/bin/env node
// Puts a card of things to check on the app's screen, and copies the answers back.
//
// The app (a build from this laptop, not a release) opens a small card when it
// gets a `check` link: the steps to do, what you should see, a ✓ and a ✗ for
// each, a note and Done. Done saves the answers in the app's Documents/checks.
// This script builds that link, sends it, and copies the answers off.
//
//   check-card.mjs link    (--file <steps.json> | --ledger <row id>) [--from N]
//   check-card.mjs send    (--file … | --ledger …) [--from N] (--sim | --device <id>)
//   check-card.mjs answers (--sim | --device <id>) [--out <dir>] [--also <folder>] [--print-out]
//
// --also copies a folder the build wrote in its own data (Documents/walk-probe,
// say) to <out>/<its name>, replacing the last copy, so a log comes back with
// the answers in one command.
//
// A steps file: { "id": "…", "title": "…", "steps": [{ "do": "…", "see": "…" }] }
// A ledger row (docs/validation/ledger.json): each runbook step's `short` (or
// `do`) is the step, and the first sentence of its `expect` is what to see.
// One card holds 12 steps and a link of at most 2,000 characters (iOS cuts a
// longer one); a longer list prints the --from that sends the rest.
//
// Answers land in native/shots/checks/, which git ignores: a check run on the
// pitch build can describe what that build shows.
//
// Exit 0: done. Exit 1: the simulator or iPad could not be reached.
// Exit 2: nothing to send (no steps, an empty step, no such ledger row, bad usage).
//
// HIFTH_SIMCTL and HIFTH_DEVICECTL swap Apple's tools for stand-ins (the tests use them).
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const BUNDLE = "com.bytesofpurpose.hifth";
const MOST_STEPS = 12;
// iOS cuts a link that opens an app at 2,048 characters, and the step it cuts
// through never reaches the card (iPad simulator, 2026-11-12). Stay well short.
const MOST_CHARS = 2000;
const DEFAULT_OUT = "native/shots/checks";
const root = new URL("../../../..", import.meta.url).pathname;

const [command, ...args] = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const flag = (k) => args.includes(k);

const log = (ev, fields = {}) =>
  console.log(
    `${new Date().toISOString()} pid=${process.pid} ev=${ev} ${Object.entries(fields)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ")}`.trimEnd(),
  );
const quote = (s) => JSON.stringify(String(s ?? "").replace(/\s+/g, " ").trim());
function refuse(msg) {
  log("error", { msg: quote(msg) });
  console.error(msg);
  process.exit(2);
}

function tool(envName, xcrunName, rest) {
  const standIn = process.env[envName];
  return standIn
    ? spawnSync(standIn, rest, { encoding: "utf8", timeout: 60_000 })
    : spawnSync("xcrun", [xcrunName, ...rest], { encoding: "utf8", timeout: 60_000 });
}
const simctl = (rest) => tool("HIFTH_SIMCTL", "simctl", rest);
const devicectl = (rest) => tool("HIFTH_DEVICECTL", "devicectl", rest);
const firstLine = (r) => (r.stderr || r.error?.message || "").trim().split("\n")[0];

// ---- what to check -----------------------------------------------------------

/** The first sentence: a card has room for what to look for, not why. */
const firstSentence = (text) => {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  return m ? m[1] : t;
};

function fromFile(path) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  return {
    id: data.id ?? basename(path, ".json"),
    title: data.title ?? data.id ?? "Check",
    steps: (data.steps ?? []).map((s) => ({ do: s.do, see: s.see })),
  };
}

function fromLedger(id, ledgerPath) {
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  const row = (ledger.checks ?? []).find((c) => c.id === id);
  if (!row) refuse(`no ledger row called ${id} in ${ledgerPath}`);
  return {
    id: row.id,
    title: row.title ?? row.id,
    steps: (row.runbook?.steps ?? []).map((s) => ({ do: s.short ?? s.do, see: s.expect ? firstSentence(s.expect) : undefined })),
  };
}

function theCheck() {
  const file = opt("--file");
  const ledgerId = opt("--ledger");
  if (!file === !ledgerId) refuse("give one of --file <steps.json> or --ledger <row id>");
  const check = file ? fromFile(file) : fromLedger(ledgerId, opt("--ledger-file") ?? join(root, "docs/validation/ledger.json"));
  const from = Number(opt("--from") ?? 1);
  if (!Number.isInteger(from) || from < 1) refuse(`--from must be a step number, 1 or more: ${opt("--from")}`);
  if (check.steps.length === 0) refuse(`${check.id} has no steps`);
  check.steps.forEach((s, i) => {
    if (!String(s.do ?? "").trim()) refuse(`step ${i + 1} of ${check.id} is empty`);
  });
  if (from > check.steps.length) refuse(`${check.id} has ${check.steps.length} steps; --from ${from} is past the end`);
  const id = from > 1 ? `${check.id}-from-${from}` : check.id;
  // Fill the card a step at a time, until 12 steps or the link would pass MOST_CHARS.
  const steps = [];
  for (const step of check.steps.slice(from - 1)) {
    if (steps.length === MOST_STEPS) break;
    if (linkFor({ id, title: check.title, steps: [...steps, step] }).length > MOST_CHARS) {
      if (steps.length === 0) {
        refuse(`step ${from} of ${check.id} is too long for one card: its link passes ${MOST_CHARS} characters. Shorten it.`);
      }
      break;
    }
    steps.push(step);
  }
  // A step answered with a cross and no note says nothing when its "see" only
  // asked for a note (the screenshot test, 2026-11-12). Named, not refused:
  // a ledger row's wording is fixed in the ledger, not here.
  steps.forEach((s, i) => {
    const see = String(s.see ?? "");
    if (/\b(note|whether)\b/i.test(see) && !/\b(tick|cross)\b/i.test(see)) {
      log("unclear_step", { step: from + i, id: quote(check.id) });
      console.error(
        `Step ${from + i} of ${check.id} asks for a note, so a cross with no note cannot be read.` +
          `\nWord it as a question with two answers: "Tick if …, cross if …".`,
      );
    }
  });
  const next = from - 1 + steps.length + 1;
  if (next <= check.steps.length) log("more_steps", { id: check.id, total: check.steps.length, next_from: next });
  return { id, title: check.title, steps };
}

/** Each value encoded on its own: `+` stays a plus in the app, so spaces are %20. */
function linkFor(check) {
  const pairs = [["id", check.id], ["title", check.title]];
  for (const s of check.steps) {
    pairs.push(["step", s.do.trim()]);
    if (s.see && String(s.see).trim()) pairs.push(["see", String(s.see).trim()]);
  }
  return `hifth://x-callback-url/check?${pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

// ---- the answers ---------------------------------------------------------------

function jsonFilesUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? jsonFilesUnder(p) : name.endsWith(".json") ? [p] : [];
  });
}

function summarise(path) {
  const a = JSON.parse(readFileSync(path, "utf8"));
  const count = (kind) => (a.steps ?? []).filter((s) => s.answer === kind).length;
  log("answer", {
    file: basename(path),
    id: a.id,
    result: a.result,
    passed: count("pass"),
    failed: count("fail"),
    unanswered: count("not answered"),
    note: quote(a.note),
  });
  (a.steps ?? []).forEach((s, i) => {
    if (s.answer === "fail") log("failed_step", { id: a.id, step: i + 1, action: quote(s.action) });
  });
}

const filesUnder = (dir) =>
  readdirSync(dir).reduce((n, name) => n + (statSync(join(dir, name)).isDirectory() ? filesUnder(join(dir, name)) : 1), 0);

/** A folder inside the app's own data, such as Documents/walk-probe: never absolute, never `..`. */
function alsoPath() {
  const also = opt("--also");
  if (also === undefined) return undefined;
  const parts = String(also).split("/").filter(Boolean);
  if (also.startsWith("/") || parts.length === 0 || parts.includes("..")) {
    refuse(`--also takes a folder inside the app's data, such as Documents/walk-probe: ${also}`);
  }
  return parts.join("/");
}

/**
 * Copy a folder the build wrote (its own log, say) next to the answers, as
 * <out>/<its name>. Replaced each time: a log that grew on the iPad must not
 * stay stale here.
 */
function copyAlso(also, out, container) {
  const name = basename(also);
  let from;
  let work;
  if (container) {
    from = join(container, also);
    if (!existsSync(from)) noAlso(also, "the simulator");
  } else {
    work = mkdtempSync(join(tmpdir(), "hifth-also-"));
    const r = devicectl([
      "device", "copy", "from", "--device", opt("--device"),
      "--domain-type", "appDataContainer", "--domain-identifier", BUNDLE,
      "--source", also, "--destination", work,
    ]);
    if (r.status !== 0) noAlso(also, "the iPad", firstLine(r));
    // devicectl may put the folder itself inside the destination, or only its files.
    const nested = join(work, name);
    from = existsSync(nested) && statSync(nested).isDirectory() ? nested : work;
  }
  const dest = join(out, name);
  rmSync(dest, { recursive: true, force: true });
  cpSync(from, dest, { recursive: true });
  if (work) rmSync(work, { recursive: true, force: true });
  log("also_copied", { from: also, files: filesUnder(dest), to: dest });
}

function noAlso(also, where, why = "") {
  log("error", { where: "also", msg: quote(`${also} not on ${where} ${why}`) });
  console.error(`${also} is not in the app's data on ${where}${why ? ` (${why})` : ""}.\nDid this build write it? Check the path, and that the build on it is the one that writes it.`);
  process.exit(1);
}

function answers() {
  const out = opt("--out") ?? DEFAULT_OUT;
  if (flag("--print-out")) {
    console.log(out);
    return;
  }
  const also = alsoPath();
  const work = mkdtempSync(join(tmpdir(), "hifth-checks-"));
  let found;
  let container;
  if (flag("--sim")) {
    const r = simctl(["get_app_container", "booted", BUNDLE, "data"]);
    if (r.status !== 0) fail("simulator", `could not find the app in the booted simulator: ${firstLine(r)}`);
    container = r.stdout.trim();
    found = jsonFilesUnder(join(container, "Documents/checks"));
  } else if (opt("--device")) {
    log("copy_start", { from: "ipad" });
    const r = devicectl([
      "device", "copy", "from", "--device", opt("--device"),
      "--domain-type", "appDataContainer", "--domain-identifier", BUNDLE,
      "--source", "Documents/checks", "--destination", work,
    ]);
    if (r.status !== 0) fail("ipad", `could not copy the answers off the iPad: ${firstLine(r)}`);
    found = jsonFilesUnder(work);
  } else {
    refuse("say where from: --sim or --device <id>");
  }
  mkdirSync(out, { recursive: true });
  let fresh = 0;
  for (const src of found.sort()) {
    const dest = join(out, basename(src));
    if (existsSync(dest)) continue;
    copyFileSync(src, dest);
    fresh++;
    summarise(dest);
  }
  rmSync(work, { recursive: true, force: true });
  if (also) copyAlso(also, out, container);
  log("done", { out, found: found.length, new: fresh });
}

function fail(where, msg) {
  log("error", { where, msg: quote(msg) });
  console.error(
    where === "ipad"
      ? `${msg}\nIs the iPad plugged in, unlocked and trusted, with a build from this laptop on it?` +
        `\nOr no card has been answered on it yet: the app makes its answers folder at the first Done.`
      : `${msg}\nIs a simulator booted with the app installed (make app-run)?`,
  );
  process.exit(1);
}

// ---- the commands --------------------------------------------------------------

if (command === "link") {
  const check = theCheck();
  log("link", { id: check.id, steps: check.steps.length });
  console.log(linkFor(check));
} else if (command === "send") {
  const check = theCheck();
  const link = linkFor(check);
  if (flag("--sim")) {
    const r = simctl(["openurl", "booted", link]);
    if (r.status !== 0) fail("simulator", `the simulator did not take the link: ${firstLine(r)}`);
    log("sent", { id: check.id, steps: check.steps.length, to: "simulator" });
  } else if (opt("--device")) {
    const r = devicectl(["device", "process", "launch", "--device", opt("--device"), "--payload-url", link, BUNDLE]);
    if (r.status !== 0) fail("ipad", `the iPad did not take the link: ${firstLine(r)}`);
    log("sent", { id: check.id, steps: check.steps.length, to: "ipad" });
  } else {
    refuse("say where to: --sim or --device <id>");
  }
  console.log(link);
} else if (command === "answers") {
  answers();
} else {
  refuse("usage: check-card.mjs link|send|answers … (see the top of the script)");
}
