/**
 * Turning either print into ink you can count, with nothing installed.
 *
 * Everything else in this repo that touches the two mus'haf prints asks
 * questions about *rectangles*: where a word's box is, whether a mark's box sits
 * inside it, whether two frames register. `mushaf-frame.mjs` is that arithmetic,
 * and it never draws. This file draws.
 *
 * It exists because the one question those rectangles cannot answer is whether
 * the ink the reader actually sees is under them — `sub-word-marks.md` §⑦ states
 * it and says nobody has looked. Looking means rasterising, and rasterising in
 * this repo has one hard constraint: the ETL is deterministic and vendor-free,
 * so a raster library with a native binary is not available to it. Hence a
 * scanline filler in ~300 lines of arithmetic, which is the whole dependency.
 *
 * ## The two prints do not use the same path grammar
 *
 * The ligature corpus is `M … c … z`, always — measured over pages 1, 2, 3, 50
 * and 604, every path is one moveto, cubics, close. `pathBBox` handles exactly
 * that, which is why it has never needed more.
 *
 * The shipped print is the full grammar: quadratics, smooth quadratics, smooth
 * cubics, elliptical arcs, and the relative form of all of them. Page 3 alone
 * carries `q t l h v c s a M H V L A Z z m`. So the parser here is a character
 * scanner rather than a token regex, and it is a character scanner for one
 * specific reason: **arc flags may be written unseparated**. In `a5 5 0 0150 50`
 * the `0150` is *four* values — two flags, then a coordinate — and a numeric
 * regex reads it as one. `pathBBox` would be wrong on the shipped print for that
 * reason alone, and it is never pointed at the shipped print.
 *
 * ## Where the ink is, on our own pages
 *
 * One outer `<g transform="matrix(1.3333 0 0 -1.3333 e f)">` holds every drawn
 * thing; `e` and `f` differ per page (`-136 482` on pages 1–2, `-55 640` on page
 * 3, `-115 640` on pages 50 and 604), so the matrix is read, never assumed. The
 * `<path class="ayahPolygon">` tap targets sit *outside* it, in plain viewBox
 * space, and carry `fill-opacity="0"` — they are not ink and are dropped.
 *
 * Fill rule matters and is not uniform: the giant text paths carry
 * `fill-rule="evenodd"`, most ornament paths do not and so are nonzero. Paths
 * are therefore filled **one at a time and OR-ed**, never merged into one edge
 * list — two overlapping even-odd paths merged into a single even-odd pass would
 * cancel where they overlap and punch a hole in the letter.
 *
 * ## What "deterministic" means here, precisely
 *
 * Every number below comes out of `+ - * /`, `Math.sqrt`, and — for elliptical
 * arcs only — `Math.atan2`, `Math.cos`, `Math.sin`. The first four are exact
 * under IEEE-754 and identical on every machine. The trigonometric three come
 * from V8's bundled fdlibm port, which is the same code on every platform V8
 * builds for; they are stable across machines but not guaranteed across V8
 * *versions*. Arcs never occur in the ligature corpus, so no template ever
 * touches them; on the shipped print they are a low-hundreds minority of
 * commands. Scores are reported to three decimals, which is roughly a thousand
 * times the size of any drift that could produce.
 */

// -------------------------------------------------------------- transforms --

/** `[a, b, c, d, e, f]`, the SVG convention: `x' = ax + cy + e`, `y' = bx + dy + f`. */
export const IDENTITY = [1, 0, 0, 1, 0, 0];

export const compose = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

const num = (s) => Number(s);

/**
 * The `transform` attribute, as far as these two corpora use it.
 *
 * Only `matrix`, `translate` and `scale` appear; `rotate` and the skews would
 * silently do nothing if they turned up, so they throw instead. A transform this
 * file mis-reads moves every box on the page by the same wrong amount, which is
 * exactly the failure this file was built to detect — it must not be able to
 * cause one.
 */
export function parseTransform(s) {
  let m = IDENTITY;
  for (const g of (s ?? "").matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const v = (g[2].match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? []).map(num);
    if (g[1] === "matrix") m = compose(m, v.slice(0, 6));
    else if (g[1] === "translate") m = compose(m, [1, 0, 0, 1, v[0], v[1] ?? 0]);
    else if (g[1] === "scale") m = compose(m, [v[0], 0, 0, v[1] ?? v[0], 0, 0]);
    else throw new Error(`transform "${g[1]}" is not handled and would be ignored silently`);
  }
  return m;
}

