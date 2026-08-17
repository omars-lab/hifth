/**
 * The sittings, served with somewhere for the answers to go.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * The sittings were being served by `python3 -m http.server`, which can hand out
 * a page and can do nothing else. So every answer a reader gave lived in that one
 * browser's own store and nowhere else: durable enough — it survives a reload, a
 * screen lock, a rebuild — but invisible from this machine, unbanked until the
 * reader reached the end of a hundred-and-seventeen-card sitting and pressed save,
 * and gone for good if they ever cleared the browser's data.
 *
 * Somebody nine answers into a sitting asked how to submit them one at a time and
 * watch the remaining count come down. Both halves of that need a server that can
 * be posted to: the page already posts every answer the moment it is given, but
 * only if it finds a sink on the window, and a static file server is not one.
 *
 * ── Why it replaces the static server rather than joining it ─────────────
 *
 * Same host, same port, same path — deliberately, and it is the whole reason this
 * is not the session runner. Browser storage is per-origin, so a sitting begun at
 * one address cannot be finished at another: move the reader to a different port
 * and every answer they have already given becomes unreachable, silently, with the
 * page cheerfully starting again from card one. This serves the same origin the
 * answers were banked under, so a reader mid-sitting reloads and picks up exactly
 * where they were, now with the answers also landing here as they go.
 *
 * A second server was ruled out earlier for the same reason it is being ruled out
 * again. This is a replacement, not an addition.
 *
 * ── What it writes ───────────────────────────────────────────────────────
 *
 * One line per answer, appended, flushed per write, to `out/mark-answers.jsonl`.
 * Append-only because the thing being defended against is losing a scarce person's
 * attention: a closed laptop or a killed terminal costs one line in the worst case,
 * where a rewritten document costs the file. It is the same shape and the same
 * reasoning as the co-working transcript, and `score-mark-report.mjs` reads it the
 * same way.
 *
 * That file is also what makes the remaining count fall. `build-mark-report.mjs
 * --answered` drops every mark carrying a standing answer, so the next round is
 * built from what is genuinely left rather than from the whole pool again.
 */
import { appendFileSync, createReadStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { extname, join, normalize, resolve } from "node:path";
import { readSitting } from "./lib/sitting-file.mjs";
import { canonicalAddress } from "./lib/tailnet.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

/**
 * Where the reader actually is, which is not this machine.
 *
 * The default was the loopback address, and the loopback address is reachable from
 * exactly one device: this one. Every sitting so far has therefore been started by
 * somebody remembering to pass a flag, and the flag they remembered was not written
 * down anywhere — not in the skill that runs the sittings, not in a script, not in
 * the Makefile. So the arrangement this project chose deliberately worked only for
 * whoever already knew the incantation.
 *
 * It now binds the private network by default, and only that: not every interface.
 * The coffee shop's wifi is an interface too, and a sitting is a maintainer's
 * instrument with a write endpoint on it. If the private network is not up there is
 * nothing to bind and it falls back to loopback, which is the honest failure — the
 * phone cannot reach this machine, and pretending otherwise by listening on the LAN
 * would be answering a different question.
 */
const DIR = resolve(arg("--dir", new URL("../out", import.meta.url).pathname));
const WHERE = canonicalAddress();
const HOST = arg("--host", WHERE.ip ?? "127.0.0.1");
const PORT = Number(arg("--port", 4180));
const LOG = join(DIR, arg("--log", "mark-answers.jsonl"));

// Not a secret and not trying to be. It is bound to one interface on a private
// tailnet; the token only means that a page which was not served from here cannot
// post into the log by guessing the path.
const TOKEN = randomBytes(9).toString("hex");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
};

/**
 * The sink the sitting looks for, in the shape it already knows.
 *
 * `build-mark-report.mjs` reads `window.HIFTH_SESSION` and falls back to a
 * download when there is none — so this is an opt-in the page takes, not an
 * interception, and a sitting opened straight off the filesystem keeps working
 * exactly as it did.
 */
