import { describe, expect, it } from "vitest";
import {
  LONG_PRESS_MS,
  PINCH_POINTER_COUNT,
  TAP_SLOP_PX,
  isMarqueeIntent,
  isViewportIntent,
  marqueeRect,
  movementDistance,
  nextIntent,
  pointerIntent,
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
  it("only a marquee paints; only pan/pinch move the viewport", () => {
    const all: PointerIntent[] = ["none", "tap", "pan", "marquee", "pinch"];
    expect(all.filter(isMarqueeIntent)).toEqual(["marquee"]);
    expect(all.filter(isViewportIntent)).toEqual(["pan", "pinch"]);
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