// ------------------------------------------------------------ path parsing --

const isDigit = (c) => c >= "0" && c <= "9";

/**
 * A path's `d`, flattened to closed rings of points in the target frame.
 *
 * `tol` is the flatness tolerance **in target units** — the largest distance a
 * flattened chord is allowed to sit from the true curve. Callers pass a fraction
 * of a sample so that subdivision error is invisible at the resolution being
 * rasterised, which is what keeps the answer independent of how the tolerance
 * was chosen.
 */
export function flatten(d, m, tol) {
  let i = 0;
  const n = d.length;
  const ws = () => {
    while (i < n && (d[i] === " " || d[i] === "," || d[i] === "\n" || d[i] === "\t" || d[i] === "\r")) i += 1;
  };
  const number = () => {
    ws();
    const s = i;
    if (d[i] === "+" || d[i] === "-") i += 1;
    while (i < n && isDigit(d[i])) i += 1;
    if (d[i] === ".") {
      i += 1;
      while (i < n && isDigit(d[i])) i += 1;
    }
    if (d[i] === "e" || d[i] === "E") {
      i += 1;
      if (d[i] === "+" || d[i] === "-") i += 1;
      while (i < n && isDigit(d[i])) i += 1;
    }
    if (i === s) throw new Error(`expected a number at ${s} of a path`);
    return Number(d.slice(s, i));
  };
  /** A flag is one character. This is the whole reason for a character scanner. */
  const flag = () => {
    ws();
    const c = d[i];
    if (c !== "0" && c !== "1") throw new Error(`expected an arc flag at ${i}, saw "${c}"`);
    i += 1;
    return c === "1";
  };
  const more = () => {
    ws();
    return i < n && (isDigit(d[i]) || d[i] === "." || d[i] === "-" || d[i] === "+");
  };

  const rings = [];
  let ring = null;
  // Current point, subpath start, and the reflected control point that the
  // smooth forms (`S`, `T`) need. `px/py` is null unless the previous command
  // was of the matching kind, per the SVG spec — a smooth cubic after a lineto
  // reflects nothing and its first control point is the current point.
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let rcx = null;
  let rcy = null;
  let rqx = null;
  let rqy = null;

  const put = (x, y) => ring.push(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]);
  const open = (x, y) => {
    if (ring && ring.length >= 6) rings.push(ring);
    ring = [];
    put(x, y);
  };
  /** After a close, a bare lineto restarts the subpath at its start point. */
  const ensure = () => {
    if (!ring) open(cx, cy);
  };
  const close = () => {
    if (ring && ring.length >= 6) rings.push(ring);
    ring = null;
  };

  /**
   * De Casteljau to a flatness bound, in the target frame. Recursive rather
   * than a fixed segment count so that a long sweeping curve and a two-unit
   * terminal get the accuracy each needs, and so the answer does not depend on
   * a magic segment number nobody can justify.
   */
  const cubic = (x0, y0, x1, y1, x2, y2, x3, y3, depth) => {
    if (depth > 0) {
      const ux = 3 * x1 - 2 * x0 - x3;
      const uy = 3 * y1 - 2 * y0 - y3;
      const vx = 3 * x2 - x0 - 2 * x3;
      const vy = 3 * y2 - y0 - 2 * y3;
      const dev = Math.max(ux * ux, vx * vx) + Math.max(uy * uy, vy * vy);
      if (dev > 16 * tol * tol) {
        const x01 = (x0 + x1) / 2;
        const y01 = (y0 + y1) / 2;
        const x12 = (x1 + x2) / 2;
        const y12 = (y1 + y2) / 2;
        const x23 = (x2 + x3) / 2;
        const y23 = (y2 + y3) / 2;
        const a = (x01 + x12) / 2;
        const b = (y01 + y12) / 2;
        const c = (x12 + x23) / 2;
        const e = (y12 + y23) / 2;
        const mx = (a + c) / 2;
        const my = (b + e) / 2;
        cubic(x0, y0, x01, y01, a, b, mx, my, depth - 1);
        cubic(mx, my, c, e, x23, y23, x3, y3, depth - 1);
        return;
      }
    }
    put(x3, y3);
  };

  const quad = (x0, y0, x1, y1, x2, y2) =>
    cubic(
      x0,
      y0,
      x0 + (2 / 3) * (x1 - x0),
      y0 + (2 / 3) * (y1 - y0),
      x2 + (2 / 3) * (x1 - x2),
      y2 + (2 / 3) * (y1 - y2),
      x2,
      y2,
      20,
    );

  /** Endpoint parameterisation → centre parameterisation, per SVG appendix F.6.5. */
  const arc = (x0, y0, rx, ry, rot, large, sweep, x1, y1) => {
    if (rx === 0 || ry === 0) {
      put(x1, y1);
      return;
    }
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    const phi = (rot * Math.PI) / 180;
    const cp = Math.cos(phi);
    const sp = Math.sin(phi);
    const dx2 = (x0 - x1) / 2;
    const dy2 = (y0 - y1) / 2;
    const x1p = cp * dx2 + sp * dy2;
    const y1p = -sp * dx2 + cp * dy2;
    const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lam > 1) {
      const s = Math.sqrt(lam);
      rx *= s;
      ry *= s;
    }
    const sign = large === sweep ? -1 : 1;
    const top = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const bot = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    const co = sign * Math.sqrt(Math.max(0, top / bot));
    const cxp = (co * rx * y1p) / ry;
    const cyp = (-co * ry * x1p) / rx;
    const ccx = cp * cxp - sp * cyp + (x0 + x1) / 2;
    const ccy = sp * cxp + cp * cyp + (y0 + y1) / 2;
    const th0 = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
    let dth = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx) - th0;
    if (!sweep && dth > 0) dth -= 2 * Math.PI;
    if (sweep && dth < 0) dth += 2 * Math.PI;
    // Segment count from the arc's own length against the tolerance, so a
    // quarter-unit terminal and a full ellipse are both drawn to the same
    // accuracy. Capped so a degenerate radius cannot spin.
    const rmax = Math.max(rx, ry);
    const segs = Math.min(256, Math.max(1, Math.ceil((Math.abs(dth) * rmax) / Math.max(tol, 1e-9) / 8)));
    for (let k = 1; k <= segs; k += 1) {
      const th = th0 + (dth * k) / segs;
      const ct = Math.cos(th);
      const st = Math.sin(th);
      put(ccx + cp * rx * ct - sp * ry * st, ccy + sp * rx * ct + cp * ry * st);
    }
  };

  let cmd = null;
  ws();
  while (i < n) {
    const c = d[i];
    if (/[A-Za-z]/.test(c)) {
      cmd = c;
      i += 1;
    } else if (cmd === null) {
      throw new Error(`a path begins with "${c}"`);
    }
    let rel;
    let K;

    if (cmd === "Z" || cmd === "z") {
      close();
      cx = sx;
      cy = sy;
      rcx = rcy = rqx = rqy = null;
      ws();
      continue;
    }

    do {
      // Re-read the command each time round. A moveto's *trailing* pairs are
      // implicit linetos per the grammar, so the command changes mid-run — and
      // hoisting this out of the loop is not a style choice, it is the bug that
      // made every trailing pair open a fresh subpath and dragged the giant text
      // path's bounding box 185 units off the left edge of the page.
      rel = cmd === cmd.toLowerCase();
      K = cmd.toUpperCase();
      if (K === "M") {
        const x = number() + (rel ? cx : 0);
        const y = number() + (rel ? cy : 0);
        open(x, y);
        cx = sx = x;
        cy = sy = y;
        rcx = rcy = rqx = rqy = null;
        // Trailing pairs after a moveto are implicit linetos, per the grammar.
        cmd = rel ? "l" : "L";
      } else if (K === "L") {
        ensure();
        cx = number() + (rel ? cx : 0);
        cy = number() + (rel ? cy : 0);
        put(cx, cy);
        rcx = rcy = rqx = rqy = null;
      } else if (K === "H") {
        ensure();
        cx = number() + (rel ? cx : 0);
        put(cx, cy);
        rcx = rcy = rqx = rqy = null;
      } else if (K === "V") {
        ensure();
        cy = number() + (rel ? cy : 0);
        put(cx, cy);
        rcx = rcy = rqx = rqy = null;
      } else if (K === "C" || K === "S") {
        let x1;
        let y1;
        if (K === "C") {
          x1 = number() + (rel ? cx : 0);
          y1 = number() + (rel ? cy : 0);
        } else {
          x1 = rcx === null ? cx : 2 * cx - rcx;
          y1 = rcy === null ? cy : 2 * cy - rcy;
        }
        const x2 = number() + (rel ? cx : 0);
        const y2 = number() + (rel ? cy : 0);
        const x3 = number() + (rel ? cx : 0);
        const y3 = number() + (rel ? cy : 0);
        ensure();
        cubic(cx, cy, x1, y1, x2, y2, x3, y3, 20);
        rcx = x2;
        rcy = y2;
        rqx = rqy = null;
        cx = x3;
        cy = y3;
      } else if (K === "Q" || K === "T") {
        let x1;
        let y1;
        if (K === "Q") {
          x1 = number() + (rel ? cx : 0);
          y1 = number() + (rel ? cy : 0);
        } else {
          x1 = rqx === null ? cx : 2 * cx - rqx;
          y1 = rqy === null ? cy : 2 * cy - rqy;
        }
        const x2 = number() + (rel ? cx : 0);
        const y2 = number() + (rel ? cy : 0);
        ensure();
        quad(cx, cy, x1, y1, x2, y2);
        rqx = x1;
        rqy = y1;
        rcx = rcy = null;
        cx = x2;
        cy = y2;
      } else if (K === "A") {
        const rx = number();
        const ry = number();
        const rot = number();
        const large = flag();
        const sweep = flag();
        const x1 = number() + (rel ? cx : 0);
        const y1 = number() + (rel ? cy : 0);
        ensure();
        arc(cx, cy, rx, ry, rot, large, sweep, x1, y1);
        rcx = rcy = rqx = rqy = null;
        cx = x1;
        cy = y1;
      } else {
        throw new Error(`path command "${cmd}" is not handled`);
      }
    } while (more());
    ws();
  }
  close();
  return rings;
}

