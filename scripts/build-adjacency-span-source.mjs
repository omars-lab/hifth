#!/usr/bin/env node
/**
 * Draws the options for `adjacency-span-source` (what-we-depend-on ⑦): whether
 * the app should read the words it lines look-alike verses up on from the
 * printed page's own words, or from the separately-licensed word-by-word corpus
 * it does today.
 *
 * The difference between the two is a set of shared runs — 2,430 both agree on,
 * 150 only the printed page finds, 114 only the corpus finds and the page loses.
 * The page draws real examples from each set on the real printed pages where
 * they sit, with the run washed exactly as the look-alike panel washes it, so a
 * reader sees what a switch would gain and what it would cost rather than being
 * told a count.
 *
 * TWO MODES, the split the `decide` skill asks for when the finding needs a
 * cache the repo does not carry:
 *
 *   node scripts/build-adjacency-span-source.mjs --extract
 *     Reads the offline ligature cache under packages/etl/data/pages/.cache
 *     (the same one `pnpm align` needs), re-runs the uniqueness rule over both
 *     the corpus's words and the print's own, reproduces the shipped 2,544 as a
 *     control, and writes every tally plus a handful of drawable examples per
 *     bucket to docs/design/adjacency-span-source.data.json. Opt-in, network-
 *     and cache-touching, never in a gate.
 *
 *   node scripts/build-adjacency-span-source.mjs
 *     Renders docs/design/adjacency-span-source.html from that committed JSON
 *     and the committed page artwork alone. No cache, no corpus, no network —
 *     so the page rebuilds on a fresh clone and the expensive half runs once.
 *
 * Registered in docs/decisions.json as the `builtBy` for adjacency-span-source;
 * the reasons live in docs/decisions/adjacency-span-source.md. The examples in
 * the JSON carry verse keys and box geometry only — no Arabic and no text — so
 * the drawn page holds zero scripture, the standing rule for anything under
 * docs/.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import { WordIndex, toAbsoluteAyah, fromAbsoluteAyah } from "../packages/core/dist/index.js";

const ASSETS = join(ROOT, "apps/web/public/assets");
const DATA_OUT = join(ROOT, "docs/design/adjacency-span-source.data.json");
const HTML_OUT = join(ROOT, "docs/design/adjacency-span-source.html");

// ============================================================ geometry (both)

const shardCache = new Map();
function indexOf(page) {
  if (!shardCache.has(page)) {
    try {
      const raw = readFileSync(join(ASSETS, `words/hafs-kfqc/${page}.json`), "utf8");
      shardCache.set(page, new WordIndex(JSON.parse(raw)));
    } catch {
      shardCache.set(page, null);
    }
  }
  return shardCache.get(page);
}

/** key "s:a" -> [pages that carry any of its words], built once from the shards. */
let ayahPagesCache = null;
function ayahPages() {
  if (ayahPagesCache) return ayahPagesCache;
  const map = new Map();
  for (const file of readdirSync(join(ASSETS, "words/hafs-kfqc"))) {
    if (!file.endsWith(".json")) continue;
    const page = Number(file.replace(".json", ""));
    const shard = JSON.parse(readFileSync(join(ASSETS, "words/hafs-kfqc", file), "utf8"));
    for (const key of Object.keys(shard.words ?? {})) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(page);
    }
  }
  for (const arr of map.values()) arr.sort((a, b) => a - b);
  ayahPagesCache = map;
  return map;
}

/**
 * The one page that carries the whole run [from..to] of `key`, and the bands the
 * look-alike panel would wash over it. null when the run straddles a page break
 * (those are skipped as specimens — a run drawn across a fold reads as broken).
 */
function drawRun(key, from, to) {
  for (const page of ayahPages().get(key) ?? []) {
    const idx = indexOf(page);
    if (!idx?.has(key)) continue;
    const span = idx.span(key);
    if (!span || span.from > from || span.to < to) continue;
    const bands = idx.bandsFor(key, from, to).map((r) => ({
      x: Number(r.x.toFixed(2)),
      y: Number(r.y.toFixed(2)),
      w: Number(r.width.toFixed(2)),
      h: Number(r.height.toFixed(2)),
    }));
    if (!bands.length) continue;
    return { page, bands };
  }
  return null;
}

// ================================================================ extract mode

