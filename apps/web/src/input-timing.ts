import { options } from "preact";

/**
 * Finish what a tap or a key set off before the next one arrives.
 *
 * A component's after-drawing work (an effect: moving focus into a sheet that
 * just opened, drawing the pins of a note just saved) waits in Preact for the
 * next screen frame, so the page can paint first. React did the same, except
 * after a tap, a click or a key: then it did that work at once, before the
 * browser could deliver the next event. The app was written against that. A
 * reader who presses `/` and starts typing a verse straight away must find the
 * jumper's field already focused, or the first letters land on the page behind
 * it — and an Escape pressed a moment after a sheet opens must reach the sheet.
 *
 * So this gives Preact React's rule back: a redraw caused by a tap, a click or
 * a key does its after-drawing work as soon as the drawing is done; any other
 * redraw (a timer, a page arriving over the network) still waits for the frame.
 */
const INPUT_EVENTS = [
  "keydown",
  "keyup",
  "keypress",
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "click",
  "touchstart",
  "touchend",
  "input",
  "change",
] as const;

/** Preact's own wait: the next frame, or 35 ms if frames are not being drawn. */
function nextFrame(win: Window, run: () => void): void {
  let timeout = 0;
  let frame = 0;
  const done = () => {
    win.clearTimeout(timeout);
    win.cancelAnimationFrame?.(frame);
    run();
  };
  timeout = win.setTimeout(done, 35);
  if (typeof win.requestAnimationFrame === "function") frame = win.requestAnimationFrame(done);
}

let installed: Window | null = null;

export function installInputTiming(win: Window): void {
  if (installed === win) return;
  installed = win;
  // Raised while the browser is handling a tap or a key, and lowered once that
  // task is over: the redraw it causes runs in the same task, a moment later.
  let fromInput = false;
  let lowering = 0;
  const raise = () => {
    fromInput = true;
    win.clearTimeout(lowering);
    lowering = win.setTimeout(() => (fromInput = false), 0);
  };
  for (const type of INPUT_EVENTS) win.addEventListener(type, raise, { capture: true, passive: true });
  options.requestAnimationFrame = (run) => {
    if (fromInput) queueMicrotask(run);
    else nextFrame(win, run);
  };
}