// ------------------------------------------------------------- the raster --

/**
 * One fillable shape: its rings, its fill rule, its bounds, and a coarse index
 * from a horizontal band to the edges that cross it.
 *
 * The index is what makes a per-mark window cheap. A shipped page is a handful
 * of paths and one of them has forty thousand characters in it; without the
 * bands, measuring a six-unit-wide mark would walk every edge on the page.
 */
export function shapeOf(rings, fillRule) {
  let n = 0;
  for (const r of rings) n += r.length / 2;
  const ex = new Float64Array(n * 4);
  let k = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rings) {
    const c = r.length / 2;
    for (let a = 0; a < c; a += 1) {
      const b = (a + 1) % c;
      ex[k] = r[a * 2];
      ex[k + 1] = r[a * 2 + 1];
      ex[k + 2] = r[b * 2];
      ex[k + 3] = r[b * 2 + 1];
      k += 4;
      if (r[a * 2] < minX) minX = r[a * 2];
      if (r[a * 2] > maxX) maxX = r[a * 2];
      if (r[a * 2 + 1] < minY) minY = r[a * 2 + 1];
      if (r[a * 2 + 1] > maxY) maxY = r[a * 2 + 1];
    }
  }
  const BAND = 2;
  const b0 = Math.floor(minY / BAND);
  const nb = Math.max(1, Math.ceil(maxY / BAND) - b0 + 1);
  const bands = Array.from({ length: nb }, () => []);
  for (let e = 0; e < n; e += 1) {
    const ya = ex[e * 4 + 1];
    const yb = ex[e * 4 + 3];
    if (ya === yb) continue; // horizontal edges never cross a scanline
    const lo = Math.max(0, Math.floor(Math.min(ya, yb) / BAND) - b0);
    const hi = Math.min(nb - 1, Math.floor(Math.max(ya, yb) / BAND) - b0);
    for (let q = lo; q <= hi; q += 1) bands[q].push(e);
  }
  return { ex, n, rings, fillRule, box: [minX, minY, maxX, maxY], bands, b0, BAND };
}

