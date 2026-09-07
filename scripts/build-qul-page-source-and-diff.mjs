#!/usr/bin/env node
/**
 * Renders the scoping page for the two open decisions about the other Qur'an
 * library: whether a page could ever be *drawn* from its data, and whether we
 * should build a fine check that holds our page *against* its.
 *
 * The reasons are authored once, in plain markdown, at
 * docs/design/qul-page-source-and-diff.md — a map of what would have to be
 * settled, settling none of it. This script is only the renderer: it turns that
 * one authored file into the standalone page the decision register points at,
 * docs/design/qul-page-source-and-diff.html, so the words a reader weighs and
 * the words checked in never drift. Two decisions share this one page, the same
 * way the page-bar options page hosts both the detents and the boundary-juz
 * questions; the reasons for each live in their own record under
 * docs/decisions/.
 *
 * The authored markdown carries zero Qur'an text — it is scoping prose, not a
 * drawn page — and this renderer copies it verbatim into HTML, so the built
 * page holds zero scripture too, the standing rule for anything under docs/.
 * The script asserts that at the end and fails loudly if a single Arabic letter
 * ever appears, the same belt-and-braces every page generator here wears.
 *
 *   node scripts/build-qul-page-source-and-diff.mjs
 *
 * No data, no cache, no network: it reads the one markdown file and writes the
 * one HTML file, so it rebuilds on a fresh clone.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const SRC = join(ROOT, "docs/design/qul-page-source-and-diff.md");
const OUT = join(ROOT, "docs/design/qul-page-source-and-diff.html");

// ------------------------------------------------------------- inline + escape

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Bold before italic — the double star has to bind before the single one. */
const inline = (s) =>
  esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

// -------------------------------------------------------------- markdown blocks
//
// A line-based renderer for exactly the constructs the authored doc uses:
// headings, one blockquote, horizontal rules, two tables, paragraphs, and lists
// that nest (option C carries bullets and sub-paragraphs under one item). No
// links, no code, no images — the doc has none, on purpose.

const indentOf = (l) => (l.match(/^ */)?.[0].length ?? 0);
const isHeading = (l) => /^#{1,3} /.test(l);
const isQuote = (l) => /^> /.test(l);
const isRule = (l) => /^---$/.test(l.trim());
const isTable = (l) => /^\s*\|/.test(l);
const isItem = (l) => /^ *- /.test(l);
const blank = (l) => l.trim() === "";

/** Drop n leading spaces where present, else trim what leading space there is. */
const dedent = (lines, n) =>
  lines.map((l) =>
    l.startsWith(" ".repeat(n)) ? l.slice(n) : l.replace(/^ +/, ""),
  );

function renderTable(rows) {
  // rows: raw "| a | b |" lines, the second being the "---" separator.
  const cells = (l) =>
    l
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
  const head = cells(rows[0]);
  const body = rows.slice(2).map(cells);
  const th = head.map((c) => `<th>${inline(c)}</th>`).join("");
  const trs = body
    .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
    .join("\n");
  return `<div class="scroll"><table>\n<thead><tr>${th}</tr></thead>\n<tbody>\n${trs}\n</tbody>\n</table></div>`;
}

