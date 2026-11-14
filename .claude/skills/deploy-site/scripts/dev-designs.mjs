/**
 * The design pages on hifth.app served on this laptop, which the developer side bar lists.
 *
 * Owner, 2026-11-13: "when we are running the landing hub in localhost mode, there is a tab for
 * designs for devs (floating menu button in localhost mode?) that will take us to pages like
 * docs/design/hifth-app-mailing-list.html".
 *
 * prepare (release-hifth-app.mjs) calls addDevDesigns after the release check has looked at the
 * folder, so the check sees the folder as it would go up. Then this adds, to the local copy only:
 *
 *   docs/                     the design pages the app build already stages (apps/web/dist/docs)
 *   docs/design/<name>.md.html  each written note in docs/design/*.md, drawn as a page
 *   docs/design/index.html    every design page and note, newest first
 *
 * The side bar (dev-sidebar.mjs) lists them; it replaced a floating Designs button on 2026-11-14.
 *
 * publish always rebuilds the folder from scratch, so none of it can ride along. If it ever did,
 * the release check refuses it: docs/ is not a file hifth.app needs (shipped.mjs, NEVER).
 * Tests: dev-designs.test.mjs.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, join } from "node:path";
import { createRequire } from "node:module";
import { marked } from "marked";

const escape = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function titleOfHtml(text, fallback) {
  const m = /<title>([^<]*)<\/title>/i.exec(text) ?? /<title>([^<]*)/i.exec(text);
  return (m?.[1] ?? "").trim() || fallback;
}

function titleOfNote(text, fallback) {
  const m = /^#\s+(.+)$/m.exec(text);
  return (m?.[1] ?? "").replace(/[*_`]/g, "").trim() || fallback;
}

/**
 * Every design page and written note, newest first.
 * @param {{builtDocs: string, notes: string, dates?: Map<string, number>}} dirs  the app build's
 *   staged docs/, the repo's docs/design/ folder of written notes, and when each file (by name)
 *   was last committed; a file missing from it is dated by the time it was written to disk
 * @returns {{href: string, title: string, kind: "page" | "note", file: string, mtime: number}[]}
 */
export function designList({ builtDocs, notes, dates = new Map() }) {
  const when = (name, file) => dates.get(name) ?? statSync(file).mtimeMs;
  const list = [];
  const pages = join(builtDocs, "design");
  if (existsSync(pages)) {
    for (const name of readdirSync(pages)) {
      if (!name.endsWith(".html") || name === "index.html") continue;
      const file = join(pages, name);
      list.push({
        href: `/docs/design/${name}`,
        title: titleOfHtml(readFileSync(file, "utf8"), name),
        kind: "page",
        file,
        mtime: when(name, file),
      });
    }
  }
  if (existsSync(notes)) {
    for (const name of readdirSync(notes)) {
      if (!name.endsWith(".md") || name === "README.md") continue;
      const file = join(notes, name);
      list.push({
        href: `/docs/design/${name}.html`,
        title: titleOfNote(readFileSync(file, "utf8"), name),
        kind: "note",
        file,
        mtime: when(name, file),
      });
    }
  }
  return list.sort((a, b) => b.mtime - a.mtime || a.title.localeCompare(b.title));
}

const NOTE_STYLE = `
:root{color-scheme:light dark;--ink:#1d1b17;--paper:#fbf8f1;--rule:#d9d2c3;--link:#2e5d8a}
@media (prefers-color-scheme:dark){:root{--ink:#ece6d9;--paper:#1b1a17;--rule:#3a372f;--link:#8db8e0}}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.6 system-ui,sans-serif}
main{max-width:46rem;margin:0 auto;padding:1.5rem 1rem 4rem}
a{color:var(--link)} img{max-width:100%;height:auto}
pre{overflow:auto;padding:.75rem;border:1px solid var(--rule);border-radius:6px}
code{font-size:.9em} table{border-collapse:collapse;display:block;overflow:auto}
th,td{border:1px solid var(--rule);padding:.3rem .5rem;vertical-align:top}
blockquote{margin:0;padding-left:1rem;border-left:3px solid var(--rule)}
.callout{margin:1rem 0;padding:.6rem .9rem;border:1px solid var(--rule);border-left:4px solid var(--link);border-radius:6px}
.callout-tip,.callout-success{border-left-color:#3d8a5a}.callout-warning,.callout-caution{border-left-color:#c08a2b}
.callout-title,.callout>summary{margin:0 0 .3rem;font-weight:600;cursor:default}.callout>summary{cursor:pointer}
.back{font-size:.9rem}`;

/**
 * Obsidian's highlighted boxes: a quote that starts "[!tip] Title" is a box with that title,
 * and "[!kind]- Title" is a box folded shut ("+" folded open). marked draws them as plain quotes.
 */