async function extract() {
  const { wordsByAyah, sharedRuns } = await import("../packages/etl/scripts/morphology.mjs");
  const { openAlignment, skeleton } = await import("../packages/etl/scripts/lib/segmentation.mjs");
  const { candidatePage } = await import("../packages/etl/scripts/lib/candidate-pages.mjs");
  const { readTheirs, WAQF } = await import("../packages/etl/scripts/lib/mushaf-frame.mjs");

  const ETL_DATA = join(ROOT, "packages/etl/data");
  const PAGES = 604;
  const DATASET = JSON.parse(
    readFileSync(join(ETL_DATA, "mutashabihat", "mutashabiha_data.json"), "utf8"),
  );

  // Copied verbatim from build-adjacency.mjs / probe-print-spans.mjs — the seed
  // adds a handful of edges the dataset does not, and 2,544 only reproduces with it.
  const CURATED = {
    "2:40": [
      { type: "mutashabih", to: "2:47", ctx: true },
      { type: "mutashabih", to: "2:122", ctx: true },
      { type: "root", to: "2:47" },
    ],
    "2:45": [{ type: "mutashabih", to: "2:153" }],
    "2:47": [
      { type: "mutashabih", to: "2:122", twin: true },
      { type: "mutashabih", to: "2:40", ctx: true },
      { type: "root", to: "2:122" },
    ],
    "2:48": [
      { type: "mutashabih", to: "2:123" },
      { type: "related", to: "82:19" },
    ],
    "2:58": [{ type: "mutashabih", to: "7:161" }],
    "2:60": [{ type: "mutashabih", to: "7:160" }],
    "2:122": [
      { type: "mutashabih", to: "2:47", twin: true },
      { type: "mutashabih", to: "2:40", ctx: true },
      { type: "root", to: "2:40" },
    ],
    "2:123": [{ type: "mutashabih", to: "2:48" }],
  };
  const CURATED_TYPE = { mutashabih: "mutashabih", related: "related-meaning", root: "shared-root" };

  const members = (a) => (Array.isArray(a) ? a : [a]);
  const first = (a) => (Array.isArray(a) ? a[0] : a);
  const datasetAbs = (n) => n + 1;
  const refToAbs = (ref) => {
    const [s, a] = ref.split(":").map(Number);
    return toAbsoluteAyah(s, a);
  };

  const edges = new Map();
  const edgeKey = (f, t, ty) => `${f}>${t}>${ty}`;
  function addEdge(fromAbs, toAbs, type, meta, { curated = false } = {}) {
    if (fromAbs === toAbs) return;
    const k = edgeKey(fromAbs, toAbs, type);
    const prev = edges.get(k);
    if (prev) {
      const ctx = prev.ctx || meta.ctx;
      edges.set(k, curated ? { ...meta, ...(ctx ? { ctx: true } : {}) } : { ...prev, ...(ctx ? { ctx: true } : {}) });
      return;
    }
    edges.set(k, meta);
  }
  for (const [, entries] of Object.entries(DATASET)) {
    for (const entry of entries) {
      const srcMembers = members(entry.src.ayah).map(datasetAbs);
      const ctx = entry.ctx === 2;
      for (const mut of entry.muts) {
        const toAbs = datasetAbs(first(mut.ayah));
        for (const fromAbs of srcMembers) addEdge(fromAbs, toAbs, "mutashabih", ctx ? { ctx: true } : {});
      }
    }
  }
  for (const [ref, list] of Object.entries(CURATED)) {
    const fromAbs = refToAbs(ref);
    for (const e of list) addEdge(fromAbs, refToAbs(e.to), CURATED_TYPE[e.type], {}, { curated: true });
  }
  for (const [k, meta] of [...edges]) {
    const [f, t, type] = k.split(">");
    const rk = edgeKey(t, f, type);
    if (!edges.has(rk)) {
      const { w: _w, ...rest } = meta;
      edges.set(rk, rest);
    }
  }

  // The corpus side, exactly as build-adjacency computes it.
  const qac = wordsByAyah();
  const align = openAlignment();
  function printRange(key, firstWord, len) {
    const head = align.printWordsOf(key, firstWord);
    const tail = align.printWordsOf(key, firstWord + len - 1);
    if (!head?.length || !tail?.length) return null;
    return [Math.min(...head), Math.max(...tail)];
  }
  function qacSpan(srcKey, tgtKey) {
    if (align.exception(srcKey) || align.exception(tgtKey)) return null;
    const { len, runs } = sharedRuns(qac.get(srcKey), qac.get(tgtKey));
    if (len === 0 || runs.length !== 1) return null;
    const from = printRange(srcKey, runs[0].a, len);
    const to = printRange(tgtKey, runs[0].b, len);
    return from && to ? { from, to } : null;
  }

  // The print side: the ayah's own words, KEEPING each word's print index so a
  // run can be drawn. printSkel.get(key) = [{ idx, skel }] in reading order.
  const isMark = (text) => text.length > 0 && [...text].every((c) => WAQF.has(c) || c === " ");
  const printSkel = new Map();
  {
    const perAyah = new Map();
    for (let page = 1; page <= PAGES; page += 1) {
      const { body } = await candidatePage(page, { offline: true });
      for (const w of readTheirs(body.toString("utf8")).words) {
        if (isMark(w.hafs)) continue;
        const key = `${w.surah}:${w.aya}`;
        if (!perAyah.has(key)) perAyah.set(key, []);
        perAyah.get(key).push([w.idx, w.hafs]);
      }
    }
    for (const [key, arr] of perAyah) {
      arr.sort((a, b) => a[0] - b[0]);
      printSkel.set(key, arr.map(([idx, text]) => ({ idx, skel: skeleton(text) })));
    }
  }
  function printSpan(srcKey, tgtKey) {
    const a = printSkel.get(srcKey);
    const b = printSkel.get(tgtKey);
    if (!a?.length || !b?.length) return null;
    const skelsA = a.map((e) => e.skel);
    const skelsB = b.map((e) => e.skel);
    const { len, runs } = sharedRuns(skelsA, skelsB);
    if (len === 0 || runs.length !== 1) return null;
    // runs are 1-based (sharedRuns counts from word 1); these arrays are 0-based.
    const a0 = runs[0].a - 1;
    const b0 = runs[0].b - 1;
    const from = [a[a0].idx, a[a0 + len - 1].idx];
    const to = [b[b0].idx, b[b0 + len - 1].idx];
    return { from: [Math.min(...from), Math.max(...from)], to: [Math.min(...to), Math.max(...to)], len };
  }

  // Walk the mutashabih edges, tally, and collect drawable candidates.
  const t = {
    mutEdges: 0, qacKept: 0, printKept: 0, both: 0, onlyQac: 0, onlyPrint: 0, neither: 0,
    lenLonger: 0, lenSame: 0, lenShorter: 0,
  };
  const cand = { both: [], onlyQac: [], onlyPrint: [] };
  const seen = new Set(); // undirected dedup for specimens
  for (const [k] of edges) {
    const [f, tt, type] = k.split(">");
    if (type !== "mutashabih") continue;
    t.mutEdges += 1;
    const src = fromAbsoluteAyah(Number(f));
    const tgt = fromAbsoluteAyah(Number(tt));
    const srcKey = `${src.surah}:${src.ayah}`;
    const tgtKey = `${tgt.surah}:${tgt.ayah}`;
    const q = qacSpan(srcKey, tgtKey);
    const p = printSpan(srcKey, tgtKey);
    if (q) t.qacKept += 1;
    if (p) t.printKept += 1;
    let bucket;
    if (q && p) { t.both += 1; bucket = "both"; }
    else if (q) { t.onlyQac += 1; bucket = "onlyQac"; }
    else if (p) { t.onlyPrint += 1; bucket = "onlyPrint"; }
    else { t.neither += 1; bucket = null; }

    if (q) {
      const qlen = sharedRuns(qac.get(srcKey), qac.get(tgtKey)).len;
      const ps = printSkel.get(srcKey), pt = printSkel.get(tgtKey);
      if (ps?.length && pt?.length) {
        const plen = sharedRuns(ps.map((e) => e.skel), pt.map((e) => e.skel)).len;
        if (plen > qlen) t.lenLonger += 1;
        else if (plen === qlen) t.lenSame += 1;
        else t.lenShorter += 1;
      }
    }

    if (!bucket) continue;
    const undirected = [Number(f), Number(tt)].sort((a, b) => a - b).join("-");
    if (seen.has(undirected)) continue;
    seen.add(undirected);
    // The run to DRAW: corpus range for both/onlyQac, print range for onlyPrint.
    const range = bucket === "onlyPrint" ? p : q;
    const src2 = drawRun(srcKey, range.from[0], range.from[1]);
    const tgt2 = drawRun(tgtKey, range.to[0], range.to[1]);
    if (!src2 || !tgt2) continue; // skip cross-page / unindexed for specimens
    const runLen = range.from[1] - range.from[0] + 1;
    cand[bucket].push({
      src: srcKey, tgt: tgtKey, runLen,
      sides: [
        { key: srcKey, page: src2.page, from: range.from[0], to: range.from[1], bands: src2.bands },
        { key: tgtKey, page: tgt2.page, from: range.to[0], to: range.to[1], bands: tgt2.bands },
      ],
    });
  }

  // Choose specimens: a few clean, multi-word, single-page runs per bucket,
  // deterministically (longest runs first, then by key) so the page is stable.
  const pick = (arr, n) =>
    arr
      .filter((e) => e.runLen >= 2)
      .sort((a, b) => b.runLen - a.runLen || a.src.localeCompare(b.src))
      .slice(0, n)
      .map(({ runLen: _r, ...rest }) => rest);

  const payload = {
    generatedBy: "scripts/build-adjacency-span-source.mjs --extract",
    note: "Verse keys and box geometry only — no scripture. See docs/decisions/adjacency-span-source.md.",
    tallies: {
      corpusKept: t.qacKept,
      printKept: t.printKept,
      agreed: t.both,
      printOnly: t.onlyPrint,
      corpusOnly: t.onlyQac,
      mutEdges: t.mutEdges,
      onCorpusKept: { printLonger: t.lenLonger, sameLength: t.lenSame, printShorter: t.lenShorter },
    },
    examples: {
      agreed: pick(cand.both, 2),
      corpusOnly: pick(cand.onlyQac, 4),
      printOnly: pick(cand.onlyPrint, 4),
    },
  };
  writeFileSync(DATA_OUT, JSON.stringify(payload, null, 2) + "\n");
  console.log(
    `extract → ${DATA_OUT.replace(ROOT, "")}\n` +
      `  control corpusKept=${t.qacKept} (must be 2544)  printKept=${t.printKept}\n` +
      `  agreed=${t.both} printOnly=${t.onlyPrint} corpusOnly=${t.onlyQac}\n` +
      `  specimens: agreed=${payload.examples.agreed.length} ` +
      `corpusOnly=${payload.examples.corpusOnly.length} printOnly=${payload.examples.printOnly.length}`,
  );
}

