/**
 * extract-ligatures.mjs — derive per-letter and per-mark OUTLINES for one verse
 * from the MushafDatabase ligature corpus, so the harakah picker can slice a
 * word into its letters and sit each mark on the letter it belongs to.
 *
 * The corpus (https://github.com/mushafdatabase/MushafDatabase-Ligature-Based-SVG,
 * "Sadaqa-e-Jaria" open licence) draws the same KFGQPC Hafs print we ship, but
 * with each word split into its connected letters (md-ligature) and each mark
 * nested inside the letter it sits on (md-diacritic, already named). Its page 7
 * is not in any V1/V2 divergence band, so it matches our page 7.
 *
 * COPY-SAFE: the corpus page carries Arabic (data-text, data-hafs). This reads
 * it at build time and writes ONLY outline path data, bounding boxes and the
 * print's own mark names — no Arabic codepoints. The output is asserted clean
 * and committed; the corpus page itself stays in a gitignored cache.
 *
 *   node scripts/extract-ligatures.mjs        # reads the cache, writes the JSON
 *
 * If the cache is missing it fetches page 7 once into
 * packages/etl/data/ligature/.cache/ (gitignored).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { JSDOM } from "jsdom";
import { ROOT } from "./code-pointers.mjs";

const PAGE = 7;
const AYAH = { surah: "002", aya: "038" };
const CACHE = join(ROOT, "packages/etl/data/ligature/.cache/007.svg");
const RAW_URL =
  "https://raw.githubusercontent.com/mushafdatabase/MushafDatabase-Ligature-Based-SVG/master/SVG%20V1.01/007.svg";
const OUT = join(ROOT, "docs/design/data/harakah-ligatures-7.json");

// The ASCII name of each Arabic base letter, so the picker can name a picked
// letter ("1 waw, 1 ha") the way it already names a picked mark ("1 kasra").
// Only the NAME travels into the output — never the Arabic character — the same
// copy-safe bargain the mark names already keep. Confusable pairs are kept apart
// by the names a hafiz uses: ح hha vs ه ha, ت ta vs ط taa, ذ dhal vs ظ dhaa.
const LETTER_NAME = {
  0x0621: "hamza", 0x0622: "alif madda", 0x0623: "alif hamza", 0x0624: "waw hamza",
  0x0625: "alif hamza", 0x0626: "ya hamza", 0x0627: "alif", 0x0628: "ba",
  0x0629: "ta marbuta", 0x062a: "ta", 0x062b: "tha", 0x062c: "jeem", 0x062d: "hha",
  0x062e: "kha", 0x062f: "dal", 0x0630: "dhal", 0x0631: "ra", 0x0632: "zay",
  0x0633: "seen", 0x0634: "sheen", 0x0635: "saad", 0x0636: "daad", 0x0637: "taa",
  0x0638: "dhaa", 0x0639: "ayn", 0x063a: "ghayn", 0x0641: "fa", 0x0642: "qaf",
  0x0643: "kaf", 0x0644: "lam", 0x0645: "meem", 0x0646: "noon", 0x0647: "ha",
  0x0648: "waw", 0x0649: "alif maqsura", 0x064a: "ya", 0x0671: "alif wasla",
};
// The letters of a cluster, in the corpus's own reading order (first letter of
// the string first). An unmapped codepoint falls back to "letter" so a name is
// always returned and the count still matches the cut count.
const letterNames = (s) => [...(s || "")].map((c) => LETTER_NAME[c.codePointAt(0)] || "letter");

const die = (m) => {
  console.error(`extract-ligatures: ${m}`);
  process.exit(1);
};

// ── cubic-bezier-aware path bounds ───────────────────────────────────────────
// The corpus paths use only M (absolute move), c (relative cubic) and z (close).
// A cubic's extent is not its control points, so solve B'(t)=0 per axis.
const NUM = /-?(?:\d+\.\d+|\.\d+|\d+)(?:e-?\d+)?/gi;

function cubicAxisBounds(p0, p1, p2, p3, lo, hi) {
  // endpoints first
  let mn = Math.min(p0, p3),
    mx = Math.max(p0, p3);
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = -p0 + p1;
  const roots = [];
  if (Math.abs(a) < 1e-9) {
    if (Math.abs(b) > 1e-9) roots.push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      roots.push((-b + s) / (2 * a), (-b - s) / (2 * a));
    }
  }
  for (const t of roots) {
    if (t <= 0 || t >= 1) continue;
    const u = 1 - t;
    const v =
      u * u * u * p0 +
      3 * u * u * t * p1 +
      3 * u * t * t * p2 +
      t * t * t * p3;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  return [Math.min(lo, mn), Math.max(hi, mx)];
}

// Tokenize a path into a flat stream of command-letters and numbers, so a
// letter followed by several coordinate groups (SVG's implicit repeat: "c a,b,c
// … g,h,i …" is two cubics) is walked correctly. Consuming only one group per
// letter — the classic mistake — clips every multi-segment curve to its first arc.
const TOKENS = /([MmCcSsQqTtLlHhVvAaZz])|(-?(?:\d+\.\d+|\.\d+|\d+)(?:e-?\d+)?)/gi;

function pathBounds(d, acc) {
  const toks = [];
  let m;
  TOKENS.lastIndex = 0;
  while ((m = TOKENS.exec(d))) toks.push(m[1] || parseFloat(m[2]));
  let i = 0;
  const hit = (x, y) => {
    acc.minX = Math.min(acc.minX, x);
    acc.maxX = Math.max(acc.maxX, x);
    acc.minY = Math.min(acc.minY, y);
    acc.maxY = Math.max(acc.maxY, y);
  };
  let cx = 0,
    cy = 0,
    sx = 0,
    sy = 0, // subpath start, for z
    cmd = "";
  const isNum = (t) => typeof t === "number";
  while (i < toks.length) {
    const t = toks[i];
    if (!isNum(t)) {
      cmd = t;
      i++;
      if (cmd === "z" || cmd === "Z") {
        cx = sx;
        cy = sy;
      }
      continue;
    }
    // an implicit repeat reuses the previous command; after M/m it becomes L/l
    const rel = cmd === cmd.toLowerCase();
    const bx = rel ? cx : 0,
      by = rel ? cy : 0;
    switch (cmd) {
      case "M":
      case "m": {
        cx = bx + toks[i++];
        cy = by + toks[i++];
        sx = cx;
        sy = cy;
        hit(cx, cy);
        cmd = rel ? "l" : "L"; // subsequent pairs are linetos
        break;
      }
      case "L":
      case "l": {
        cx = bx + toks[i++];
        cy = by + toks[i++];
        hit(cx, cy);
        break;
      }
      case "H":
      case "h": {
        cx = bx + toks[i++];
        hit(cx, cy);
        break;
      }
      case "V":
      case "v": {
        cy = by + toks[i++];
        hit(cx, cy);
        break;
      }
      case "C":
      case "c": {
        const x1 = bx + toks[i++],
          y1 = by + toks[i++],
          x2 = bx + toks[i++],
          y2 = by + toks[i++],
          x3 = bx + toks[i++],
          y3 = by + toks[i++];
        [acc.minX, acc.maxX] = cubicAxisBounds(cx, x1, x2, x3, acc.minX, acc.maxX);
        [acc.minY, acc.maxY] = cubicAxisBounds(cy, y1, y2, y3, acc.minY, acc.maxY);
        cx = x3;
        cy = y3;
        break;
      }
      default:
        // any command we don't model: swallow one number so we can't spin
        i++;
    }
  }
  return acc;
}

function bbox(ds) {
  const acc = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const d of ds) pathBounds(d, acc);
  const r = (n) => Math.round(n * 100) / 100;
  return [r(acc.minX), r(acc.minY), r(acc.maxX - acc.minX), r(acc.maxY - acc.minY)];
}

// ── slicing a connected cluster into single letters ─────────────────────────
// The corpus draws a whole cluster (هبطو, say) as ONE connected outline — there
// is no per-letter geometry to read. But connected Arabic letters join at the
// baseline through a thin stroke, so the ink is tall under a letter's body and
// pinches to almost nothing at each join. We rasterize the ink ourselves (the
// beziers we already parse), measure how tall it stands in each vertical column,
// and cut at the deepest pinches — one fewer cut than there are letters, a count
// the corpus hands us in data-text (its length only; no Arabic is kept).

// Flatten a path's segments into straight edges, subdividing each cubic, so the
// filled shape can be scanned column by column.
function flattenEdges(ds) {
  const edges = [];
  for (const d of ds) {
    const toks = [];
    let m;
    TOKENS.lastIndex = 0;
    while ((m = TOKENS.exec(d))) toks.push(m[1] || parseFloat(m[2]));
    let i = 0,
      cx = 0,
      cy = 0,
      sx = 0,
      sy = 0,
      px = 0,
      py = 0,
      cmd = "";
    const isNum = (t) => typeof t === "number";
    const line = (x, y) => {
      edges.push([px, py, x, y]);
      px = x;
      py = y;
    };
    while (i < toks.length) {
      const t = toks[i];
      if (!isNum(t)) {
        cmd = t;
        i++;
        if (cmd === "z" || cmd === "Z") {
          line(sx, sy);
          cx = sx;
          cy = sy;
        }
        continue;
      }
      const rel = cmd === cmd.toLowerCase();
      const bx = rel ? cx : 0,
        by = rel ? cy : 0;
      switch (cmd) {
        case "M":
        case "m":
          cx = bx + toks[i++];
          cy = by + toks[i++];
          sx = cx;
          sy = cy;
          px = cx;
          py = cy;
          cmd = rel ? "l" : "L";
          break;
        case "L":
        case "l": {
          const x = bx + toks[i++],
            y = by + toks[i++];
          line(x, y);
          cx = x;
          cy = y;
          break;
        }
        case "H":
        case "h": {
          const x = bx + toks[i++];
          line(x, cy);
          cx = x;
          break;
        }
        case "V":
        case "v": {
          const y = by + toks[i++];
          line(cx, y);
          cy = y;
          break;
        }
        case "C":
        case "c": {
          const x1 = bx + toks[i++],
            y1 = by + toks[i++],
            x2 = bx + toks[i++],
            y2 = by + toks[i++],
            x3 = bx + toks[i++],
            y3 = by + toks[i++];
          const N = 16;
          for (let k = 1; k <= N; k++) {
            const tt = k / N,
              u = 1 - tt;
            const X =
              u * u * u * cx + 3 * u * u * tt * x1 + 3 * u * tt * tt * x2 + tt * tt * tt * x3;
            const Y =
              u * u * u * cy + 3 * u * u * tt * y1 + 3 * u * tt * tt * y2 + tt * tt * tt * y3;
            line(X, Y);
          }
          cx = x3;
          cy = y3;
          break;
        }
        default:
          i++;
      }
    }
  }
  return edges;
}

// The vertical extent of the filled ink at each of W columns across [x0, x0+w].
function inkProfile(edges, x0, w, W) {
  const prof = new Array(W).fill(0);
  for (let c = 0; c < W; c++) {
    const X = x0 + (w * (c + 0.5)) / W;
    let mn = Infinity,
      mx = -Infinity;
    for (const [ax, ay, bxE, by] of edges) {
      if (ax === bxE) continue;
      if ((ax - X) * (bxE - X) <= 0) {
        const y = ay + ((by - ay) * (X - ax)) / (bxE - ax);
        if (y < mn) mn = y;
        if (y > mx) mx = y;
      }
    }
    prof[c] = mx > mn ? mx - mn : 0;
  }
  // light smoothing, so a single thin stroke (an isolated ascender) does not read
  // as a join and a jagged edge does not invent one.
  const sm = prof.slice();
  for (let c = 1; c < W - 1; c++) sm[c] = (prof[c - 1] + prof[c] + prof[c + 1]) / 3;
  return sm;
}

// The x-positions (n-1 of them) where a connected cluster of n letters joins —
// the pinches between letter bodies, to cut at. Empty for a single letter.
//
// A join is a VALLEY between two letter bodies, not simply a thin column: a thin
// final alif is thinner than the deep joins between fuller letters, so "the n-1
// thinnest columns" would pile every cut into that one thin place. We instead
// score each local minimum of the ink-height profile by its PROMINENCE — how far
// the ink must rise on both sides before it dips lower again — which is large at
// a real between-letter join and small at a wobble inside one letter. The most
// prominent, well-separated valleys are the joins; if the ink offers fewer than
// n-1 (rare), the rest fall back to an even division.
function letterCuts(bodyDs, bb, n) {
  if (n <= 1) return [];
  const [x0, , w] = bb;
  if (!(w > 0)) return [];
  const edges = flattenEdges(bodyDs);
  const W = Math.max(60, Math.round(w * 10));
  const prof = inkProfile(edges, x0, w, W);
  const colX = (c) => x0 + (w * (c + 0.5)) / W;

  // Keep cuts away from the two ends, where the ink tapers to a point: that taper
  // is a thin, prominent-looking valley but it is the edge of the cluster, not a
  // join, and a cut there would carve off a sliver instead of a letter.
  const endMargin = Math.max(3, Math.floor(W / (n * 2)));
  const mins = [];
  for (let c = endMargin; c < W - endMargin; c++) {
    if (
      prof[c] <= prof[c - 1] &&
      prof[c] <= prof[c + 1] &&
      (prof[c] < prof[c - 2] || prof[c] < prof[c + 2])
    )
      mins.push(c);
  }
  const prominence = (c) => {
    let l = c,
      lmax = prof[c];
    while (l > 0) {
      l--;
      if (prof[l] < prof[c]) break;
      if (prof[l] > lmax) lmax = prof[l];
    }
    let r = c,
      rmax = prof[c];
    while (r < W - 1) {
      r++;
      if (prof[r] < prof[c]) break;
      if (prof[r] > rmax) rmax = prof[r];
    }
    return Math.min(lmax, rmax) - prof[c];
  };
  const minSep = Math.max(4, Math.floor(W / (n * 3)));
  const scored = mins.map((c) => ({ c, p: prominence(c) })).sort((a, b) => b.p - a.p);
  const chosen = [];
  for (const { c } of scored) {
    if (chosen.every((o) => Math.abs(o - c) >= minSep)) {
      chosen.push(c);
      if (chosen.length === n - 1) break;
    }
  }
  for (let k = 1; k <= n - 1 && chosen.length < n - 1; k++) {
    const guess = Math.round((W * k) / n);
    if (chosen.every((o) => Math.abs(o - guess) >= minSep)) chosen.push(guess);
  }
  chosen.sort((a, b) => a - b);
  const r = (v) => Math.round(v * 100) / 100;
  return chosen.slice(0, n - 1).map((c) => r(colX(c)));
}

// ── read the corpus page ─────────────────────────────────────────────────────
async function ensureCache() {
  if (existsSync(CACHE)) return;
  mkdirSync(dirname(CACHE), { recursive: true });
  const res = await fetch(RAW_URL);
  if (!res.ok) die(`fetch ${RAW_URL} → ${res.status}`);
  writeFileSync(CACHE, await res.text());
  console.error(`extract-ligatures: cached page ${PAGE}`);
}

await ensureCache();
const svgText = readFileSync(CACHE, "utf8");
const dom = new JSDOM(`<!doctype html><body>${svgText}</body>`, {
  contentType: "text/html",
});
const doc = dom.window.document;
const svg = doc.querySelector("svg");
if (!svg) die("no <svg> root");
const vb = svg.getAttribute("viewBox");

const dsOf = (el) => [...el.querySelectorAll("path")].map((p) => p.getAttribute("d"));

const words = [...doc.querySelectorAll('g[id^="md-word"]')].filter(
  (w) => w.getAttribute("data-surah") === AYAH.surah && w.getAttribute("data-aya") === AYAH.aya
);
if (!words.length) die(`no words for ${AYAH.surah}:${AYAH.aya} on page ${PAGE}`);

const out = {
  source: "MushafDatabase-Ligature-Based-SVG SVG V1.01, page 7 (Sadaqa-e-Jaria licence)",
  page: PAGE,
  ayah: `${Number(AYAH.surah)}:${Number(AYAH.aya)}`,
  viewBox: vb,
  words: words
    .map((w) => {
      const ligs = [...w.querySelectorAll(':scope > g[id^="md-ligature"]')].map((l) => {
        // The letter ink: the connected base outline plus its identifying dots
        // (the dot under a bāʾ, say). Dots belong to the letter's shape, not to
        // the vowel-marks a reader would pin a note to, so they are drawn, never
        // offered as a target.
        const textPath = l.querySelector(':scope > path[data-type="text"]');
        // How many letters this connected cluster holds — the length of the
        // corpus's own letter string. Only the COUNT is kept; the string (Arabic)
        // is thrown away, so the output stays copy-safe.
        const dataText = textPath?.getAttribute("data-text") || "";
        const nLetters = [...dataText].length || 1;
        // The name of each letter in the cluster, reading order — the only thing
        // kept from the Arabic string; the string itself is discarded below.
        const names = dataText ? letterNames(dataText) : ["letter"];
        const baseD = [
          ...l.querySelectorAll(':scope > path[data-type="text"]'),
        ].map((p) => p.getAttribute("d"));
        const body = [
          ...l.querySelectorAll(':scope > path[data-type="text"]'),
          ...l.querySelectorAll('path[data-type="dots"]'),
        ].map((p) => p.getAttribute("d"));
        // The marks: each vowel-sign is its own path inside the diacritic group,
        // separately named — one target each (sukun, kasra, damma …), placed on
        // the base letter it sounds. The corpus once grouped them; we split them.
        const dia = [...l.querySelectorAll('path[data-type="diacritic"]')].map((p) => {
          const dd = [p.getAttribute("d")];
          return { name: p.getAttribute("data-diacritic") || "mark", bb: bbox(dd), d: dd };
        });
        const bb = bbox(body);
        // Where to cut this cluster into single letters, measured on the base
        // outline (dots would blur the join). Empty when it is one letter.
        const cuts = letterCuts(baseD, bbox(baseD), nLetters);
        return { bb, n: nLetters, cuts, names, body, dia };
      });
      return {
        wi: Number(w.getAttribute("data-word-index-in-ayah")),
        bb: bbox([...w.querySelectorAll("path")].map((p) => p.getAttribute("d"))),
        ligs,
      };
    })
    .sort((a, b) => a.wi - b.wi),
};

const json = JSON.stringify(out);
if (/[؀-ۿ]/.test(json)) die("output carries Arabic codepoints — refusing to write");
writeFileSync(OUT, JSON.stringify(out, null, 0));
console.error(
  `extract-ligatures: wrote ${OUT} — ${out.words.length} words, ${out.words.reduce(
    (n, w) => n + w.ligs.length,
    0
  )} letters, ${out.words.reduce((n, w) => n + w.ligs.reduce((m, l) => m + l.dia.length, 0), 0)} marks`
);
