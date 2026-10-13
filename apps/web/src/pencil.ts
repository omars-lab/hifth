/**
 * The Apple Pencil's double-tap and squeeze, as the page reads them
 * (docs/PLAN.md, 96; docs/design/pencil-gestures.md, ①, option B).
 *
 * A web page never hears either gesture. The iPad app does, through Apple's
 * pencil interaction, and hands each one to the page under `__HIFTH_PAGE__`
 * (native-bridge.ts) with the reader's own pencil setting and, when the pencil
 * was hovering, where its tip was. The page decides what that setting means in
 * Hifth, here, so every setting Apple offers has one stated answer:
 *
 *   switch to eraser, switch to last used   swap the pen in hand (no eraser in Hifth)
 *   show tool palette                       Hifth's own pens, beside the tip
 *   show colour palette, ink attributes     the highlighter's four pens, beside the tip
 *   off, run shortcut, anything new         nothing (a shortcut never reaches us)
 *
 * Its own module, free of React, as `pen-side.ts` is.
 */
import type { PageTool } from "./components/PageStage";

export type PencilAction = "previous" | "palette" | "pens" | "none";

export function pencilAction(pref: string): PencilAction {
  if (pref === "eraser" || pref === "previous") return "previous";
  if (pref === "palette") return "palette";
  if (pref === "colours" || pref === "ink") return "pens";
  return "none";
}

export interface PencilGesture {
  readonly kind: "doubleTap" | "squeeze";
  /** The reader's pencil setting, by the app's name for it. */
  readonly pref: string;
  /** Where the tip hovered, in the page's own pixels; `null` if it was not near. */
  readonly at: { x: number; y: number } | null;
}

/** The app's message, checked: anything malformed is dropped, not guessed at. */
export function pencilGesture(raw: unknown): PencilGesture | null {
  if (!raw || typeof raw !== "object") return null;
  const { kind, pref, x, y } = raw as Record<string, unknown>;
  if (kind !== "doubleTap" && kind !== "squeeze") return null;
  if (typeof pref !== "string") return null;
  const at = typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  return { kind, pref, at };
}

/**
 * What a double-tap puts in hand. Hifth's tools put themselves down after one
 * use, so the hand is usually empty (plain selecting): the swap picks up the
 * last tool used, and with one in hand it puts it down. `null` when no tool has
 * been used yet, and there is nothing to swap to.
 */
export function swapTool(current: PageTool, last: PageTool | null): PageTool | null {
  if (current !== "select") return "select";
  return last;
}

type Size = { w: number; h: number };

/**
 * Where the pens' corner goes for a tip: to its right, else its left, else
 * below it, else above it, the first that keeps the pens whole in the window
 * and off the tip; centred on the tip along the other way, as far as the
 * window lets. With room nowhere, to its right, pushed inside.
 */
export function besideTip(tip: { x: number; y: number }, size: Size, view: Size, gap = 16, margin = 8): { left: number; top: number } {
  const fit = (n: number, room: number) => Math.min(Math.max(margin, n), Math.max(margin, room - margin));
  const across = fit(tip.y - size.h / 2, view.h - size.h);
  const along = fit(tip.x - size.w / 2, view.w - size.w);
  const tries = [
    { left: tip.x + gap, top: across },
    { left: tip.x - gap - size.w, top: across },
    { left: along, top: tip.y + gap },
    { left: along, top: tip.y - gap - size.h },
  ];
  const whole = (p: { left: number; top: number }) =>
    p.left >= margin && p.top >= margin && p.left + size.w <= view.w - margin && p.top + size.h <= view.h - margin;
  return tries.find(whole) ?? { left: fit(tries[0]!.left, view.w - size.w), top: across };
}
