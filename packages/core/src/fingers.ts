/**
 * Every finger on the glass, across the whole document.
 *
 * A page hears only the fingers that land on it. On the open book each page is
 * its own surface, so a pinch with one finger on each page reaches each page as
 * a lone finger, and a lone finger that moves means "select a run of verses".
 * Only something listening on the whole window can see that the two lone
 * fingers are one pinch; this is that listener, shared by every page.
 *
 * A stroke is a *crowd* once a second finger joins it, and it stays one until
 * the next stroke's first finger lands: a page that hears its own finger lift
 * last must still know it was half of a pinch.
 */

/** Where one finger is on the screen, and what it landed on. */
export interface Finger {
  x: number;
  y: number;
  target: EventTarget | null;
}

/** The parts of a pointer event this reads; a real `PointerEvent` is one. */
export interface FingerEvent {
  type: string;
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  target: EventTarget | null;
}

const KINDS = ["pointerdown", "pointermove", "pointerup", "pointercancel"] as const;

export class FingerCount {
  private readonly fingers = new Map<number, Finger>();
  private crowd = false;
  private watchers = 0;
  private host: EventTarget | null = null;
  private readonly onEvent = (e: Event) => this.see(e as unknown as FingerEvent);

  /** The fingers on the glass now, by pointer id. */
  get down(): ReadonlyMap<number, Finger> {
    return this.fingers;
  }

  /** Has this stroke had two fingers on the glass at once? */
  get crowded(): boolean {
    return this.crowd;
  }

  /**
   * Take one pointer event. A mouse is not a finger and is not counted, but a
   * mouse press with no finger down does start a fresh stroke: a pinch must not
   * leave the next mouse drag thinking it is still part of one.
   */
  see(e: FingerEvent): void {
    if (e.pointerType === "mouse") {
      if (e.type === "pointerdown" && this.fingers.size === 0) this.crowd = false;
      return;
    }
    switch (e.type) {
      case "pointerdown":
        if (this.fingers.size === 0) this.crowd = false;
        this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, target: e.target });
        if (this.fingers.size > 1) this.crowd = true;
        return;
      case "pointermove": {
        const finger = this.fingers.get(e.pointerId);
        if (finger) {
          finger.x = e.clientX;
          finger.y = e.clientY;
        }
        return;
      }
      case "pointerup":
      case "pointercancel":
        this.fingers.delete(e.pointerId);
        return;
    }
  }

  /**
   * Listen on `host` (the window) until the returned function is called. Many
   * pages watch at once and share one set of listeners; they come off with the
   * last. Capture phase, so the count is current before any page hears the
   * same event.
   */
  watch(host: EventTarget): () => void {
    if (this.watchers === 0) {
      this.host = host;
      for (const kind of KINDS) host.addEventListener(kind, this.onEvent, { capture: true, passive: true });
    }
    this.watchers += 1;
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.watchers -= 1;
      if (this.watchers > 0 || !this.host) return;
      for (const kind of KINDS) this.host.removeEventListener(kind, this.onEvent, { capture: true });
      this.host = null;
    };
  }
}

/** The one count every page shares. */
export const fingersOnGlass = new FingerCount();

type Point = { readonly x: number; readonly y: number };

/**
 * How much further apart two fingers are now than where they began: 2 is
 * twice as far apart, 0.5 half. Fingers that began on the same spot give no
 * scale at all, rather than an infinite one.
 */
export function spreadScale(start: readonly [Point, Point], now: readonly [Point, Point]): number {
  const before = Math.hypot(start[1].x - start[0].x, start[1].y - start[0].y);
  if (before === 0) return 1;
  return Math.hypot(now[1].x - now[0].x, now[1].y - now[0].y) / before;
}
