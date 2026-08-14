#!/usr/bin/env node
/**
 * A co-working session on one manual validation check: the runbook, on the
 * device you are working from, with everything you do banked to disk as you do
 * it.
 *
 * ── The gap this closes ──────────────────────────────────────────────────
 *
 * `docs/validation/ledger.json` is the register and the runbook, and it is
 * already rendered three ways — the terminal (`make validate CHECK=<id>`), the
 * phone (`make guide`), and this skill's own prose. All three are *read-only*.
 * The writing has always happened at the end, on the laptop, from memory:
 * `make record CHECK=<id> RESULT='<one sentence>'`.
 *
 * That is fine for the verdict, which is a judgement and belongs to a person.
 * It is bad for everything else. Fifteen minutes of walking a runbook on a
 * phone produces observations at step four that are gone by step ten, and the
 * one surviving sentence cannot tell anybody afterwards whether the check was
 * thin or the recall was. Worse, a check with structured answers — the
 * hundred forced choices in `placement-correction-by-eye` — held its entire
 * output in a browser tab's `localStorage` on a `file://` origin, which is a
 * store no browser promises to keep, until the very end when it produced a
 * download the person then had to find and hand to a scorer.
 *
 * So: a small local server that renders one check from the same ledger, and
 * appends every tick, note, structured answer and verdict to
 * `docs/validation/sessions/<stamp>-<check>.jsonl` the moment it happens.
 *
 * ── What it deliberately does not do ─────────────────────────────────────
 *
 * It does not judge. Nothing on the page tells you how you are doing, and no
 * route on the server can score anything. That is not minimalism, it is a
 * requirement borrowed from the check that most needs it: a blind forced
 * choice is only evidence while nobody — the worker included — knows how it is
 * going. A progress bar is fine; a running tally would quietly convert the
 * measurement into a training exercise, and the number that came out would be
 * a measure of how fast someone learned the pattern.
 *
 * It also does not replace `make guide`. That page is for skimming what is
 * outstanding, stays committed, and is gated against ledger drift. This one is
 * ephemeral, opens a file for writing, and exists only while you are working.
 *
 * ── Why the token ────────────────────────────────────────────────────────
 *
 * The server binds `0.0.0.0`, because most of these checks happen on a phone
 * and a phone needs the LAN. That means anything else on the network can reach
 * the write routes, and the write routes append to a file this project treats
 * as evidence. A random token in the URL is cheap and turns "anyone on this
 * Wi-Fi can post observations into a validation record" into "nobody can". The
 * integrity argument is the real one; the confidentiality is incidental.
 *
 * Usage:
 *   node scripts/session.mjs --check <id>          # resume an unbanked session, or start one
 *   node scripts/session.mjs --check <id> --new    # start a fresh transcript regardless
 *   node scripts/session.mjs --check <id> --port 4180
 *   node scripts/session.mjs --check <id> --tool <repo-relative path to an .html>
 *
 * ── Why --tool ───────────────────────────────────────────────────────────
 *
 * The ledger pins one tool page per check, which is right for a check whose
 * tool is one page. It is wrong for a check whose population was cut into
 * parts so a person could finish it: sixteen files, one check, and the pinned
 * path can only name one of them. Without an override the other fifteen get
 * opened as plain files off a static server, which injects no sink — so every
 * answer lives in that phone's browser store and nowhere else until somebody
 * remembers to press save. The flag is what makes the phone just a screen.
 *
 * It overrides the path only. The check is still the check: same transcript,
 * same ledger entry, same verdict at the end.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync, spawn } from "node:child_process";
import { extname, join, basename, resolve, sep } from "node:path";
import { readLedger, ROOT, SHOTS_DIR } from "./validation-ledger.mjs";
import { card, CSS, rich, attr } from "./lib/validation-render.mjs";
import {
  append,
  draftResult,
  openSessionFor,
  readSession,
  sessionPath,
  stampNow,
  summarise,
} from "./lib/session-log.mjs";

/* ── arguments ─────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const flag = (name) => argv.includes(`--${name}`);

const ledger = readLedger();
const checks = ledger.checks ?? [];
const id = arg("check");
const check = checks.find((c) => c.id === id);

if (!id || !check) {
  console.error(`\n  session — ${id ? `no check "${id}" in the ledger` : "which check?"}. Available:\n`);
  for (const c of checks) console.error(`    ${c.id.padEnd(32)} ${c.status}`);
  console.error(`\n  usage: make session CHECK=<id>\n`);
  process.exit(2);
}

const steps = check.runbook?.steps ?? [];
if (!steps.length) {
  console.error(
    `\n  session — "${id}" has no runbook steps, so there is nothing to walk.\n` +
      `  Add them to docs/validation/ledger.json first; gate:validation already\n` +
      `  refuses a pending human check without them.\n`,
  );
  process.exit(2);
}

/* ── which page this sitting opens ─────────────────────────────────────── */

