import { describe, expect, it } from "vitest";
import {
  LONG_PRESS_MS,
  WHEEL_GAP_MS,
  WHEEL_TURN_PX,
  WHEEL_TURN_REST,
  normalizeWheelDelta,
  nextWheelTurn,
  type WheelTurnState,
  PINCH_POINTER_COUNT,
  TAP_SLOP_PX,
  isMarqueeIntent,
  isTurnIntent,
  isViewportIntent,
  marqueeRect,
  movementDistance,
  nextIntent,
  pointerIntent,
  TURN_AXIS_RATIO,
  TURN_COMMIT_FRACTION,
  TURN_EDGE_GUARD_PX,
  TURN_FLICK_PX_PER_MS,
  turnCommit,
  type PointerIntent,
  type PointerSample,
} from "./gestures.js";

/** A one-finger sample; every field defaulted to "just pressed, hasn't moved". */
function sample(over: Partial<PointerSample> = {}): PointerSample {
  return { pointers: 1, elapsedMs: 0, dx: 0, dy: 0, ...over };
}

describe("pointerIntent · pointer count", () => {
  it("no pointers down is no gesture", () => {
    expect(pointerIntent(sample({ pointers: 0 }))).toBe("none");
    // Even with movement and time on the clock — a lifted hand means nothing.
    expect(pointerIntent(sample({ pointers: 0, elapsedMs: 9999, dx: 400 }))).toBe("none");
  });

  it("two pointers is a pinch, whatever the time or distance says", () => {
    expect(pointerIntent(sample({ pointers: PINCH_POINTER_COUNT }))).toBe("pinch");
    // A frame that would otherwise read as a pan…
    expect(pointerIntent(sample({ pointers: 2, elapsedMs: 20, dx: 100 }))).toBe("pinch");
    // …and one that would otherwise read as a marquee.
    expect(pointerIntent(sample({ pointers: 2, elapsedMs: 2000, dx: 100 }))).toBe("pinch");
  });

  it("three or more pointers is still a pinch (palm on the glass)", () => {
    expect(pointerIntent(sample({ pointers: 3, elapsedMs: 500, dx: 50 }))).toBe("pinch");
  });
});

describe("pointerIntent · the hold threshold", () => {
  it("just under the long press, still inside slop, is a tap", () => {
    expect(pointerIntent(sample({ elapsedMs: LONG_PRESS_MS - 1 }))).toBe("tap");
  });

  it("exactly at the long press arms the marquee (threshold is inclusive)", () => {
    expect(pointerIntent(sample({ elapsedMs: LONG_PRESS_MS }))).toBe("marquee");
  });

  it("just over the long press, still inside slop, is an armed marquee", () => {
    expect(pointerIntent(sample({ elapsedMs: LONG_PRESS_MS + 1 }))).toBe("marquee");
  });
});

describe("pointerIntent · the slop threshold", () => {
  it("exactly at slop is still a tap (threshold is exclusive)", () => {
    expect(pointerIntent(sample({ elapsedMs: 20, dx: TAP_SLOP_PX }))).toBe("tap");
  });

  it("just over slop before the hold completes is a pan", () => {
    expect(pointerIntent(sample({ elapsedMs: 20, dx: TAP_SLOP_PX + 0.01 }))).toBe("pan");
  });

  it("just under slop before the hold completes is still a tap", () => {
    expect(pointerIntent(sample({ elapsedMs: 20, dx: TAP_SLOP_PX - 0.01 }))).toBe("tap");
  });

  it("measures movement as a straight line, not per axis", () => {
    // 6+6 per axis is under slop on each but 8.49 px of actual travel.
    expect(movementDistance({ dx: 6, dy: 6 })).toBeCloseTo(8.485, 3);
    expect(pointerIntent(sample({ elapsedMs: 20, dx: 6, dy: 6 }))).toBe("pan");
    // …while 5+5 (7.07 px) has not left the finger's own wobble.
    expect(pointerIntent(sample({ elapsedMs: 20, dx: 5, dy: 5 }))).toBe("tap");
  });

  it("negative movement counts the same as positive (direction is irrelevant)", () => {
    expect(pointerIntent(sample({ elapsedMs: 20, dx: -(TAP_SLOP_PX + 1) }))).toBe("pan");
  });
});

