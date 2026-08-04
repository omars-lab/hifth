#!/usr/bin/env node
/**
 * Does a word box from the candidate corpus land on our page?
 *
 * `probe-ligature-print.mjs` answered the question that blocked this one — the
 * candidate paginates the same print we do — and closed with the next wall:
 *
 * > word boxes do not transfer without a per-page registration against the text
 * > block (theirs states one as `data-rect` on `#md-page-inner`).
 *
 * That sentence contains a prediction, and the prediction is wrong. There is a
 * registration, it is not per-page, and it is not against the text block.
 *
 * ## The correspondence nobody had to invent
 *
 * Both corpora already mark the same physical objects: the **ayah-end
 * ornaments**. Ours are `<g ayah:x ayah:y>` in polygon space; theirs are
 * `<g id="md-aya-mark-NNN" data-surah data-aya>`. Every page therefore comes
 * with 5–20 exact point correspondences, free, needing no fonts, no rendering
 * and no judgment — which is the same standard the print probe held itself to.
 *
 * Fit `ours = s·theirs + t` on those points by least squares, independently in x
 * and y, and **measure the residual** rather than assuming one exists. The
 * residual is what decides this, so it is what gets recorded.
 *
 * Two details are load-bearing and were both learned the hard way:
 *
 * - **Document order is not reading order.** Our marker elements come out
 *   reversed on p120 and scrambled within a line on p577. Pairing on emitted
 *   order fits a mirror image: p575 and p577 produced a negative x scale and a
 *   residual of 157. Both sides are sorted into canonical reading order — band
 *   by y, then right-to-left within a band — before pairing.
 * - **Their y is top-down, like our polygons.** Our *ink* is y-flipped by the
 *   `matrix(1.3333 0 0 -1.3333 …)` the page sits under, but the ayah polygons
 *   live outside that matrix. Registering against the polygons is what makes the
 *   fit a plain positive scale instead of a flip.
 *
 * ## The check the fit has to survive
 *
 * A good residual on the markers only proves the markers line up. So every word
 * on every page is mapped through the fitted transform and its centre tested
 * against **its own ayah's** polygon — keyed on `(surah, aya)`, because keying on
 * ayah alone matches the wrong surah on a page carrying several short ones, which
 * is how an earlier version of this probe talked itself into a false negative.
 *
 * A miss is not automatically our bug or theirs. Waqf and hizb marks (ۖ ۗ ۚ ۛ ۞)
 * are separate words in their corpus, sit superscript above the line, and their
 * centres routinely fall in the previous line's band — benign, and counted
 * separately so the interesting residue is visible underneath.
 *
 * What the residue turned out to be is recorded in the result file: it is a
 * defect in **our** polygons, not in the registration.
 *
 * Nothing is vendored. Like the print probe, this is a decision probe: run when
 * the question is asked, recorded beside the hashes of the bytes it read, so a
 * rerun against the same pin either reproduces or says loudly that upstream
 * moved. The pin itself is not restated — it is read from
 * `ligature-svg.probe.json`, so there is one pin and not two.
 *
 * Usage:
 *   node packages/etl/scripts/probe-word-registration.mjs          # the 61 pages
 *   node packages/etl/scripts/probe-word-registration.mjs --all    # all 604
 *   node packages/etl/scripts/probe-word-registration.mjs --write  # record it
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "data", "pages");
const PIN = join(DATA, "ligature-svg.probe.json");
const RESULT = join(DATA, "word-registration.probe.json");
const PAGES = join(HERE, "..", "..", "..", "apps", "web", "public", "assets", "pages", "hafs-kfqc");

const pin = JSON.parse(readFileSync(PIN, "utf8"));
const { repo, commit, path } = pin.candidate;

/**
 * The pages worth fetching.
 *
 * The print probe's 56 — every V1/V2 divergence band plus its controls — because
 * reusing them means this probe's hashes cross-check that one's, and a page that
 * changed upstream shows up in both. Plus five pages the corpus-wide scan of our
 * own polygons flagged as suspicious (431, 545, 551, 554, 602), because a probe
 * that only looked at healthy pages could not tell "registration works" from
 * "registration works where our data happens to be complete".
 */
