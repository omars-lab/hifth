// Draws where a finger is on the page, for a recording an options note embeds.
// A recording of a web page shows no finger, so a tap and a hold look the same
// in it. This draws them in:
//   - a grey fingertip where a finger goes down;
//   - an amber ring that fills around it while it stays, over the hold time;
//   - a ripple instead of a ring when it lifts at once (a tap);
//   - a numbered step label at the top: window.__step(2, "Keep holding").
// It only watches the page's pointer events and never takes a touch itself
// (pointer-events: none), so the app reacts exactly as it would without it.
// Drive the touch with the drive tool's tap= and hold= steps, which send a real
// touch through the browser's own input; the drive tool's --marks loads this.
//
// Set before loading, if the defaults are wrong:
//   window.TOUCH_HOLD_MS  how long the ring takes to fill: match the app's hold (500)
//   window.TOUCH_FADE_MS  how long the mark takes to fade on lift; 0 = gone at once (300)
(() => {
  if (window.__step) return "already installed";
  const HOLD_MS = window.TOUCH_HOLD_MS ?? 500;
  const FADE_MS = window.TOUCH_FADE_MS ?? 300;
  const DELAY_MS = Math.min(120, HOLD_MS / 3); // a tap shorter than this never starts the ring
  const R = 26; // ring radius in CSS px, about a fingertip
  const C = 2 * Math.PI * R;
  const NS = "http://www.w3.org/2000/svg";

  const layer = document.createElement("div");
  Object.assign(layer.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: 2147483647 });
  document.body.appendChild(layer);

  const label = document.createElement("div");
  label.dataset.touchStep = "";
  Object.assign(label.style, {
    position: "fixed", left: "50%", top: "64px", transform: "translateX(-50%)",
    display: "none", alignItems: "center", gap: "8px", padding: "6px 14px 6px 6px",
    borderRadius: "999px", background: "rgba(20,24,28,.86)", color: "#fff",
    font: "600 15px/1.2 system-ui, sans-serif", whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(0,0,0,.25)",
  });
  layer.appendChild(label);
  window.__step = (n, text) => {
    label.innerHTML = "";
    const num = document.createElement("span");
    Object.assign(num.style, {
      display: "inline-grid", placeItems: "center", width: "24px", height: "24px", borderRadius: "50%",
      background: "#e0a030", color: "#14181c", font: "700 14px/1 system-ui, sans-serif",
    });
    num.textContent = String(n);
    label.append(num, document.createTextNode(text));
    label.style.display = "flex";
    // Longer labels wrap over the app's own buttons on a phone.
    return text.length > 28 ? `step ${n}: label is ${text.length} characters; keep it under 28` : n;
  };

  const circle = (mid, r, attrs) => {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", mid);
    c.setAttribute("cy", mid);
    c.setAttribute("r", r);
    for (const [k, v] of Object.entries(attrs)) c.setAttribute(k, v);
    return c;
  };

  let mark = null;
  let downAt = 0;
  const down = (e) => {
    if (mark) mark.remove();
    downAt = performance.now();
    const size = 2 * R + 12;
    const mid = size / 2;
    mark = document.createElement("div");
    mark.dataset.touchMark = "";
    Object.assign(mark.style, {
      position: "fixed", left: e.clientX - mid + "px", top: e.clientY - mid + "px",
      width: size + "px", height: size + "px",
      transition: `opacity ${FADE_MS}ms, transform ${FADE_MS}ms`,
    });
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    const track = circle(mid, R, { fill: "none", stroke: "rgba(255,255,255,.75)", "stroke-width": "5" });
    const ring = circle(mid, R, {
      fill: "none", stroke: "#e0a030", "stroke-width": "5", "stroke-linecap": "round",
      transform: `rotate(-90 ${mid} ${mid})`, "data-touch-ring": "",
    });
    ring.style.strokeDasharray = String(C);
    ring.style.strokeDashoffset = String(C);
    const pad = circle(mid, R - 6, { fill: "rgba(20,24,28,.38)", stroke: "#fff", "stroke-width": "2" });
    svg.append(track, ring, pad);
    mark.appendChild(svg);
    layer.appendChild(mark);
    mark._ring = ring;
    mark._timer = setTimeout(() => {
      ring.style.transition = `stroke-dashoffset ${HOLD_MS - DELAY_MS}ms linear`;
      ring.style.strokeDashoffset = "0";
    }, DELAY_MS);
  };
  const up = () => {
    if (!mark) return;
    const m = mark;
    mark = null;
    clearTimeout(m._timer);
    const held = performance.now() - downAt >= HOLD_MS;
    m.dataset.touchKind = held ? "hold" : "tap";
    if (!held) {
      m._ring.style.transition = "none";
      m._ring.style.opacity = "0"; // a tap: no ring, only the ripple
    }
    if (FADE_MS === 0) return void m.remove();
    m.style.transform = held ? "scale(1)" : "scale(1.6)";
    m.style.opacity = "0";
    setTimeout(() => m.remove(), FADE_MS + 100);
  };
  document.addEventListener("pointerdown", down, true);
  document.addEventListener("pointerup", up, true);
  document.addEventListener("pointercancel", up, true);
  return "installed";
})();