describe("pointerIntent · the pan/marquee split", () => {
  it("move first, then it is a pan", () => {
    expect(pointerIntent(sample({ elapsedMs: LONG_PRESS_MS - 1, dx: 40 }))).toBe("pan");
  });

  it("hold first, then move, and it is a marquee", () => {
    expect(pointerIntent(sample({ elapsedMs: LONG_PRESS_MS + 1, dx: 40 }))).toBe("marquee");
  });

  it("the two thresholds are independent — both boundaries in one table", () => {
    const cases: Array<[number, number, PointerIntent]> = [
      [LONG_PRESS_MS - 1, TAP_SLOP_PX - 1, "tap"],
      [LONG_PRESS_MS - 1, TAP_SLOP_PX + 1, "pan"],
      [LONG_PRESS_MS + 1, TAP_SLOP_PX - 1, "marquee"],
      [LONG_PRESS_MS + 1, TAP_SLOP_PX + 1, "marquee"],
    ];
    for (const [elapsedMs, dx, expected] of cases) {
      expect(pointerIntent(sample({ elapsedMs, dx }))).toBe(expected);
    }
  });
});

describe("nextIntent · latching", () => {
  it("a pan stays a pan even when the finger stops long enough to be a hold", () => {
    let intent = nextIntent("none", sample({ elapsedMs: 30, dx: 20 }));
    expect(intent).toBe("pan");
    // The user drags, then rests mid-page: the stroke must not become a marquee.
    intent = nextIntent(intent, sample({ elapsedMs: LONG_PRESS_MS * 3, dx: 20 }));
    expect(intent).toBe("pan");
  });

  it("a marquee stays a marquee even when the finger later races", () => {
    let intent = nextIntent("none", sample({ elapsedMs: LONG_PRESS_MS + 5 }));
    expect(intent).toBe("marquee");
    intent = nextIntent(intent, sample({ elapsedMs: LONG_PRESS_MS + 6, dx: 300 }));
    expect(intent).toBe("marquee");
  });

  it("a tap is not latched — it is the undecided state", () => {
    let intent = nextIntent("none", sample({ elapsedMs: 10, dx: 2 }));
    expect(intent).toBe("tap");
    intent = nextIntent(intent, sample({ elapsedMs: 40, dx: 30 }));
    expect(intent).toBe("pan");
  });

  it("a second finger takes over an in-flight pan", () => {
    const panning = nextIntent("none", sample({ elapsedMs: 30, dx: 20 }));
    expect(nextIntent(panning, sample({ pointers: 2, elapsedMs: 60, dx: 20 }))).toBe("pinch");
  });

  it("a second finger takes over an in-flight marquee too", () => {
    const painting = nextIntent("none", sample({ elapsedMs: LONG_PRESS_MS, dx: 30 }));
    expect(painting).toBe("marquee");
    expect(nextIntent(painting, sample({ pointers: 2, elapsedMs: 400 }))).toBe("pinch");
  });

  it("lifting one finger from a pinch does not start a pan", () => {
    const pinching = nextIntent("none", sample({ pointers: 2, elapsedMs: 40 }));
    expect(nextIntent(pinching, sample({ pointers: 1, elapsedMs: 80, dx: 60 }))).toBe("pinch");
  });

  it("lifting every finger resets the gesture", () => {
    const panning = nextIntent("none", sample({ elapsedMs: 30, dx: 20 }));
    const released = nextIntent(panning, sample({ pointers: 0, elapsedMs: 90, dx: 20 }));
    expect(released).toBe("none");
    // …and the next press starts undecided again.
    expect(nextIntent(released, sample({ elapsedMs: 5 }))).toBe("tap");
  });
});

