/**
 * The rough band — how the pen draws a mark since the highlight-texture
 * decision was settled (docs/decisions/highlight-texture.md, 2026-09-30).
 *
 * The swipe ink.ts works out is still the geometry: where a band sits, how
 * long it runs, how thick it is. This turns one swipe into the outline a real
 * highlighter leaves: the edges drift a little, the band sags and tilts
 * slightly, and both ends are cut nearly upright — a slight slant where the
 * tip lands (the right, where a line of Arabic begins) and at the far end.
 * The first drawing slanted the start by half a band and rounded the far end,
 * which read as a rhombus; the owner asked for the ends "straightened
 * vertically, just slight slants", and the upright-ends test holds that.
 *
 * Seeded, never random: a band is drawn by the same hand on every visit, so a
 * verse never shimmers between page turns (see {@link bandSeed}).
 *
 * Pure: numbers in, a path string out. No DOM, no library.
 */

import type { Swipe } from "./ink.js";

/** How far an edge drifts from the pen's own edge, as a share of half the band. */
const DRIFT = 0.14;
/** How far apart the drift's turning points sit along the line, in page units. */
const DRIFT_STEP = 26;
/** The whole band's bow and tilt, as shares of half the band. */
const SAG = 0.12;
const TILT = 0.08;
/** How far each end leans off upright, as shares of half the band: a range, seeded. */
const SLANT_MIN = 0.08;
const SLANT_SPREAD = 0.12;
/** Spacing of the outline's points along an edge, in page units. */
const STEP = 8;

type Pt = readonly [number, number];

/** FNV-1a: a stable 32-bit number for a seed string. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A small seeded generator (mulberry32): the same seed, the same numbers. */
function seeded(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Smooth noise along a line, between -1 and 1: random heights every `step`
 * units, eased between them. A hand drifts; it does not jitter.
 */
function drift(r: () => number, from: number, to: number, step: number): (x: number) => number {
  const n = Math.ceil((to - from) / step) + 2;
  const k = Array.from({ length: n }, () => r() * 2 - 1);
  return (x) => {
    const u = (x - from) / step;
    const i = Math.max(0, Math.min(n - 2, Math.floor(u)));
    const w = (1 - Math.cos(Math.PI * (u - i))) / 2;
    return k[i]! * (1 - w) + k[i + 1]! * w;
  };
}

/**
 * The seed for a band: the page it is on and where it sits, to a hundredth of
 * a unit. Where, not what or when — the same verse lands in the same place on
 * every visit, so it gets the same hand, and nothing about the order marks were
 * drawn in can change it.
 */
export function bandSeed(page: number, s: Swipe): string {
  const r = (v: number) => Math.round(v * 100) / 100;
  return `p${page}:${r(s.x1)}:${r(s.x2)}:${r(s.y)}:${r(s.width)}`;
}

/**
 * The points the outline passes through, clockwise from the band's right-hand
 * top corner: along the top edge to the far end, down the far end, back along
 * the bottom edge. Exposed so the shape can be measured, not only drawn.
 */
export function roughBandOutline(s: Swipe, seed: string): Pt[] {
  const h = s.width / 2;
  const L = Math.min(s.x1, s.x2) - h;
  const R = Math.max(s.x1, s.x2) + h;
  const r = seeded(seed);
  const top = drift(r, L, R, DRIFT_STEP);
  const bottom = drift(r, L, R, DRIFT_STEP);
  const sag = (r() * 2 - 1) * h * SAG;
  const tilt = (r() * 2 - 1) * h * TILT;
  const startSlant = h * (SLANT_MIN + r() * SLANT_SPREAD);
  const endSlant = h * (SLANT_MIN + r() * SLANT_SPREAD);
  const a = DRIFT * h;
  // The band's own centreline: a slight bow and tilt across its length, measured
  // from the right, where the pen starts.
  const mid = (x: number) => {
    const t = (R - x) / (R - L || 1);
    return s.y + sag * Math.sin(Math.PI * t) + tilt * (t - 0.5);
  };

  const pts: Pt[] = [];
  // The top edge, right to left, stopping where the far end leans in.
  const topEnd = L + endSlant;
  for (let x = R; x > topEnd; x -= STEP) pts.push([x, mid(x) - h - a * top(x)]);
  pts.push([topEnd, mid(topEnd) - h - a * top(topEnd)]);
  // The far end: nearly upright, one point at its middle so the corner rounds
  // only a little.
  pts.push([L + endSlant * 0.35, mid(L)]);
  // The bottom edge, left to right, stopping where the tip landed.
  const bottomEnd = R - startSlant;
  for (let x = L; x < bottomEnd; x += STEP) pts.push([x, mid(x) + h + a * bottom(x)]);
  pts.push([bottomEnd, mid(bottomEnd) + h + a * bottom(bottomEnd)]);
  return pts;
}

const f2 = (v: number) => String(Math.round(v * 100) / 100);
const P = ([x, y]: Pt) => `${f2(x)} ${f2(y)}`;

/** A closed curve through the points (Catmull-Rom, written as cubic Béziers). */
function smooth(pts: readonly Pt[]): string {
  const n = pts.length;
  let d = `M${P(pts[0]!)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return `${d}Z`;
}

/** The rough band as an SVG path, ready for a `d` attribute. */
export function roughBandPath(s: Swipe, seed: string): string {
  return smooth(roughBandOutline(s, seed));
}
