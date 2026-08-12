#!/usr/bin/env node
/**
 * Render docs/validation/ledger.json into docs/validation/guide.html — the
 * manual-validation runbooks, on the device they are performed on.
 *
 * Every manual check in this project happens with a phone in one hand: the perf
 * probe, the screen-reader tour, the offline survival test, and half of the edge
 * audit. Every word of guidance, until now, lived in a terminal the phone cannot
 * see. That is not a documentation gap, it is why follow-up ① sat open for six
 * loops — a check whose instructions are somewhere else is a check that gets
 * postponed.
 *
 * The page is generated, never hand-edited, and committed: `gate:validation`
 * compares its `data-ledger-hash` against the ledger and fails if they have
 * drifted, the same rule the ETL shards live under. It is also entirely
 * self-contained — no fonts, no scripts, no images from anywhere — because it is
 * served over a plain-http LAN preview to a phone that may be in airplane mode
 * for the check it is describing.
 *
 * This is the *reading* surface: all the checks, none of them written to. The
 * writing surface is `make session CHECK=<id>` (scripts/session.mjs), which
 * draws one check from the same renderer and banks what you do to a transcript.
 * The split is deliberate — you browse what is outstanding far more often than
 * you sit down to work one, and a page that opens a file on disk every time
 * somebody scrolls past it is a page nobody leaves open.
 *
 * Usage:
 *   node scripts/build-validation-guide.mjs           # write the file
 *   node scripts/build-validation-guide.mjs --serve   # write it, then serve it on the LAN
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { readLedger, ledgerHash, GUIDE_PATH, ROOT } from "./validation-ledger.mjs";
import { card, CSS } from "./lib/validation-render.mjs";

/* ── rendering ─────────────────────────────────────────────────────────── */

function page(checks, hash) {
  const open = checks.filter((c) => c.status === "pending");
  return `<!doctype html>
<html lang="en" data-ledger-hash="${hash}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>Hifth — manual validation field guide</title>
<style>${CSS}</style>
</head>
<body>
<header class="top">
  <p class="kicker">Hifth · حِفظ</p>
  <h1>Field guide</h1>
  <p class="lede">The checks a machine cannot run. ${open.length} of ${checks.length} outstanding.</p>
  <p class="rule">Every result here must tighten something automated — a threshold, a
  fixture, a gate. That is what <b>tunes</b> is for at the foot of each card. A verdict
  that tunes nothing has to be bought again by hand, forever.</p>
  <p class="src">Generated from <code>docs/validation/ledger.json</code> · <code>${hash}</code>
  · never edit this file — run <code>make guide</code></p>
</header>

<main>
${checks.map((c) => card(c)).join("\n")}
</main>

<footer class="foot">
  <p>Made it through one? <code>make record CHECK=&lt;id&gt; RESULT='…'</code> on the laptop,
  then do what the card's <b>tunes</b> list says. To have the answers banked as you go
  instead of typed from memory at the end: <code>make session CHECK=&lt;id&gt;</code>.</p>
</footer>

<script>${JS}</script>
</body>
</html>
`;
}

// Progress survives a screen lock, which a fifteen-minute walkthrough on a
// phone will hit at least once. Keyed by check + index only, so regenerating
// the guide does not wipe a session in progress.
//
// This is the guide's own persistence and it stays browser-local on purpose:
// the guide is a page you skim, and a tick here is a bookmark, not evidence.
// Evidence is what `make session` writes, to a file, with a timestamp.
const JS = `
(function () {
  var KEY = "hifth-guide:";
  document.querySelectorAll("input[data-step]").forEach(function (box) {
    var k = KEY + box.dataset.step;
    if (localStorage.getItem(k) === "1") box.checked = true;
    box.addEventListener("change", function () {
      if (box.checked) localStorage.setItem(k, "1");
      else localStorage.removeItem(k);
    });
  });
})();
`;

/* ── serving ───────────────────────────────────────────────────────────── */

function serve() {
  const dir = join(ROOT, "docs", "validation");
  const port = Number(process.env.GUIDE_PORT || 4174);
  // .png is not optional: the guide's screenshots are served from this same
  // directory, and a PNG sent as text/plain renders as a broken image on the
  // phone — which reads as "the guide is broken", not "the MIME map is short".
  const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
  };

  createServer((req, res) => {
    const rel = normalize(decodeURIComponent((req.url ?? "/").split("?")[0])).replace(/^(\.\.[/\\])+/, "");
    const file = join(dir, rel === "/" || rel === "\\" ? "guide.html" : rel);
    if (!file.startsWith(dir) || !existsSync(file)) {
      res.writeHead(404, { "content-type": "text/plain" }).end("not here");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "text/plain; charset=utf-8" });
    res.end(readFileSync(file));
  }).listen(port, "0.0.0.0", () => {
    console.log(`\n  Guide on your phone (same Wi-Fi):  http://${process.env.LAN_IP ?? "<lan-ip>"}:${port}`);
    console.log(`  Keep it open beside the app under test. Ctrl-C to stop.\n`);
  });
}

/* ── run ───────────────────────────────────────────────────────────────── */
//
// Last, not first: `const JS` above is in the temporal dead zone until the
// module body has run past it, and page() reads it.

const ledger = readLedger();
const checks = ledger.checks ?? [];
const hash = ledgerHash(checks);

writeFileSync(GUIDE_PATH, page(checks, hash), "utf8");
console.log(`  guide → docs/validation/guide.html  (${checks.length} checks, ledger ${hash})`);

if (process.argv.includes("--serve")) serve();
