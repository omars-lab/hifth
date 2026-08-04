/**
 * The two mushaf frames, and the arithmetic that carries a box from one to the
 * other.
 *
 * This file exists because two scripts need the same maths and the repo's rule
 * is that a thing is described once. `probe-word-registration.mjs` asked whether
 * a word box from the ligature corpus transfers onto our page; `build-words.mjs`
 * takes the yes and ships the boxes. If they carried two copies of `pathBBox`
 * and two copies of the fit, the probe's recorded residual would stop being
 * evidence about what the builder emits — which is the only reason the probe was
 * worth running.
 *
 * Nothing here fetches, reads a path, or prints. Callers hand it SVG text.
 *
 * ## The frames
 *
 * **Ours** — `viewBox="0 0 345 550"` (pages 1–2: `0 0 235 235`). Ink sits under
 * `matrix(1.3333 0 0 -1.3333 e f)`, so it is y-flipped; the `<path
 * class="ayahPolygon">` tap targets do **not**, they live in plain viewBox
 * space. Every registration here is against the polygons, which is what makes
 * the fit a positive scale rather than a flip.
 *
 * **Theirs** — `viewBox="0 0 382.68 547.09"`, y top-down, one `<g
 * id="md-word-NNN">` per word wrapping per-ligature `<path data-text>`. Paths,
 * not rects: a word's box is measured, never read off an attribute.
 *
 * ## The correspondence
 *
 * Both corpora already mark the same physical objects — the ayah-end ornaments.
 * Ours are `<g ayah:x ayah:y>`, theirs `<g id="md-aya-mark-NNN" data-surah
 * data-aya>`. That is 5–20 exact point pairs per page, free, needing no fonts
 * and no judgment. `fitFrames` pairs them and solves `ours = s·theirs + t` by
 * least squares, independently in x and y, and returns the residual — which is
 * the number that decides whether the answer may be used.
 *
 * Two details are load-bearing, both learned by getting them wrong first:
 *
 * - **Document order is not reading order.** Our markers come out reversed on
 *   p120 and scrambled within a line on p577. Pairing on emitted order fits a
 *   *mirror*: negative x-scale, residual 157. Both sides go through
 *   `readingOrder` first.
 * - **Their y and our polygons agree in direction.** Registering against the
 *   ink instead would fit the flip and hide it in the sign of the scale.
 */

// ---------------------------------------------------------------- geometry --

const cub = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

/**
 * Every extreme of one cubic coordinate: the endpoints, plus any turning point
 * strictly inside the segment. Sampling instead would understate a curved
 * word's box, and a word's box is the thing being shipped.
 */