const EXTRA = [431, 545, 551, 554, 602];
const DEFAULT_PAGES = [
  ...new Set([
    1, 2, 119, 120, 121, 122, 123, 143, 144, 145, 146, 530, 531, 532, 533, 534, 535,
    ...Array.from({ length: 37 }, (_, i) => 564 + i),
    601, 604, ...EXTRA,
  ]),
].sort((a, b) => a - b);

/** Viewport widths the stage is actually asked to render 345 viewBox units across. */
const WIDTHS = { "320": 320, "390": 390, "430": 430 };

const all = process.argv.includes("--all");
const write = process.argv.includes("--write");
const wanted = all ? Array.from({ length: 604 }, (_, i) => i + 1) : DEFAULT_PAGES;

// ---------------------------------------------------------------- geometry --

const cub = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

/**
 * Every extreme of one cubic coordinate: the endpoints, plus any turning point
 * strictly inside the segment. Sampling instead would understate a curved
 * word's box, and a word's box is the thing being tested.
 */
function cubicExtrema(p0, p1, p2, p3) {
  const out = [p0, p3];
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const push = (t) => {
    if (t > 0 && t < 1) out.push(cub(p0, p1, p2, p3, t));
  };
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const r = Math.sqrt(disc);
      push((-b + r) / (2 * a));
      push((-b - r) / (2 * a));
    }
  }
  return out;
}

const TOKEN = /[MmCcZzLlHhVv]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

/** Exact bbox of a path. Their glyph outlines use only M, c and z. */
function pathBBox(d) {
  const toks = d.match(TOKEN) ?? [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let cmd = null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const hit = (x, y) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) {
      cmd = toks[i++];
      if (cmd === "Z" || cmd === "z") {
        cx = sx;
        cy = sy;
        continue;
      }
    }
    if (cmd === "M" || cmd === "m") {
      let x = Number(toks[i++]);
      let y = Number(toks[i++]);
      if (cmd === "m") {
        x += cx;
        y += cy;
      }
      cx = x;
      cy = y;
      sx = x;
      sy = y;
      hit(x, y);
      cmd = cmd === "M" ? "L" : "l";
    } else if (cmd === "C" || cmd === "c") {
      const v = toks.slice(i, i + 6).map(Number);
      i += 6;
      const [x1, y1, x2, y2, x3, y3] =
        cmd === "c"
          ? [cx + v[0], cy + v[1], cx + v[2], cy + v[3], cx + v[4], cy + v[5]]
          : v;
      for (const x of cubicExtrema(cx, x1, x2, x3)) hit(x, cy);
      for (const y of cubicExtrema(cy, y1, y2, y3)) hit(cx, y);
      cx = x3;
      cy = y3;
      hit(x3, y3);
    } else if (cmd === "L" || cmd === "l") {
      let x = Number(toks[i++]);
      let y = Number(toks[i++]);
      if (cmd === "l") {
        x += cx;
        y += cy;
      }
      cx = x;
      cy = y;
      hit(x, y);
    } else if (cmd === "H" || cmd === "h") {
      let x = Number(toks[i++]);
      if (cmd === "h") x += cx;
      cx = x;
      hit(cx, cy);
    } else if (cmd === "V" || cmd === "v") {
      let y = Number(toks[i++]);
      if (cmd === "v") y += cy;
      cy = y;
      hit(cx, cy);
    } else {
      i += 1;
    }
  }
  return [minX, minY, maxX, maxY];
}

const union = (bs) => [
  Math.min(...bs.map((b) => b[0])),
  Math.min(...bs.map((b) => b[1])),
  Math.max(...bs.map((b) => b[2])),
  Math.max(...bs.map((b) => b[3])),
];

/** Our own polygons: `M…h…v…H…Z` runs, each subpath one axis-aligned rect. */
function rectsOf(d) {
  const toks = d.match(/[MmZzHhVv]|[-+]?(?:\d*\.\d+|\d+\.?)/g) ?? [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let cmd = null;
  let pts = [];
  const out = [];
  const close = () => {
    if (pts.length) {
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      out.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
    }
    pts = [];
  };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) {
      cmd = toks[i++];
      if (cmd === "Z" || cmd === "z") {
        close();
        cx = sx;
        cy = sy;
        continue;
      }
    }
    if (cmd === "M" || cmd === "m") {
      let x = Number(toks[i++]);
      let y = Number(toks[i++]);
      if (cmd === "m") {
        x += cx;
        y += cy;
      }
      cx = x;
      cy = y;
      sx = x;
      sy = y;
      pts = [[x, y]];
    } else if (cmd === "H" || cmd === "h") {
      let x = Number(toks[i++]);
      if (cmd === "h") x += cx;
      cx = x;
      pts.push([cx, cy]);
    } else if (cmd === "V" || cmd === "v") {
      let y = Number(toks[i++]);
      if (cmd === "v") y += cy;
      cy = y;
      pts.push([cx, cy]);
    } else {
      i += 1;
    }
  }
  close();
  return out;
}

