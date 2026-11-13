#!/usr/bin/env node
/**
 * Render docs/design/hifth-app-mailing-list.html from the note beside it,
 * docs/design/hifth-app-mailing-list.md.
 *
 * The note is the record, written for the docs vault. The site serves only
 * HTML, so the open decision "what sends the notify list's emails?" needs a
 * page a stranger can open: this is that page, made from the note and nothing
 * else, so the two cannot say different things. Edit the note, then run this.
 *
 * The note's one Mermaid diagram is drawn to an inline SVG here, at build time,
 * in a headless browser (the same way scripts/render-diagrams.mjs draws the
 * field guide's), because the site blocks every outside script. The Obsidian
 * callout at the top becomes a plain highlighted box.
 *
 * Usage: node scripts/build-hifth-app-mailing-list.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const SRC = join(ROOT, "docs", "design", "hifth-app-mailing-list.md");
const OUT = join(ROOT, "docs", "design", "hifth-app-mailing-list.html");

// marked comes with Mermaid; Playwright lives with the app's tests.
const rootRequire = createRequire(join(ROOT, "package.json"));
const mermaidJs = rootRequire.resolve("mermaid/dist/mermaid.min.js");
const { marked } = await import(createRequire(rootRequire.resolve("mermaid/package.json")).resolve("marked"));
const { chromium } = createRequire(join(ROOT, "apps", "web", "package.json"))("@playwright/test");

let md = readFileSync(SRC, "utf8");

// The diagram: pull each ```mermaid block out, draw it, put a marker back.
const diagrams = [];
md = md.replace(/```mermaid\n([\s\S]*?)```/g, (_, src) => {
  diagrams.push(src);
  return `\n<div data-diagram="${diagrams.length - 1}"></div>\n`;
});

// The callout: "> [!tip] Title" then "> lines" becomes a highlighted box.
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
        flowchart: { curve: "basis", padding: 12 },
      }),
    );
    for (const [i, src] of diagrams.entries()) {
      const svg = await page.evaluate(
        async ([id, text]) => (await globalThis.mermaid.render(id, text)).svg,
        [`mail-diagram-${i}`, src],
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

const title = md.match(/^# (.*)$/m)?.[1] ?? "Mailing list";

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hifth notify list</title>
<meta name="description" content="${title.replace(/"/g, "&quot;")}">
<!-- Built by scripts/build-hifth-app-mailing-list.mjs from hifth-app-mailing-list.md. Do not edit by hand. -->
<style>
:root { --bg: #fbfaf7; --ink: #1f2328; --muted: #5b636d; --line: #d9dcd3; --tip: #eef6ee; --tip-edge: #3d8b55; --code: #f0efe9; --link: #1f5fa8; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #161c25; --ink: #e6ebf2; --muted: #9aa7b8; --line: #2e3846; --tip: #17271d; --tip-edge: #5fbf7a; --code: #1d2531; --link: #8cb8f0; } }
:root[data-theme="dark"] { --bg: #161c25; --ink: #e6ebf2; --muted: #9aa7b8; --line: #2e3846; --tip: #17271d; --tip-edge: #5fbf7a; --code: #1d2531; --link: #8cb8f0; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, sans-serif; }
main { max-width: 60rem; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 1.6rem; line-height: 1.25; }
h2 { font-size: 1.25rem; margin-top: 2.2rem; border-top: 1px solid var(--line); padding-top: 1.2rem; }
h3 { font-size: 1.05rem; margin-top: 1.6rem; }
a { color: var(--link); }
code { background: var(--code); padding: 0 4px; border-radius: 4px; font-size: 0.9em; }
.callout { background: var(--tip); border-left: 4px solid var(--tip-edge); padding: 4px 16px; border-radius: 6px; }
.callout-title { font-weight: 700; margin-bottom: 0; }
.table-wrap { overflow-x: auto; margin: 1rem 0; }
table { border-collapse: collapse; width: 100%; font-size: 0.92rem; }
th, td { border: 1px solid var(--line); padding: 6px 8px; vertical-align: top; text-align: left; }
th { background: var(--code); }
.diagram { margin: 1rem 0; padding: 12px; background: #ffffff; border-radius: 8px; overflow-x: auto; }
.diagram svg { display: block; margin: 0 auto; width: 100%; max-width: 520px !important; height: auto; }
</style>
</head>
<body>
<main>
${html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>")}
</main>
</body>
</html>
`;

writeFileSync(OUT, page, "utf8");
console.log("  page → docs/design/hifth-app-mailing-list.html");
