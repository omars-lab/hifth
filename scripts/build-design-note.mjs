#!/usr/bin/env node
/**
 * Render a design note in docs/ (Markdown, written for the docs vault) to the
 * HTML page beside it, which is what the site serves.
 *
 * The note is the record; the page is made from the note and nothing else, so
 * the two cannot say different things. Edit the note, then run this.
 *
 * Each ```mermaid block is drawn to an inline SVG at build time in a headless
 * browser, because the site blocks every outside script. Lines in a drawing
 * show what they carry: a solid line is drawn with travelling dashes (still
 * under "reduce motion"), a thick line is the highlighted path, a dotted line
 * stays still. The note's first Obsidian
 * callout becomes a plain highlighted box.
 *
 * Usage: node scripts/build-design-note.mjs --note docs/design/<name>.md --title "<tab title>"
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { parseArgs } from "node:util";
import { ROOT } from "./code-pointers.mjs";

const { values } = parseArgs({ options: { note: { type: "string" }, title: { type: "string" } } });
if (!values.note?.endsWith(".md") || !values.title) {
  console.error('usage: node scripts/build-design-note.mjs --note docs/design/<name>.md --title "<tab title>"');
  process.exit(2);
}
const SRC = join(ROOT, values.note);
const OUT = SRC.replace(/\.md$/, ".html");
const name = relative(join(ROOT, "docs"), SRC);

// marked comes with Mermaid; Playwright lives with the app's tests.
const rootRequire = createRequire(join(ROOT, "package.json"));
const mermaidJs = rootRequire.resolve("mermaid/dist/mermaid.min.js");
const { marked } = await import(createRequire(rootRequire.resolve("mermaid/package.json")).resolve("marked"));
const { chromium } = createRequire(join(ROOT, "apps", "web", "package.json"))("@playwright/test");

let md = readFileSync(SRC, "utf8");

// A link to another note points at that note's page, when it has one.
md = md.replace(/\]\(([\w./-]+)\.md(#[^)]*)?\)/g, (whole, path, hash = "") =>
  existsSync(join(dirname(SRC), `${path}.html`)) ? `](${path}.html${hash})` : whole,
);

const diagrams = [];
md = md.replace(/```mermaid\n([\s\S]*?)```/g, (_, src) => {
  diagrams.push(src);
  return `\n<div data-diagram="${diagrams.length - 1}"></div>\n`;
});

md = md.replace(/^> \[!(\w+)\] (.*)\n((?:>.*\n)*)/m, (_, kind, title, body) => {
  const inner = body.replace(/^> ?/gm, "");
  return `<aside class="callout ${kind}"><p class="callout-title">${title}</p>\n\n${inner}\n</aside>\n`;
});

let html = marked.parse(md, { gfm: true });

if (diagrams.length) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><body></body>");
    await page.addScriptTag({ path: mermaidJs });
    await page.evaluate(() =>
      globalThis.mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "strict",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        flowchart: { curve: "basis", padding: 12, wrappingWidth: 180 },
      }),
    );
    for (const [i, src] of diagrams.entries()) {
      const svg = await page.evaluate(
        async ([id, text]) => (await globalThis.mermaid.render(id, text)).svg,
        [`note-diagram-${i}`, src],
      );
      html = html.replace(
        new RegExp(`<div data-diagram="${i}"></div>`),
        `<figure class="diagram">${svg.replace(/(\d\.\d)\d+/g, "$1")}</figure>`,
      );
    }
  } finally {
    await browser.close();
  }
}

const heading = md.match(/^# (.*)$/m)?.[1] ?? values.title;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(values.title)}</title>
<meta name="description" content="${esc(heading)}">
<!-- Built by scripts/build-design-note.mjs from ${name}. Do not edit by hand. -->
<style>
:root { --bg: #fbfaf7; --ink: #1f2328; --muted: #5b636d; --line: #d9dcd3; --tip: #eef6ee; --tip-edge: #3d8b55; --code: #f0efe9; --link: #1f5fa8; --hafiz: #fff3c4; --flow: #4b5563; --marks: #b4690e; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #161c25; --ink: #e6ebf2; --muted: #9aa7b8; --line: #2e3846; --tip: #17271d; --tip-edge: #5fbf7a; --code: #1d2531; --link: #8cb8f0; --hafiz: #3a3214; } }
:root[data-theme="dark"] { --bg: #161c25; --ink: #e6ebf2; --muted: #9aa7b8; --line: #2e3846; --tip: #17271d; --tip-edge: #5fbf7a; --code: #1d2531; --link: #8cb8f0; --hafiz: #3a3214; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, sans-serif; }
main { max-width: 60rem; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 1.6rem; line-height: 1.25; }
h2 { font-size: 1.25rem; margin-top: 2.2rem; border-top: 1px solid var(--line); padding-top: 1.2rem; }
h3 { font-size: 1.05rem; margin-top: 1.8rem; }
a { color: var(--link); }
code { background: var(--code); padding: 0 4px; border-radius: 4px; font-size: 0.9em; }
.callout { background: var(--tip); border-left: 4px solid var(--tip-edge); padding: 4px 16px; border-radius: 6px; }
.callout-title { font-weight: 700; margin-bottom: 0; }
.table-wrap { overflow-x: auto; margin: 1rem 0; }
table { border-collapse: collapse; width: 100%; font-size: 0.92rem; }
th, td { border: 1px solid var(--line); padding: 6px 8px; vertical-align: top; text-align: left; }
th { background: var(--code); }
thead:not(:has(th:not(:empty))) { display: none; }
tr:has(td:first-child strong:only-child) td { background: var(--hafiz); }
.diagram { margin: 1rem 0; padding: 12px; background: #ffffff; border-radius: 8px; overflow-x: auto; }
.diagram svg { display: block; margin: 0 auto; width: 100%; max-width: 560px !important; height: auto; }
.diagram svg .flowchart-link.edge-pattern-solid { stroke: var(--flow) !important; stroke-dasharray: 8 5 !important; animation: note-flow 0.9s linear infinite; }
.diagram svg .flowchart-link.edge-thickness-thick { stroke: var(--marks) !important; stroke-width: 3.5px !important; }
.diagram svg .flowchart-link.edge-pattern-dotted { stroke-dasharray: 2 6 !important; stroke-linecap: round; animation: none; }
@keyframes note-flow { to { stroke-dashoffset: -13; } }
@media (prefers-reduced-motion: reduce) { .diagram svg .flowchart-link { animation: none !important; } }
</style>
</head>
<body>
<main>
${html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>")}
</main>
</body>
</html>
`;

writeFileSync(OUT, out, "utf8");
console.log(`  page → ${relative(ROOT, OUT)}`);