// ------------------------------------------------------------------ parsing --

const attr = (s, name) => {
  const m = s.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
};

/** Their page: the ayah-end ornaments and every word's exact box. */
function readTheirs(svg) {
  const marks = [];
  const boundary = /<g id="md-(?:line|word|aya-mark|diacritic)-/;
  for (const m of svg.matchAll(/<g id="md-aya-mark-(\d+)"([^>]*)>/g)) {
    const rest = svg.slice(m.index + m[0].length);
    const nxt = rest.match(boundary);
    const seg = nxt ? rest.slice(0, nxt.index) : rest;
    const orn = seg.match(/<g id="md-ornament-\d+-\d+">([\s\S]*?)<\/g>/);
    const ds = [...(orn ? orn[1] : seg).matchAll(/\sd="([^"]*)"/g)].map((x) => x[1]);
    if (!ds.length) continue;
    marks.push({
      surah: Number(attr(m[2], "data-surah")),
      aya: Number(attr(m[2], "data-aya")),
      box: union(ds.map(pathBBox)),
    });
  }
  const words = [];
  const wordBoundary = /<g id="md-(?:line|word|aya-mark)-/;
  for (const m of svg.matchAll(/<g id="md-word-(\d+)"([^>]*)>/g)) {
    const rest = svg.slice(m.index + m[0].length);
    const nxt = rest.match(wordBoundary);
    const seg = nxt ? rest.slice(0, nxt.index) : rest;
    const ds = [...seg.matchAll(/\sd="([^"]*)"/g)].map((x) => x[1]);
    if (!ds.length) continue;
    words.push({
      surah: Number(attr(m[2], "data-surah")),
      aya: Number(attr(m[2], "data-aya")),
      line: Number(attr(m[2], "data-line-number")),
      idx: Number(attr(m[2], "data-word-index-in-ayah")),
      hafs: attr(m[2], "data-hafs") ?? "",
      box: union(ds.map(pathBBox)),
    });
  }
  return { marks, words };
}

/** Our page: the ayah-end markers and one rect list per ayah. */
function readOurs(page) {
  const svg = readFileSync(join(PAGES, `${page}.svg`), "utf8");
  const marks = [...svg.matchAll(/<g ayah:x="([\d.]+)" ayah:y="([\d.]+)"/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
  const verses = new Map();
  for (const m of svg.matchAll(
    /<path id="verse-\d+"[^>]*d="([^"]*)"[^>]*ayah="(\d+)"[^>]*surah="(\d+)"/g,
  )) {
    const key = `${Number(m[3])}:${Number(m[2])}`;
    if (!verses.has(key)) verses.set(key, []);
    verses.get(key).push(...rectsOf(m[1]));
  }
  const vb = (svg.match(/viewBox="([^"]*)"/)?.[1] ?? "0 0 345 550").split(/\s+/).map(Number);
  return { marks, verses, vb };
}

// -------------------------------------------------------------------- maths --

/**
 * Down the page, then right-to-left within a band. Applied to *both* sides
 * before pairing — see the header; pairing on document order fits a mirror.
 */
function readingOrder(pts, tol) {
  const rows = [];
  for (const p of [...pts].sort((a, b) => a[1] - b[1])) {
    const last = rows.at(-1);
    if (last && Math.abs(p[1] - last.y) <= tol) last.row.push(p);
    else rows.push({ y: p[1], row: [p] });
  }
  return rows.flatMap(({ row }) => row.sort((a, b) => b[0] - a[0]));
}

