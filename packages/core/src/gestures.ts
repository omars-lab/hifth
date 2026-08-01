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
 * A desktop adds a fourth input to the same surface — the **wheel**, which
 * turns pages. It is not a pointer and gets its own rule at the foot of this
 * file, but it is here rather than in a file of its own for the reason above:
 * it is the same question (*what did that movement mean?*) asked of a different
 * device, and the answer has to be as testable without hardware as the rest.
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

/*
 * ---------------------------------------------------------------------------
 * The wheel — `page-turning.md` §7 ③, shaped by `page-transition.md` §3.2 ④.
 *
 * Plain wheel over the stage used to do nothing at all, which on a desktop is
 * the one input a reader reaches for without being told. It turns pages. The
 * requirement §3.2 ④ states is *discrete and debounced — one turn per gesture,
 * not per event*, and it rules out the obvious implementation: a scroll-snap
 * container needs `scrollLeft`, whose sign convention under RTL is not portable
 * (§2.6), and a momentum scroll over 604 pages would mount an unbounded number
 * of leaves (`backlog.md` ③).
 *
 * So the wheel is classified the same way the hand is, and for the same reason
 * the rest of this file exists: the rule is time and distance only, it is pure,
 * and every boundary is a unit test rather than a trackpad in someone's hand.
 * ---------------------------------------------------------------------------
 */

/**
 * A quiet this long ends the gesture and re-arms the turn.
 *
 * This single number is what separates a mouse from a trackpad, and it is the
 * only honest discriminator available — a `wheel` event does not say which
 * device produced it. A trackpad (and the momentum tail that outlives the
 * fingers) streams at frame rate, ~16 ms apart, so it never opens a gap this
 * wide and the whole flick counts as **one** gesture. A mouse notch is a
 * discrete flick of a finger, rarely repeated faster than this, so each notch
 * is its own gesture and turns its own page.
 *
 * The failure mode if it is set too low is a momentum tail turning three pages
 * after the hand has stopped, which is exactly the unbounded mounting §3.2 ④
 * rejects scroll-snap for.
 */
export const WHEEL_GAP_MS = 100;

/**
 * Accumulated wheel movement (normalized px, see {@link normalizeWheelDelta})
 * before a gesture turns a page.
 *
 * One mouse notch is 100 px in a pixel-mode browser, so a notch clears this
 * comfortably and turns exactly one page. A trackpad crosses it a few frames
 * into a deliberate two-finger push, and never on the stray one-pixel drift a
 * resting hand produces.
 */
export const WHEEL_TURN_PX = 40;

/** A wheel notch in line mode, in px. Matches @use-gesture's own constant. */
const WHEEL_LINE_HEIGHT = 40;

/** A wheel notch in page mode, in px. Matches @use-gesture's own constant. */
const WHEEL_PAGE_HEIGHT = 800;

/** One wheel event, reduced to what the turn rule may look at. */
export interface WheelSample {
  /** `WheelEvent.deltaY`, in whatever unit `deltaMode` names. */
  deltaY: number;
  /** `WheelEvent.deltaMode`: 0 = px, 1 = lines, 2 = pages. */
  deltaMode: number;
  /** `WheelEvent.timeStamp`, or any monotonic ms clock. */
  timeStamp: number;
}

/** How far this event scrolled, in px, whatever unit it arrived in. */
export function normalizeWheelDelta(sample: Pick<WheelSample, "deltaY" | "deltaMode">): number {
  if (sample.deltaMode === 1) return sample.deltaY * WHEEL_LINE_HEIGHT;
  if (sample.deltaMode === 2) return sample.deltaY * WHEEL_PAGE_HEIGHT;
  return sample.deltaY;
}

/**
 * What the wheel has accumulated so far. Opaque to callers; hand it back.
 * {@link WHEEL_TURN_REST} is the value to start from.
 */
export interface WheelTurnState {
  /** Normalized px accumulated in this gesture, signed. */
  readonly travel: number;
  /** `timeStamp` of the last event seen, for the gap test. */
  readonly at: number;
  /** False once this gesture has spent its turn; a gap re-arms it. */
  readonly armed: boolean;
}

/** The resting state — no gesture in progress. */
export const WHEEL_TURN_REST: WheelTurnState = { travel: 0, at: -Infinity, armed: true };

/**
 * Advance the wheel accumulator by one event and say whether to turn a page.
 *
 * `step` is `1` for the next page and `-1` for the previous. Scrolling **down**
 * goes forward — the direction a reader's hand means by "onward" on every other
 * surface they use — and note this is deliberately not the RTL question the
 * arrow keys had to answer: down is down in both directions of script, which is
 * a large part of why the vertical axis is the one bound here.
 *
 * `deltaX` is deliberately not an input. A two-finger horizontal swipe is the
 * *browser's* back/forward gesture on macOS, and a page turn bound to it would
 * be racing the history stack for the same fingers — the reader would sometimes
 * leave the app instead of turning a leaf, and which one happened would depend
 * on how far they swiped.
 */
export function nextWheelTurn(
  previous: WheelTurnState,
  sample: WheelSample,
): { state: WheelTurnState; step: 1 | -1 | 0 } {
  const quiet = sample.timeStamp - previous.at >= WHEEL_GAP_MS;
  // A gap means the hand let go: whatever was accumulating is abandoned rather
  // than added to, so two flicks in opposite directions cannot cancel out and a
  // gesture never inherits the tail of the one before it.
  const travel = (quiet ? 0 : previous.travel) + normalizeWheelDelta(sample);
  const armed = quiet || previous.armed;
  const at = sample.timeStamp;

  if (!armed || Math.abs(travel) < WHEEL_TURN_PX) {
    return { state: { travel, at, armed }, step: 0 };
  }
  // Spent. `travel` resets so the momentum tail accumulates against a fresh
  // zero, but `armed` stays false until a gap, so the tail can never spend it.
  return { state: { travel: 0, at, armed: false }, step: travel > 0 ? 1 : -1 };
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