/**
 * A binary mask of a window, sampled at pixel centres.
 *
 * `x0, y0` are the window's top-left in target units; `cols × rows` samples at
 * `1/res` units apart, sample `(i, j)` testing the point
 * `(x0 + (i + 0.5)/res, y0 + (j + 0.5)/res)`. Centre sampling rather than corner
 * sampling because a mark is a handful of samples across and a half-sample
 * systematic shift would show up as exactly the registration bias this is meant
 * to measure.
 *
 * Shapes are OR-ed in, one fill at a time. See the header on why they are never
 * merged.
 */
export function rasterise(shapes, x0, y0, cols, rows, res) {
  const mask = new Uint8Array(cols * rows);
  const xs = [];
  const ws = [];
  for (const s of shapes) {
    if (s.box[2] < x0 || s.box[0] > x0 + cols / res) continue;
    if (s.box[3] < y0 || s.box[1] > y0 + rows / res) continue;
    for (let j = 0; j < rows; j += 1) {
      const y = y0 + (j + 0.5) / res;
      if (y < s.box[1] || y > s.box[3]) continue;
      const bi = Math.floor(y / s.BAND) - s.b0;
      if (bi < 0 || bi >= s.bands.length) continue;
      xs.length = 0;
      ws.length = 0;
      for (const e of s.bands[bi]) {
        const ya = s.ex[e * 4 + 1];
        const yb = s.ex[e * 4 + 3];
        if (ya <= y === yb <= y) continue;
        const xa = s.ex[e * 4];
        const xb = s.ex[e * 4 + 2];
        xs.push(xa + ((y - ya) * (xb - xa)) / (yb - ya));
        ws.push(yb > ya ? 1 : -1);
      }
      if (xs.length < 2) continue;
      const ord = xs.map((_, q) => q).sort((a, b) => xs[a] - xs[b]);
      const row = j * cols;
      let wind = 0;
      for (let q = 0; q < ord.length - 1; q += 1) {
        wind += ws[ord[q]];
        const inside = s.fillRule === "evenodd" ? (q & 1) === 0 : wind !== 0;
        if (!inside) continue;
        const xa = xs[ord[q]];
        const xb = xs[ord[q + 1]];
        let ia = Math.ceil((xa - x0) * res - 0.5);
        let ib = Math.ceil((xb - x0) * res - 0.5);
        if (ia < 0) ia = 0;
        if (ib > cols) ib = cols;
        for (let p = ia; p < ib; p += 1) mask[row + p] = 1;
      }
    }
  }
  return mask;
}