describe("intent predicates", () => {
  it("only a marquee paints; only pan/pinch move the viewport; only a turn turns", () => {
    const all: PointerIntent[] = ["none", "tap", "pan", "marquee", "pinch", "turn"];
    expect(all.filter(isMarqueeIntent)).toEqual(["marquee"]);
    expect(all.filter(isViewportIntent)).toEqual(["pan", "pinch"]);
    expect(all.filter(isTurnIntent)).toEqual(["turn"]);
  });

  it("a turn is NOT a viewport intent — during a turn no glyph moves", () => {
    // The single line that keeps page-turning.md §1.5's axiom true through the
    // fourth gesture. If `turn` ever joined this set the reader would be
    // dragging the fold and panning the page it crosses at the same time.
    expect(isViewportIntent("turn")).toBe(false);
  });
});

/**
 * A stroke that has cleared the slop radius, has not held, and is happening on
 * a page with no horizontal slack — i.e. everything rule 3 needs *except* the
 * axis ratio, which each test supplies.
 */
function turnable(over: Partial<PointerSample> = {}): PointerSample {
  return sample({ elapsedMs: 40, fitsAcross: true, edgeDistancePx: 200, ...over });
}

describe("pointerIntent · the turn rule (page-turning.md §4.2)", () => {
  it("a sideways stroke across a page that fits is a turn", () => {
    expect(pointerIntent(turnable({ dx: 60, dy: 4 }))).toBe("turn");
  });

  it("the same stroke on a page with room to roam is a pan", () => {
    // Above fit-zoom the horizontal slot is occupied by a real pan, and the page
    // bar is the path to a turn. This is the whole gate.
    expect(pointerIntent(turnable({ dx: 60, dy: 4, fitsAcross: false }))).toBe("pan");
  });

  it("omitting fitsAcross leaves the old three-gesture ladder exactly as it was", () => {
    // Every caller that predates the turn — and every test above — passes
    // neither new field. They must classify identically.
    expect(pointerIntent(sample({ elapsedMs: 40, dx: 60 }))).toBe("pan");
  });

  it("a hold beats a turn, whatever the stroke does next", () => {
    // The marquee-is-never-at-risk argument, asserted rather than reasoned: by
    // the time the hold has completed, rule 2 has already answered.
    expect(pointerIntent(turnable({ elapsedMs: LONG_PRESS_MS, dx: 200, dy: 0 }))).toBe("marquee");
  });

  it("two fingers beat a turn", () => {
    expect(pointerIntent(turnable({ pointers: 2, dx: 200, dy: 0 }))).toBe("pinch");
  });

  it("the axis ratio: the boundary, either side of it, and both directions", () => {
    const dy = 10;
    const edge = TURN_AXIS_RATIO * dy;
    // Strictly greater — exactly 2:1 is not decisive enough.
    expect(pointerIntent(turnable({ dx: edge, dy }))).toBe("pan");
    expect(pointerIntent(turnable({ dx: edge + 1, dy }))).toBe("turn");
    // Direction is irrelevant to the *classification* (it decides which way to
    // turn, not whether). Both signs of both axes.
    expect(pointerIntent(turnable({ dx: -(edge + 1), dy }))).toBe("turn");
    expect(pointerIntent(turnable({ dx: edge + 1, dy: -dy }))).toBe("turn");
  });

  it("a mostly-vertical stroke on a fitting page is still a pan", () => {
    // A phone that overflows vertically has a live vertical pan at fit-zoom, and
    // this is the case that must keep working: fitsAcross is true and the finger
    // is carrying the foot of the page.
    expect(pointerIntent(turnable({ dx: 10, dy: 60 }))).toBe("pan");
  });

  it("the iOS edge band declines the turn rather than fighting the OS", () => {
    const stroke = { dx: 60, dy: 0 };
    expect(pointerIntent(turnable({ ...stroke, edgeDistancePx: TURN_EDGE_GUARD_PX }))).toBe("pan");
    expect(pointerIntent(turnable({ ...stroke, edgeDistancePx: TURN_EDGE_GUARD_PX + 1 }))).toBe(
      "turn",
    );
  });

  it("an omitted edge distance means 'not near an edge'", () => {
    // A caller that cannot measure the screen (a spread panel, a test) must not
    // silently lose the gesture; the guard is opt-in the same way fitsAcross is.
    expect(pointerIntent(sample({ elapsedMs: 40, dx: 60, fitsAcross: true }))).toBe("turn");
  });
});

