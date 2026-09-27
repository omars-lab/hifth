#!/usr/bin/env node
/**
 * Draw the charts that decide whether the app's code-size cap should move.
 *
 * Three questions, one chart each, written to docs/performance/bundle-report.html:
 *
 *   1. How has the app's code grown?        git history of scripts/budget-baseline.json
 *   2. What is taking up the room?          the built app's source map, per file
 *   3. What does more code cost at start-up? docs/performance/sweep.json (perf-sweep.mjs)
 *
 * The page is self-contained (inline SVG, no scripts, no network), holds numbers
 * only, and is served from the site like every other page under docs/.
 *
 * Run: `make perf-report` (builds first, so the breakdown matches the cap check).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "apps", "web", "dist");
const OUT_DIR = join(ROOT, "docs", "performance");
const OUT = join(OUT_DIR, "bundle-report.html");
const SWEEP = join(OUT_DIR, "sweep.json");
const GATE = readFileSync(join(ROOT, "scripts", "gate-budget.mjs"), "utf8");
const CAP_KB = Number(/const BUDGET_GZ = (\d+) \* 1024/.exec(GATE)?.[1]);

const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const kb = (b) => Math.round(b / 102.4) / 10;

// ── 1. growth over time ──────────────────────────────────────────────────────
const history = git("log", "--reverse", "--format=%h %cs", "--", "scripts/budget-baseline.json")
  .trim()
  .split("\n")
  .filter(Boolean)
  .flatMap((line) => {
    const [hash, date] = line.split(" ");
    try {
      const b = JSON.parse(git("show", `${hash}:scripts/budget-baseline.json`));
      return [{ hash, date, kb: kb(b.totalGz) }];
    } catch {
      return [];
    }
  });

// ── 2. what is in the main script, from its source map ───────────────────────
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function decodeVlq(seg) {
  const out = [];
  let value = 0, shift = 0;
  for (const ch of seg) {
    const d = B64.indexOf(ch);
    value += (d & 31) << shift;
    if (d & 32) shift += 5;
    else {
      out.push(value & 1 ? -(value >>> 1) : value >>> 1);
      value = 0;
      shift = 0;
    }
  }
  return out;
}

/** Bytes of generated code attributed to each source file. */
function attribute(code, map) {
  const lines = code.split("\n");
  const bytes = new Map();
  let src = 0;
  map.mappings.split(";").forEach((line, li) => {
    const text = lines[li] ?? "";
    let col = 0;
    const segs = line ? line.split(",").map(decodeVlq) : [];
    const starts = [];
    for (const s of segs) {
      col += s[0];
      if (s.length > 1) src += s[1];
      starts.push([col, s.length > 1 ? src : -1]);
      // The remaining fields (line, column, name) are not needed for a size count.
    }
    starts.forEach(([c, s], i) => {
      const end = i + 1 < starts.length ? starts[i + 1][0] : text.length;
      const name = s < 0 ? "(glue code)" : map.sources[s];
      bytes.set(name, (bytes.get(name) ?? 0) + Math.max(0, end - c));
    });
  });
  return bytes;
}

/** A plain name for a source path: a package, or a file of ours. */
function label(path) {
  const pkg = /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/.exec(path);
  if (pkg) return { group: `library: ${pkg[1]}`, file: `library: ${pkg[1]}` };
  const core = /packages\/core\/(?:src|dist)\/(.+)$/.exec(path);
  if (core) return { group: "shared logic (packages/core)", file: `core/${core[1].replace(/\.js$/, ".ts")}` };
  // The map names our own files relative to dist/assets: "../../src/App.tsx".
  const web = /(?:^|\/)src\/(.+)$/.exec(path);
  if (web) {
    const dir = web[1].includes("/") ? web[1].split("/")[0] : "(top level)";
    return { group: `app: ${dir}`, file: web[1] };
  }
  return { group: "other", file: path.replace(/^(\.\.\/)+/, "") };
}

const assets = join(DIST, "assets");
const main = existsSync(assets) ? readdirSync(assets).find((f) => /^index-.*\.js$/.test(f)) : undefined;
let groups = [], files = [], mainGzKb = 0;
if (main && existsSync(join(assets, `${main}.map`))) {
  const code = readFileSync(join(assets, main), "utf8");
  const map = JSON.parse(readFileSync(join(assets, `${main}.map`), "utf8"));
  const raw = attribute(code, map);
  // Gzip is not per-file, so each file's share of the compressed size is its
  // share of the raw bytes. Good enough to rank; not exact to the byte.
  const totalRaw = [...raw.values()].reduce((a, b) => a + b, 0);
  const gz = gzipSync(code).length;
  mainGzKb = kb(gz);
  const byGroup = new Map(), byFile = new Map();
  for (const [path, n] of raw) {
    const { group, file } = label(path);
    const share = (n / totalRaw) * gz;
    byGroup.set(group, (byGroup.get(group) ?? 0) + share);
    byFile.set(file, (byFile.get(file) ?? 0) + share);
  }
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([name, b]) => ({ name, kb: kb(b) }));
  groups = top(byGroup, 12);
  files = top(byFile, 20);
}

