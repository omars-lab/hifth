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
import { readLedger, ledgerHash, guideDiagrams, readDiagrams, GUIDE_PATH, ROOT } from "./validation-ledger.mjs";
import { guidePage } from "./lib/validation-render.mjs";

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
    ".svg": "image/svg+xml",
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
const ledger = readLedger();
const checks = ledger.checks ?? [];
const hash = ledgerHash(checks);

// The diagrams are drawn by scripts/render-diagrams.mjs (it needs a browser);
// this only reads what is on disk, and the card says so when one is missing.
writeFileSync(GUIDE_PATH, guidePage(checks, hash, readDiagrams(guideDiagrams(checks))), "utf8");
console.log(`  guide → docs/validation/guide.html  (${checks.length} checks, ledger ${hash})`);

if (process.argv.includes("--serve")) serve();