/**
 * The one the ledger pinned, or the one named on the command line.
 *
 * An override keeps the pinned label and note where there are any, because the
 * check has not changed: the same reasons still apply and they are usually the
 * only prose saying what the page is for. Only the path moves, and both the
 * card and the transcript say which file it moved to — otherwise sixteen
 * sittings of one check produce sixteen identical-looking pages and sixteen
 * transcripts that cannot say which was which, and that is not a thing anybody
 * discovers until they are reading them months later.
 */
function chosenTool() {
  const pinned = check.runbook?.tool ?? null;
  const named = arg("tool");
  if (!named) return pinned;

  // Repo-relative and inside the repo. Not a security boundary — whoever runs
  // this already has the shell — but the page it names is served through a
  // route the token guards, and the guard is only worth having while this
  // server's reach is as small as it claims. Both sides go through `resolve`
  // because ROOT carries a trailing slash and a string comparison against it
  // silently rejects every real path.
  if (!resolve(ROOT, named).startsWith(resolve(ROOT) + sep) || extname(named) !== ".html") {
    console.error(`\n  session — --tool wants a .html path inside the repo, and got "${named}".\n`);
    process.exit(2);
  }
  return { ...(pinned ?? {}), path: named, from: "command line" };
}

const tool = chosenTool();
const toolReady = tool ? existsSync(join(ROOT, tool.path)) : false;

/* ── the transcript ────────────────────────────────────────────────────── */

const commit =
  spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).stdout?.trim() || null;

// Resuming is the default, and the reason is the failure this whole script is
// about: an interrupted session whose work is still on disk must not be
// orphaned beside a fresh empty one. Two half-transcripts for one check is
// worse than either alone — nobody can tell later which was the real attempt.
const resumed = flag("new") ? null : openSessionFor(id);
const logPath = resumed?.path ?? sessionPath(id, stampNow());

if (resumed) {
  const s = summarise(resumed.events);
  console.log(`\n  resuming ${basename(logPath)} — ${s.stepsDone}/${steps.length} steps, ${s.observations} answers`);
} else {
  append(logPath, {
    kind: "session",
    check: id,
    title: check.title,
    commit,
    on: `${process.platform} node ${process.versions.node}`,
    stepsTotal: steps.length,
    tool: tool?.path ?? null,
  });
  console.log(`\n  new transcript → docs/validation/sessions/${basename(logPath)}`);
}

// A resumed transcript already said which page it was opened against, and a
// resume that opens a different one has to say so or the record is wrong about
// itself. Nothing reads this yet; it is here because the alternative is a file
// that quietly stops describing the sitting it holds.
if (resumed && tool?.path && resumed.events.find((e) => e.kind === "session")?.tool !== tool.path) {
  append(logPath, { kind: "tool", path: tool.path });
  console.log(`  now against ${tool.path}`);
}

/* ── the page ──────────────────────────────────────────────────────────── */

