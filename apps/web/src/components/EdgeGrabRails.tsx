import { useRef, useState } from "react";
import styles from "./EdgeGrabRails.module.css";

/**
 * What a grabbed edge does to the book. Three verbs, one per phase of a drag,
 * so the rails never hold any turn state of their own — they hand the drag to
 * the one surface that owns turning and let it draw. `step` is +1 forward /
 * −1 back; the caller fixes it per edge (see {@link EdgeGrabRails}).
 */
export interface EdgeTurnDriver {
  begin: (step: 1 | -1) => void;
  track: (dx: number) => void;
  release: (dx: number, velocityX: number) => void;
}

/** The live drag, kept off React state so a move does not re-render the book. */
interface Grab {
  step: 1 | -1;
  startX: number;
  lastX: number;
  lastT: number;
  begun: boolean;
}

/**
 * A grab must have travelled this far before it is a turn. Below it, a press on
 * the edge is a click that lands nowhere — no band flashes on and retreats, and
 * a reader who clicks the fore-edge by accident sees nothing happen.
 */
const GRAB_SLOP_PX = 4;

/**
 * The outer edges of an open mus'haf, made grabbable.
 *
 * ## Why the edges, and why here
 *
 * A physical reader turns a page by its fore-edge. This is that: hovering the
 * outer edge of either leaf shows a hand, and a drag that begins there sweeps
 * the leaf across — while a drag that begins anywhere else does not turn the
 * page at all (on the desktop spread the stage's own swipe-to-turn is off, so
 * the middle of the page is free to pan and select). The reading direction is
 * the print's: the earlier pages are on the right, so the **left** edge pulls
 * *forward* into the book and the **right** edge pulls *back* toward the start.
 *
 * The rails sit on the book rather than inside a leaf because one of the two
 * edges belongs to the *facing* leaf — a page the turning stage does not own
 * and gets no pointer from. So the grab is caught here and handed to the stage
 * through {@link EdgeTurnDriver}; the rails themselves know nothing about the
 * fold, exactly as the book knows nothing about it (the band is portalled in).
 *
 * ## The shape
 *
 * Wider at the corners than down the middle — a physical page is easiest to
 * lift by a corner, and a thin strip that swallowed the whole outer margin
 * would eat the fore-edge a reader wants to select against. The clip-path bows
 * the grab region inward at top and bottom and pinches it to a sliver at the
 * midline, so the middle of the fore-edge stays the page's.
 */
export function EdgeGrabRails({ driver }: { driver?: EdgeTurnDriver }): JSX.Element | null {
  // Which side, if any, is being held right now — only to swap the cursor to a
  // closed hand. The drag's numbers live in the ref beside it.
  const [held, setHeld] = useState<"left" | "right" | null>(null);
  const grab = useRef<Grab | null>(null);

  if (!driver) return null;

  const rail = (side: "left" | "right", step: 1 | -1): JSX.Element => (
    <div
      key={side}
      className={styles.rail}
      data-side={side}
      data-testid={`edge-grab-${side}`}
      data-grabbing={held === side ? "true" : undefined}
      aria-hidden="true"
      onPointerDown={(e) => {
        // Left button only, and take the pointer so the whole drag arrives here
        // even when it leaves the strip — a page turn crosses the book.
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        grab.current = { step, startX: e.clientX, lastX: e.clientX, lastT: e.timeStamp, begun: false };
        setHeld(side);
      }}
      onPointerMove={(e) => {
        const g = grab.current;
        if (!g) return;
        const dx = e.clientX - g.startX;
        // Hold the band back until the grab has actually moved: a still press is
        // not a turn, and beginning one would flash a fold on and take it back.
        if (!g.begun && Math.abs(dx) < GRAB_SLOP_PX) return;
        if (!g.begun) {
          driver.begin(g.step);
          g.begun = true;
        }
        driver.track(dx);
        g.lastX = e.clientX;
        g.lastT = e.timeStamp;
      }}
      onPointerUp={(e) => {
        const g = grab.current;
        grab.current = null;
        setHeld(null);
        if (!g) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (!g.begun) return; // a click on the edge, not a turn
        const dx = e.clientX - g.startX;
        // Signed pixels-per-millisecond over the last move, for the flick rule.
        // Zero when the finger paused before lifting, which is the same as a
        // slow release — only the distance decides then.
        const dt = e.timeStamp - g.lastT;
        const velocityX = dt > 0 ? (e.clientX - g.lastX) / dt : 0;
        driver.release(dx, velocityX);
      }}
      onPointerCancel={() => {
        const g = grab.current;
        grab.current = null;
        setHeld(null);
        // A cancelled grab (a second pointer, the OS taking over) releases at
        // rest so the band retreats rather than committing on a stroke the
        // reader did not finish.
        if (g?.begun) driver.release(0, 0);
      }}
    />
  );

  return (
    <>
      {rail("left", 1)}
      {rail("right", -1)}
    </>
  );
}
