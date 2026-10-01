// The moving pictures: makes the real app answer a real finger the way an
// option would. Set window.MOCK_OPTION ("A", "B" or "C") first, and load the finger marks
// before this (make drive MARKS=1), so the mark still sees every touch.
//   A  a tap on the page hides the bars, another brings them back, and
//      nothing is painted; a hold opens the verse menu, as it already does today.
//   B  a tap opens the menu as today; the full-screen button (added by
//      fullscreen-button.js) hides the bars and leaves a small way back.
//   C  a tap opens the menu as today; a hold opens a second, small menu
//      beside the verse instead of today's menu.
(() => {
  if (window.__gestures) return "already installed";
  window.__gestures = true;
  const option = window.MOCK_OPTION;
  const holdMs = window.TOUCH_HOLD_MS ?? 500;
  const bars = () => document.querySelectorAll("header, footer, nav");
  let down = null;

  const hideBars = (wayBack) => {
    bars().forEach((e) => (e.style.display = "none"));
    if (!wayBack) return;
    const b = document.createElement("button");
    b.textContent = "⤡";
    b.setAttribute("aria-label", "Show the bars");
    Object.assign(b.style, {
      position: "fixed", top: "12px", right: "12px", width: "40px", height: "40px",
      borderRadius: "50%", border: "1px solid rgba(0,0,0,.25)", background: "rgba(250,247,240,.92)",
      font: "20px/1 system-ui", color: "#1f5f57", zIndex: 99,
    });
    document.body.appendChild(b);
  };
  const toggleBars = () => {
    const hidden = [...bars()].some((e) => e.style.display === "none");
    bars().forEach((e) => (e.style.display = hidden ? "" : "none"));
  };

  const smallMenu = (x, y) => {
    const menu = document.createElement("div");
    menu.setAttribute("data-mock-small-menu", "");
    Object.assign(menu.style, {
      position: "fixed", right: "16px", top: `${Math.max(80, Math.min(y - 90, innerHeight - 260))}px`,
      display: "flex", flexDirection: "column", gap: "2px", padding: "8px", borderRadius: "14px",
      background: "rgba(250,247,240,.98)", boxShadow: "0 8px 28px rgba(0,0,0,.25)",
      border: "1px solid rgba(0,0,0,.12)", zIndex: 99,
    });
    for (const [glyph, caption] of [["⏭", "Play to"], ["✎", "Mark"], ["✍", "Note"], ["⧉", "Copy"]]) {
      const b = document.createElement("button");
      b.innerHTML = `<span style="font-size:20px;width:24px;display:inline-block">${glyph}</span>${caption}`;
      Object.assign(b.style, {
        display: "flex", gap: "10px", alignItems: "center", width: "130px", padding: "8px 10px",
        border: 0, background: "none", font: "15px system-ui", color: "#1f5f57", textAlign: "left",
      });
      menu.appendChild(b);
    }
    document.body.appendChild(menu);
    return x;
  };

  const onPage = (e) => e.target instanceof Element && e.target.closest('svg[role="group"]');
  // Where the option keeps today's behaviour (A's hold, B, C's tap) the app
  // sees the touch untouched. Where it changes it (A's tap, C's hold) the app
  // sees the finger go down and then a cancelled touch, so it does nothing,
  // and the clicks the browser makes up after a tap are swallowed too.
  let swallowUntil = 0;
  const swallowClicks = (e) => {
    if (performance.now() < swallowUntil) e.stopImmediatePropagation();
  };
  for (const type of ["mousedown", "mouseup", "click"]) window.addEventListener(type, swallowClicks, true);
  window.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY, at: performance.now(), page: Boolean(onPage(e)) };
  }, true);
  window.addEventListener("pointerup", (e) => {
    const from = down;
    down = null;
    if (!from || !e.isTrusted) return;
    const held = performance.now() - from.at >= holdMs;
    const still = Math.hypot(e.clientX - from.x, e.clientY - from.y) < 10;
    if (option === "B" && e.target instanceof Element && e.target.closest('[aria-label="Full screen"]')) {
      hideBars(true);
      return;
    }
    if (!from.page || !still) return;
    const takeOver = (option === "A" && !held) || (option === "C" && held);
    if (!takeOver) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    swallowUntil = performance.now() + 600;
    e.target.dispatchEvent(new PointerEvent("pointercancel", {
      bubbles: true, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: true,
      clientX: e.clientX, clientY: e.clientY,
    }));
    if (option === "A") toggleBars();
    if (option === "C") smallMenu(e.clientX, e.clientY);
    // A touch can leave the verse with the keyboard's focus outline; the option draws nothing.
    setTimeout(() => document.activeElement instanceof HTMLElement || document.activeElement instanceof SVGElement ? document.activeElement.blur() : null, 0);
  }, true);
  return `installed for ${option}`;
})();
