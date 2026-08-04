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
 * - **Hold first, then it's a marquee.** A finger still inside the slop radius
 *   for {@link LONG_PRESS_MS} has, in hand terms, stopped moving; whatever it
 *   does next paints. This is the same heuristic the platform long-press uses,
 *   which is why it feels learnable rather than arbitrary.
 * - **…unless the hold began inside the ayah already selected ⇒ word.** Same
 *   hold, one bit of context: see {@link PointerSample.insideSelection}.
 * - **Move sideways first, across a page that fits ⇒ turn.** The one rule that
 *   needs to know something about the *page* as well as the hand; see
 *   {@link PointerSample.fitsAcross} for why that is not a layering violation.
 * - **Move first, otherwise ⇒ pan.** A finger that leaves {@link TAP_SLOP_PX}
 *   before {@link LONG_PRESS_MS} has elapsed is dragging the page — the common
 *   case, and it must feel instant (no hold, no delay, no hesitation).
 * - **Neither yet ⇒ tap.** Below both thresholds the gesture is still a tap, and
 *   releasing there is exactly the Loop-1 tap-to-select.
 *
 * The order of those two middle rules is the whole safety argument for adding a
 * fourth gesture to a surface that already had three: **the marquee is never at
 * risk.** A hafiz who presses and holds to paint is 350 ms into a hold before
 * the turn rule is consulted at all, and the turn rule requires movement
 * *before* the hold completes. The two cannot both be true of one stroke.
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

/**
 * How much more horizontal than vertical a stroke must be to mean a turn.
 *
 * **This number is a proposal, not a measurement**, and it is the same one
 * `page-turning.md` §4.2 states it as. 2:1 is the common default; nothing here
 * has been checked against a hand. What would settle it: record `dx`/`dy` at the
 * moment of latch across a set of real one-thumb strokes on a 390 px phone and
 * pick the ratio that separates an intentional sideways flick from the diagonal
 * drift of a thumb pivoting at the base of itself. Until then this is honest
 * about being a guess rather than dressed up as a threshold.
 */
export const TURN_AXIS_RATIO = 2;

/**
 * A stroke starting this close to either side of the screen is not a turn.
 *
 * iOS 13.4+ edge-gates `preventDefault` on Safari's interactive back gesture:
 * inside a ~24 px band at the screen edges the OS keeps the touch whatever the
 * page says. Under RTL the *forward* turn begins with a rightward movement,
 * which most naturally starts near the **left** edge — exactly that band. So a
 * turn that began there would be racing the history stack for the same finger,
 * and which one won would depend on how far the reader dragged
 * (`page-turning.md` §4.4).
 *
 * The mitigation is to decline, not to fight: a stroke inside the band latches
 * `"pan"` (a measured no-op horizontally at fit-zoom) and the OS keeps its
 * gesture. An app that eats the platform back gesture on an offline PWA is an
 * app the reader cannot leave. The cost is a thin strip down both sides, and it
 * costs nothing else, because the page bar's next/prev buttons remain the
 * guaranteed path (WCAG 2.5.1).
 *
 * Both edges, not just the left: the band is symmetric on the platform, and a
 * rule that guarded one side would be a rule that had quietly hard-coded which
 * direction the book runs.
 */
export const TURN_EDGE_GUARD_PX = 24;

