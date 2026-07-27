/**
 * gestures.ts — the pointer-intent splitter for the stage (PLAN §3, spec §9).
 *
 * One surface carries three gestures: **pan** the page, **pinch** to zoom, and
 * **marquee** to paint a highlight across a passage. Nothing in the DOM tells
 * them apart — they all start as a finger on the same pixels — so the split has
 * to be a decision about *how the hand moved*, made from pointer count, elapsed
 * time and distance alone. That decision lives here: DOM-free, framework-free,
 * pure, so every boundary is a unit test instead of a phone in someone's hand.
 *
 * The rules, in the order the hand performs them:
 *
 * - **Two pointers down ⇒ pinch.** Always, immediately, whatever came before.
 *   @use-gesture does not disambiguate for us (research §4): the stage checks
 *   `pinching` and cancels the drag, and this classifier says the same thing so
 *   the two never disagree.
 * - **Move first, then it's a pan.** A finger that leaves {@link TAP_SLOP_PX}
 *   before {@link LONG_PRESS_MS} has elapsed is dragging the page — the common
 *   case, and it must feel instant (no hold, no delay, no hesitation).
 * - **Hold first, then it's a marquee.** A finger still inside the slop radius
 *   for {@link LONG_PRESS_MS} has, in hand terms, stopped moving; whatever it
 *   does next paints. This is the same heuristic the platform long-press uses,
 *   which is why it feels learnable rather than arbitrary.
 * - **Neither yet ⇒ tap.** Below both thresholds the gesture is still a tap, and
 *   releasing there is exactly the Loop-1 tap-to-select.
 *
 * The classification is *latched* by {@link nextIntent}: the first frame that
 * resolves to pan or marquee owns the rest of the gesture. Without latching a
 * slow pan would flip to marquee the moment it paused, and a marquee would flip
 * to pan the moment it sped up — the gesture would change meaning mid-stroke.
 *
 * Note what is *not* an input here: `prefers-reduced-motion`. Reduced motion
 * shortens animation (tokens set `--dur-hop: 0`), but a hold is a hold and a
 * drag is a drag; changing the thresholds would change what the user's hand
 * *means*, not how fast we draw it. The thresholds are time and distance only.
 */

import type { Rect } from "./highlighter.js";

/**
 * Hold this long without leaving the slop radius and the next movement paints a
 * marquee instead of panning. 350 ms sits below the platform long-press (iOS
 * ~500 ms, Android ~400 ms) on purpose: the competing gesture — pan — latches on
 * the *first* pixel of movement, so arming the marquee early costs a pan
 * nothing, while a longer hold would make highlighting feel like it stalls.
 */
export const LONG_PRESS_MS = 350;

/**
 * Movement below this (CSS px, straight-line from the press point) is "still".
 * 8 px matches Android's `ViewConfiguration` touch slop — the distance a finger
 * wanders while a hand *thinks* it is holding perfectly still.
 */
export const TAP_SLOP_PX = 8;

/** Two pointers on the stage means pinch-zoom, never pan and never marquee. */
export const PINCH_POINTER_COUNT = 2;

/** What the hand is doing on the stage right now. */
export type PointerIntent = "none" | "tap" | "pan" | "marquee" | "pinch";

/** One frame of pointer state — everything the split is allowed to look at. */
export interface PointerSample {
  /** Pointers currently down on the stage. */
  pointers: number;
  /** Milliseconds since the gesture's first pointerdown. */
  elapsedMs: number;
  /** Movement from the press point, in CSS px. */
  dx: number;
  /** Movement from the press point, in CSS px. */
  dy: number;
}

/** Straight-line movement from the press point (CSS px). */
export function movementDistance(sample: Pick<PointerSample, "dx" | "dy">): number {
  return Math.hypot(sample.dx, sample.dy);
}

/**
 * Classify a single frame in isolation — what this sample, on its own, looks
 * like. Callers that need gesture-lifetime stability want {@link nextIntent},
 * which latches this result; this one is the pure rule table underneath.
 */
export function pointerIntent(sample: PointerSample): PointerIntent {
  if (sample.pointers >= PINCH_POINTER_COUNT) return "pinch";
  if (sample.pointers <= 0) return "none";
  const moved = movementDistance(sample);
  const held = sample.elapsedMs >= LONG_PRESS_MS;
  if (moved > TAP_SLOP_PX) {
    // Moved decisively: which happened first, the hold or the movement?
    return held ? "marquee" : "pan";
  }
  // Still inside the slop radius: a completed hold arms the marquee; otherwise
  // this is still a tap and could become anything.
  return held ? "marquee" : "tap";
}

/**
 * Advance the latched intent for a gesture: call it every move frame with the
 * previous result. `pan` and `marquee` are terminal for the gesture's lifetime
 * (a stroke never changes meaning halfway); `pinch` overrides anything the
 * moment a second finger lands, and lifting every pointer resets to `none`.
 */
export function nextIntent(previous: PointerIntent, sample: PointerSample): PointerIntent {
  if (sample.pointers >= PINCH_POINTER_COUNT) return "pinch";
  if (sample.pointers <= 0) return "none";
  // A pinch that drops back to one finger stays a pinch: the leftover finger is
  // the tail of a zoom, not the start of a new pan across the page.
  if (previous === "pinch") return "pinch";
  if (previous === "pan" || previous === "marquee") return previous;
  return pointerIntent(sample);
}

/** True when the intent paints a marquee rather than moving the page. */
export function isMarqueeIntent(intent: PointerIntent): boolean {
  return intent === "marquee";
}

/** True when the intent should drive the pan/zoom transform. */
export function isViewportIntent(intent: PointerIntent): boolean {
  return intent === "pan" || intent === "pinch";
}

/**
 * The rectangle spanned by two points, normalized so width/height are never
 * negative — a marquee dragged up-and-left is the same rectangle as one dragged
 * down-and-right. Units are the caller's (the stage passes SVG user units, so
 * the rect can be intersected against polygon bboxes directly).
 */
export function marqueeRect(
  from: { x: number; y: number },
  to: { x: number; y: number },
): Rect {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  return { x, y, width: Math.abs(to.x - from.x), height: Math.abs(to.y - from.y) };
}
