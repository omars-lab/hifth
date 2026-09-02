/**
 * juz-detents (open decision, docs/decisions/page-bar.md §"When a reader lets go
 * near a marker"): when a reader releases the page bar near a juz marker, does the
 * bar pull the released page onto that juz's opening, or land under the thumb?
 *
 * Three interchangeable strategies, one per drawn option. They are real code, not a
 * mock: the winner graduates into `PageSlider`'s release handler (`commit()`) and
 * the losers are deleted — nothing throwaway the choice did not need. Until the
 * owner chooses, all three are mounted **live** on the decision page
 * (docs/design/page-bar-options.html), so the snap is felt rather than imagined.
 *
 * Each `resolve` is a **standalone, self-contained** function: it reads only its
 * arguments and touches no module-scope symbol, so the very same compiled source
 * runs in the app, in the unit test, and — inlined by the page builder — in the
 * reader's browser on the decision page. That is what makes "one component, used
 * live and in code" literally true rather than a claim about two copies.
 */

/** What a strategy needs to know to resolve a release. */
export interface DetentContext {
  /** Printed-page count the bar spans — 604 in the vendored build. */
  readonly total: number;
  /** The page each of the 30 juz opens on; `null` where the juz is unvendored. */
  readonly juzStarts: readonly (number | null)[];
  /** How many pages either side of a marker still pull onto it (option B). */
  readonly radius: number;
}

/** Where a release ends up, and whether a marker caught it. */
export interface Landing {
  /** The page the release lands on. */
  readonly page: number;
  /** Was the release pulled onto a marker rather than left under the thumb? */
  readonly pulled: boolean;
  /** The juz whose marker caught the release, when `pulled`; otherwise `null`. */
  readonly juz: number | null;
}

/** A · a marker only marks — the release lands exactly where the thumb is (today). */
export function resolveMarkOnly(asked: number, _ctx: DetentContext): Landing {
  return { page: asked, pulled: false, juz: null };
}

/**
 * B · a marker pulls, a few pages either side — a release within `radius` pages of
 * a juz opening lands on that opening, ties going to the nearer marker.
 */
export function resolvePullNearby(asked: number, ctx: DetentContext): Landing {
  let best = -1;
  let bestDist = Infinity;
  let bestJuz: number | null = null;
  for (let j = 0; j < ctx.juzStarts.length; j++) {
    const start = ctx.juzStarts[j];
    if (start === null || start === undefined) continue;
    const dist = Math.abs(start - asked);
    if (dist <= ctx.radius && dist < bestDist) {
      best = start;
      bestDist = dist;
      bestJuz = j + 1;
    }
  }
  if (best < 0) return { page: asked, pulled: false, juz: null };
  return { page: best, pulled: true, juz: bestJuz };
}

/** C · a marker is a button; the drag is unchanged — a release lands under the thumb. */
export function resolveTapButton(asked: number, _ctx: DetentContext): Landing {
  return { page: asked, pulled: false, juz: null };
}

/**
 * C's refinement (the owner's, 2026-09-02): a marker is a button, and it *grows as
 * the pointer approaches it* — so at rest it stays small and never eats the drag,
 * yet is easy to hit the moment you reach for it. Given the pointer's distance from
 * a marker along the bar, in pixels, return the factor to scale that marker by: `1`
 * at or beyond `near`, rising to `peak` under the pointer, eased (squared) so only
 * the last stretch of the approach is felt. The growth is a *hover* effect — while a
 * drag is under way the caller passes no proximity and every marker stays at `1`, so
 * it cannot touch the drag. A `near` of `0` turns the growth off entirely.
 */
export function markerEmphasis(distPx: number, near: number, peak: number): number {
  if (near <= 0 || !(distPx < near)) return 1;
  const t = 1 - distPx / near;
  return 1 + (peak - 1) * t * t;
}

/** A resolver plus how it presents itself, for the bar and the decision page. */
export interface DetentStrategy {
  readonly id: "A" | "B" | "C";
  readonly label: string;
  /** Whether the markers themselves are tap targets (only option C). */
  readonly tappableMarkers: boolean;
  /**
   * C only: how a tap target grows as the pointer nears it — `near` px of reach and
   * the `peak` factor under the pointer, fed to `markerEmphasis`. `null` where the
   * markers do not grow (A and B).
   */
  readonly emphasis: { readonly near: number; readonly peak: number } | null;
  resolve(asked: number, ctx: DetentContext): Landing;
}

export const markOnlyDetent: DetentStrategy = {
  id: "A",
  label: "A marker only marks",
  tappableMarkers: false,
  emphasis: null,
  resolve: resolveMarkOnly,
};

export const pullNearbyDetent: DetentStrategy = {
  id: "B",
  label: "A marker pulls, a few pages either side",
  tappableMarkers: false,
  emphasis: null,
  resolve: resolvePullNearby,
};

export const tapButtonDetent: DetentStrategy = {
  id: "C",
  label: "A marker is a button; the drag is unchanged",
  tappableMarkers: true,
  // Small at rest, growing to ~2.4x within a fingertip's reach of the pointer.
  emphasis: { near: 28, peak: 2.4 },
  resolve: resolveTapButton,
};

/** All three, in the order the decision page draws them. */
export const DETENT_STRATEGIES: readonly DetentStrategy[] = [
  markOnlyDetent,
  pullNearbyDetent,
  tapButtonDetent,
];