describe("nextIntent · a turn is latched like the rest", () => {
  it("a turn stays a turn once the thumb starts curving", () => {
    // Real thumbs pivot. The axis test is applied once, at the frame the stroke
    // clears slop; after that the reader may curve it into a hook and the app
    // must not change its mind — a pan mid-turn is the page jumping under a
    // finger that was moving the fold.
    let intent = nextIntent("none", turnable({ dx: 30, dy: 2 }));
    expect(intent).toBe("turn");
    intent = nextIntent(intent, turnable({ elapsedMs: 200, dx: 40, dy: 90 }));
    expect(intent).toBe("turn");
  });

  it("a turn does not become a marquee when the finger pauses mid-drag", () => {
    let intent = nextIntent("none", turnable({ dx: 30, dy: 0 }));
    expect(intent).toBe("turn");
    intent = nextIntent(intent, turnable({ elapsedMs: LONG_PRESS_MS * 4, dx: 30, dy: 0 }));
    expect(intent).toBe("turn");
  });

  it("a second finger takes over an in-flight turn", () => {
    const turning = nextIntent("none", turnable({ dx: 30, dy: 0 }));
    expect(nextIntent(turning, turnable({ pointers: 2, dx: 30 }))).toBe("pinch");
  });

  it("lifting every finger ends the turn", () => {
    const turning = nextIntent("none", turnable({ dx: 30, dy: 0 }));
    expect(nextIntent(turning, turnable({ pointers: 0, dx: 30 }))).toBe("none");
  });

  it("a latched pan is never re-opened as a turn", () => {
    // The reader started by dragging the page vertically; the stroke is spoken
    // for. Curving it sideways later must not turn a page under them.
    let intent = nextIntent("none", turnable({ dx: 2, dy: 40 }));
    expect(intent).toBe("pan");
    intent = nextIntent(intent, turnable({ elapsedMs: 120, dx: 200, dy: 40 }));
    expect(intent).toBe("pan");
  });
});

