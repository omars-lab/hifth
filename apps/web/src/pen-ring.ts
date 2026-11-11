/**
 * How the pens that open at the Apple Pencil's tip are laid out, and where the
 * reader's choice is kept (docs/design/pencil-gestures.md, ④).
 *
 * The owner asked on 2026-11-10 for rings around the tip, "layers of an
 * onion", with today's row kept as the other choice:
 *
 *   rings  the tools on a circle round the tip, the tip in the hole; a tool
 *          with choices of its own (the highlighter's pens; Note, Harakat and
 *          Word behind the one button) adds them as an outer ring (the default);
 *   row    the tools in a row beside the tip, as first built.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key
 * rather than retyping it — the discipline `pen-home.ts` keeps.
 */
import { besideTip } from "./pencil";

export type TipPens = "rings" | "row";

/** In settings order. */
export const TIP_PENS: readonly TipPens[] = ["rings", "row"];

/** Versioned: a layout that later changes what it does gets a new key. */
export const TIP_PENS_KEY = "hifth.pens.tip.v1";

export function savedTipPens(): TipPens {
  try {
    return localStorage.getItem(TIP_PENS_KEY) === "row" ? "row" : "rings";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "rings";
  }
}

export function rememberTipPens(choice: TipPens): void {
  try {
    localStorage.setItem(TIP_PENS_KEY, choice);
  } catch {
    /* nothing to do — see savedTipPens */
  }
}

/** How far a button's middle is from the rings' middle: the tools, then their choices. */
export const RING_INNER = 84;
export const RING_OUTER = 134;
/** Half a button, and so how far past the outer ring the rings reach. */
const HALF = 22;
/** From the middle to the rings' outer edge, kept whether or not the outer ring is out. */
export const RING_REACH = RING_OUTER + HALF;
/** How far apart two buttons' middles stand along a ring. */
const PITCH = 46;
/** How far the rings may slide off the tip and still keep it clear in the hole. */
const SLIDE = 16;

type Point = { x: number; y: number };
type Size = { w: number; h: number };

/**
 * Where the rings' middle goes for a tip: on the tip, the rings whole in the
 * window. Near an edge they slide inside, as long as the tip stays clear in the
 * hole; nearer than that they stand beside the tip instead, as the row does,
 * so no button is ever under it. The room is always the outer ring's, so the
 * rings do not move under the hand when a tool's choices open.
 */
export function ringCentre(tip: Point, view: Size, margin = 8): Point {
  const fit = (n: number, room: number) => Math.min(Math.max(margin + RING_REACH, n), Math.max(margin + RING_REACH, room - margin - RING_REACH));
  const inside = { x: fit(tip.x, view.w), y: fit(tip.y, view.h) };
  if (Math.hypot(inside.x - tip.x, inside.y - tip.y) <= SLIDE) return inside;
  // Beside the tip, on the side the middle of the window is: the nearest the
  // rings can stand to a tip in a corner and still be whole.
  const far = Math.hypot(view.w / 2 - tip.x, view.h / 2 - tip.y) || 1;
  const away = RING_REACH + 16;
  const toward = {
    x: fit(tip.x + ((view.w / 2 - tip.x) / far) * away, view.w),
    y: fit(tip.y + ((view.h / 2 - tip.y) / far) * away, view.h),
  };
  if (Math.hypot(toward.x - tip.x, toward.y - tip.y) >= RING_REACH + 4) return toward;
  // A window too small for that: wherever a box that size fits, as the row does.
  const side = 2 * RING_REACH;
  const corner = besideTip(tip, { w: side, h: side }, view, 16, margin);
  return { x: corner.left + RING_REACH, y: corner.top + RING_REACH };
}

/** A spot from the rings' middle, as the CSS that puts a button's middle there. */
export function spotStyle(p: Point): { left: string; top: string } {
  return { left: `calc(50% + ${p.x.toFixed(1)}px)`, top: `calc(50% + ${p.y.toFixed(1)}px)` };
}

/**
 * Where button `i` of `n` stands on the tools' ring, from the rings' middle:
 * the first at the top, the rest clockwise, or the other way round where the
 * page reads right to left, so "next" is always the way the language reads.
 */
export function innerSpot(i: number, n: number, rtl = false): Point & { angle: number } {
  const angle = -Math.PI / 2 + ((rtl ? -1 : 1) * i * 2 * Math.PI) / n;
  return { x: RING_INNER * Math.cos(angle), y: RING_INNER * Math.sin(angle), angle };
}

/**
 * Where a tool's choices stand on the outer ring: side by side, centred on
 * the tool they belong to (`angle`, from `innerSpot`). `groups` is how many
 * choices each group holds; a small gap parts one group from the next.
 */
export function outerSpots(angle: number, groups: readonly number[], rtl = false): Point[] {
  const GAP = 0.4;
  const slots: number[] = [];
  let at = 0;
  for (const n of groups) {
    for (let k = 0; k < n; k++) slots.push(at++);
    at += GAP;
  }
  const mid = (at - GAP - 1) / 2;
  const step = ((rtl ? -1 : 1) * PITCH) / RING_OUTER;
  return slots.map((s) => {
    const a = angle + (s - mid) * step;
    return { x: RING_OUTER * Math.cos(a), y: RING_OUTER * Math.sin(a) };
  });
}
