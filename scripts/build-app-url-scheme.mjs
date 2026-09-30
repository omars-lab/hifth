#!/usr/bin/env node
/**
 * Renders docs/design/app-url-scheme.html — the readable face of the app's URL
 * contract — from docs/design/app-url-scheme.openapi.json, which is the one
 * source: the Swift tests run its examples through the real parser, a vitest
 * holds its lists of panels and tools to the web router, and this page shows
 * it to a person. Nothing on the page is written here that the JSON does not
 * say, so the two cannot drift.
 *
 * Self-contained: no fonts, no CDN, no assets, and no Arabic. Rebuild:
 *   node scripts/build-app-url-scheme.mjs        (make app-links-doc)
 * Check it is current:
 *   node --test scripts/app-url-scheme.test.mjs
 * Browse the same JSON in Swagger UI (docs/design/app-url-scheme.swagger.html,
 * a hand-written page beside it) from a local server, opened in the browser:
 *   node scripts/build-app-url-scheme.mjs --serve  (make app-links-ui)
 */

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const SPEC = resolve(__dirname, "../docs/design/app-url-scheme.openapi.json");
export const OUT = resolve(__dirname, "../docs/design/app-url-scheme.html");

const C = {
  paper: "#f4efe6", raised: "#fbf8f2", sunk: "#ece4d6", ink: "#26201a", inkSoft: "#5c5347",
  inkFaint: "#6b6255", accent: "#1f6f66", accentStrong: "#17544d", accentTint: "#d7e7e3",
  gold: "#e8a13a", red: "#b3402f",
};

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The little Markdown the JSON uses: `code`, **bold**, and paragraphs. */
const md = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .split(/\n\n+/)
    .map((p) => `<p>${p}</p>`)
    .join("\n");

const deref = (spec, p) => {
  if (!p.$ref) return p;
  const [, , kind, name] = p.$ref.split("/");
  return spec.components[kind][name];
};

/** A schema, with a `$ref` followed and the keys beside it (`default`) kept. */
const schemaOf = (spec, schema) => (schema?.$ref ? { ...deref(spec, schema), ...schema } : schema);

const values = (spec, schema) => {
  schema = schemaOf(spec, schema);
  if (!schema) return "";
  if (schema.enum) return schema.enum.map((v) => `<code>${esc(v)}</code>`).join(", ");
  const bits = [schema.type ?? ""];
  if (schema.pattern) bits.push(`matching <code>${esc(schema.pattern)}</code>`);
  if (schema.minimum != null && schema.maximum != null) bits.push(`${schema.minimum} to ${schema.maximum}`);
  if (schema.format) bits.push(schema.format);
  return bits.filter(Boolean).join(", ");
};

const paramsTable = (spec, params) =>
  params.length === 0
    ? "<p class=\"faint\">No parameters.</p>"
    : `<table><thead><tr><th>key</th><th>where</th><th>values</th><th>what it does</th></tr></thead><tbody>
${params
  .map(deref.bind(null, spec))
  .map(
    (p) =>
      `<tr><td><code>${esc(p.name)}</code>${p.required ? ' <span class="req">required</span>' : ""}</td><td>${esc(p.in)}</td><td>${values(spec, p.schema)}${p.example != null ? `<div class="faint">e.g. <code>${esc(p.example)}</code></div>` : ""}</td><td>${md(p.description ?? "")}</td></tr>`,
  )
  .join("\n")}
</tbody></table>`;

const callbackSection = (spec, callbacks) => {
  if (!callbacks) return "";
  const rows = Object.entries(callbacks).map(([name, cb]) => {
    const resolved = deref(spec, cb);
    const [expr, ops] = Object.entries(resolved)[0];
    const op = ops.get ?? ops.post ?? Object.values(ops)[0];
    const params = op.parameters ?? [];
    return `<h4>${esc(name)} <span class="faint">— opens <code>${esc(expr)}</code></span></h4>
${md(op.summary ?? "")}
${paramsTable(spec, params)}`;
  });
  return `<h3>What comes back</h3>\n${rows.join("\n")}`;
};

const exampleRows = (examples) =>
  examples
    .map(
      (e) =>
        `<tr><td><code class="url">${esc(e.url)}</code>${e.note ? `<div class="faint">${md(e.note)}</div>` : ""}</td><td><code>${esc(e.result)}</code></td></tr>`,
    )
    .join("\n");

/** Examples whose URL starts under this path (plain links are everything else). */
const examplesFor = (spec, path) => {
  const all = spec["x-examples"] ?? [];
  const isX = (u) => /^hifth:\/\/x-callback-url\//i.test(u);
  if (path.startsWith("/x-callback-url/")) {
    const action = path.slice("/x-callback-url/".length);
    return all.filter((e) => new RegExp(`^hifth://x-callback-url/${action}(\\?|/|$)`, "i").test(e.url));
  }
  return all.filter((e) => !isX(e.url));
};

const unplacedExamples = (spec) => {
  const placed = new Set(Object.keys(spec.paths).flatMap((p) => examplesFor(spec, p).map((e) => e.url)));
  return (spec["x-examples"] ?? []).filter((e) => !placed.has(e.url));
};

export function render(spec) {
  const paths = Object.entries(spec.paths).map(([path, ops]) => {
    const op = ops.get;
    const examples = examplesFor(spec, path);
    return `<section id="${esc(op.operationId)}">
<h2>${esc(op.summary)}</h2>
<p class="path"><code>hifth://${esc(path.replace(/^\//, ""))}</code></p>
${md(op.description ?? "")}
<h3>Parameters</h3>
${paramsTable(spec, op.parameters ?? [])}
${callbackSection(spec, op.callbacks)}
<h3>Examples</h3>
<table><thead><tr><th>link</th><th>the app does</th></tr></thead><tbody>
${exampleRows(examples)}
</tbody></table>
</section>`;
  });
  const leftovers = unplacedExamples(spec);
  const errors = spec.components?.schemas?.ErrorCode;
  const edition = spec.components?.schemas?.Edition;
  const editions = edition?.["x-editions"] ?? [];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(spec.info.title)}</title>