/**
 * Summed-area table of a mask, so "how much ink is in this rectangle" is four
 * lookups however many times it is asked.
 *
 * It is asked a great many times: the offset search below evaluates a few
 * hundred candidate placements per mark, and each one needs the ink count under
 * a moved rectangle.
 */
export function integral(mask, cols, rows) {
  const sat = new Int32Array((cols + 1) * (rows + 1));
  for (let j = 0; j < rows; j += 1) {
    let run = 0;
    for (let i = 0; i < cols; i += 1) {
      run += mask[j * cols + i];
      sat[(j + 1) * (cols + 1) + i + 1] = sat[j * (cols + 1) + i + 1] + run;
    }
  }
  return sat;
}

/** Ink count in `[i0, i1) × [j0, j1)`, clamped to the window. */
export function boxSum(sat, cols, rows, i0, j0, i1, j1) {
  const a = Math.max(0, Math.min(cols, i0));
  const b = Math.max(0, Math.min(rows, j0));
  const c = Math.max(0, Math.min(cols, i1));
  const e = Math.max(0, Math.min(rows, j1));
  if (c <= a || e <= b) return 0;
  const W = cols + 1;
  return sat[e * W + c] - sat[b * W + c] - sat[e * W + a] + sat[b * W + a];
}

// -------------------------------------------------------- reading a page --

const TAG = /<(path|g|\/g|svg)\b([^>]*)>/g;

const attrOf = (s, k) => s.match(new RegExp(`\\s${k}="([^"]*)"`))?.[1] ?? null;

/**
 * Every filled path on one of our own pages, flattened into the page's own
 * viewBox frame, plus that frame.
 *
 * Two exclusions, both load-bearing:
 *
 * - `fill-opacity="0"` — the ayah tap targets. They are full-page-width bands
 *   and counting them as ink would score every mark on the page at 100%.
 * - `fill="none"` — nothing in these pages carries it today, but a stroke-only
 *   path arriving later would otherwise be filled as if it were solid.
 *
 * The `<g>` stack is tracked properly rather than assuming one matrix, because
 * the tap targets sit outside the transform group and the ornaments inside it,
 * and a flat read would put one of the two in the wrong frame.
 */