// ── 3. start-up cost of more code ────────────────────────────────────────────
const sweep = existsSync(SWEEP) ? JSON.parse(readFileSync(SWEEP, "utf8")) : null;

// ── charts ───────────────────────────────────────────────────────────────────
const W = 640, H = 260, PAD = { l: 52, r: 16, t: 16, b: 40 };

/** `xs`, when given, places points by value (uneven amounts); otherwise evenly. */
function lineChart(points, { yMin = 0, yMax, yLine, yLineLabel, yUnit, xLabels, xs }) {
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const span = xs ? Math.max(...xs) - Math.min(...xs) || 1 : 0;
  const x = (i) =>
    PAD.l +
    (xs ? ((xs[i] - Math.min(...xs)) / span) * iw : points.length < 2 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => PAD.t + ih - ((v - yMin) / (yMax - yMin)) * ih;
  const ticks = Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) / 4) * i);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" class="chart">
  ${ticks.map((t) => `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${PAD.l - 6}" y="${y(t) + 4}" text-anchor="end" class="tick">${Math.round(t)}${yUnit}</text>`).join("")}
  <line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(yLine)}" y2="${y(yLine)}" class="limit"/>
  <text x="${PAD.l + 6}" y="${y(yLine) - 6}" text-anchor="start" class="limit-label">${esc(yLineLabel)}</text>
  <path d="${path}" class="line"/>
  ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p)}" r="3.5" class="dot"><title>${esc(xLabels[i])}: ${p}${yUnit}</title></circle>`).join("")}
  ${(() => { let last = null; return xLabels.map((l, i) => { const show = (points.length <= 8 || i % Math.ceil(points.length / 6) === 0 || i === points.length - 1) && l !== last; if (show) last = l; return show ? `<text x="${x(i)}" y="${H - PAD.b + 18}" text-anchor="middle" class="tick">${esc(l)}</text>` : ""; }).join(""); })()}