const SHIM = `<script>
window.HIFTH_SESSION = {
  post: function (kind, payload) {
    return fetch("/api/event?t=${TOKEN}", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: kind, payload: payload }), keepalive: true,
    }).then(function (r) { return r.json(); });
  },
  artifact: function (name, json) {
    return fetch("/api/artifact?t=${TOKEN}", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name, json: json }),
    }).then(function (r) { return r.json(); });
  },
  answers: function (name) {
    return fetch("/api/answers?t=${TOKEN}&name=" + encodeURIComponent(name)).then(function (r) { return r.json(); });
  },
  sittings: function () {
    return fetch("/api/sittings?t=${TOKEN}").then(function (r) { return r.json(); });
  },
};
</script>`;

/**
 * In front of the page's own scripts, or not at all.
 *
 * Three anchors tried in order, because a generated single-file page very often
 * opens with a doctype and a meta and never writes a head tag — the parser
 * supplies one. Prepending ahead of the doctype instead would put the page in
 * quirks mode, breaking its layout to fix its reporting. A page none of these
 * match is served untouched and says so on the terminal, which is better than
 * serving something that will quietly bank nothing.
 */
const ANCHORS = [/<head(\s[^>]*)?>/i, /<!doctype[^>]*>/i, /<html(\s[^>]*)?>/i];

function inject(html) {
  for (const re of ANCHORS) {
    const m = html.match(re);
    if (m) return html.replace(re, (hit) => hit + SHIM);
  }
  return null;
}

const body = (req) =>
  new Promise((ok, no) => {
    let s = "";
    req.on("data", (c) => {
      s += c;
      if (s.length > 8e6) no(new Error("too big"));
    });
    req.on("end", () => ok(s));
    req.on("error", no);
  });

const json = (res, code, obj) => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
};

let banked = 0;

/**
 * Everything this machine holds for one sitting, handed back to it.
 *
 * The browser's own store was the only place a reader's *place* and their drawn
 * corrections lived, and it turns out to be the least dependable thing in the chain:
 * it is per-origin, so the tailnet name and the tailnet address are two different
 * memories of the same sitting, and a browser is free to throw it away. This machine
 * has had every answer since the first one. So it hands them back, and the browser
 * store stops being the single copy of anything.
 *
 * Two halves, because they are different kinds of record and the page merges them:
 * `banked` is the reduced snapshot a hand-over wrote — retractions already applied —
 * and `log` is the raw append-only stream, retractions included as their own lines.
 * Filtering is left to the page: one log covers every sitting, and only the page
 * knows which marks are its own.
 */
function answersFor(name) {
  const banked = [];
  if (name) {
    const path = join(DIR, name.replace(/[^a-zA-Z0-9._-]/g, ""));
    if (path.startsWith(DIR) && existsSync(path)) {
      try {
        const doc = JSON.parse(readFileSync(path, "utf8"));
        for (const ev of doc.said || []) banked.push(ev);
      } catch {
        // A half-written hand-over is not a reason to refuse the log as well.
      }
    }
  }

  const log = [];
  if (existsSync(LOG)) {
    for (const line of readFileSync(LOG, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line);
        if (rec.payload) log.push(rec.payload);
      } catch {
        // One torn line at the tail is what append-only costs; the rest still reads.
      }
    }
  }
  return { banked, log };
}

/**
 * Which sittings are on the disk right now, and what each is asking about.
 *
 * The front door used to be a photograph of this. Every tile, every total and
 * every sentence carrying a number was worked out when the page was generated
 * and then frozen, so finishing a sitting left it looking exactly as unfinished
 * as the fifteen beside it, and a re-deal left the page describing a set of
 * parts that no longer existed. Nothing on the screen could admit either, and
 * the only cure was somebody remembering to regenerate the page.
 *
 * This is the listing that ends that. It walks the directory on each request
 * rather than caching, for the same reason every other route here reads its file
 * per request: the parts are rebuilt while this is running, routinely, and a
 * server holding its own idea of what is on the disk would be the stale thing
 * instead of the page. Twenty-odd files off a warm disk is not a cost worth
 * defending against.
 *
 * It reads them through `lib/sitting-file.mjs` — the same reading the builder and
 * the auditor use — so the three cannot come to different conclusions about what
 * a sitting is. A file that is not a sitting is skipped silently; the output
 * directory is full of them. A sitting whose card list is torn comes back with
 * its header and its fault, because the header is what carries the counts, and
 * listing it with a note is better than a front door that has quietly lost one.
 */
