import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cornerOf, landedCorner, peelShape, type PeelSide, type Pt } from "../peel";
import type { TurnStyle } from "../turn-style";
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
  /**
   * The grab came up; returns whether it committed. `held` says the rails are
   * drawing a peel and will carry the turn over themselves, then call `finish`.
   */
  release: (dx: number, velocityX: number, held?: boolean) => boolean;
  /** The peel has laid the leaf down: land on the new opening, no band. */
  finish: (step: 1 | -1) => void;
}

/**
 * The two pages a lifted leaf shows: the one beneath it (the same side of the
 * next opening) and the one on its back (the far side, once it lands). Image
 * addresses, so the peel is a picture of the pages and the live page drawing
 * is never moved.
 */
export interface PeelPages {
  under: string;
  back: string;
}

/** The corner in the hand, in the book's own pixels. */
interface Held {
  side: PeelSide;
  step: 1 | -1;
  corner: Pt;
  pointer: Pt;
  leafW: number;
  bookH: number;
  /** Carried over and waiting for the page to change underneath. */
  landed?: boolean;
}

/** How long the corner takes to finish its travel, or to fall back, after release. */
const CARRY_MS = 220;
const FALL_MS = 160;
/** Longest the laid-down leaf waits for the new opening before it gets out of the way. */
const LANDED_HOLD_MS = 1500;