/** Least squares y = a·x + b, with the residual at every point. */
function fit(xs, ys) {
  const n = xs.length;
  const sx = xs.reduce((t, v) => t + v, 0);
  const sy = ys.reduce((t, v) => t + v, 0);
  const sxx = xs.reduce((t, v) => t + v * v, 0);
  const sxy = xs.reduce((t, v, i) => t + v * ys[i], 0);
  const a = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const b = (sy - a * sx) / n;
  return { a, b, res: xs.map((x, i) => ys[i] - (a * x + b)) };
}

const WAQF = new Set([..."ۖۗۘۙۚۛۜ۩۞"]);

function analyse(page, svg) {
  const { marks, words } = readTheirs(svg);
  const { marks: om, verses, vb } = readOurs(page);
  const T = readingOrder(
    marks.map((t) => [(t.box[0] + t.box[2]) / 2, (t.box[1] + t.box[3]) / 2]),
    8,
  );
  const O = readingOrder(om, 11);
  if (T.length !== O.length || T.length < 3) {
    throw new Error(`${T.length} of their marks vs ${O.length} of ours`);
  }
  const fx = fit(T.map((p) => p[0]), O.map((p) => p[0]));
  const fy = fit(T.map((p) => p[1]), O.map((p) => p[1]));
  const residual = Math.max(...[...fx.res, ...fy.res].map(Math.abs));

  const missed = [];
  for (const w of words) {
    const cx = fx.a * ((w.box[0] + w.box[2]) / 2) + fx.b;
    const cy = fy.a * ((w.box[1] + w.box[3]) / 2) + fy.b;
    const rects = verses.get(`${w.surah}:${w.aya}`) ?? [];
    const inOwn = rects.some((r) => r[0] <= cx && cx <= r[2] && r[1] <= cy && cy <= r[3]);
    if (!inOwn) {
      missed.push({ key: `${w.surah}:${w.aya}`, idx: w.idx, line: w.line, hafs: w.hafs });
    }
  }
  const waqf = missed.filter((m) => [...m.hafs].every((c) => WAQF.has(c))).length;
  return {
    page,
    viewBox: vb.join(" "),
    markers: T.length,
    sx: fx.a,
    tx: fx.b,
    sy: fy.a,
    ty: fy.b,
    residual,
    words: words.length,
    missed: missed.length,
    missedWaqf: waqf,
    // Which ayahs lost words, and how many — the shape of the residue.
    gaps: Object.entries(
      missed
        .filter((m) => ![...m.hafs].every((c) => WAQF.has(c)))
        .reduce((acc, m) => ({ ...acc, [m.key]: (acc[m.key] ?? 0) + 1 }), {}),
    )
      .filter(([, n]) => n >= 3)
      .map(([key, n]) => ({ key, words: n })),
  };
}

// --------------------------------------------------------------------- run --

