#!/usr/bin/env node
/**
 * Which source files the shipped scripts are made of, and how much each weighs.
 *
 * Builds the web app with source maps into a scratch folder (never apps/web/dist,
 * which the browser tests read), then walks each shipped script's map and adds up
 * the bytes each source file produced. The gzipped share is that byte count scaled
 * by the script's own gzip ratio: close enough to rank what to trim, not a measure
 * to quote to the byte.
 *
 *   node .claude/skills/optimizing-performance/scripts/size-by-source.mjs [--top 40] [--chunk index] [--out <dir>]
 *
 * First used 2026-11-12 (the words-table trim) as a throwaway; kept as a tool for
 * the second trim the same day, which found the info panel's copied setting
 * blocks and the offline worker's helper library.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const top = Number(opt("top", "40"));
const chunkFilter = opt("chunk", "");
const out = resolve(opt("out", mkdtempSync(join(tmpdir(), "hifth-size-"))));
const root = resolve(new URL("../../../..", import.meta.url).pathname);

if (!args.includes("--no-build")) {
  console.error(`ev=build_start out=${out}`);
  execFileSync("pnpm", ["-C", "apps/web", "exec", "vite", "build", "--sourcemap", "--outDir", out, "--emptyOutDir"], {
    cwd: root,
    stdio: ["ignore", "ignore", "inherit"],
  });
  console.error("ev=build_done");
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const val = Object.fromEntries([...B64].map((c, i) => [c, i]));
/** One line of a map's mappings: [generated column, source index or -1] per segment. */
function segments(line, state) {
  const outSegs = [];
  for (const seg of line.split(",")) {
    if (!seg) continue;
    const fields = [];
    let shift = 0;
    let n = 0;
    for (const ch of seg) {
      const d = val[ch];
      n += (d & 31) << shift;
      if (d & 32) shift += 5;
      else {
        fields.push(n & 1 ? -(n >>> 1) : n >>> 1);
        n = 0;
        shift = 0;
      }
    }
    state.col += fields[0];
    if (fields.length > 1) state.src += fields[1];
    outSegs.push([state.col, fields.length > 1 ? state.src : -1]);
  }
  return outSegs;
}

const assets = join(out, "assets");
const rows = new Map();
for (const file of readdirSync(assets).filter((f) => f.endsWith(".js"))) {
  if (chunkFilter && !file.startsWith(chunkFilter)) continue;
  const mapPath = join(assets, `${file}.map`);
  if (!existsSync(mapPath)) continue;
  const code = readFileSync(join(assets, file), "utf8");
  const map = JSON.parse(readFileSync(mapPath, "utf8"));
  const ratio = gzipSync(code).length / Buffer.byteLength(code);
  const chunk = file.replace(/-[A-Za-z0-9_-]{8}\.js$/, "");
  const state = { src: 0 };
  const lines = code.split("\n");
  map.mappings.split(";").forEach((line, li) => {
    state.col = 0;
    const segs = segments(line, state);
    const text = lines[li] ?? "";
    segs.forEach(([col, src], k) => {
      const end = k + 1 < segs.length ? segs[k + 1][0] : text.length;
      if (src < 0) return;
      const source = map.sources[src];
      // Sources are named relative to the map's folder; print them from the repo root.
      const where = source ? relative(root, resolve(assets, map.sourceRoot ?? "", source)) : "?";
      const name = `${chunk}  ${where}`;
      rows.set(name, (rows.get(name) ?? 0) + Buffer.byteLength(text.slice(col, end)) * ratio);
    });
  });
}

const sorted = [...rows].sort((a, b) => b[1] - a[1]);
for (const [name, gz] of sorted.slice(0, top)) console.log(`${(gz / 1024).toFixed(2).padStart(7)} KB gz  ${name}`);
console.error(`ev=done files=${rows.size} out=${out}`);