export function cubicExtrema(p0, p1, p2, p3) {
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

/** Exact bbox of a path, as `[minX, minY, maxX, maxY]`. */
export function pathBBox(d) {
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
        cmd === "c" ? [cx + v[0], cy + v[1], cx + v[2], cy + v[3], cx + v[4], cy + v[5]] : v;
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

export const union = (bs) => [
  Math.min(...bs.map((b) => b[0])),
  Math.min(...bs.map((b) => b[1])),
  Math.max(...bs.map((b) => b[2])),
  Math.max(...bs.map((b) => b[3])),
];

/**
 * Our own ayah polygons, as closed rings of points — one ring per subpath.
 *
 * These are straight-line paths only, but they are **not** all rectangles and
 * they are not all `M…h…v…H…Z`. Most are: a band per line, `h` across and `v`
 * down. But 118 of the 6236 are general polygons, and several of those — every
 * one on pages 1 and 2 — carry an `l`, because a decorated frame's text block
 * does not sit on the same grid twice:
 *
 *     verse-4 on page 1:  M128.5 76.2H13l-.4 27h116Z
 *
 * The version of this that shipped inside `probe-word-registration.mjs` handled
 * `M`, `H` and `V` and quietly dropped `L`/`l`, treating each subpath as a
 * bounding rect. On that path it collected two points, both on y = 76.2, and
 * returned a **zero-height** rect — so every word of `1:4` tested as outside its
 * own ayah, and the probe reported a hole in the polygon that is not there. That
 * false positive was noticed and withdrawn twice before anyone read the parser;
 * this is the cause, and it is why the return value here is rings rather than
 * rects. A bounding rect would also have over-claimed the L-shaped bands on
 * pages 1, 6 and 7 in the other direction.
 *
 * `scripts/gate-pages.mjs` has always had the full grammar; the two agree now.
 */
export function ringsOf(d) {
  const out = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let pts = null;
  const close = () => {
    if (pts && pts.length > 2) out.push(pts);
    pts = null;
  };
  for (const tok of d.match(/[A-Za-z][^A-Za-z]*/g) ?? []) {
    const c = tok[0];
    const n = (tok.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
    const rel = c === c.toLowerCase();
    if (c === "M" || c === "m") {
      close();
      cx = rel ? cx + n[0] : n[0];
      cy = rel ? cy + n[1] : n[1];
      sx = cx;
      sy = cy;
      pts = [[cx, cy]];
      // Extra pairs after an M are implicit lineto, per the SVG grammar.
      for (let i = 2; i + 1 < n.length; i += 2) {
        cx = rel ? cx + n[i] : n[i];
        cy = rel ? cy + n[i + 1] : n[i + 1];
        pts.push([cx, cy]);
      }
    } else if (c === "H" || c === "h") {
      for (const v of n) pts.push([(cx = rel ? cx + v : v), cy]);
    } else if (c === "V" || c === "v") {
      for (const v of n) pts.push([cx, (cy = rel ? cy + v : v)]);
    } else if (c === "L" || c === "l") {
      for (let i = 0; i + 1 < n.length; i += 2) {
        cx = rel ? cx + n[i] : n[i];
        cy = rel ? cy + n[i + 1] : n[i + 1];
        pts.push([cx, cy]);
      }
    } else if (c === "Z" || c === "z") {
      close();
      cx = sx;
      cy = sy;
    } else {
      throw new Error(`ayah polygon carries a curve command: ${c}`);
    }
  }
  close();
  return out;
}

/**
 * Is a point inside any of these rings?
 *
 * Ray casting per ring, OR-ed, rather than one even-odd pass over all of them.
 * An ayah's rings are its line bands; adjacent bands share an edge and a few
 * genuinely overlap by a fraction of a unit, and a single even-odd pass would
 * make the overlap a *hole*. Per-ring-then-OR cannot do that.
 */
export function pointInRings(rings, x, y) {
  for (const ring of rings) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

// ------------------------------------------------------------------ parsing --

const attr = (s, name) => {
  const m = s.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
};

/**
 * Their page: the ayah-end ornaments and every word's exact box, in their
 * frame. Word order is document order, which for their corpus *is* reading
 * order within an ayah — `data-word-index-in-ayah` is carried through so no
 * caller has to trust that.
 */
export function readTheirs(svg) {
  const marks = [];
  const boundary = /<g id="md-(?:line|word|aya-mark)-/;
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
  for (const m of svg.matchAll(/<g id="md-word-(\d+)"([^>]*)>/g)) {
    const rest = svg.slice(m.index + m[0].length);
    const nxt = rest.match(boundary);
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

/** Our page: the ayah-end markers, one ring list per ayah, and the viewBox. */
export function readOurs(svg) {
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
    verses.get(key).push(...ringsOf(m[1]));
  }
  const vb = (svg.match(/viewBox="([^"]*)"/)?.[1] ?? "0 0 345 550").split(/\s+/).map(Number);
  return { marks, verses, vb };
}

// -------------------------------------------------------------------- maths --

/**
 * Down the page, then right-to-left within a band. Applied to *both* sides
 * before pairing — see the header; pairing on document order fits a mirror.
 */
export function readingOrder(pts, tol) {
  const rows = [];
  for (const p of [...pts].sort((a, b) => a[1] - b[1])) {
    const last = rows.at(-1);
    if (last && Math.abs(p[1] - last.y) <= tol) last.row.push(p);
    else rows.push({ y: p[1], row: [p] });
  }
  return rows.flatMap(({ row }) => row.sort((a, b) => b[0] - a[0]));
}

/** Least squares y = a·x + b, with the residual at every point. */
export function fit(xs, ys) {
  const n = xs.length;
  const sx = xs.reduce((t, v) => t + v, 0);
  const sy = ys.reduce((t, v) => t + v, 0);
  const sxx = xs.reduce((t, v) => t + v * v, 0);
  const sxy = xs.reduce((t, v, i) => t + v * ys[i], 0);
  const a = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const b = (sy - a * sx) / n;
  return { a, b, res: xs.map((x, i) => ys[i] - (a * x + b)) };
}

/**
 * The per-page transform, fitted on the ornaments. Throws rather than returning
 * a bad fit: a page whose marker counts disagree has nothing to register
 * against, and a caller that silently accepted `NaN` would write plausible
 * numbers into a shipped file.
 *
 * The tolerances (8 units theirs, 11 ours) are line-band widths in each frame —
 * wide enough to gather a line, narrow enough not to swallow the next one.
 */
export function fitFrames(theirMarks, ourMarks) {
  const T = readingOrder(
    theirMarks.map((t) => [(t.box[0] + t.box[2]) / 2, (t.box[1] + t.box[3]) / 2]),
    8,
  );
  const O = readingOrder(ourMarks, 11);
  if (T.length !== O.length || T.length < 3) {
    throw new Error(`${T.length} of their marks vs ${O.length} of ours`);
  }
  const fx = fit(
    T.map((p) => p[0]),
    O.map((p) => p[0]),
  );
  const fy = fit(
    T.map((p) => p[1]),
    O.map((p) => p[1]),
  );
  return {
    markers: T.length,
    sx: fx.a,
    tx: fx.b,
    sy: fy.a,
    ty: fy.b,
    residual: Math.max(...[...fx.res, ...fy.res].map(Math.abs)),
    /** A box in their frame → the same box in ours. */
    apply: (b) => [fx.a * b[0] + fx.b, fy.a * b[1] + fy.b, fx.a * b[2] + fx.b, fy.a * b[3] + fy.b],
  };
}

/**
 * Waqf and hizb marks. Their corpus makes each of these a separate word; it
 * sits superscript above the line, so its centre routinely lands in the band
 * above. Benign, and counted apart so the interesting residue stays visible.
 */
export const WAQF = new Set([..."ۖۗۘۙۚۛۜ۩۞"]);