// ================================================================ render mode
// Committed bytes only: the findings JSON and the outlined page artwork. No
// cache, no corpus, no network — so the page rebuilds on a fresh clone.

const HTML_ARTIFACT = join(ROOT, "docs/design/adjacency-span-source.artifact.html");
/** Where the checked-in copy reaches the print from, relative to docs/design/. */
const PRINT_HREF = (page) => `../../apps/web/public/assets/pages/hafs-kfqc/${page}.svg`;
/** Padding around a run's bounding box, in page units. */
const PAD = 10;

function printMarkup(page) {
  return readFileSync(join(ASSETS, `pages/hafs-kfqc/${page}.svg`), "utf8")
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/ id="[^"]*"/g, "");
}
function printSize(page) {
  const vb = readFileSync(join(ASSETS, `pages/hafs-kfqc/${page}.svg`), "utf8").match(/viewBox="([^"]+)"/);
  const [, , w, h] = vb[1].split(/\s+/).map(Number);
  return { w, h };
}

const n2 = (v) => Number(v.toFixed(2));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** The rectangle to crop to: the run's bands, padded, clamped to the page. */
function frameOf(bands, page) {
  const { w: pw, h: ph } = printSize(page);
  const x0 = Math.min(...bands.map((b) => b.x));
  const y0 = Math.min(...bands.map((b) => b.y));
  const x1 = Math.max(...bands.map((b) => b.x + b.w));
  const y1 = Math.max(...bands.map((b) => b.y + b.h));
  const x = Math.max(0, x0 - PAD);
  const y = Math.max(0, y0 - PAD);
  return {
    x, y,
    width: Math.min(pw, x1 + PAD) - x,
    height: Math.min(ph, y1 + PAD) - y,
  };
}