function renderBlocks(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (blank(l)) {
      i++;
      continue;
    }
    if (isHeading(l)) {
      // headings can soft-wrap across lines until a blank line.
      const buf = [l];
      i++;
      while (i < lines.length && !blank(lines[i]) && !isHeading(lines[i])) buf.push(lines[i++]);
      const m = buf.join(" ").match(/^(#{1,3}) (.*)$/s);
      const level = m[1].length;
      out.push(`<h${level}>${inline(m[2].replace(/\s+/g, " ").trim())}</h${level}>`);
      continue;
    }
    if (isQuote(l)) {
      const buf = [];
      while (i < lines.length && isQuote(lines[i])) buf.push(lines[i++].replace(/^> ?/, ""));
      out.push(`<blockquote><p>${inline(buf.join(" ").replace(/\s+/g, " ").trim())}</p></blockquote>`);
      continue;
    }
    if (isRule(l)) {
      out.push("<hr>");
      i++;
      continue;
    }
    if (isTable(l)) {
      const buf = [];
      while (i < lines.length && isTable(lines[i])) buf.push(lines[i++]);
      out.push(renderTable(buf));
      continue;
    }
    if (isItem(l)) {
      const base = indentOf(l);
      const region = [];
      // A list runs on through blanks, deeper-indented continuations and its own
      // siblings — and stops at the first line back at base indent that is not a
      // bullet (a following paragraph), which is exactly where markdown ends it.
      while (i < lines.length) {
        const cur = lines[i];
        if (blank(cur)) {
          region.push(cur);
          i++;
          continue;
        }
        if (indentOf(cur) > base || (indentOf(cur) === base && isItem(cur))) {
          region.push(cur);
          i++;
          continue;
        }
        break;
      }
      out.push(renderList(region, base));
      continue;
    }
    // paragraph: soft-wrapped plain lines up to the next block or blank.
    const buf = [l];
    i++;
    while (
      i < lines.length &&
      !blank(lines[i]) &&
      !isHeading(lines[i]) &&
      !isQuote(lines[i]) &&
      !isRule(lines[i]) &&
      !isTable(lines[i]) &&
      !isItem(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    out.push(`<p>${inline(buf.join(" ").replace(/\s+/g, " ").trim())}</p>`);
  }
  return out.join("\n");
}

function renderList(region, base) {
  // Split into items at base-indent bullets; each item's body is everything up
  // to the next such bullet, dedented and rendered on its own so nested bullets
  // and sub-paragraphs (option C) come out right.
  const items = [];
  let cur = null;
  for (const line of region) {
    if (indentOf(line) === base && isItem(line)) {
      if (cur) items.push(cur);
      cur = [line.replace(/^ *- /, "")];
    } else if (cur) {
      cur.push(line);
    }
  }
  if (cur) items.push(cur);
  const lis = items
    .map((itemLines) => {
      const [lead, ...rest] = itemLines;
      const body = renderBlocks([lead, ...dedent(rest, base + 2)]);
      // Unwrap the paragraph tags for a simple one-paragraph item so it is not
      // double-spaced — but only when the body really is a single paragraph
      // (its first </p> is its last), never for an item that also carries a
      // nested list or sub-paragraphs, like option C.
      const onlyP =
        body.startsWith("<p>") &&
        body.endsWith("</p>") &&
        body.indexOf("</p>") === body.length - 4;
      return `<li>${onlyP ? body.slice(3, -4) : body}</li>`;
    })
    .join("\n");
  return `<ul>\n${lis}\n</ul>`;
}

// --------------------------------------------------------------------- the page

const STYLE = `
:root {
  --ground: #f4efe6; --raised: #fbf8f2; --sunk: #ece4d6;
  --ink: #26201a; --soft: #5c5347; --faint: #6b6255;
  --rule: #ded4c3; --rule-soft: #eae1d2;
  --accent: #1f6f66; --accent-ink: #17544d; --accent-soft: #d7e7e3;
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", "Hoefler Text", Georgia, serif;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --measure: 40rem;
}
:root:not([data-theme="light"]) {
  @media (prefers-color-scheme: dark) {
    --ground: #1a1712; --raised: #221e18; --sunk: #14110d;
    --ink: #ece3d4; --soft: #b3a793; --faint: #8f836f;
    --rule: #3a3227; --rule-soft: #2c261d;
    --accent: #6fc3b7; --accent-ink: #9fd8cf; --accent-soft: #21332f;
  }
}
:root[data-theme="dark"] {
  --ground: #1a1712; --raised: #221e18; --sunk: #14110d;
  --ink: #ece3d4; --soft: #b3a793; --faint: #8f836f;
  --rule: #3a3227; --rule-soft: #2c261d;
  --accent: #6fc3b7; --accent-ink: #9fd8cf; --accent-soft: #21332f;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--ink);
  font-family: var(--sans); line-height: 1.62; }
.wrap { max-width: 52rem; margin: 0 auto; padding: 3rem 1.5rem 5rem; }
h1, h2, h3 { font-family: var(--serif); font-weight: 600; text-wrap: balance; line-height: 1.25; }
h1 { font-size: clamp(1.6rem, 4.5vw, 2.4rem); margin: 0 0 1rem; }
h2 { font-size: 1.4rem; margin: 2.4rem 0 0.8rem; padding-top: 1.4rem; border-top: 1px solid var(--rule-soft); }
h3 { font-size: 1.12rem; margin: 1.8rem 0 0.5rem; color: var(--accent-ink); }
p, li { max-width: var(--measure); }
p, ul, blockquote, .scroll { margin: 0 0 0.9rem; }
li { margin: 0 0 0.5rem; }
ul ul { margin-top: 0.5rem; }
strong { color: var(--ink); }
blockquote { border-left: 3px solid var(--accent); background: var(--raised);
  margin-left: 0; padding: 0.2rem 1.1rem; color: var(--soft); border-radius: 0 6px 6px 0; }
blockquote p { margin: 0.6rem 0; font-style: italic; }
hr { border: none; border-top: 1px solid var(--rule); margin: 2rem 0; }
.scroll { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 0.95rem; }
th, td { border: 1px solid var(--rule); padding: 0.5rem 0.7rem; text-align: left;
  vertical-align: top; }
th { background: var(--sunk); font-family: var(--serif); }
a { color: var(--accent-ink); }
`;

function build() {
  const md = readFileSync(SRC, "utf8");
  const title = (md.match(/^#\s+(.+?)\s*$/m)?.[1] ?? "Decision").replace(/[*`]/g, "");
  const body = renderBlocks(md.split("\n"));
  const html = `<title>${esc(title)}</title>
<style>${STYLE}</style>
<main class="wrap">
${body}
</main>
`;
  // The one invariant that matters: not a single Qur'an letter reaches the page.
  const arabic = [...html].filter((c) => {
    const n = c.charCodeAt(0);
    return (n >= 0x0600 && n <= 0x06ff) || (n >= 0x0750 && n <= 0x077f) || (n >= 0xfb50 && n <= 0xfdff) || (n >= 0xfe70 && n <= 0xfeff);
  });
  if (arabic.length) {
    console.error(`build-qul-page-source-and-diff: FAIL — ${arabic.length} Arabic codepoint(s) in the built page`);
    process.exit(1);
  }
  writeFileSync(OUT, html);
  console.log(`render → ${OUT.replace(ROOT, "")} ${(html.length / 1024).toFixed(0)}KB, 0 Arabic`);
}

build();