function callouts(html) {
  return html.replace(
    /<blockquote>\s*<p>\[!(\w+)\]([+-]?)[ \t]*([^\n<]*)\n?([\s\S]*?)<\/blockquote>/g,
    (_, kind, fold, title, rest) => {
      const name = title.trim() || kind[0].toUpperCase() + kind.slice(1);
      const inner = rest.startsWith("</p>") ? rest.slice(4) : `<p>${rest}`;
      const cls = `callout callout-${kind.toLowerCase()}`;
      return fold
        ? `<details class="${cls}"${fold === "+" ? " open" : ""}><summary>${name}</summary>${inner}</details>`
        : `<aside class="${cls}"><p class="callout-title">${name}</p>${inner}</aside>`;
    },
  );
}

/** One written note as a page: its Markdown drawn, links to other notes kept working. */
export function notePage(markdown, title, { mermaid = false } = {}) {
  let body = callouts(marked.parse(markdown));
  body = body.replace(/href="(?![a-z]+:|\/|#)([^"#]+)\.md(#[^"]*)?"/g, 'href="$1.md.html$2"');
  const hasDiagram = /class="language-mermaid"/.test(body);
  body = body.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, '<pre class="mermaid">$1</pre>');
  const script =
    mermaid && hasDiagram
      ? '<script src="_mermaid.min.js"></script><script>mermaid.initialize({startOnLoad:true,theme:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"default"})</script>'
      : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${NOTE_STYLE}</style></head><body><main><p class="back"><a href="index.html">All design pages</a></p>${body}</main>${script}</body></html>`;
}

function indexPage(list) {
  const row = (d) =>
    `<li><a href="${escape(d.href)}">${escape(d.title)}</a> <small>${d.kind === "note" ? "written note" : "page"} · ${new Date(d.mtime).toISOString().slice(0, 10)}</small></li>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Design pages</title><style>${NOTE_STYLE} li{margin:.3rem 0} small{opacity:.65}</style></head><body><main><h1>Design pages</h1><p>Every options page and written note, newest first. Served on this laptop only; the public copies are at blog.bytesofpurpose.com/hifth/docs/.</p><p><a href="/docs/">The design front door</a></p><ul>${list.map(row).join("")}</ul></main></body></html>`;
}

function mermaidFile() {
  try {
    return createRequire(import.meta.url).resolve("mermaid/dist/mermaid.min.js");
  } catch {
    return null;
  }
}

/**
 * Put the design pages into a local copy of the release folder.
 * @param {{out: string, builtDocs: string, notes: string, dates?: Map<string, number>}} dirs
 * @returns {ReturnType<typeof designList>} the pages and notes, newest first, for the side bar
 */
export function addDevDesigns({ out, builtDocs, notes, dates }) {
  const docs = join(out, "docs");
  const design = join(docs, "design");
  if (existsSync(builtDocs)) cpSync(builtDocs, docs, { recursive: true });
  mkdirSync(design, { recursive: true });

  const list = designList({ builtDocs, notes, dates });
  const mermaid = mermaidFile();
  let anyDiagram = false;
  for (const d of list.filter((x) => x.kind === "note")) {
    const name = basename(d.file, ".md");
    const markdown = readFileSync(d.file, "utf8");
    anyDiagram ||= /```mermaid/.test(markdown);
    writeFileSync(join(design, `${name}.md.html`), notePage(markdown, d.title, { mermaid: Boolean(mermaid) }));
    const pictures = join(notes, name);
    if (existsSync(pictures) && statSync(pictures).isDirectory()) {
      cpSync(pictures, join(design, name), { recursive: true });
    }
  }
  if (mermaid && anyDiagram) cpSync(mermaid, join(design, "_mermaid.min.js"));
  writeFileSync(join(design, "index.html"), indexPage(list));
  return list;
}

/**
 * When each file in a folder was last committed, by file name, from one git log. The build
 * copies every design page at once, so a copy's own time says nothing about when it changed.
 * @returns {Map<string, number>} milliseconds since 1970, newest commit per name
 */
export function commitDates(repo, folder) {
  const r = spawnSync("git", ["-C", repo, "log", "--format=%x00%ct", "--name-only", "--", folder], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    // A commit hook hands git the real repository in GIT_DIR and friends; read the one named.
    env: Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_"))),
  });
  const dates = new Map();
  let at = 0;
  for (const line of (r.stdout ?? "").split("\n")) {
    if (line.startsWith("\0")) at = Number(line.slice(1)) * 1000;
    else if (line && !dates.has(basename(line))) dates.set(basename(line), at);
  }
  return dates;
}