/** What the hand is doing on the stage right now. */
export type PointerIntent = "none" | "tap" | "pan" | "marquee" | "pinch" | "turn" | "word";

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
  /**
   * Whether the page has any horizontal slack to roam over — `viewFitsAcross`
   * in `view.ts`, measured once per stroke by the caller.
   *
   * This is the only thing in this file that is not purely about the hand, and
   * it is here because the question the turn rule asks genuinely is *"is the
   * horizontal slot free?"*. At fit-zoom a horizontal drag changes the transform
   * by zero — measured: 150 px of drag at z = 1 on 390 × 844 moves the page not
   * at all — so binding a turn there takes nothing away from panning. Above
   * fit-zoom the drag is a real pan and the slot is occupied, so the turn must
   * not fire; the page bar is the path then, and it is on screen.
   *
   * **Optional, and it defaults to "no".** A caller that does not pass it gets
   * the three-gesture ladder exactly as it was, which is what keeps the wheel
   * path and every existing test honest rather than accidentally re-classified.
   */
  fitsAcross?: boolean;
  /**
   * How far the press point was from the *nearer* left/right screen edge, in
   * CSS px. Omitted means "not near an edge" — see {@link TURN_EDGE_GUARD_PX}
   * for what this guards and why declining is the right answer.
   */
  edgeDistancePx?: number;
  /**
   * Whether the press landed inside the ayah that is *already selected*.
   *
   * This is the one bit that separates the two things a completed hold can mean.
   * The gesture the reader chose (`docs/decisions/word-selection.md`) is: tap
   * selects an ayah exactly as it always did, and a second press — a hold, this
   * time inside what is already lit — drops a level, to the word under the
   * finger. Dragging from there extends word by word; Escape climbs back.
   *
   * **The honest cost, recorded rather than absorbed:** a reader can no longer
   * begin a multi-ayah marquee *from inside the ayah they currently have
   * selected*. The hold there now means word. Everywhere else on the page — and
   * everywhere at all when nothing is selected — the marquee is untouched, and
   * the workaround is the one a reader already performs without being taught it:
   * start the sweep a few millimetres outside the lit polygon.
   *
   * **Optional, and it defaults to "no",** exactly like {@link fitsAcross}: a
   * caller that never passes it gets the four-gesture ladder unchanged, which is
   * what keeps every existing test measuring what it was written to measure.
   */
  insideSelection?: boolean;
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
    if (held) return heldIntent(sample);
    return isTurnStroke(sample) ? "turn" : "pan";
  }
  // Still inside the slop radius: a completed hold arms the marquee; otherwise
  // this is still a tap and could become anything.
  return held ? heldIntent(sample) : "tap";
}

/**
 * What a completed hold means — the marquee, unless it began inside the ayah
 * already selected, in which case it drops to words. One function rather than
 * two branches so the two `held` arms above cannot drift apart: a hold that
 * completes before the finger moves and one that completes after must mean the
 * same thing, or a reader's stroke would depend on how still their hand was.
 */
function heldIntent(sample: PointerSample): PointerIntent {
  return sample.insideSelection ? "word" : "marquee";
}

/**
 * The turn rule's three conditions, all of which must hold, and only ever asked
 * of a stroke that has already moved and has not held.
 */
function isTurnStroke(sample: PointerSample): boolean {
  if (!sample.fitsAcross) return false;
  if ((sample.edgeDistancePx ?? Number.POSITIVE_INFINITY) <= TURN_EDGE_GUARD_PX) return false;
  return Math.abs(sample.dx) > TURN_AXIS_RATIO * Math.abs(sample.dy);
}

/**
 * Advance the latched intent for a gesture: call it every move frame with the
 * previous result. `pan`, `marquee` and `turn` are terminal for the gesture's
 * lifetime (a stroke never changes meaning halfway); `pinch` overrides anything
 * the moment a second finger lands, and lifting every pointer resets to `none`.
 *
 * A latched `"turn"` is what makes the diagonal case survivable. The axis test
 * is applied *once*, at the frame the stroke first clears the slop radius, and
 * from then on the reader may curve the stroke however a thumb curves without
 * the app changing its mind about what they meant. Re-deciding per frame would
 * make a turn flicker into a pan and back mid-drag — and a pan mid-turn is not
 * a harmless flicker, it is the page jumping under a finger that was moving the
 * fold.
 */
export function nextIntent(previous: PointerIntent, sample: PointerSample): PointerIntent {
  if (sample.pointers >= PINCH_POINTER_COUNT) return "pinch";
  if (sample.pointers <= 0) return "none";
  // A pinch that drops back to one finger stays a pinch: the leftover finger is
  // the tail of a zoom, not the start of a new pan across the page.
  if (previous === "pinch") return "pinch";
  if (previous === "pan" || previous === "marquee" || previous === "turn" || previous === "word")
    return previous;
  return pointerIntent(sample);
}

/** True when the intent paints a marquee rather than moving the page. */
export function isMarqueeIntent(intent: PointerIntent): boolean {
  return intent === "marquee";
}