function sittingsOnDisk() {
  const out = [];
  for (const name of readdirSync(DIR).sort()) {
    if (!name.startsWith("sit.") || !name.endsWith(".html")) continue;
    const s = readSitting(join(DIR, name));
    if (!s) continue;
    out.push({ name, ids: s.ids, faults: s.faults, ...s.head });
  }
  return out;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "x"}`);

  if (req.method === "GET" && url.pathname === "/api/sittings") {
    if (url.searchParams.get("t") !== TOKEN) return json(res, 403, { ok: false, error: "not this server's page" });
    return json(res, 200, { ok: true, sittings: sittingsOnDisk() });
  }

  if (req.method === "GET" && url.pathname === "/api/answers") {
    if (url.searchParams.get("t") !== TOKEN) return json(res, 403, { ok: false, error: "not this server's page" });
    const got = answersFor(url.searchParams.get("name") || "");
    return json(res, 200, { ok: true, ...got });
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/")) {
    if (url.searchParams.get("t") !== TOKEN) return json(res, 403, { ok: false, error: "not this server's page" });
    let sent;
    try {
      sent = JSON.parse(await body(req));
    } catch {
      return json(res, 400, { ok: false, error: "not json" });
    }

    if (url.pathname === "/api/event") {
      // Stamped here rather than trusted from the browser: the device has its own
      // clock and its own timezone and no particular reason to be right, and a log
      // whose times came from two sources cannot be read as a sequence.
      appendFileSync(LOG, `${JSON.stringify({ t: new Date().toISOString(), ...sent })}\n`, "utf8");
      banked += 1;
      process.stdout.write(`\r${banked} answers banked to ${LOG.split("/").pop()}   `);
      return json(res, 200, { ok: true });
    }

    if (url.pathname === "/api/artifact") {
      const name = String(sent.name || "").replace(/[^a-zA-Z0-9._-]/g, "");
      if (!name) return json(res, 400, { ok: false, error: "no name" });
      const path = join(DIR, name);
      writeFileSync(path, JSON.stringify(sent.json, null, 1), "utf8");
      console.log(`\nbanked a whole sitting to ${path}`);
      return json(res, 200, { ok: true, path });
    }
    return json(res, 404, { ok: false, error: "no such endpoint" });
  }

  // Everything else is a file. `normalize` before joining, so a path with .. in it
  // cannot walk out of the directory being served.
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let path = join(DIR, rel);
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html");
  if (!path.startsWith(DIR) || !existsSync(path)) {
    res.writeHead(404, { "content-type": "text/plain" });
    return res.end("not here");
  }

  const type = TYPES[extname(path)] || "application/octet-stream";
  if (extname(path) !== ".html") {
    res.writeHead(200, { "content-type": type });
    return createReadStream(path).pipe(res);
  }

  const html = readFileSync(path, "utf8");
  const withSink = inject(html);
  if (!withSink) console.log(`\n${rel}: nowhere to put the sink — served as-is, it will download instead`);
  res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  res.end(withSink || html);
}).listen(PORT, HOST, () => {
  // One address, printed once, with the others named as things not to use. The
  // banner used to print whatever was bound, which meant it printed the loopback
  // address on the machine nobody sits at. What a person needs from this is the
  // line they type into a phone, and there has to be exactly one of them or the
  // browser store quietly splits in two.
  const shown = HOST === WHERE.ip ? WHERE.host : HOST;
  console.log(`serving ${DIR}`);
  console.log("");
  console.log(`  open this, and only this:   http://${shown}:${PORT}/`);
  console.log("");
  if (WHERE.onPrivateNetwork) {
    console.log(`  Any other spelling of this machine is a different place as far as a browser`);
    console.log(`  is concerned, and a sitting opened at one cannot see what was answered at`);
    console.log(`  the other. Not ${WHERE.alternates.join(", not ")}.`);
  } else {
    console.log(`  The private network is not up, so nothing but this machine can reach this.`);
    console.log(`  Start it and run this again to get an address a phone can open.`);
  }
  console.log("");
  console.log(`  answers append to ${LOG}`);
});