export function readPageInk(svg, tol) {
  const vb = (svg.match(/viewBox="([^"]*)"/)?.[1] ?? "0 0 345 550").split(/\s+/).map(Number);
  const stack = [IDENTITY];
  const shapes = [];
  for (const t of svg.matchAll(TAG)) {
    if (t[1] === "/g") {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (t[1] === "g" || t[1] === "svg") {
      const tr = attrOf(t[2], "transform");
      if (t[1] === "g") stack.push(tr ? compose(stack[stack.length - 1], parseTransform(tr)) : stack[stack.length - 1]);
      continue;
    }
    const d = attrOf(t[2], "d");
    if (!d) continue;
    const fill = attrOf(t[2], "fill");
    if (fill === "none") continue;
    if (attrOf(t[2], "fill-opacity") === "0") continue;
    const rings = flatten(d, stack[stack.length - 1], tol);
    if (!rings.length) continue;
    shapes.push(shapeOf(rings, attrOf(t[2], "fill-rule") === "evenodd" ? "evenodd" : "nonzero"));
  }
  return { vb, shapes };
}

/**
 * The ink of one window, cut into the pieces a finger can point at.
 *
 * A piece is a connected run of ink: a haraka floating over a word is one, the word
 * body under it is another, and a dot is a third. That is the unit a reader means
 * when they point — nobody points at half a fatha — and it is why the cut is made
 * on connectivity rather than on the print's own paths, which are a handful of
 * enormous outlines with no relationship at all to what a reader sees.
 *
 * The cut is made on a raster and then carried back onto the outlines, because
 * connectivity between two closed rings is a question about their interiors and the
 * rings do not know the answer. Each ring is assigned to whichever component its own
 * boundary sits against: for an outer ring that is the ink it encloses, for a hole
 * it is the ink around it, and both land on the same piece, which is what keeps a
 * counter-shape with the letter it was cut out of.
 *
 * `res`, samples to the page unit, defaults to sixteen because that is the
 * resolution `probe-mark-ink.mjs` measures at: a caller cutting pieces from a
 * window that search ran over should cut at the same grain it ran at, or it is
 * offering a piece the measurement never had.
 */
export function inkPieces(shapes, vx, vy, vw, vh, res = 16) {
  const cols = Math.ceil(vw * res);
  const rows = Math.ceil(vh * res);
  const mask = rasterise(shapes, vx, vy, cols, rows, res);
  const lab = new Int32Array(cols * rows);
  const stack = new Int32Array(cols * rows);
  let n = 0;
  // Four-connected rather than eight. The failure that matters is a haraka welded
  // to the letter under it, because then the reader cannot point at it at all;
  // a piece that comes apart in two is recoverable with a second tap.
  for (let s = 0; s < mask.length; s += 1) {
    if (!mask[s] || lab[s]) continue;
    n += 1;
    let sp = 0;
    lab[s] = n;
    stack[sp] = s;
    sp += 1;
    while (sp) {
      sp -= 1;
      const q = stack[sp];
      const qi = q % cols;
      const qj = (q - qi) / cols;
      if (qi > 0 && mask[q - 1] && !lab[q - 1]) { lab[q - 1] = n; stack[sp] = q - 1; sp += 1; }
      if (qi < cols - 1 && mask[q + 1] && !lab[q + 1]) { lab[q + 1] = n; stack[sp] = q + 1; sp += 1; }
      if (qj > 0 && mask[q - cols] && !lab[q - cols]) { lab[q - cols] = n; stack[sp] = q - cols; sp += 1; }
      if (qj < rows - 1 && mask[q + cols] && !lab[q + cols]) { lab[q + cols] = n; stack[sp] = q + cols; sp += 1; }
    }
  }
  return {
    /** Which component a ring's boundary sits against, or 0 if it sits against none. */
    of(ring) {
      const tally = new Map();
      for (let i = 0; i < ring.length; i += 2) {
        const ci = Math.floor((ring[i] - vx) * res);
        const cj = Math.floor((ring[i + 1] - vy) * res);
        for (let dj = -1; dj <= 1; dj += 1) {
          for (let di = -1; di <= 1; di += 1) {
            const a = ci + di;
            const b = cj + dj;
            if (a < 0 || b < 0 || a >= cols || b >= rows) continue;
            const l = lab[b * cols + a];
            if (l) tally.set(l, (tally.get(l) || 0) + 1);
          }
        }
      }
      let best = 0;
      let seen = 0;
      for (const [l, c] of tally) if (c > seen) { seen = c; best = l; }
      return best;
    },
  };
}