const TOKEN = randomBytes(9).toString("base64url");

function page() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>Hifth — session · ${attr(check.id)}</title>
<style>${CSS}${EXTRA_CSS}</style>
</head>
<body data-token="${attr(TOKEN)}" data-check="${attr(check.id)}">
<header class="top">
  <p class="kicker">Hifth · حِفظ · session</p>
  <h1>${rich(check.title)}</h1>
  <p class="lede">Everything you tick or type below lands in
  <code>docs/validation/sessions/${attr(basename(logPath))}</code> as you do it — not at the end,
  and not from memory.</p>
  <p class="rule">Nothing here tells you how you are doing, and nothing here can.
  A verdict is yours to write at the bottom; this page only remembers what you saw.</p>
</header>

<main>
${
  tool
    ? `<article class="card tool-card">
  <div class="head"><span class="badge">tool</span><h2>${rich(tool.label ?? "This check has its own tool")}</h2></div>
  ${tool.note ? `<p class="why">${rich(tool.note)}</p>` : ""}
  ${tool.from ? `<p class="expect">Opening <code>${attr(tool.path)}</code> — asked for by name, not the page this check pins.</p>` : ""}
  ${
    toolReady
      ? `<p><a class="tool-open" href="/tool?t=${attr(TOKEN)}" target="_blank" rel="noopener">Open it →</a></p>
  <p class="expect">Answers it records come straight here, into the same transcript. No download to find afterwards.</p>`
      : `<p class="expect">Not built yet on this machine. Run the check's setup commands above, then reload this page.</p>`
  }
</article>`
    : ""
}
${card(check, { capture: true })}

<article class="card bank">
  <div class="head"><span class="badge">last</span><h2>Bank the verdict</h2></div>
  <p class="why">One sentence, in your words: what you saw, and what it decides. This is
  the artifact — a <code>done</code> with no result is indistinguishable from a check nobody ran.
  Bank a refusal exactly as carefully as a confirmation.</p>
  <textarea id="verdict" rows="4" placeholder="what you saw, and what it decides"></textarea>
  <p class="draft">Your notes so far, to crib from: <span id="draft">—</span></p>
  <div class="bank-row">
    <button id="bank" type="button">Bank it and stamp the ledger</button>
    <span id="bank-say"></span>
  </div>
  <p class="expect">This runs <code>make record</code> for you: the ledger gets the verdict and
  the date, the guide is regenerated, and <code>gate:validation</code> re-runs. What it will not do
  is the <b>tunes</b> work above — that needs judgement, so it stays yours.</p>
</article>
</main>

<div class="bar" role="status" aria-live="polite">
  <span id="prog">0/${steps.length} steps</span>
  <span id="saved" class="ok">banked</span>
</div>

<footer class="foot">
  <p>Close the tab whenever — the transcript is already on disk. Ctrl-C in the terminal
  prints where it is.</p>
</footer>

<script>${JS}</script>
</body>
</html>
`;
}

