// Stands in for the "hold" step the page driver does not have yet: a finger
// goes down in the middle of a verse, stays, and lifts. window.HOLD_VERSE
// picks the verse (default 2:45, one line on page 7); window.PRESS_MS is how
// long the finger stays (default: a full hold plus a moment to show the ring
// full; set it to 90 for a quick tap). If window.HOLD_LABEL is set, the step
// label changes to it once the ring starts filling.
// In today's app, a finger going down and up on a verse without moving opens
// the verse menu, so the menu that rises after this is the app's own.
// It returns once the finger is up, because the driver waits for a script
// that hands back a promise.
(async () => {
  const key = window.HOLD_VERSE || "2:45";
  const hold = window.TOUCH_HOLD_MS || 500;
  const ms = window.PRESS_MS || hold + 350;
  const verse = [...document.querySelectorAll('path[aria-label^="Ayah "]')].find(
    (p) => p.getAttribute("aria-label").endsWith(" " + key) && p.getBoundingClientRect().width > 0,
  );
  const box = verse.getBoundingClientRect();
  const x = box.x + box.width * 0.55;
  const y = box.y + box.height / 2;
  const target = document.elementFromPoint(x, y) || verse;
  const opts = { clientX: x, clientY: y, pointerId: 7, pointerType: "touch", isPrimary: true, bubbles: true, composed: true };
  const wait = (t) => new Promise((r) => setTimeout(r, t));
  target.dispatchEvent(new PointerEvent("pointerdown", opts));
  if (ms > 150 && window.HOLD_LABEL && window.__step) {
    await wait(150);
    window.__step(2, window.HOLD_LABEL);
    await wait(ms - 150);
  } else {
    await wait(ms);
  }
  target.dispatchEvent(new PointerEvent("pointerup", opts));
  return { verse: key, ms, x: Math.round(x), y: Math.round(y), hit: target.getAttribute("aria-label") || target.tagName };
})();