</svg>`;
}

function bars(rows) {
  if (!rows.length) return `<p class="empty">No source map found — run <code>make perf-report</code>, which builds first.</p>`;
  const max = Math.max(...rows.map((r) => r.kb));
  return `<table class="bars">${rows
    .map((r) => `<tr><th>${esc(r.name)}</th><td><span style="width:${((r.kb / max) * 100).toFixed(1)}%"></span></td><td class="n">${r.kb.toFixed(1)} KB</td></tr>`)
    .join("")}</table>`;
}

const latest = history.at(-1);
const growth = history.length
  ? lineChart(history.map((h) => h.kb), {
      yMax: Math.ceil(Math.max(CAP_KB, ...history.map((h) => h.kb)) / 25) * 25 + 25,
      yLine: CAP_KB,
      yLineLabel: `cap: ${CAP_KB} KB`,
      yUnit: "",
      xLabels: history.map((h) => h.date.slice(5)),
    })
  : `<p class="empty">No recorded sizes yet.</p>`;

let sweepChart = `<p class="empty">Not measured yet. Run <code>make perf-sweep</code> (about a minute per amount), then <code>make perf-report</code>.</p>`;
let sweepTable = "", headroom = "";
if (sweep?.points?.length) {
  const pts = sweep.points;
  sweepChart = lineChart(pts.map((p) => p.startupMs), {
    yMin: 1500,
    yMax: Math.ceil(Math.max(sweep.goalMs, ...pts.map((p) => p.startupMs)) / 500) * 500 + 500,
    yLine: sweep.goalMs,
    yLineLabel: `goal: usable in ${sweep.goalMs / 1000} s`,
    yUnit: "",
    xLabels: pts.map((p) => `+${p.addedKb}`),
    xs: pts.map((p) => p.addedKb),
  });
  sweepTable = `<table class="data"><tr><th>code added</th><th>app's code</th><th>usable after (median)</th><th>every run</th></tr>${pts
    .map((p) => `<tr><td>+${p.addedKb} KB</td><td>${p.scriptGzKb} KB</td><td>${p.startupMs} ms</td><td>${p.allStartupMs.join(", ")}</td></tr>`)
    .join("")}</table>`;
  const first = pts[0], last = pts.at(-1);
  if (pts.length > 1 && last.addedKb > first.addedKb) {
    // Start-up does not grow smoothly: it climbs in steps of one network round
    // trip, when the script needs one more trip to arrive. So the answer is read
    // off the measurements — the most that still passed, the least that failed —
    // not from a straight line through them.
    const msPerKb = (last.startupMs - first.startupMs) / (last.addedKb - first.addedKb);
    const passed = pts.filter((p) => p.startupMs <= sweep.goalMs).at(-1);
    const failed = pts.find((p) => p.startupMs > sweep.goalMs);
    const where = failed
      ? `The goal was still met with <b>+${passed?.addedKb ?? 0} KB</b> and missed with <b>+${failed.addedKb} KB</b>, so the room left is somewhere in between.`
      : `The goal was met at every amount tried, up to +${last.addedKb} KB.`;
    headroom = `<p class="answer">The app starts in ${first.startupMs} ms today, ${sweep.goalMs - first.startupMs} ms inside the goal. ${where} On average each extra kilobyte cost ${msPerKb.toFixed(1)} ms, but it arrives in steps of one network round trip, so a small addition can cost nothing or a whole step. This is for code that only has to download; code that also runs costs more, so leave room.</p>`;
  }
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>App Code Size</title>
<style>
  :root { --bg:#faf7f0; --fg:#2a2620; --muted:#6b6457; --line:#1f6f5c; --limit:#b4432f; --grid:#e3ddd0; --bar:#1f6f5c; --card:#fff; }
  @media (prefers-color-scheme: dark) { :root { --bg:#1b1a17; --fg:#ece6da; --muted:#a39b8c; --line:#5fc1a6; --limit:#e27a64; --grid:#34312b; --bar:#5fc1a6; --card:#24221e; } }
  body { background:var(--bg); color:var(--fg); font:16px/1.55 system-ui, sans-serif; margin:0; padding:24px 16px 64px; }
  main { max-width:720px; margin:0 auto; }
  h1 { font-size:1.6rem; margin:0 0 4px; } h2 { font-size:1.15rem; margin:40px 0 8px; }
  .sub, .empty, .note { color:var(--muted); } .note { font-size:.9rem; }
  .chart { width:100%; height:auto; background:var(--card); border-radius:8px; }
  .grid { stroke:var(--grid); } .tick { fill:var(--muted); font-size:11px; }
  .limit { stroke:var(--limit); stroke-dasharray:5 4; stroke-width:1.5; } .limit-label { fill:var(--limit); font-size:12px; }
  .line { fill:none; stroke:var(--line); stroke-width:2; } .dot { fill:var(--line); }
  table { width:100%; border-collapse:collapse; font-size:.9rem; }
  .bars th { text-align:left; font-weight:normal; padding:3px 8px 3px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:220px; }
  .bars td span { display:block; height:12px; background:var(--bar); border-radius:2px; }
  .bars td:nth-child(2) { width:55%; } .n { text-align:right; white-space:nowrap; padding-left:8px; }
  .data th, .data td { text-align:left; padding:4px 8px 4px 0; border-bottom:1px solid var(--grid); }
  .answer { background:var(--card); padding:12px 14px; border-radius:8px; }
  code { font-size:.9em; }
</style>
</head>
<body><main>
<h1>How much code can the app carry and still open fast?</h1>
<p class="sub">Rebuilt ${new Date().toISOString().slice(0, 10)} by <code>make perf-report</code>. The promise: the app is usable within 2.5 seconds on a mid-range Android phone on a slow connection. The size cap (${CAP_KB} KB compressed) is a quick stand-in for that promise; these charts say whether the stand-in still matches it.</p>

<h2>How has the app's code grown?</h2>
<p>Compressed size of all the app's code each time someone accepted a new size. Today: <b>${latest ? `${latest.kb} KB` : "unknown"}</b>.</p>
${growth}

<h2>What is taking up the room?</h2>
<p>The main script (${mainGzKb} KB compressed), split by where its code came from. Libraries are other people's code we ship; the rest is ours.</p>
${bars(groups)}
<h2>Which single files are largest?</h2>
${bars(files)}
<p class="note">Each file's compressed size is estimated from its share of the uncompressed script, so the order is right but a single number may be off by a little.</p>

<h2>What does more code cost at start-up?</h2>
<p>The app as built, then with extra code added that cannot be compressed, each opened by Lighthouse on the same pinned slow phone as the start-up check.${sweep ? ` Measured ${esc(sweep.measuredAt.slice(0, 10))}.` : ""}</p>
${sweepChart}
${headroom}
${sweepTable}
<p class="note">The extra code only has to download, not run, so real features cost at least this much and usually more. Lighthouse models a slow phone rather than using one; its numbers are steady from run to run, but they are not a stopwatch on real hardware.</p>
</main></body>
</html>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, html);
console.log(`perf-report — wrote docs/performance/bundle-report.html (${history.length} sizes, ${groups.length} groups, ${sweep?.points?.length ?? 0} sweep points)`);