/** The live drag, kept off React state so a move does not re-render the book. */
interface Grab {
  step: 1 | -1;
  startX: number;
  startY: number;
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
 * through {@link EdgeTurnDriver}. The stage rules whether a drag turned the
 * page; the rails draw the corner in the hand (#189) — it lifts with the
 * pointer, the next opening shows beneath, and on release it goes over or falls
 * back. The drawing is pictures of the pages and plain paper, so the live page
 * never moves (see {@link PeelOverlay}).
 *
 * ## The shape
 *
 * Wider at the corners than down the middle — a physical page is easiest to
 * lift by a corner, and a thin strip that swallowed the whole outer margin
 * would eat the fore-edge a reader wants to select against. The clip-path bows
 * the grab region inward at top and bottom and pinches it to a sliver at the
 * midline, so the middle of the fore-edge stays the page's.
 */
export function EdgeGrabRails({
  driver,
  aside = false,
  peel,
  turnStyle,
  opening,
}: {
  driver?: EdgeTurnDriver;
  /**
   * Stand aside and let the pointer through to the page: the harakat and word
   * tools point at single signs, and the first word of every line sits under
   * the strip's corners. The arrows and keys still turn the page meanwhile.
   */
  aside?: boolean;
  /**
   * The pages each edge would show as its corner lifts, or null where there is
   * no page to show (the ends of the book, a page not in the edition). A side
   * with none — or a reader who asked for less motion — turns on release the
   * old way, with the ordinary animated turn.
   */
  peel?: { left: PeelPages | null; right: PeelPages | null } | undefined;
  /** The reader's turn style: how deep the lifted leaf's shadow falls. */
  turnStyle?: TurnStyle | undefined;
  /** Changes when the opening does; a laid-down leaf clears when it changes. */
  opening?: number;
}): JSX.Element | null {
  // Which side, if any, is being held right now — only to swap the cursor to a
  // closed hand. The drag's numbers live in the ref beside it.
  const [held, setHeld] = useState<"left" | "right" | null>(null);
  const grab = useRef<Grab | null>(null);
  // The corner as drawn. React state because it *is* the drawing; only the
  // rails and their overlay re-render as it moves, never the book.
  const [lifted, setLifted] = useState<Held | null>(null);
  const liftedRef = useRef<Held | null>(null);
  const anim = useRef(0);
  const put = (h: Held | null): void => {
    liftedRef.current = h;
    setLifted(h);
  };

  // The new opening is on the page: the laid-down leaf has nothing left to
  // cover. A timer backs it up so a turn that never lands cannot leave it up.
  useEffect(() => {
    if (liftedRef.current?.landed) put(null);
  }, [opening]);
  useEffect(() => {
    if (!lifted?.landed) return;
    const t = window.setTimeout(() => put(null), LANDED_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [lifted?.landed]);
  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  if (!driver) return null;

  const reduced = (): boolean =>
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Move the corner to `to` over `ms`, then `done`. */
  const travel = (to: Pt, ms: number, done: () => void): void => {
    const from = liftedRef.current;
    if (!from) return done();
    const p0 = from.pointer;
    const t0 = performance.now();
    cancelAnimationFrame(anim.current);
    const frame = (now: number): void => {
      const cur = liftedRef.current;
      if (!cur) return;
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - (1 - k) ** 3; // ease out: the page settles as a page does
      put({ ...cur, pointer: { x: p0.x + (to.x - p0.x) * e, y: p0.y + (to.y - p0.y) * e } });
      if (k < 1) anim.current = requestAnimationFrame(frame);
      else done();
    };
    anim.current = requestAnimationFrame(frame);
  };

  const rail = (side: "left" | "right", step: 1 | -1): JSX.Element => (
    <div
      key={side}
      className={styles.rail}
      data-side={side}
      data-testid={`edge-grab-${side}`}
      data-grabbing={held === side ? "true" : undefined}
      data-aside={aside ? "true" : undefined}
      aria-hidden="true"
      onPointerDown={(e) => {
        // Left button only, and take the pointer so the whole drag arrives here
        // even when it leaves the strip — a page turn crosses the book.
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        grab.current = {
          step,
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastT: e.timeStamp,
          begun: false,
        };
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
          // Lift the corner nearest the press, if this edge has pages to show.
          const book = e.currentTarget.parentElement?.getBoundingClientRect();
          if (peel?.[side] && book && book.width > 0 && !reduced()) {
            cancelAnimationFrame(anim.current);
            const leafW = book.width / 2;
            const corner = cornerOf(side, leafW, book.height, g.startY - book.top);
            put({ side, step: g.step, corner, pointer: corner, leafW, bookH: book.height });
          }
        }
        const h = liftedRef.current;
        if (h && !h.landed) {
          // The corner goes where the hand goes, from where it started.
          put({ ...h, pointer: { x: h.corner.x + dx, y: h.corner.y + (e.clientY - g.startY) } });
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
        const h = liftedRef.current;
        const committed = driver.release(dx, velocityX, !!h);
        if (!h) return;
        if (committed) {
          // Carry the corner over the spine, lay the leaf down, then land.
          travel(landedCorner(h.corner, h.leafW), CARRY_MS, () => {
            const cur = liftedRef.current;
            if (cur) put({ ...cur, landed: true });
            driver.finish(h.step);
          });
        } else {
          travel(h.corner, FALL_MS, () => put(null));
        }
      }}
      onPointerCancel={() => {
        const g = grab.current;
        grab.current = null;
        setHeld(null);
        // A cancelled grab (a second pointer, the OS taking over) releases at
        // rest so the band retreats rather than committing on a stroke the
        // reader did not finish.
        if (g?.begun) driver.release(0, 0);
        if (liftedRef.current) travel(liftedRef.current.corner, FALL_MS, () => put(null));
      }}
    />
  );

  const pages = lifted ? peel?.[lifted.side] : null;
  const shape =
    lifted && pages
      ? peelShape(lifted.side, lifted.leafW, lifted.bookH, lifted.corner, lifted.pointer)
      : null;

  return (
    <>
      {rail("left", 1)}
      {rail("right", -1)}
      {lifted && pages && shape && (
        <PeelOverlay held={lifted} pages={pages} shape={shape} turnStyle={turnStyle ?? "seam"} />
      )}
    </>
  );
}

const poly = (pts: Pt[]): string =>
  `polygon(${pts.map((p) => `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`).join(", ")})`;

/** Grey lines where words will be — the skeleton curl's face, never a glyph. */
const SKELETON_LINES = 15;

const gradient = (g: { angleDeg: number; foldAt: number }, color: string, reach: number): string =>
  `linear-gradient(${g.angleDeg.toFixed(2)}deg, ${color} ${g.foldAt.toFixed(1)}px, transparent ${(g.foldAt + reach).toFixed(1)}px)`;

/**
 * The lifted corner, drawn over the book. Nothing in it moves a drawn letter,
 * which is the rule every turn style keeps (turn-style decision, 2026-09-26):
 *
 *   beneath   the next page, standing still where it will lie, cut to the
 *             lifted area — it is uncovered, not moved;
 *   flap      the underside of the leaf in the hand, carried to the pointer by
 *             one transform. Plain paper under the flat seam, grey lines where
 *             words will be under the skeleton curl, and absent under the
 *             shadow lift, where only a shadow comes up off the fold;
 *   back      the real page on the leaf's back — shown only once the leaf
 *             lies flat where it lands, so it never rides a moving surface.
 */
function PeelOverlay({
  held,
  pages,
  shape,
  turnStyle,
}: {
  held: Held;
  pages: PeelPages;
  shape: NonNullable<ReturnType<typeof peelShape>>;
  turnStyle: TurnStyle;
}): JSX.Element {
  const { leafW, bookH, side, landed = false } = held;
  const leafAt = (x: number): CSSProperties => ({ left: x, top: 0, width: leafW, height: bookH });
  const liftedX = side === "left" ? 0 : leafW;
  const landsX = side === "left" ? leafW : 0;
  const flap = turnStyle !== "lift" && !landed;
  return (
    <div
      className={styles.peel}
      data-testid="edge-peel"
      data-side={side}
      data-style={turnStyle}
      data-landed={landed ? "true" : undefined}
      data-lift={Math.round(shape.lift)}
      aria-hidden="true"
    >
      <div className={styles.beneath} style={{ clipPath: poly(shape.revealed) }}>
        <img
          className={styles.page}
          data-testid="edge-peel-under"
          src={pages.under}
          alt=""
          draggable={false}
          style={leafAt(liftedX)}
        />
        {!landed && (
          <div
            className={styles.cast}
            style={{ background: gradient(shape.cast, "var(--peel-cast)", turnStyle === "lift" ? 90 : 36) }}
          />
        )}
      </div>
      {flap && (
        <div className={styles.flapShadow}>
          <div
            className={styles.flap}
            data-testid="edge-peel-flap"
            style={{
              clipPath: poly(shape.backClip),
              transform: `matrix(${shape.matrix.map((v) => v.toFixed(5)).join(", ")})`,
            }}
          >
            <div className={styles.face} style={leafAt(landsX)}>
              {turnStyle === "curl" && (
                <div className={styles.skeleton} data-skeleton="">
                  {Array.from({ length: SKELETON_LINES }, (_, k) => (
                    <i key={k} />
                  ))}
                </div>
              )}
            </div>
            <div
              className={styles.sheen}
              style={{ background: gradient(shape.shade, "var(--peel-fold)", 120) }}
            />
          </div>
        </div>
      )}
      {landed && (
        <img
          className={styles.page}
          data-testid="edge-peel-back"
          src={pages.back}
          alt=""
          draggable={false}
          style={leafAt(landsX)}
        />
      )}
    </div>
  );
}