const EXTRA_CSS = `
/* The session's own chrome. Everything above this line is the shared card
   renderer, so a step reads identically here and in the field guide. */
textarea { display: block; width: 100%; margin: 8px 0 0; padding: 10px 12px;
  background: #0a0d12; color: var(--text); border: 1px solid var(--line); border-radius: 9px;
  font: 15px/1.5 ui-serif, Georgia, serif; resize: vertical; }
textarea:focus-visible { outline: 2px solid var(--amber); outline-offset: 1px; }
.note { margin: 10px 0 0; }
.note label { font: 600 11px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase;
  color: var(--dim); }

.tool-card { border-color: var(--amber); }
.tool-open { display: inline-block; margin: 6px 0 2px; padding: 12px 18px; border-radius: 10px;
  background: var(--amber); color: #10141a; font: 600 16px/1 ui-sans-serif, system-ui, sans-serif;
  text-decoration: none; min-height: 44px; box-sizing: border-box; }

.bank { border-color: var(--green); }
.bank .draft { margin: 10px 0 0; font-size: 14px; color: var(--dim); }
.bank-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 12px 0 4px; }
#bank { padding: 13px 20px; min-height: 44px; border: 0; border-radius: 10px;
  background: var(--green); color: #0d1512; font: 600 16px/1 ui-sans-serif, system-ui, sans-serif;
  cursor: pointer; }
#bank[disabled] { opacity: .5; cursor: default; }
#bank-say { font-size: 15px; color: var(--dim); }

/* Progress and a save state, and nothing else. Anything resembling a score
   belongs to the scorer, which runs afterwards and not here. */
.bar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between;
  gap: 16px; padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background: #0a0d12ee; border-top: 1px solid var(--line); backdrop-filter: blur(8px);
  font: 600 13px/1.4 var(--mono); letter-spacing: .04em; }
.bar .ok { color: var(--green); }
.bar .pending { color: var(--amber); }
.bar .lost { color: #e07a6a; }
body { padding-bottom: 72px; }
`;

/**
 * The client. Three jobs: restore what the transcript already knows, post every
 * change immediately, and be visibly honest when a post did not land.
 *
 * That last one is the whole contract. A capture surface that drops writes
 * quietly is worse than the download it replaced, because the download at least
 * failed where you could see it.
 */
const JS = `
(function () {
  var TOKEN = document.body.dataset.token;
  var queue = [], flushing = false, lost = 0;
  var saved = document.getElementById("saved");
  var prog = document.getElementById("prog");
  var total = ${steps.length};

  function say() {
    if (lost) { saved.textContent = lost + " not banked — retrying"; saved.className = "lost"; }
    else if (queue.length || flushing) { saved.textContent = "banking…"; saved.className = "pending"; }
    else { saved.textContent = "banked"; saved.className = "ok"; }
  }

  function post(event) { queue.push(event); say(); flush(); }

  function flush() {
    if (flushing || !queue.length) return;
    flushing = true;
    var event = queue[0];
    fetch("/api/event?t=" + encodeURIComponent(TOKEN), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(event), keepalive: true,
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      queue.shift(); lost = 0; flushing = false; say(); flush();
    }).catch(function () {
      // Keep it queued and keep saying so. Retrying forever is right here: the
      // server is on this machine or this LAN, so a failure is almost always a
      // sleep or a Ctrl-C, and the work is worth more than the tidiness.
      lost = queue.length; flushing = false; say(); setTimeout(flush, 1500);
    });
  }

  function progress() {
    var n = document.querySelectorAll("input[data-step]:checked").length;
    prog.textContent = n + "/" + total + " steps";
  }

  document.querySelectorAll("input[data-step]").forEach(function (box) {
    box.addEventListener("change", function () {
      post({ kind: "step", stepId: box.dataset.stepId || null,
             index: Number(box.dataset.stepIndex), do: box.dataset.stepDo,
             state: box.checked ? "done" : "undone" });
      progress();
    });
  });

  var timers = {};
  document.querySelectorAll("textarea[data-note]").forEach(function (area) {
    area.addEventListener("input", function () {
      // Debounced, not per-keystroke: the transcript is append-only and a line
      // per character would bury the reading. Short enough that a closed lid
      // costs at most the last sentence.
      clearTimeout(timers[area.dataset.note]);
      timers[area.dataset.note] = setTimeout(function () {
        post({ kind: "note", stepId: area.dataset.note, text: area.value });
      }, 600);
    });
    area.addEventListener("blur", function () {
      clearTimeout(timers[area.dataset.note]);
      post({ kind: "note", stepId: area.dataset.note, text: area.value });
    });
  });

  // What the transcript already holds, so a reload or a second device picks up
  // where the first left off rather than looking like a fresh session.
  fetch("/api/state?t=" + encodeURIComponent(TOKEN)).then(function (r) { return r.json(); })
    .then(function (s) {
      (s.stepStates || []).forEach(function (st) {
        var sel = st.stepId
          ? 'input[data-step-id="' + CSS.escape(st.stepId) + '"]'
          : 'input[data-step-index="' + st.index + '"]';
        var box = document.querySelector(sel);
        if (box) box.checked = st.state === "done";
      });
      (s.notes || []).forEach(function (n) {
        var area = document.querySelector('textarea[data-note="' + CSS.escape(n.stepId) + '"]');
        if (area) area.value = n.text;
      });
      document.getElementById("draft").textContent = s.draft || "—";
      progress();
    }).catch(function () { lost = 1; say(); });

  var bank = document.getElementById("bank");
  var bankSay = document.getElementById("bank-say");
  bank.addEventListener("click", function () {
    var text = document.getElementById("verdict").value.trim();
    if (!text) { bankSay.textContent = "The verdict in words IS the artifact — say what you saw."; return; }
    bank.disabled = true; bankSay.textContent = "recording…";
    fetch("/api/record?t=" + encodeURIComponent(TOKEN), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: text }),
    }).then(function (r) { return r.json(); }).then(function (out) {
      bankSay.textContent = out.ok
        ? "Banked. Now do what tunes says — see the terminal."
        : "make record refused: " + (out.error || "see the terminal");
      bank.disabled = !out.ok;
    }).catch(function () { bank.disabled = false; bankSay.textContent = "could not reach the session — is it still running?"; });
  });

  say();
})();
`;