describe("turnCommit · what a released stroke meant (page-turning.md §4.3)", () => {
  const STAGE = 390;
  const slow = (dx: number) => turnCommit({ dx, velocityX: 0, stageWidth: STAGE });

  it("rightward is the next page, leftward the previous — loop-1.md's book direction", () => {
    expect(slow(STAGE * 0.5)).toBe(1);
    expect(slow(-STAGE * 0.5)).toBe(-1);
  });

  it("agrees with the wheel's sign convention: 1 is always the next page", () => {
    const byWheel = nextWheelTurn(WHEEL_TURN_REST, { deltaY: 200, deltaMode: 0, timeStamp: 1000 });
    expect(byWheel.step).toBe(1);
    expect(slow(STAGE * 0.5)).toBe(byWheel.step);
  });

  it("the distance boundary is inclusive, and it is a fraction of the stage", () => {
    const edge = TURN_COMMIT_FRACTION * STAGE;
    expect(slow(edge)).toBe(1);
    expect(slow(edge - 1)).toBe(0);
    // Same proportion of a wider stage asks for more px, which is the point of
    // expressing it as a fraction rather than as a distance.
    expect(turnCommit({ dx: edge, velocityX: 0, stageWidth: 1440 })).toBe(0);
  });

  it("a short quick flick commits where a short slow drag springs back", () => {
    const short = 20;
    expect(slow(short)).toBe(0);
    expect(turnCommit({ dx: short, velocityX: TURN_FLICK_PX_PER_MS, stageWidth: STAGE })).toBe(1);
    expect(turnCommit({ dx: short, velocityX: TURN_FLICK_PX_PER_MS - 0.01, stageWidth: STAGE })).toBe(
      0,
    );
  });

  it("a flick that disagrees with the drag does not commit the flick's direction", () => {
    // The reader pushed right, changed their mind, and snapped back left. The
    // gesture they finished is 'not this one', and turning the previous page
    // would be the app finishing a sentence they stopped saying.
    expect(turnCommit({ dx: 30, velocityX: -2, stageWidth: STAGE })).toBe(0);
  });

  it("a long drag commits even when the finger stopped dead before release", () => {
    expect(turnCommit({ dx: STAGE * 0.4, velocityX: 0, stageWidth: STAGE })).toBe(1);
  });

  it("a stroke with no horizontal displacement turns nothing", () => {
    expect(turnCommit({ dx: 0, velocityX: 5, stageWidth: STAGE })).toBe(0);
  });
});

describe("thresholds are motion-preference independent", () => {
  it("classifies identically under a reduced-motion environment", () => {
    // The module is DOM-free by design, so there is nothing for a media query to
    // reach. Pin that: install a matchMedia that reports reduced motion for
    // everything and assert the whole boundary table is unchanged. Reduced
    // motion shortens animation — it must never redefine what a hold means.
    const g = globalThis as { matchMedia?: unknown };
    const original = g.matchMedia;
    g.matchMedia = () => ({ matches: true, media: "(prefers-reduced-motion: reduce)" });
    try {
      expect(pointerIntent(sample({ elapsedMs: LONG_PRESS_MS - 1 }))).toBe("tap");
      expect(pointerIntent(sample({ elapsedMs: LONG_PRESS_MS }))).toBe("marquee");
      expect(pointerIntent(sample({ elapsedMs: 20, dx: TAP_SLOP_PX + 1 }))).toBe("pan");
      expect(pointerIntent(sample({ pointers: 2 }))).toBe("pinch");
      expect(LONG_PRESS_MS).toBe(350);
      expect(TAP_SLOP_PX).toBe(8);
    } finally {
      if (original === undefined) delete g.matchMedia;
      else g.matchMedia = original;
    }
  });
});

