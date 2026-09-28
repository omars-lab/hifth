#!/usr/bin/env node
/**
 * Draw the field guide's Mermaid diagrams to SVG, once, and keep them.
 *
 * The guide is one file with no scripts from anywhere, opened on a phone that
 * may be offline, so it cannot draw Mermaid itself. This draws each diagram in
 * a headless browser at build time and writes docs/validation/diagrams/<key>.svg,
 * named by a hash of the source. Only diagrams with no file yet are drawn, so a
 * run with nothing new is instant and needs no browser.
 *
 * Usage: node scripts/render-diagrams.mjs
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { readLedger, guideDiagrams, diagramKey, diagramPath, DIAGRAMS_DIR, ROOT } from "./validation-ledger.mjs";

const todo = guideDiagrams(readLedger().checks ?? []).filter((src) => !existsSync(diagramPath(src)));
if (!todo.length) {
  console.log("  diagrams → nothing new to draw");
  process.exit(0);
}

// Playwright lives with the app's tests; Mermaid is a root dev tool.
const { chromium } = createRequire(join(ROOT, "apps", "web", "package.json"))("@playwright/test");
const mermaidJs = createRequire(join(ROOT, "package.json")).resolve("mermaid/dist/mermaid.min.js");

// The guide's own night palette, so a diagram reads as part of the page.
const config = {
  startOnLoad: false,
  theme: "base",
  securityLevel: "strict",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  themeVariables: {
    darkMode: true,
    background: "#161c25",
    primaryColor: "#1d2531",
    primaryBorderColor: "#f0a65a",
    primaryTextColor: "#e6ebf2",
    lineColor: "#9aa7b8",
    secondaryColor: "#131a17",
    tertiaryColor: "#161c25",
    edgeLabelBackground: "#161c25",
    fontSize: "15px",
  },
  flowchart: { curve: "basis", padding: 12 },
};

mkdirSync(DIAGRAMS_DIR, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent("<!doctype html><body></body>");
  await page.addScriptTag({ path: mermaidJs });
  await page.evaluate((c) => globalThis.mermaid.initialize(c), config);
  for (const src of todo) {
    const key = diagramKey(src);
    const svg = await page.evaluate(
      async ([id, text]) => (await globalThis.mermaid.render(id, text)).svg,
      [`d${key}`, src],
    );
    // Mermaid writes coordinates to 15 places; one is plenty on a screen.
    writeFileSync(diagramPath(src), svg.replace(/(\d\.\d)\d+/g, "$1") + "\n", "utf8");
    console.log(`  diagram → docs/validation/diagrams/${key}.svg`);
  }
} finally {
  await browser.close();
}