/**
 * The shim a check's own tool finds waiting for it.
 *
 * Injected into any page served at `/tool`, before that page's own scripts, so
 * a tool can post structured answers into the transcript without knowing
 * anything about this server beyond one function. A tool opened straight off
 * the filesystem finds no shim and keeps whatever offline behaviour it already
 * had — which is why this is an opt-in call and not an interception.
 */
const SHIM = (token) => `<script>
window.HIFTH_SESSION = {
  post: function (kind, payload) {
    return fetch("/api/event?t=${token}", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: kind, tool: true, payload: payload }), keepalive: true,
    });
  },
  artifact: function (name, json) {
    return fetch("/api/artifact?t=${token}", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name, json: json }),
    }).then(function (r) { return r.json(); });
  },
};
</script>`;

/**
 * Put the shim in front of the tool's own scripts, and say so — or refuse.
 *
 * The first version of this looked for `<head>` and nothing else, which is a
 * reasonable-looking assumption and wrong: a generated single-file tool very
 * often opens `<!doctype html><meta charset=utf-8><title>…` and never writes a
 * head tag at all, because the parser supplies one. The tool then loaded with no
 * sink on the window, took its own documented fallback, and wrote a file to the
 * downloads folder — correct behaviour for a page opened off the filesystem, and
 * a silent lie about a page served from here.
 *
 * So: three anchors, tried in order, and a caller that fails loudly rather than
 * serving a page that will quietly bank nothing. Never prepend ahead of a
 * doctype — that is how a page ends up in quirks mode, which would break the
 * tool's layout to fix its reporting.
 */
const ANCHORS = [/<head(\s[^>]*)?>/i, /<!doctype[^>]*>/i, /<html(\s[^>]*)?>/i];

function injectShim(html, token) {
  for (const re of ANCHORS) {
    const m = html.match(re);
    if (m) return { html: html.replace(re, (hit) => hit + SHIM(token)), at: m[0].slice(0, 24) };
  }
  // No doctype, no html, no head: a fragment, and there is nothing to displace.
  if (!/^\s*<!doctype/i.test(html)) return { html: SHIM(token) + html, at: "the top" };
  return { html: null, at: null };
}

/* ── the server ────────────────────────────────────────────────────────── */

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

const port = Number(arg("port") ?? process.env.SESSION_PORT ?? 4175);