describe("marqueeRect", () => {
  it("normalizes a rectangle dragged down-and-right", () => {
    expect(marqueeRect({ x: 10, y: 20 }, { x: 40, y: 60 })).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });
  });

  it("normalizes a rectangle dragged up-and-left to the same rect", () => {
    expect(marqueeRect({ x: 40, y: 60 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });
  });

  it("handles the RTL case: dragging leftwards across a line", () => {
    // On a mushaf the hand sweeps right→left; width must stay positive.
    expect(marqueeRect({ x: 300, y: 100 }, { x: 120, y: 118 })).toEqual({
      x: 120,
      y: 100,
      width: 180,
      height: 18,
    });
  });

  it("a press with no drag is a degenerate (zero-size) rect, not a negative one", () => {
    expect(marqueeRect({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({
      x: 5,
      y: 5,
      width: 0,
      height: 0,
    });
  });
});

describe("the wheel — one turn per gesture (§7 ③, page-transition §3.2 ④)", () => {
  /** Feed a whole gesture and collect the turns it produced. */
  const play = (
    events: ReadonlyArray<{ deltaY: number; timeStamp: number; deltaMode?: number }>,
    from: WheelTurnState = WHEEL_TURN_REST,
  ): { steps: number[]; state: WheelTurnState } => {
    let state = from;
    const steps: number[] = [];
    for (const e of events) {
      const out = nextWheelTurn(state, { deltaMode: 0, ...e });
      state = out.state;
      if (out.step !== 0) steps.push(out.step);
    }
    return { steps, state };
  };

  it("turns forward on a scroll down and back on a scroll up", () => {
    expect(play([{ deltaY: 100, timeStamp: 0 }]).steps).toEqual([1]);
    expect(play([{ deltaY: -100, timeStamp: 0 }]).steps).toEqual([-1]);
  });

  it("ignores movement under the threshold — a resting hand drifts", () => {
    const gentle = Array.from({ length: 5 }, (_, i) => ({ deltaY: 4, timeStamp: i * 16 }));
    expect(play(gentle).steps).toEqual([]);
  });

  it("turns exactly one page for a trackpad flick, momentum and all", () => {
    // The whole point of the debounce. A flick is ~15 frames of real movement
    // followed by a decaying tail that can outlive the fingers by a second; per
    // event this would be dozens of turns, which is the unbounded mounting
    // §3.2 ④ rejects scroll-snap for.
    const flick = [
      ...Array.from({ length: 15 }, (_, i) => ({ deltaY: 12, timeStamp: i * 16 })),
      ...Array.from({ length: 40 }, (_, i) => ({ deltaY: 12 * 0.9 ** i, timeStamp: 240 + i * 16 })),
    ];
    expect(play(flick).steps).toEqual([1]);
  });

  it("turns once per mouse notch, because a notch opens a gap a stream never does", () => {
    // WHEEL_GAP_MS is the only discriminator available: a wheel event does not
    // say which device sent it.
    const notches = [0, 150, 300, 450].map((timeStamp) => ({ deltaY: 100, timeStamp }));
    expect(play(notches).steps).toEqual([1, 1, 1, 1]);
  });

  it("abandons a gesture's travel at the gap instead of carrying it over", () => {
    // Two sub-threshold nudges either side of a pause must not add up into a
    // turn the reader never asked for.
    const nudge = WHEEL_TURN_PX - 1;
    expect(
      play([
        { deltaY: nudge, timeStamp: 0 },
        { deltaY: nudge, timeStamp: WHEEL_GAP_MS },
      ]).steps,
    ).toEqual([]);
  });

  it("cannot be spent twice by one gesture, however far it goes", () => {
    const shove = Array.from({ length: 30 }, (_, i) => ({ deltaY: 50, timeStamp: i * 16 }));
    expect(play(shove).steps).toEqual([1]);
  });

  it("re-arms after the quiet, so a second flick turns a second page", () => {
    const first = Array.from({ length: 10 }, (_, i) => ({ deltaY: 20, timeStamp: i * 16 }));
    const second = first.map((e) => ({ ...e, timeStamp: e.timeStamp + 1000 }));
    expect(play([...first, ...second]).steps).toEqual([1, 1]);
  });

  it("reads line and page deltaModes, which is how Firefox reports a notch", () => {
    // deltaMode 1 is lines: three of them is one notch, and 3 × 40 = 120 px.
    expect(normalizeWheelDelta({ deltaY: 3, deltaMode: 1 })).toBe(120);
    expect(normalizeWheelDelta({ deltaY: 1, deltaMode: 2 })).toBe(800);
    expect(normalizeWheelDelta({ deltaY: 100, deltaMode: 0 })).toBe(100);
    // Below the threshold in its own units, over it once normalized.
    expect(play([{ deltaY: 3, timeStamp: 0, deltaMode: 1 }]).steps).toEqual([1]);
  });

  it("starts from rest with no history to inherit", () => {
    expect(WHEEL_TURN_REST.armed).toBe(true);
    expect(WHEEL_TURN_REST.travel).toBe(0);
    // A first event at timeStamp 0 must read as quiet, not as the continuation
    // of a gesture that never happened.
    expect(play([{ deltaY: 100, timeStamp: 0 }], WHEEL_TURN_REST).steps).toEqual([1]);
  });
});
