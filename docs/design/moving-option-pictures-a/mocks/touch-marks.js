// Draws where a finger is on the page, for recordings of an options note.
// A grey fingertip appears where the finger goes down; if it stays, a ring
// fills around it over the hold time; when it lifts, the mark fades. A quick
// tap shows a small ripple instead. It also puts a numbered step label at the
// top of the screen: call window.__step(2, "Keep holding").
// It only watches pointer events, so it draws real touches and scripted ones
// alike, and it never takes a touch itself (pointer-events: none).
(() => {
  if (window.__step) return "already installed";
  const HOLD_MS = window.TOUCH_HOLD_MS || 500; // how long a hold must last
  const DELAY_MS = 120; // a tap shorter than this never starts the ring
  const R = 26; // ring radius in CSS px, about a fingertip
  const C = 2 * Math.PI * R;

  const layer = document.createElement("div");
  Object.assign(layer.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: 2147483647 });
  document.body.appendChild(layer);

  const label = document.createElement("div");
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
    return n;
  };

  let mark = null;
  let downAt = 0;
  const NS = "http://www.w3.org/2000/svg";
  const down = (e) => {
    downAt = performance.now();
    const size = 2 * R + 12;
    mark = document.createElement("div");
    Object.assign(mark.style, {
      position: "fixed", left: e.clientX - size / 2 + "px", top: e.clientY - size / 2 + "px",
      width: size + "px", height: size + "px", transition: "opacity .3s, transform .3s",
    });
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    const mid = size / 2;
    const pad = document.createElementNS(NS, "circle");
    pad.setAttribute("cx", mid); pad.setAttribute("cy", mid); pad.setAttribute("r", R - 6);
    pad.setAttribute("fill", "rgba(20,24,28,.38)"); pad.setAttribute("stroke", "#fff"); pad.setAttribute("stroke-width", "2");
    const track = document.createElementNS(NS, "circle");
    track.setAttribute("cx", mid); track.setAttribute("cy", mid); track.setAttribute("r", R);
    track.setAttribute("fill", "none"); track.setAttribute("stroke", "rgba(255,255,255,.75)"); track.setAttribute("stroke-width", "5");
    const ring = document.createElementNS(NS, "circle");
    ring.setAttribute("cx", mid); ring.setAttribute("cy", mid); ring.setAttribute("r", R);
    ring.setAttribute("fill", "none"); ring.setAttribute("stroke", "#e0a030"); ring.setAttribute("stroke-width", "5");
    ring.setAttribute("stroke-linecap", "round");
    ring.setAttribute("transform", `rotate(-90 ${mid} ${mid})`);
    ring.style.strokeDasharray = String(C);
    ring.style.strokeDashoffset = String(C);
    svg.append(track, ring, pad);
    mark.appendChild(svg);
    layer.appendChild(mark);
    mark._ring = ring;
    // Start filling only after a short delay, so a quick tap shows no ring.
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
    if (!held) m._ring.style.opacity = "0"; // a tap: no ring, just the ripple
    m.style.transform = held ? "scale(1)" : "scale(1.6)";
    m.style.opacity = "0";
    setTimeout(() => m.remove(), 400);
  };
  document.addEventListener("pointerdown", down, true);
  document.addEventListener("pointerup", up, true);
  document.addEventListener("pointercancel", up, true);
  return "installed";
})();