function json(res, code, body) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    // A ceiling, because one of the tools posts a whole ruling and an unbounded
    // read on a LAN-bound socket is somebody else's denial of service.
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 4e6) reject(new Error("too big"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;

  // Every route that reads or writes the transcript is behind the token. The
  // page itself is not: it carries the token, so serving it is how you get one,
  // and it holds nothing a stranger could not read in the repo anyway.
  const authed = url.searchParams.get("t") === TOKEN;
  if (path.startsWith("/api/") && !authed) return json(res, 403, { ok: false, error: "bad token" });

  if (path === "/" || path === "/index.html") {
    res.writeHead(200, { "content-type": TYPES[".html"] });
    return res.end(page());
  }

  if (path === "/tool") {
    if (!authed) return json(res, 403, { ok: false, error: "bad token" });
    if (!tool || !toolReady) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      return res.end("this check declares no tool, or it has not been built yet");
    }
    const shimmed = injectShim(readFileSync(join(ROOT, tool.path), "utf8"), TOKEN);
    if (!shimmed.html) {
      // Refusing beats serving it. A tool that loads without the sink falls back
      // to its offline behaviour and looks like it is working, and the session
      // ends with an empty transcript and a file in the downloads folder.
      console.log(`\n  ! ${tool.path} has nowhere to put the session shim — serving it would bank nothing.`);
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      return res.end("this tool has nowhere to put the session shim — it would bank nothing, so it is not being served");
    }
    console.log(`  tool opened · shim after ${shimmed.at}`);
    res.writeHead(200, { "content-type": TYPES[".html"] });
    return res.end(shimmed.html);
  }

  // The runbook's screenshots, from where `make shots` writes them.
  if (path.startsWith("/shots/")) {
    const file = join(SHOTS_DIR, basename(path));
    if (!existsSync(file)) {
      res.writeHead(404, { "content-type": "text/plain" });
      return res.end("no shot");
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    return res.end(readFileSync(file));
  }

  if (path === "/api/state") {
    const events = readSession(logPath);
    const s = summarise(events);
    const stepStates = [];
    for (const e of events) {
      if (e.kind !== "step") continue;
      const at = stepStates.findIndex((x) => (x.stepId ?? null) === (e.stepId ?? null) && x.index === e.index);
      const row = { stepId: e.stepId ?? null, index: e.index, state: e.state };
      if (at >= 0) stepStates[at] = row;
      else stepStates.push(row);
    }
    return json(res, 200, { stepStates, notes: s.notes, draft: draftResult(s), observations: s.observations });
  }

  if (path === "/api/event" && req.method === "POST") {
    let event;
    try {
      event = await body(req);
    } catch {
      return json(res, 400, { ok: false, error: "unreadable" });
    }
    append(logPath, event);
    return json(res, 200, { ok: true });
  }

  // A tool's finished output, written where its scorer already expects to find
  // it. This is the half of the download that was worth keeping: the file, at a
  // path the next command can be told. What is dropped is the hunting.
  if (path === "/api/artifact" && req.method === "POST") {
    let payload;
    try {
      payload = await body(req);
    } catch {
      return json(res, 400, { ok: false, error: "unreadable" });
    }
    // The raw name, not its basename. Sanitising `../../../etc/evil.json` down
    // to `evil.json` and writing it would be safe — it lands in the same
    // directory either way — but it would also report success for a name the
    // caller plainly did not mean, which turns a bug in a tool into a file
    // nobody goes looking for. Refuse anything that is not already a bare name.
    const name = String(payload.name ?? "");
    if (!/^[A-Za-z0-9._-]+\.json$/.test(name)) return json(res, 400, { ok: false, error: "bad name" });
    const out = join(ROOT, "packages", "etl", "out", name);
    writeFileSync(out, `${JSON.stringify(payload.json, null, 2)}\n`, "utf8");
    append(logPath, { kind: "artifact", name, path: `packages/etl/out/${name}` });
    console.log(`\n  artifact → packages/etl/out/${name}`);
    return json(res, 200, { ok: true, path: `packages/etl/out/${name}` });
  }

  if (path === "/api/record" && req.method === "POST") {
    let payload;
    try {
      payload = await body(req);
    } catch {
      return json(res, 400, { ok: false, error: "unreadable" });
    }
    const result = String(payload.result ?? "").trim();
    if (!result) return json(res, 400, { ok: false, error: "no verdict" });

    append(logPath, { kind: "verdict", result });
    const ran = spawnSync(
      process.execPath,
      [join(ROOT, "scripts", "record-validation.mjs"), "--check", id, "--result", result],
      { stdio: "inherit", cwd: ROOT },
    );
    if (ran.status !== 0) return json(res, 200, { ok: false, error: `record exited ${ran.status}` });
    banked = true;
    goodbye();
    return json(res, 200, { ok: true });
  }

  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("not here");
});

