#!/usr/bin/env node
/**
 * Every checked-in page under docs/ goes out with the site.
 *
 * WHY. The tenet in CLAUDE.md: a design is public, on the app's own site, or it
 * is not published. Until 2026-09-01 an options page was "published" by putting
 * a copy on another host — an address minted elsewhere, written back here by
 * hand or not at all, on a host that blocks every external asset so each page
 * had to be inlined into a second, fatter copy. Nine pages went out that way and
 * the tree named five. The site already ships the vendored artwork every options
 * page draws on, so the cheapest public copy of a page was always the site
 * itself: same path as in the repository, beside the assets it references, and
 * published by the same merge that lands the page.
 *
 * WHAT IT DOES. Runs at the end of `pnpm --filter @hifth/web build`, after vite
 * has emptied and refilled dist/, and copies every `docs/** /*.html` — except the
 * `.artifact.html` inlined copies, which exist only for the other host — to
 * `dist/docs/` at the same relative path. Two kinds of relative link are
 * rewritten on the way, because a page that renders from `file://` in a clone
 * points at things the site keeps elsewhere:
 *
 *   ../../apps/web/public/assets/…   → the same file where the site serves it
 *   ../decisions/x.md, ../design/y.md → the record, rendered, on the repository
 *                                        host (the site has no markdown)
 *   shots/probe-idle.png              → left as it is, and the file is copied
 *                                        beside the page (a checked-in file
 *                                        under docs/ that is not markdown)
 *
 * A link to another staged page is left as it is: the docs tree keeps its
 * depth, so `../design/x.html` means the same thing on the site. Any other
 * relative link — a file outside docs/, a page that does not exist — fails the
 * build, because a link that renders as a link and opens as a 404 is the
 * failure this whole arrangement exists to end.
 *
 * It also writes `dist/docs/index.html`: the front door, generated from the
 * decision register and the staged files. Open decisions first, since they are
 * the only pages anybody can still act on; then every page by folder. Nothing
 * on it is typed here — questions come from the register, titles from each
 * page's own <title>.
 *
 * NOT PRECACHED, NOT SHELLED. The service worker's precache glob runs inside
 * the vite build, before this does, so none of it is downloaded at install; and
 * vite.config.ts denylists /docs/ from the navigation fallback, or a reader
 * with the app installed would be handed the app shell in place of the page.
 *
 *   node scripts/stage-docs.mjs          stage (the build calls this)
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, posix } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import {
  readDecisions,
  splitDoc,
  titleOf,
  STATUS_ORDER,
} from "./decisions.mjs";
import { publicUrl, sourceRepo } from "./site.mjs";

const DIST = join(ROOT, "apps", "web", "dist");
const DOCS = "docs";
const PUBLIC = "apps/web/public/";

if (!existsSync(join(DIST, "index.html"))) {
  console.error(
    "stage-docs — apps/web/dist has no index.html; build the app first (this runs at the end of that build)",
  );
  process.exit(1);
}

/** Every repo-relative path under docs/ that ends in .html and is not an inlined other-host copy. */
function pages(dir = DOCS) {
  const out = [];
  for (const name of readdirSync(join(ROOT, dir)).sort()) {
    const rel = posix.join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...pages(rel));
    else if (name.endsWith(".html") && !name.endsWith(".artifact.html"))
      out.push(rel);
  }
  return out;
}

const staged = new Set(pages());
const repo = sourceRepo();
const problems = [];
const copies = new Set();
let rewritten = 0;

const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i;

/** Rewrite one page's relative links for the site. */
function rewrite(html, page) {
  const dir = posix.dirname(page);
  return html.replace(/\b(href|src)="([^"]*)"/g, (whole, attr, url) => {
    if (!url || ABSOLUTE.test(url)) return whole;
    const cut = url.search(/[?#]/);
    const path = cut === -1 ? url : url.slice(0, cut);
    const suffix = cut === -1 ? "" : url.slice(cut);
    const target = posix.normalize(posix.join(dir, path));
    let out;
    if (target.startsWith(PUBLIC))
      out = posix.relative(dir, target.slice(PUBLIC.length));
    else if (target.endsWith(".md")) out = `${repo}/blob/main/${target}`;
    else if (staged.has(target)) return whole;
    else if (
      target.startsWith(`${DOCS}/`) &&
      existsSync(join(ROOT, target)) &&
      statSync(join(ROOT, target)).isFile()
    ) {
      copies.add(target);
      return whole;
    } else {
      problems.push(
        `${page}: "${url}" points at ${target}, which the site does not serve`,
      );
      return whole;
    }
    rewritten++;
    return `${attr}="${out}${suffix}"`;
  });
}

const titles = new Map();
for (const page of staged) {
  const html = readFileSync(join(ROOT, page), "utf8");
  titles.set(page, html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() || page);
  const out = join(DIST, page);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, rewrite(html, page));
}
for (const file of copies) {
  mkdirSync(dirname(join(DIST, file)), { recursive: true });
  copyFileSync(join(ROOT, file), join(DIST, file));
}

/* ── The front door ────────────────────────────────────────────────────────── */