/**
 * True when the finger is choosing words inside an ayah rather than sweeping
 * across ayahs.
 *
 * Deliberately *not* folded into {@link isMarqueeIntent}. The two share a
 * trigger and nothing else: a marquee resolves against ayah polygons the browser
 * measures, a word selection against boxes a shard vendored, and each paints
 * into its own highlighter group. A caller that treated them alike would ask the
 * page for the ayahs under a rectangle that only ever covers one.
 */
export function isWordIntent(intent: PointerIntent): boolean {
  return intent === "word";
}

/**
 * True when the intent should drive the pan/zoom transform.
 *
 * `"turn"` is deliberately not in this set, and it is the one line that keeps
 * `page-turning.md` §1.5's axiom true through the new gesture: during a turn no
 * glyph moves at all. The finger is dragging the fold — a third element that
 * carries no page — and if a turn also drove the viewport the reader would be
 * turning a page and panning it at the same time.
 */
export function isViewportIntent(intent: PointerIntent): boolean {
  return intent === "pan" || intent === "pinch";
}

/** True when the finger is dragging the fold across the leaf. */
export function isTurnIntent(intent: PointerIntent): boolean {
  return intent === "turn";
}

/**
 * How far across the stage a turn stroke must travel to commit on release.
 *
 * **Unmeasured, and `page-transition.md` §7 ⑥ answers the question of whether to
 * reopen it here: no.** 25 % is `page-turning.md` §4.3's number and it is
 * conventional rather than tested; what would settle it is a device pass on the
 * acceptance phone, which is the same pass {@link TURN_AXIS_RATIO} needs. It is
 * written as a fraction of the stage rather than as px on purpose — a 390 px
 * phone and a 1440 px desktop should ask for the same *proportion* of a shove,
 * not the same distance.
 */
export const TURN_COMMIT_FRACTION = 0.25;

/**
 * The flick that commits a turn the reader never dragged far enough for, in CSS
 * px per millisecond.
 *
 * Same standing as the fraction above: conventional, unmeasured, and named here
 * rather than buried so the device pass has something to correct. 0.5 px/ms is
 * ~500 px/s, comfortably above a slow deliberate drag and below the speed of a
 * dismissive flick.
 *
 * It exists because distance alone gets the *fast* reader wrong: a hafiz walking
 * the book flicks short and quick, and a rule that only measured displacement
 * would spring back on the stroke they meant most decisively.
 */
export const TURN_FLICK_PX_PER_MS = 0.5;

/** A released turn stroke, reduced to what the commit rule may look at. */
export interface TurnStroke {
  /** Signed horizontal displacement from the press point at release, CSS px. */
  dx: number;
  /** Signed horizontal velocity at release, CSS px per ms. */
  velocityX: number;
  /** The stage the stroke crossed, CSS px — the fraction is taken of this. */
  stageWidth: number;
}

/**
 * Decide what a released turn stroke meant: `1` for the next page, `-1` for the
 * previous, `0` to spring back and turn nothing.
 *
 * **Direction is `loop-1.md`'s, and it is a fact about the book:** a finger
 * moving *rightward* advances to the next page, because in a bound mus'haf that
 * is the direction a leaf travels when you turn it forward. It does not flip
 * with the UI language — the same reason `sweepOf` reads physical px and not
 * logical ones — and it agrees with `nextWheelTurn`'s sign convention, where
 * `1` is likewise the next page.
 *
 * The velocity clause requires the flick to agree with the displacement. A
 * stroke that went one way and snapped back the other at the last moment has
 * had the reader change their mind mid-gesture; committing it in the direction
 * of the *snap* would turn a page they were in the middle of not turning.
 */
export function turnCommit(stroke: TurnStroke): 1 | -1 | 0 {
  if (stroke.dx === 0) return 0;
  const dir: 1 | -1 = stroke.dx > 0 ? 1 : -1;
  const far = Math.abs(stroke.dx) >= TURN_COMMIT_FRACTION * stroke.stageWidth;
  const flicked =
    Math.abs(stroke.velocityX) >= TURN_FLICK_PX_PER_MS && Math.sign(stroke.velocityX) === dir;
  return far || flicked ? dir : 0;
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
