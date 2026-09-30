#!/usr/bin/env node
/**
 * Pictures for docs/waiting-on-you.md: each open decision's options page,
 * photographed the way a reader would see it — the top of the page, then each
 * of its sections — so the note in Obsidian shows the choice, not just names it.
 *
 * Writes docs/waiting-on-you/<decision>-<n>.png and shots.json, which lists
 * every picture with the heading it was taken under. The note is rebuilt from
 * that list by `make tasks-doc`, so a picture taken here shows up there.
 *
 * The pages are served the way the site serves them — docs/ under /docs/, the
 * built app at the root — because some options are live copies of the app that
 * only load when the page sits two folders below it. So the app must be built
 * first (apps/web/dist); `make waiting-shots` does that.
 *
 * Usage:  node scripts/shoot-waiting.mjs        (or `make waiting-shots`)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, normalize } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import { payload } from "./tasks.mjs";
import { WAITING_SHOTS_DIR, WAITING_SHOTS_INDEX } from "./waiting.mjs";

/* global document, window -- the page.evaluate callbacks run in the browser */
const { chromium } = createRequire(join(ROOT, "apps", "web", "package.json"))("@playwright/test");

/** Tallest a section picture gets; a longer section is cut here, the rest is on the page. */
const MAX_SECTION = 1400;
/** Sections past this many are left to the page itself. */
const MAX_SECTIONS = 6;
/**
 * Sections that hold the reasons around a choice rather than the choice: the
 * glossary, the history, the sources, the measurements, what was left out.
 * They stay on the page, one click away.
 */
const SKIP =
  /reasons|measured|left out|else could be considered|people outside|defined|being asked now|nobody decides|already decided/i;

const DIST = join(ROOT, "apps", "web", "dist");
if (!existsSync(join(DIST, "index.html"))) {
  console.error("shoot-waiting: apps/web/dist is not built; run `make waiting-shots`, which builds it.");
  process.exit(1);
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

/** docs/ from the working tree (so a page edited on a branch is what is shot), the app from dist. */
function fileFor(urlPath) {
  const rel = normalize(decodeURIComponent(urlPath.split("?")[0])).replace(/^\/+/, "");
  if (rel.startsWith("..")) return null;
  const base = rel.startsWith("docs/") ? ROOT : DIST;
  let abs = join(base, rel);
  if (existsSync(abs) && statSync(abs).isDirectory()) abs = join(abs, "index.html");
  return existsSync(abs) ? abs : null;
}

const server = createServer((req, res) => {
  const abs = fileFor(req.url ?? "/");
  if (!abs) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(abs)] ?? "application/octet-stream" });
  res.end(readFileSync(abs));
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const origin = `http://127.0.0.1:${server.address().port}`;

mkdirSync(WAITING_SHOTS_DIR, { recursive: true });
for (const f of readdirSync(WAITING_SHOTS_DIR)) {
  if (f.endsWith(".png")) rmSync(join(WAITING_SHOTS_DIR, f));
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const index = {};

for (const d of payload().decisions) {
  if (!d.page) continue;
  await page.goto(`${origin}/${d.page}`, { waitUntil: "load" });
  // Live options draw themselves after load, and a live copy of the app loads
  // lazily once it is scrolled to: bring each into view, then give it time.
  await page.evaluate(async () => {
    for (const f of document.querySelectorAll("iframe")) {
      f.scrollIntoView();
      await new Promise((r) => setTimeout(r, 200));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(4000);
  const shots = [];
  const top = `${d.id}-0.png`;
  await page.screenshot({ path: join(WAITING_SHOTS_DIR, top) });
  shots.push({ file: top, caption: "The top of the page" });

  const sections = await page.evaluate(() => {
    const heads = [...document.querySelectorAll("h2")];
    const end = document.documentElement.scrollHeight;
    return heads.map((h, i) => ({
      text: h.textContent.trim().replace(/\s+/g, " "),
      top: h.getBoundingClientRect().top + window.scrollY,
      bottom: heads[i + 1] ? heads[i + 1].getBoundingClientRect().top + window.scrollY : end,
    }));
  });
  let n = 1;
  for (const s of sections) {
    if (n > MAX_SECTIONS) break;
    if (!s.text || SKIP.test(s.text)) continue;
    const height = Math.min(s.bottom - s.top, MAX_SECTION);
    if (height < 120) continue;
    const file = `${d.id}-${n}.png`;
    await page.screenshot({
      path: join(WAITING_SHOTS_DIR, file),
      fullPage: true,
      clip: { x: 0, y: Math.max(0, s.top - 16), width: 1280, height: height + 16 },
    });
    shots.push({ file, caption: s.text });
    n++;
  }
  index[d.id] = { shots };
  console.log(`ev=shot decision=${d.id} pictures=${shots.length}`);
}

await browser.close();
server.close();
writeFileSync(WAITING_SHOTS_INDEX, `${JSON.stringify(index, null, 2)}\n`);
console.log(`wrote ${WAITING_SHOTS_INDEX.replace(ROOT, "")}`);
