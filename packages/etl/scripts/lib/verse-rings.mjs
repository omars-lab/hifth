/**
 * The verse-number ring swap, launch item 45.
 *
 * quran-svg drew a ring round each verse number from a source it does not name. The verse
 * numbers themselves are the Complex's. This step can put another ring in each place:
 *
 *   upstream   keep quran-svg's ring; the page is left byte for byte as pinned
 *   complex    the Complex's own pale green medallion, from its free 1441H drawing files
 *   plain      a plain ring of our own drawing
 *
 * Both swaps place the new shape from the verse number alone: its centre plus a straight-line
 * offset fitted against the drawing files (`regular` for most pages, `small` for the opening
 * two, whose rings are drawn twice and smaller). No drawing file is read here. How the lines
 * were fitted, and how closely they land, is in the mushaf-reference skill's scripts.
 *
 * Every ring the page has is either swapped or dropped as a twin, each ring must sit on its
 * own verse number, and the counts are returned so the copy step can assert the corpus totals.
 */

export const RING_MODES = ["upstream", "complex", "plain"];

/** quran-svg's ring: one path, always starting `m1248,4`, under a translate and a scale. */
const RING =
  /<g transform="translate\(([-\d.]+)[ ,]([-\d.]+)\) scale\(([-\d.]+)[ ,]([-\d.]+)\)"><path d="(m1248,4[^"]*)"[^>]*\/><\/g>/g;
/** A verse number: a group with the `ayah:x` attribute, its first path the numeral. */
const NUMERAL = /<g transform="translate\(([-\d.]+)[ ,]([-\d.]+)\)" ayah:x[^>]*><path d="([^"]*)"/g;

