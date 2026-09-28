/**
 * The shape of a page corner lifted by hand, on the open book.
 *
 * A reader who grabs a leaf by its outer corner and pulls folds it along a line:
 * the corner goes where the hand is, and the fold is the line of points equally
 * far from where the corner started and where it is now. Everything on the
 * corner's side of that line is lifted — so there the next opening shows
 * through — and it reappears mirrored across the line as the flap, showing the
 * back of the leaf, which is the page that will lie on the other side once the
 * turn is done.
 *
 * All in the book's own pixels: x from the book's left edge, y from its top.
 * The book is two leaves of width `leafW`, the spine at x = leafW. Pure numbers,
 * so the drawing (EdgeGrabRails) is only CSS, and this file is where the
 * geometry is tested.
 */

export interface Pt {
  x: number;
  y: number;
}

export type PeelSide = "left" | "right";

export interface PeelShape {
  /** The lifted area of the leaf, where the next opening shows through. */
  revealed: Pt[];
  /**
   * The flap, in the coordinates of the back page lying flat where it will
   * land. `matrix` then carries it to where the hand holds it.
   */
  backClip: Pt[];
  /** CSS `matrix(a, b, c, d, e, f)`: the flat back page → the lifted flap. */
  matrix: [number, number, number, number, number, number];
  /** How far the corner has travelled from where it started, in px. */
  lift: number;
  /**
   * Which way the fold faces, for the flap's shading: the angle of a CSS
   * `linear-gradient` running from the fold into the flap, in the flat back
   * page's coordinates, and where the fold sits along it (px).
   */
  shade: { angleDeg: number; foldAt: number };
  /** The same, for the shadow cast on the page beneath, in the book's pixels. */
  cast: { angleDeg: number; foldAt: number };
}

/** The outer corner of the grabbed leaf nearest the press. */
export function cornerOf(side: PeelSide, leafW: number, bookH: number, pressY: number): Pt {
  return { x: side === "left" ? 0 : 2 * leafW, y: pressY < bookH / 2 ? 0 : bookH };
}

/** Where the corner ends when the turn is carried through: mirrored over the spine. */
export function landedCorner(corner: Pt, leafW: number): Pt {
  return { x: 2 * leafW - corner.x, y: corner.y };
}

/**
 * Keep the corner where paper can reach. A leaf is bound at the spine, so the
 * corner can never be further from the spine's end on its own edge than the
 * leaf is wide, nor further from the spine's other end than the leaf's diagonal.
 */
export function reachable(p: Pt, corner: Pt, leafW: number, bookH: number): Pt {
  let q = clampTo(p, { x: leafW, y: corner.y }, leafW);
  q = clampTo(q, { x: leafW, y: bookH - corner.y }, Math.hypot(leafW, bookH));
  return q;
}

function clampTo(p: Pt, centre: Pt, radius: number): Pt {
  const dx = p.x - centre.x;
  const dy = p.y - centre.y;
  const d = Math.hypot(dx, dy);
  if (d <= radius || d === 0) return p;
  return { x: centre.x + (dx * radius) / d, y: centre.y + (dy * radius) / d };
}

/**
 * The fold for a corner of `side`'s leaf held at `pointer`. Null when the corner
 * has not moved far enough to have a fold at all.
 */
export function peelShape(
  side: PeelSide,
  leafW: number,
  bookH: number,
  corner: Pt,
  pointer: Pt,
): PeelShape | null {
  const p = reachable(pointer, corner, leafW, bookH);
  const vx = p.x - corner.x;
  const vy = p.y - corner.y;
  const lift = Math.hypot(vx, vy);
  if (lift < 1) return null;
  const n = { x: vx / lift, y: vy / lift };
  const m = { x: (p.x + corner.x) / 2, y: (p.y + corner.y) / 2 };

  const x0 = side === "left" ? 0 : leafW;
  const leaf: Pt[] = [
    { x: x0, y: 0 },
    { x: x0 + leafW, y: 0 },
    { x: x0 + leafW, y: bookH },
    { x: x0, y: bookH },
  ];
  // The corner's side of the fold: (q − m)·n < 0.
  const revealed = clipHalfPlane(leaf, (q) => (q.x - m.x) * n.x + (q.y - m.y) * n.y);
  if (revealed.length < 3) return null;

  // The flat back page sits mirrored over the spine: s(x, y) = (2·leafW − x, y).
  const spine = (q: Pt): Pt => ({ x: 2 * leafW - q.x, y: q.y });
  const backClip = revealed.map(spine);

  // The flap is the fold's mirror σ(q) = q − 2((q − m)·n)n, applied to the
  // back page brought back over the spine: T = σ ∘ s.
  //   σ's linear part A = I − 2nnᵀ; its offset b = 2(m·n)n.
  //   s's linear part S = diag(−1, 1); its offset (2·leafW, 0).
  const a11 = 1 - 2 * n.x * n.x;
  const a12 = -2 * n.x * n.y;
  const a22 = 1 - 2 * n.y * n.y;
  const mn = m.x * n.x + m.y * n.y;
  const bx = 2 * mn * n.x;
  const by = 2 * mn * n.y;
  // A·S = [[−a11, a12], [−a12, a22]]; offset A·(2L, 0) + b.
  const matrix: PeelShape["matrix"] = [
    -a11,
    -a12,
    a12,
    a22,
    a11 * 2 * leafW + bx,
    a12 * 2 * leafW + by,
  ];

  // Shading runs from the fold into the flap. In the flat back page, the flap
  // is where (s(z) − m)·n < 0, so "into the flap" is the direction (nx, −ny).
  const bookW = 2 * leafW;
  const shade = gradientAlong({ x: n.x, y: -n.y }, spine(m), bookW, bookH);
  // On the page beneath, the shadow the lifted leaf casts runs from the fold
  // back toward where the corner was: the direction −n, in the book's pixels.
  const cast = gradientAlong({ x: -n.x, y: -n.y }, m, bookW, bookH);

  return { revealed, backClip, matrix, lift, shade, cast };
}

/**
 * A CSS `linear-gradient` angle running along `d` (a unit vector) over a box of
 * `w × h`, and where `through` sits along it in px. CSS measures a gradient on a
 * line through the box's centre, of length |w·dx| + |h·dy|, starting half that
 * behind the centre.
 */
function gradientAlong(d: Pt, through: Pt, w: number, h: number): { angleDeg: number; foldAt: number } {
  const angleDeg = (Math.atan2(d.x, -d.y) * 180) / Math.PI;
  const len = Math.abs(w * d.x) + Math.abs(h * d.y);
  const start = { x: w / 2 - (d.x * len) / 2, y: h / 2 - (d.y * len) / 2 };
  const foldAt = (through.x - start.x) * d.x + (through.y - start.y) * d.y;
  return { angleDeg, foldAt };
}

/** The part of a convex polygon where `side(q) < 0` (Sutherland–Hodgman, one edge). */
function clipHalfPlane(poly: Pt[], side: (q: Pt) => number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const fa = side(a);
    const fb = side(b);
    if (fa < 0) out.push(a);
    if (fa < 0 !== fb < 0) {
      const t = fa / (fa - fb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/** Apply a CSS matrix to a point — for tests, and for anyone checking a flap. */
export function applyMatrix(mx: PeelShape["matrix"], q: Pt): Pt {
  const [a, b, c, d, e, f] = mx;
  return { x: a * q.x + c * q.y + e, y: b * q.x + d * q.y + f };
}