const decisions = readDecisions();
for (const d of decisions) {
  if (d.page && !staged.has(d.page))
    problems.push(`decisions.json[${d.id}]: page ${d.page} was not staged`);
}

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const fromIndex = (page) => posix.relative(DOCS, page);
const recordUrl = (doc) => `${repo}/blob/main/${splitDoc(doc).file}`;

const withPage = decisions.filter((d) => d.page);
const byStatus = (s) => withPage.filter((d) => d.status === s);
const statusLabel = {
  open: "Still open",
  living: "Living",
  decided: "Decided",
  superseded: "Superseded",
};

const decisionRows = STATUS_ORDER.map((s) => {
  const rows = byStatus(s);
  if (!rows.length) return "";
  return `<h3>${statusLabel[s] ?? s}</h3>
<ul class="decisions">
${rows
  .map(
    (d) => `  <li>
    <a class="q" href="${esc(fromIndex(d.page))}">${esc(d.question)}</a>
    <span class="meta">${esc(titleOf(splitDoc(d.doc).file) ?? "")}${d.decided ? ` · chose ${esc(d.decided)}` : ""} · <a href="${esc(recordUrl(d.doc))}">the record</a></span>
  </li>`,
  )
  .join("\n")}
</ul>`;
}).join("\n");

const folders = new Map();
for (const page of [...staged].sort()) {
  const folder = posix.dirname(page);
  if (!folders.has(folder)) folders.set(folder, []);
  folders.get(folder).push(page);
}
const pageRows = [...folders]
  .map(
    ([folder, list]) => `<h3><code>${esc(folder)}/</code></h3>
<ul class="pages">
${list.map((p) => `  <li><a href="${esc(fromIndex(p))}">${esc(titles.get(p))}</a> <span class="path">${esc(posix.basename(p))}</span></li>`).join("\n")}
</ul>`,
  )
  .join("\n");

const registers = [
  ["Every decision, and its status", "docs/decisions/README.md"],
  ["What is still open, worst first", "docs/issues.md"],
  ["What is being worked on", "docs/tasks.md"],
  ["The plan of record", "docs/PLAN.md"],
  ["Where each feature lives", "docs/map.json"],
];

const index = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hifth designs and decisions</title>
<style>
:root { --ground:#f4efe6; --ink:#26201a; --soft:#5c5347; --rule:#ded4c3; --accent:#1f6f66; --terra:#a23b2c; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --ground:#17140f; --ink:#ece3d3; --soft:#b4a893; --rule:#352f26; --accent:#5fb0a3; --terra:#d9826c; } }
body { margin:0; background:var(--ground); color:var(--ink); font: 16px/1.5 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; }
main { max-width: 40rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
h1 { font-weight: 500; font-size: 1.7rem; margin: 0 0 .25rem; }
h2 { font-weight: 500; font-size: 1.2rem; margin: 2.2rem 0 .4rem; border-bottom: 1px solid var(--rule); padding-bottom: .25rem; }
h3 { font-weight: 500; font-size: .95rem; color: var(--soft); margin: 1.2rem 0 .3rem; }
p.lede { color: var(--soft); margin: 0 0 .5rem; }
ul { list-style: none; padding: 0; margin: 0; }
li { padding: .45rem 0; border-bottom: 1px solid var(--rule); }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.q { display: block; }
.meta, .path { display: block; font-size: .85rem; color: var(--soft); }
code { font: .85em ui-monospace, Menlo, monospace; }
.back { font-size: .9rem; }
</style>
</head>
<body>
<main>
<p class="back"><a href="../">← back to the app</a></p>
<h1>Hifth designs and decisions</h1>
<p class="lede">Every page this project has drawn to decide something, served from the app's own site so that anybody can open it. A page here is the same file that is checked into the repository at the same path; it is public because it was merged, and for no other reason.</p>

<h2>What is being decided</h2>
<p class="lede">Each page draws its options on real pages of the mus'haf, at the size they would be used. The record beside it holds the reasons.</p>
${decisionRows}

<h2>Every page</h2>
${pageRows}

<h2>The registers</h2>
<p class="lede">What the project has decided, what is still open and what is being worked on — rendered on the repository host.</p>
<ul class="pages">
${registers.map(([label, path]) => `  <li><a href="${esc(`${repo}/blob/main/${path}`)}">${esc(label)}</a> <span class="path">${esc(path)}</span></li>`).join("\n")}
</ul>
<p class="lede" style="margin-top:2rem">Rebuilt by the app's build from the repository at <a href="${esc(repo)}">${esc(repo)}</a>. Nothing on this page is typed here.</p>
</main>
</body>
</html>
`;
mkdirSync(join(DIST, DOCS), { recursive: true });
writeFileSync(join(DIST, DOCS, "index.html"), index);

if (problems.length) {
  console.error(`FAIL stage-docs — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `stage-docs — ${staged.size} pages under docs/ staged to apps/web/dist/docs, ${rewritten} link(s) rewritten for the site, ${copies.size} linked file(s) copied beside them; front door at ${publicUrl("docs/")}`,
);