<style>
:root { color-scheme: light; }
body { margin: 0; padding: 24px 16px 64px; background: ${C.paper}; color: ${C.ink}; font: 16px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif; }
main { max-width: 900px; margin: 0 auto; }
h1 { font-size: 1.8rem; margin: 0 0 4px; }
h2 { font-size: 1.3rem; margin: 40px 0 4px; color: ${C.accentStrong}; }
h3 { font-size: 1rem; margin: 20px 0 6px; }
h4 { font-size: 0.95rem; margin: 14px 0 4px; }
p { margin: 8px 0; }
code { font: 0.9em ui-monospace, SFMono-Regular, Menlo, monospace; background: ${C.sunk}; padding: 1px 4px; border-radius: 4px; }
code.url { word-break: break-all; }
.path code { font-size: 1.05rem; background: ${C.accentTint}; color: ${C.accentStrong}; }
.faint { color: ${C.inkFaint}; font-size: 0.9em; }
.req { color: ${C.red}; font-size: 0.8em; }
table { border-collapse: collapse; width: 100%; background: ${C.raised}; font-size: 0.93rem; }
th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid ${C.sunk}; }
th { font-weight: 600; color: ${C.inkSoft}; }
td p { margin: 0 0 4px; }
nav a { margin-right: 14px; color: ${C.accent}; }
.meta { color: ${C.inkSoft}; font-size: 0.9rem; }
@media (max-width: 640px) { table, thead, tbody, tr { display: block; } th { display: none; } td { display: block; border: 0; } tr { border-bottom: 1px solid ${C.sunk}; padding: 6px 0; } }
</style>
</head>
<body>
<main>
<h1>${esc(spec.info.title)}</h1>
<p class="meta">Version ${esc(spec.info.version)} · rendered from <code>docs/design/app-url-scheme.openapi.json</code> by <code>scripts/build-app-url-scheme.mjs</code>. The same contract in <a href="app-url-scheme.swagger.html">Swagger UI</a>, or as <a href="app-url-scheme.openapi.json">raw JSON</a>. Every example below is run through the app's own parser by its tests, so the table says what the app does, not what it was meant to do.</p>
${md(spec.info.description ?? "")}
<nav>${Object.values(spec.paths)
    .map((ops) => `<a href="#${esc(ops.get.operationId)}">${esc(ops.get.summary.split(":")[0])}</a>`)
    .join("")}<a href="#editions">Editions</a><a href="#errors">Error codes</a></nav>
${paths.join("\n")}
<section id="editions">
<h2>Which mus'haf may a link name?</h2>
${md(edition?.description ?? "")}
<table><thead><tr><th>id</th><th>mus'haf</th><th>in the app?</th></tr></thead><tbody>
${editions
    .map(
      (e) =>
        `<tr><td><code>${esc(e.id)}</code></td><td>${esc(e.name)}${e.riwayah ? `<div class="faint">${esc(e.riwayah)}</div>` : ""}</td><td>${e.shipped ? "<strong>yes</strong>" : `not yet${e.reason ? `<div class="faint">${esc(e.reason)}</div>` : ""}`}</td></tr>`,
    )
    .join("\n")}
</tbody></table>
</section>
<section id="errors">
<h2>Error codes</h2>
<p>An <code>x-error</code> answer carries <code>errorCode</code>, one of ${(errors?.enum ?? []).map((v) => `<code>${esc(v)}</code>`).join(", ")}, and a plain <code>errorMessage</code>.</p>
${md(errors?.description ?? "")}
</section>
${leftovers.length ? `<section id="more"><h2>Other examples</h2><table><tbody>${exampleRows(leftovers)}</tbody></table></section>` : ""}
</main>
</body>
</html>
`;
}

/* ── serving ───────────────────────────────────────────────────────────── */

export const SWAGGER = OUT.replace(/\.html$/, ".swagger.html");

/**
 * Serves docs/design/ so the Swagger UI page can fetch the JSON beside it
 * (a file:// page may not), with the Swagger page at the root. Same shape as
 * the guide's server: one folder, a short MIME map, nothing outside it.
 */
export function serve({ port = Number(process.env.APP_LINKS_PORT || 4175), open = true } = {}) {
  const dir = dirname(OUT);
  const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
  };
  const server = createServer((req, res) => {
    const rel = normalize(decodeURIComponent((req.url ?? "/").split("?")[0])).replace(/^(\.\.[/\\])+/, "");
    const file = rel === "/" || rel === "\\" ? SWAGGER : join(dir, rel);
    if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { "content-type": "text/plain" }).end("not here");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "text/plain; charset=utf-8" });
    res.end(readFileSync(file));
  });
  server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`\n  App links in Swagger UI:  ${url}`);
    console.log(`  The readable page:        ${url}app-url-scheme.html`);
    console.log(`  Edit the JSON and reload. Ctrl-C to stop.\n`);
    if (open && process.platform === "darwin") spawn("open", [url], { stdio: "ignore" }).unref();
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const spec = JSON.parse(readFileSync(SPEC, "utf8"));
  writeFileSync(OUT, render(spec));
  console.log(`wrote ${OUT}`);
  if (process.argv.includes("--serve")) serve({ open: !process.argv.includes("--no-open") });
}