async function fetchPage(page) {
  const file = `${String(page).padStart(3, "0")}.svg`;
  const url = `https://raw.githubusercontent.com/${repo}/${commit}/${encodeURIComponent(path)}/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  return { body, sha256: createHash("sha256").update(body).digest("hex") };
}

console.log(`\n  probe:word-registration — ${repo} @ ${commit.slice(0, 12)}`);
console.log(`  ${wanted.length} page(s): fitting ours = s·theirs + t on the ayah-end ornaments\n`);

const rows = [];
const failed = [];
let bytes = 0;

for (const page of wanted) {
  const { body, sha256 } = await fetchPage(page);
  bytes += body.length;
  try {
    const r = analyse(page, body.toString("utf8"));
    rows.push({ ...r, sha256 });
    const flag = r.missed - r.missedWaqf >= 3 ? "✗" : "·";
    process.stdout.write(
      `  ${flag} p${String(page).padStart(3)}  ${String(r.markers).padStart(2)} marks` +
        `  residual ${r.residual.toFixed(3)}` +
        `  ${String(r.missed).padStart(3)}/${String(r.words).padStart(3)} words adrift` +
        `${r.gaps.length ? `   ← ${r.gaps.map((g) => `${g.key} (${g.words})`).join(", ")}` : ""}\n`,
    );
  } catch (e) {
    failed.push({ page, why: String(e.message) });
    process.stdout.write(`  ? p${String(page).padStart(3)}  ${e.message}\n`);
  }
}

const std = rows.filter((r) => r.viewBox === "0 0 345 550");
const group = (name, g) => {
  if (!g.length) return null;
  const range = (k) => [Math.min(...g.map((r) => r[k])), Math.max(...g.map((r) => r[k]))];
  return { name, pages: g.length, sx: range("sx"), tx: range("tx"), sy: range("sy"), ty: range("ty") };
};
const groups = [
  group("even", std.filter((r) => r.page % 2 === 0)),
  group("odd", std.filter((r) => r.page % 2 === 1)),
  group("override", rows.filter((r) => r.viewBox !== "0 0 345 550")),
].filter(Boolean);

const residuals = std.map((r) => r.residual).sort((a, b) => a - b);
const maxRes = residuals.at(-1) ?? 0;
const medRes = residuals[Math.floor(residuals.length / 2)] ?? 0;
const totalWords = rows.reduce((t, r) => t + r.words, 0);
const totalMissed = rows.reduce((t, r) => t + r.missed, 0);
const totalWaqf = rows.reduce((t, r) => t + r.missedWaqf, 0);
const holes = rows.flatMap((r) => r.gaps.map((g) => ({ page: r.page, ...g })));

console.log("");
for (const g of groups) {
  console.log(
    `  ${g.name.padEnd(9)} (${String(g.pages).padStart(2)}): ` +
      `sx ${g.sx[0].toFixed(5)}–${g.sx[1].toFixed(5)}  tx ${g.tx[0].toFixed(3)}–${g.tx[1].toFixed(3)}  ` +
      `sy ${g.sy[0].toFixed(5)}–${g.sy[1].toFixed(5)}  ty ${g.ty[0].toFixed(3)}–${g.ty[1].toFixed(3)}`,
  );
}
console.log(`\n  marker residual: median ${medRes.toFixed(3)}, max ${maxRes.toFixed(3)} viewBox units`);
for (const [label, w] of Object.entries(WIDTHS)) {
  console.log(`    at ${label} px wide: median ${(medRes * (w / 345)).toFixed(3)} px, max ${(maxRes * (w / 345)).toFixed(3)} px`);
}
console.log(
  `\n  ${totalMissed}/${totalWords} word centres (${((totalMissed / totalWords) * 100).toFixed(1)}%) fall outside their own ayah polygon` +
    `\n    ${totalWaqf} are single waqf/hizb marks — superscript, above their line, benign` +
    `\n    ${totalMissed - totalWaqf} are ordinary words, on ${new Set(holes.map((h) => h.page)).size} page(s)`,
);

const verdict = maxRes < 1 ? "registers" : "does-not-register";
console.log(`\n  verdict: ${verdict} — (${(bytes / 1024 / 1024).toFixed(1)} MB fetched)\n`);

if (write) {
  const prior = JSON.parse(readFileSync(RESULT, "utf8"));
  writeFileSync(
    RESULT,
    `${JSON.stringify(
      {
        ...prior,
        ranOn: new Date().toISOString().slice(0, 10),
        verdict,
        transform: {
          groups: groups.map((g) => ({
            ...g,
            sx: g.sx.map((v) => Number(v.toFixed(5))),
            tx: g.tx.map((v) => Number(v.toFixed(3))),
            sy: g.sy.map((v) => Number(v.toFixed(5))),
            ty: g.ty.map((v) => Number(v.toFixed(3))),
          })),
          residualViewBoxUnits: { median: Number(medRes.toFixed(3)), max: Number(maxRes.toFixed(3)) },
          residualDevicePx: Object.fromEntries(
            Object.entries(WIDTHS).map(([label, w]) => [
              label,
              { median: Number((medRes * (w / 345)).toFixed(3)), max: Number((maxRes * (w / 345)).toFixed(3)) },
            ]),
          ),
        },
        coverage: {
          words: totalWords,
          missed: totalMissed,
          missedWaqfOrHizb: totalWaqf,
          missedOrdinary: totalMissed - totalWaqf,
          holes,
        },
        failed,
        pages: rows.map((r) => ({
          page: r.page,
          sha256: r.sha256,
          markers: r.markers,
          residual: Number(r.residual.toFixed(4)),
          words: r.words,
          missed: r.missed,
        })),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`  wrote ${RESULT}\n`);
}

process.exitCode = verdict === "registers" ? 0 : 1;