// Whether this sitting ended with a verdict written into the ledger. Read on the
// way out; a session that stops without one is normal and says so.
let banked = false;

server.listen(port, "0.0.0.0", () => {
  const lan = process.env.LAN_IP;
  console.log(`\n  ${check.title}`);
  console.log(`  ${check.id} · ${check.status}${check.blocks?.length ? ` · blocks ${check.blocks.join(", ")}` : ""}\n`);
  console.log(`  Here:        http://localhost:${port}/`);
  if (lan) console.log(`  Same Wi-Fi:  http://${lan}:${port}/`);
  console.log(`\n  Ticks, notes and answers land in docs/validation/sessions/${basename(logPath)}`);
  console.log(`  as you make them. Ctrl-C when you are done — nothing is lost by stopping.\n`);
  if (tool?.from) console.log(`  Tool:        ${tool.path}  (asked for by name)`);
  if (tool && !toolReady) {
    console.log(`  ! ${tool.path} is not built yet — run the setup commands above first.\n`);
  }
  if (!flag("no-open") && process.platform === "darwin") {
    // `?s=` is a cache-buster, and it is not optional. `open` hands the URL to
    // the browser, and a browser with a tab already pointed at exactly this URL
    // brings that tab to the front rather than loading anything — so a stale tab
    // from whatever last used this port appears, looking like the session and
    // failing like one. A per-run query makes it a URL no tab can already hold.
    spawn("open", [`http://localhost:${port}/?s=${TOKEN}`], { stdio: "ignore", detached: true }).unref();
  }
});

/**
 * What was captured, and the one command that turns it into a ledger entry.
 *
 * Printed on the way out rather than only at the end of a successful bank,
 * because stopping early is a normal thing to do — the runbook for the
 * adjudication check tells you in as many words to stop when you get tired.
 */
function goodbye() {
  const s = summarise(readSession(logPath));
  console.log(`\n  ── session over ────────────────────────────────────────────`);
  console.log(`  transcript   docs/validation/sessions/${basename(logPath)}`);
  console.log(`  steps        ${s.stepsDone}/${steps.length}`);
  console.log(`  notes        ${s.notes.length}`);
  if (s.observations) console.log(`  answers      ${s.observations} recorded from the tool`);
  for (const a of s.artifacts) console.log(`  artifact     ${a.path}`);
  if (banked || s.verdict) {
    console.log(`\n  Banked: ${(s.verdict?.result ?? "").slice(0, 120)}`);
    console.log(`  Now do what its 'tunes' list says — that is what the check was bought for.\n`);
  } else {
    console.log(`\n  Not banked yet. When you have a verdict:`);
    console.log(`    make record CHECK=${id} RESULT='${draftResult(s).replace(/'/g, "’") || "<what you saw>"}'`);
    console.log(`  Re-running 'make session CHECK=${id}' picks this transcript back up.\n`);
  }
}

process.on("SIGINT", () => {
  goodbye();
  process.exit(0);
});