const TOK = /[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g;
const ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

/**
 * Bounds of every end and control point of a path, absolute, as [x0, y0, x1, y1]. Control
 * points can sit outside the curve, so this is a little generous; it is used for centres.
 */
export function pathBounds(d) {
  const xs = [];
  const ys = [];
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let cmd = null;
  const toks = d.match(TOK) ?? [];
  for (let i = 0; i < toks.length; ) {
    const t = toks[i];
    if (/^[a-z]$/i.test(t)) {
      cmd = t;
      i++;
      if (cmd === "Z" || cmd === "z") {
        x = sx;
        y = sy;
      }
      continue;
    }
    const c = cmd.toLowerCase();
    const n = ARGS[c];
    const a = toks.slice(i, i + n).map(Number);
    i += n;
    const rel = cmd !== cmd.toUpperCase();
    if (c === "h") x = rel ? x + a[0] : a[0];
    else if (c === "v") y = rel ? y + a[0] : a[0];
    else {
      const pts = c === "a" ? [[a[5], a[6]]] : [];
      if (c !== "a") for (let k = 0; k < n; k += 2) pts.push([a[k], a[k + 1]]);
      for (const [px, py] of pts) {
        xs.push(rel ? px + x : px);
        ys.push(rel ? py + y : py);
      }
      const [ex, ey] = pts[pts.length - 1];
      x = rel ? x + ex : ex;
      y = rel ? y + ey : ey;
      if (c === "m") {
        sx = x;
        sy = y;
        cmd = rel ? "l" : "L";
      }
    }
    xs.push(x);
    ys.push(y);
  }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

const f2 = (n) => (Math.abs(n) < 0.005 ? 0 : n).toFixed(2);

/** Move an absolute path drawn round (0, 0) to (cx, cy), scaled. Only M, L, C and Z. */
function placeShape(d, cx, cy, scale) {
  const out = [];
  let pair = [];
  for (const tok of d.match(/[MLCZ]|-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []) {
    if (/[MLCZ]/.test(tok)) {
      out.push(tok);
      continue;
    }
    pair.push(Number(tok));
    if (pair.length === 2) {
      out.push(`${f2(cx + pair[0] * scale)} ${f2(cy + pair[1] * scale)}`);
      pair = [];
    }
  }
  return out.join(" ").replace(/ ?([MLCZ]) ?/g, "$1");
}

/** Two circles, the inner cut out, so the ring is a band of the given width. */
function plainRing(cx, cy, radius, width) {
  const circle = (r) =>
    `M${f2(cx - r)} ${f2(cy)}a${f2(r)} ${f2(r)} 0 1 0 ${f2(2 * r)} 0a${f2(r)} ${f2(r)} 0 1 0 ${f2(-2 * r)} 0Z`;
  return circle(radius) + circle(radius - width);
}

const ringCentres = new Map();
function ringCentre(d) {
  if (!ringCentres.has(d)) {
    const [x0, y0, x1, y1] = pathBounds(d);
    ringCentres.set(d, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0 });
  }
  return ringCentres.get(d);
}

const line = (fit, x, y) => fit[0] + fit[1] * x + fit[2] * y;

/**
 * Swap the rings on one page's raw upstream markup. `rings` is the `rings` entry of the pin
 * (with the shapes file's contents merged in): `mode`, the `regular` and `small` lines, and
 * `complex: {d, fill}` or `plain: {radius, width, fill}` for the mode that needs it.
 * Returns the page and the counts: rings found, twins dropped, shapes placed.
 */
export function swapRings(svg, page, rings) {
  const mode = rings?.mode ?? "upstream";
  if (!RING_MODES.includes(mode)) throw new Error(`unknown ring mode "${mode}"`);
  const found = [...svg.matchAll(RING)];
  if (mode === "upstream") return { svg, found: found.length, twins: 0, placed: 0 };
  const shape = rings[mode];
  if (!shape) throw new Error(`ring mode "${mode}" needs its shape, and the pin's shapes file gives none`);

  const small = rings.small.pages.includes(page);
  const fit = small ? rings.small : rings.regular;
  const scale = small ? rings.small.scale : 1;

  const numerals = [...svg.matchAll(NUMERAL)].map((m) => {
    const [x0, y0, x1, y1] = pathBounds(m[3]);
    return { x: Number(m[1]) + (x0 + x1) / 2, y: Number(m[2]) + (y0 + y1) / 2 };
  });

  // Pages 1 and 2 draw each ring twice, one exactly on the other; keep the first.
  let twins = 0;
  const kept = found.filter((m, i) => {
    const twin = i > 0 && m[0] === found[i - 1][0];
    if (twin) twins++;
    return !twin;
  });
  if (kept.length !== numerals.length) {
    throw new Error(
      `page ${page}: ${kept.length} rings (after ${twins} doubled) but ${numerals.length} verse number(s); ` +
        `the rings no longer pair one to one with the numbers`,
    );
  }

  // Each ring comes just before its own number. Check it sits on it before trusting the order.
  kept.forEach((m, i) => {
    const c = ringCentre(m[5]);
    const sxr = Number(m[3]);
    const syr = Number(m[4]);
    const rx = Number(m[1]) + c.x * sxr;
    const ry = Number(m[2]) + c.y * syr;
    const n = numerals[i];
    const dist = Math.hypot(rx - n.x, ry - n.y);
    if (dist > c.w * Math.abs(sxr)) {
      throw new Error(`page ${page}: ring ${i + 1} sits ${dist.toFixed(1)} units from its verse number`);
    }
  });

  let next = 0;
  const keptSet = new Set(kept.map((m) => m.index));
  const out = svg.replace(RING, (...args) => {
    const index = args[args.length - 2];
    if (!keptSet.has(index)) return "";
    const n = numerals[next++];
    const cx = n.x + line(fit.dx, n.x, n.y);
    const cy = n.y + line(fit.dy, n.x, n.y);
    if (mode === "complex") return `<path d="${placeShape(shape.d, cx, cy, scale)}" fill="${shape.fill}"/>`;
    return `<path d="${plainRing(cx, cy, shape.radius * scale, shape.width * scale)}" fill="${shape.fill}" fill-rule="evenodd"/>`;
  });
  if ([...out.matchAll(RING)].length) throw new Error(`page ${page}: a ring survived the swap`);
  return { svg: out, found: found.length, twins, placed: next };
}