function renderCopy(data, artifact) {
  const print = (page) => {
    if (artifact) return `<use href="#page-${page}"></use>`;
    const { w, h } = printSize(page);
    return `<image href="${PRINT_HREF(page)}" x="0" y="0" width="${w}" height="${h}"></image>`;
  };
  const wash = (bands) =>
    bands
      .map(
        (b) =>
          `<rect class="run" x="${n2(b.x - 0.5)}" y="${n2(b.y - 0.5)}"` +
          ` width="${n2(b.w + 1)}" height="${n2(b.h + 1)}" rx="1.5"></rect>`,
      )
      .join("");
  const side = (s) => {
    const f = frameOf(s.bands, s.page);
    return (
      `<figure class="crop">` +
      `<svg class="art" viewBox="${n2(f.x)} ${n2(f.y)} ${n2(f.width)} ${n2(f.height)}"` +
      ` aria-hidden="true" focusable="false">${print(s.page)}${wash(s.bands)}</svg>` +
      `<figcaption>${esc(s.key)}<span class="pg">page ${s.page}</span></figcaption>` +
      `</figure>`
    );
  };
  const specimen = (e) =>
    `<div class="pair">${e.sides.map(side).join('<span class="tie" aria-hidden="true">≈</span>')}</div>`;

  const bucket = (title, lead, arr) =>
    `<div class="bucket"><h3>${title}</h3><p class="lead">${lead}</p>` +
    `<div class="specimens">${arr.map(specimen).join("")}</div></div>`;

  const t = data.tallies;
  const pages = [...new Set(
    Object.values(data.examples).flat().flatMap((e) => e.sides.map((s) => s.page)),
  )];
  const defs = artifact
    ? `<svg class="vault" aria-hidden="true" focusable="false"><defs>${pages
        .map((p) => `<g id="page-${p}">${printMarkup(p)}</g>`)
        .join("")}</defs></svg>`
    : "";

  // The proportion bar: 2,430 shared, then the two disagreeing wings.
  const total = t.agreed + t.printOnly + t.corpusOnly;
  const pct = (x) => n2((x / total) * 100);
  const bar =
    `<div class="propbar" role="img" aria-label="Of ${total} runs, ${t.agreed} are found both ways, ` +
    `${t.printOnly} only by the printed page, ${t.corpusOnly} only by the corpus.">` +
    `<span class="seg agreed" style="width:${pct(t.agreed)}%"><b>${t.agreed}</b> both agree</span>` +
    `<span class="seg gain" style="width:${pct(t.printOnly)}%" title="only the printed page finds these"><b>+${t.printOnly}</b></span>` +
    `<span class="seg loss" style="width:${pct(t.corpusOnly)}%" title="only the corpus finds these"><b>−${t.corpusOnly}</b></span>` +
    `</div>` +
    `<div class="propkey">` +
    `<span><i class="sw agreed"></i>found both ways</span>` +
    `<span><i class="sw gain"></i>only the printed page — new</span>` +
    `<span><i class="sw loss"></i>only the corpus — lost on the page</span>` +
    `</div>`;

  const html = `<title>Which words the app lines look-alikes up on</title>
<style>
:root {
  --ground: #f4efe6;
  --raised: #fbf8f2;
  --sunk: #ece4d6;
  --ink: #26201a;
  --soft: #5c5347;
  --faint: #6b6255;
  --rule: #ded4c3;
  --rule-soft: #eae1d2;
  --accent: #1f6f66;
  --accent-ink: #17544d;
  --accent-soft: #d7e7e3;
  --gain: #1f6f66;
  --gain-soft: #cfe6e1;
  --loss: #a23b2c;
  --loss-soft: #f0d8ce;
  --agreed: #7a6f5c;
  --agreed-soft: #e4dccb;
  --run: rgba(31, 111, 102, 0.30);
  --run-line: rgba(23, 84, 77, 0.75);
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", "Hoefler Text", Georgia, serif;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  --measure: 37rem;
}
:root:not([data-theme="light"]) {
  @media (prefers-color-scheme: dark) {
    --ground: #1a1712; --raised: #221e18; --sunk: #14110d;
    --ink: #ece3d4; --soft: #b3a793; --faint: #8f836f;
    --rule: #3a3227; --rule-soft: #2c261d;
    --accent: #6fc3b7; --accent-ink: #9fd8cf; --accent-soft: #21332f;
    --gain: #6fc3b7; --gain-soft: #21332f;
    --loss: #e0876f; --loss-soft: #3a2620;
    --agreed: #b6a98f; --agreed-soft: #2e281f;
    --run: rgba(111, 195, 183, 0.28); --run-line: rgba(159, 216, 207, 0.8);
  }
}
:root[data-theme="dark"] {
  --ground: #1a1712; --raised: #221e18; --sunk: #14110d;
  --ink: #ece3d4; --soft: #b3a793; --faint: #8f836f;
  --rule: #3a3227; --rule-soft: #2c261d;
  --accent: #6fc3b7; --accent-ink: #9fd8cf; --accent-soft: #21332f;
  --gain: #6fc3b7; --gain-soft: #21332f;
  --loss: #e0876f; --loss-soft: #3a2620;
  --agreed: #b6a98f; --agreed-soft: #2e281f;
  --run: rgba(111, 195, 183, 0.28); --run-line: rgba(159, 216, 207, 0.8);
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--ink);
  font-family: var(--sans); line-height: 1.6; }
.wrap { max-width: 62rem; margin: 0 auto; padding: 3rem 1.5rem 5rem; }
h1, h2, h3 { font-family: var(--serif); font-weight: 600; text-wrap: balance; line-height: 1.2; }
h1 { font-size: clamp(1.7rem, 4.5vw, 2.5rem); margin: 0 0 0.5rem; }
h2 { font-size: 1.45rem; margin: 0 0 0.9rem; }
h3 { font-size: 1.1rem; margin: 0 0 0.3rem; }
p { max-width: var(--measure); }
a { color: var(--accent-ink); }
.sub { color: var(--soft); font-size: 1.05rem; max-width: var(--measure); margin: 0 0 1.4rem; }
.status { display: inline-flex; gap: 0.5rem; align-items: baseline;
  font-family: var(--mono); font-size: 0.8rem; letter-spacing: 0.03em;
  text-transform: uppercase; color: var(--soft);
  border: 1px solid var(--rule); border-radius: 999px; padding: 0.3rem 0.8rem; }
.status b { color: var(--accent-ink); }
.picture { font-size: 0.95rem; color: var(--soft); border-left: 2px solid var(--rule);
  padding: 0.2rem 0 0.2rem 1rem; margin: 1.4rem 0 0; max-width: var(--measure); }

section { margin-top: 3rem; }
section > h2 .n { display: block; font-family: var(--mono); font-size: 0.72rem;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint);
  font-weight: 400; margin-bottom: 0.35rem; }

dl.gloss { display: grid; grid-template-columns: max-content 1fr; gap: 0.35rem 1.1rem;
  background: var(--raised); border: 1px solid var(--rule); border-radius: 12px;
  padding: 1.1rem 1.3rem; margin: 1.5rem 0 0; max-width: var(--measure); }
dl.gloss dt { font-weight: 600; color: var(--accent-ink); font-family: var(--serif); }
dl.gloss dd { margin: 0; color: var(--soft); font-size: 0.96rem; }

.figures { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.9rem; margin: 1.6rem 0 0; }
.tile { background: var(--raised); border: 1px solid var(--rule); border-radius: 12px;
  padding: 1.1rem 1.2rem; }
.tile .big { font-family: var(--serif); font-size: 2.1rem; font-weight: 600;
  line-height: 1; font-variant-numeric: tabular-nums; }
.tile.gain .big { color: var(--gain); }
.tile.loss .big { color: var(--loss); }
.tile .cap { color: var(--soft); font-size: 0.88rem; margin-top: 0.45rem; }

.propbar { display: flex; height: 2.6rem; border-radius: 8px; overflow: hidden;
  border: 1px solid var(--rule); margin: 1.6rem 0 0.7rem; font-size: 0.8rem; }
.propbar .seg { display: flex; align-items: center; justify-content: center; gap: 0.3rem;
  color: #fff; white-space: nowrap; overflow: hidden; padding: 0 0.4rem; }
.propbar .seg b { font-variant-numeric: tabular-nums; }
.seg.agreed { background: var(--agreed); }
.seg.gain { background: var(--gain); }
.seg.loss { background: var(--loss); }
.propkey { display: flex; flex-wrap: wrap; gap: 0.4rem 1.3rem; color: var(--soft);
  font-size: 0.85rem; }
.propkey span { display: inline-flex; align-items: center; gap: 0.4rem; }
.sw { width: 0.85rem; height: 0.85rem; border-radius: 3px; display: inline-block; }
.sw.agreed { background: var(--agreed); }
.sw.gain { background: var(--gain); }
.sw.loss { background: var(--loss); }

table.cost { border-collapse: collapse; margin: 1.4rem 0 0; font-size: 0.95rem;
  min-width: min(100%, 28rem); }
table.cost td { padding: 0.4rem 1rem 0.4rem 0; border-bottom: 1px solid var(--rule-soft); }
table.cost td.v { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600;
  font-family: var(--mono); }

.buckets { margin-top: 1.8rem; display: grid; gap: 2.2rem; }
.bucket h3 { color: var(--ink); }
.bucket .lead { color: var(--soft); font-size: 0.97rem; margin: 0 0 1rem; }
.specimens { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  gap: 1.1rem; }
.pair { display: flex; align-items: center; gap: 0.5rem; background: var(--raised);
  border: 1px solid var(--rule); border-radius: 12px; padding: 0.8rem; }
.pair .tie { color: var(--faint); font-size: 1.3rem; flex: none; }
.crop { flex: 1; margin: 0; min-width: 0; }
.crop .art { width: 100%; height: auto; display: block; background: var(--sunk);
  border-radius: 6px; border: 1px solid var(--rule-soft); }
.crop figcaption { font-family: var(--mono); font-size: 0.78rem; color: var(--soft);
  margin-top: 0.4rem; display: flex; justify-content: space-between; gap: 0.5rem; }
.crop figcaption .pg { color: var(--faint); }
.run { fill: var(--run); stroke: var(--run-line); stroke-width: 1; }
rect { paint-order: stroke; }

.opts { border-collapse: collapse; width: 100%; margin-top: 1.4rem; font-size: 0.97rem; }
.opts th, .opts td { text-align: left; vertical-align: top; padding: 0.7rem 0.9rem;
  border-bottom: 1px solid var(--rule); }
.opts th { font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--faint); font-weight: 400; }
.opts td.k { font-family: var(--serif); font-weight: 600; color: var(--accent-ink);
  white-space: nowrap; }
.opts td.lab { font-weight: 600; }

ul.plain { max-width: var(--measure); padding-left: 1.1rem; }
ul.plain li { margin-bottom: 0.7rem; }
ul.plain li b { color: var(--ink); }
.vault { position: absolute; width: 0; height: 0; overflow: hidden; }

@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }

  /* What a choice does for a hafiz, marked the way a reader marks a page: a highlighter stroke. */
  .hafiz-box{margin:1.6em 0;padding:1em 1.15em;border:2px solid #e8c400;border-radius:12px;background:rgba(255,236,120,.14)}
  .hafiz-box h2{margin-top:0}
  .hafiz-box ul{margin:.5em 0 0;padding-left:1.1em}
  .hafiz-box li{margin:.45em 0}
  .hl{background-image:linear-gradient(100deg,rgba(255,221,0,0) 0%,rgba(255,221,0,.62) 1.2%,rgba(255,228,50,.48) 50%,rgba(255,221,0,.66) 98.8%,rgba(255,221,0,0) 100%);border-radius:.4em .2em .45em .25em;padding:.06em .28em;margin:0 -.08em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
  .for-hafiz{margin:.55em 0 0}
  @media (prefers-color-scheme: dark){
    .hafiz-box{background:rgba(250,204,21,.08);border-color:#b99a10}
    .hl{background-image:linear-gradient(100deg,rgba(250,204,21,0) 0%,rgba(250,204,21,.34) 1.2%,rgba(250,204,21,.26) 50%,rgba(250,204,21,.36) 98.8%,rgba(250,204,21,0) 100%)}
  }
</style>
${defs}
<div class="wrap">
<header>
  <h1>Which words does the app line look-alikes up on?</h1>
  <p class="sub">When two verses open the same way, the app washes the phrase they share so the
    eye is taught the seam. To wash it, the app must know that phrase word for word — and it can
    count those words two ways. This page draws what the choice between them keeps and drops, on
    the real pages where they differ.</p>
  <span class="status">Status <b>Open</b> · asked 2026-09-03</span>
  <p class="picture">This is the picture the decision record points at. Every run below is drawn
    on the printed page it actually sits on, washed exactly as the look-alike panel washes it.
    Rebuilt from committed findings — no scripture travels in this page.</p>
</header>

<section>
  <h2><span class="n">Words this page uses</span>The three words to have first</h2>
  <dl class="gloss">
    <dt>look-alikes</dt><dd>Two verses that begin with the same phrase and then diverge — the
      pairs a hafiz most often slips between. Known in the tradition as <em>mutashabihat</em>.</dd>
    <dt>shared run</dt><dd>The stretch of words a look-alike pair has in common, taken as the
      longest run they share and kept only where it sits in exactly one place on each side.</dd>
    <dt>the page's words vs. the corpus's</dt><dd>The printed mus'haf has its own words; a
      separate word-by-word reference we carry has its own count of the same verse. The two
      mostly agree, but the printed page splits some short joining particles the reference writes
      joined — so a phrase is often more words on the page, never fewer.</dd>
  </dl>
</section>

<section>
  <h2><span class="n">The question</span>What is being decided?</h2>
  <p>The shared runs are worked out once when the app is built. The question here is only which
    set of words they are counted in: <b>the printed page's own words</b>, or <b>the separate
    word-by-word reference we carry today</b>. Nothing else about the look-alike panel changes —
    only which words of an agreed pair get washed.</p>
  <p>It is asked now because the reference we count in today comes under a share-alike licence
    that reaches whatever the app builds from it, and the printed page's words — already carried,
    already read — do not. Counting the runs in the page's own words would take the whole
    look-alike feature out from under that licence and delete a conversion step besides. The
    catch is that it does not keep the same runs.</p>
</section>

<section class="hafiz-box">
  <h2><span class="n">For the reader this is for</span>What does this change for a hafiz?</h2>
  <p>A hafiz opens a look-alike pair to see the phrase the two verses share, which is where one slides
  into the other. <span class="hl">In ${t.agreed.toLocaleString()} pairs nothing changes. In
  ${t.corpusOnly} pairs the shared phrase would stop being coloured, and in ${t.printOnly} it would start.</span>
  The licence half of this choice is one a hafiz never sees.</p>
  <p><span class="hl">So for a hafiz the question is which ${t.corpusOnly} pairs would be lost, and
  nobody has looked yet.</span> If they are pairs huffaz are known to confuse, that loss outweighs the
  licence gain; if they are rarely confused, the swap costs a hafiz almost nothing.</p>
</section>

<section>
  <h2><span class="n">The cost of leaving it</span>What does each way keep, measured?</h2>
  <p>The same rule, run over each set of words on 2026-09-03. The two results are not one inside
    the other — the page finds runs the reference misses, and misses runs the reference finds:</p>
  <div class="figures">
    <div class="tile"><div class="big">${t.corpusKept.toLocaleString()}</div>
      <div class="cap">runs kept today, counted in the reference</div></div>
    <div class="tile"><div class="big">${t.printKept.toLocaleString()}</div>
      <div class="cap">runs kept if counted in the page's own words</div></div>
    <div class="tile gain"><div class="big">+${t.printOnly}</div>
      <div class="cap">new runs only the page finds</div></div>
    <div class="tile loss"><div class="big">−${t.corpusOnly}</div>
      <div class="cap">runs the page loses that the reference keeps</div></div>
  </div>
  ${bar}
  <table class="cost">
    <tr><td>runs both ways agree on</td><td class="v">${t.agreed.toLocaleString()}</td></tr>
    <tr><td>runs only the printed page finds</td><td class="v">${t.printOnly}</td></tr>
    <tr><td>runs only the reference finds, lost on the page</td><td class="v">${t.corpusOnly}</td></tr>
    <tr><td>shared phrases that are more words on the page</td><td class="v">${t.onCorpusKept.printLonger.toLocaleString()}</td></tr>
    <tr><td>the same length either way</td><td class="v">${t.onCorpusKept.sameLength.toLocaleString()}</td></tr>
    <tr><td>fewer words on the page</td><td class="v">${t.onCorpusKept.printShorter}</td></tr>
  </table>
  <p>The churn is the split itself. Because a phrase is never fewer page-words, some runs grow
    long enough to become the single place they occur — a new run appears — while a short joining
    particle that repeats across the page forges a fresh tie elsewhere and dissolves a run that
    used to be unique. So the trade is bounded, and it <em>is</em> a trade:
    <b>${t.corpusOnly} runs a reader can land on today disappear, ${t.printOnly} new ones appear,
    and the feature stops being a share-alike derivative.</b></p>
</section>

<section>
  <h2><span class="n">What the two sets look like</span>The runs, drawn on the page</h2>
  <p>Every panel below is a real look-alike pair, each verse cropped from the page it sits on,
    with the run washed the way the app washes it. Read across the three groups: what both ways
    keep, what only the page adds, and what only the reference keeps and the page would lose.</p>
  <div class="buckets">
    ${bucket(
      "Runs both ways agree on",
      "These the choice does not touch — counted either way, the same words are washed. The overwhelming majority of runs are here.",
      data.examples.agreed,
    )}
    ${bucket(
      `Runs only the printed page finds — the ${t.printOnly} gained`,
      "A phrase splits into enough page-words that it becomes the single place it occurs, and a new run appears. The app would start washing these.",
      data.examples.printOnly,
    )}
    ${bucket(
      `Runs only the reference finds — the ${t.corpusOnly} lost`,
      "Washed today, but on the page's own words the run either splits or is no longer unique, so it drops out. These are what the switch costs a reader.",
      data.examples.corpusOnly,
    )}
  </div>
</section>

<section>
  <h2><span class="n">What already decides part of this</span>What constrains it?</h2>
  <ul class="plain">
    <li><b>What the app is allowed to give away, by channel.</b> The look-alike tree is
      <em>computed into</em> something the app ships, not merely read to check it, so the licence
      under the reference reaches the reader. On the web served today that costs nothing anyone
      must act on; in a channel where a store forbids share-alike terms it would, and that is the
      case this option is insurance against.</li>
    <li><b>What the look-alike panel draws.</b> It washes its colours off exactly these runs.
      That decision took the runs as given and correct and did not reopen them — this is where
      they are reopened, so the two must be read together. If the page's words win,
      ${t.corpusOnly} pairs lose the run they land on and ${t.printOnly} gain one.</li>
  </ul>
</section>

<section>
  <h2><span class="n">Prior art</span>What do others do about this?</h2>
  <p>I did not look outside the project for this one, and should say so plainly. The choice is
    internal: which of two things <em>we already hold</em> to count a run in, both vendored here
    with their licences known. The public Qur'an-data libraries publish look-alike lists and
    word-by-word references as separate resources and leave the joining to whoever uses them —
    which is why this project had to compute the runs itself in the first place. There is no
    upstream that has made this particular choice for us to follow.</p>
</section>

<section>
  <h2><span class="n">The options</span>So which words?</h2>
  <table class="opts">
    <tr><th>#</th><th>Option</th><th>What it gets, what it costs</th></tr>
    <tr><td class="k">A</td><td class="lab">Keep counting in the reference's words</td>
      <td>The ${t.corpusKept.toLocaleString()} runs that ship today, the conversion step, and the
        share-alike thread that comes with the reference. Zero work. <em>Doing nothing is A.</em>
        <p class="for-hafiz"><span class="hl"><b>For a hafiz:</b> nothing changes; every pair you see coloured today stays coloured the same way.</span></p></td></tr>
    <tr><td class="k">B</td><td class="lab">Count in the printed page's own words</td>
      <td>${t.printKept.toLocaleString()} runs, no conversion step, no share-alike thread. Costs
        ${t.corpusOnly} runs a reader can land on today to gain ${t.printOnly} new ones.
        <p class="for-hafiz"><span class="hl"><b>For a hafiz:</b> the coloured phrase is counted in the words of the page you memorised from, but ${t.corpusOnly} pairs you may rely on lose their colour. Worth it only if those are pairs huffaz rarely confuse.</span></p></td></tr>
  </table>
</section>

<section>
  <h2><span class="n">What else was weighed</span>What is not on the list, and why?</h2>
  <ul class="plain">
    <li><b>Keep the reference, fall back to the page only where they disagree.</b> Keeps the
      share-alike thread — shedding which is the whole gain — so it buys the churn without the
      payoff. Out.</li>
    <li><b>Count in the reference but ship the runs already converted, to drop the conversion
      step.</b> Removes the step but not the licence thread, the larger half of the cost. A
      tidy-up of A, not a third answer.</li>
  </ul>
</section>

<section>
  <h2><span class="n">Sensitivity</span>What would change the answer?</h2>
  <ul class="plain">
    <li><b>A channel being chosen where share-alike terms bite</b> — a store build. Then B's
      licence gain stops being insurance and becomes the reason.</li>
    <li><b>A hafiz judging the ${t.corpusOnly} lost runs.</b> If the runs the page drops are ones
      a reader leans on, the cost is higher than a count says; if marginal, lower. Nobody has
      looked at <em>which</em> ${t.corpusOnly} they are, only at how many.</li>
    <li><b>The reference being re-licensed permissively.</b> Then the licence half dissolves and
      only the ${t.corpusOnly}-for-${t.printOnly} churn is left, which on its own does not
      obviously favour either side.</li>
  </ul>
</section>

<section>
  <h2><span class="n">Scope</span>What is this not settling?</h2>
  <ul class="plain">
    <li><b>The licence question itself</b> — whether the reference binds what we ship, and in
      which channels — is asked elsewhere and only pointed at here.</li>
    <li><b>Which verses are look-alikes.</b> Untouched; only which words of an agreed pair get
      washed.</li>
    <li><b>The four verses whose two printings cannot be lined up at all.</b> They take no part
      in this and their alignment is not reopened.</li>
    <li><b>What the panel looks like.</b> Nothing here changes that — only, if B wins, which
      ${t.corpusOnly}-and-${t.printOnly} of its pairs shift the run they draw.</li>
  </ul>
</section>
</div>
`;
  return html;
}

function render() {
  const data = JSON.parse(readFileSync(DATA_OUT, "utf8"));
  writeFileSync(HTML_OUT, renderCopy(data, false));
  writeFileSync(HTML_ARTIFACT, renderCopy(data, true));
  const sizes = [HTML_OUT, HTML_ARTIFACT].map(
    (f) => `${f.replace(ROOT, "")} ${(readFileSync(f, "utf8").length / 1024).toFixed(0)}KB`,
  );
  console.log("render →", sizes.join("  "));
}

const mode = process.argv[2];
if (mode === "--extract") await extract();
else render();
