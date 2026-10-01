// Draws what a phone recording cannot show on its own: where the finger is,
// how long it has been held, and which step of the story we are on. It only
// draws on top of the page (it never catches a touch), so the real taps the
// recording makes still reach the app underneath.
//
// Run once with evalfile, then drive it with eval steps:
//   eval=__touch.label(1, 'Hold a verse')    a numbered caption at the top
//   eval=__touch.down(180, 662)              a finger mark appears there
//   eval=__touch.ring(550)                   a ring fills round it, in that many ms
//   eval=__touch.up()                        the finger lifts
(() => {
  if (window.__touch) return "already";
  const css = document.createElement("style");
  css.textContent = `
    .tm-layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; }
    .tm-finger { position: absolute; width: 46px; height: 46px; margin: -23px 0 0 -23px;
      border-radius: 50%; background: rgba(40, 40, 40, .28); border: 2px solid rgba(255, 255, 255, .9);
      box-shadow: 0 0 0 1px rgba(0, 0, 0, .25); transform: scale(.6); opacity: 0;
      transition: transform .12s ease-out, opacity .12s ease-out; }
    .tm-finger.on { transform: scale(1); opacity: 1; }
    .tm-ring { position: absolute; width: 70px; height: 70px; margin: -35px 0 0 -35px; opacity: 0;
      transition: opacity .15s; }
    .tm-ring.on { opacity: 1; }
    .tm-ring circle { fill: none; stroke: #1f5f57; stroke-width: 5; stroke-linecap: round;
      transform: rotate(-90deg); transform-origin: 50% 50%; }
    .tm-label { position: absolute; left: 50%; top: 14px; transform: translateX(-50%);
      display: flex; align-items: center; gap: 10px; max-width: 92%;
      padding: 8px 16px 8px 8px; border-radius: 999px; background: rgba(31, 95, 87, .96);
      color: #fff; font: 600 17px/1.25 system-ui, -apple-system, sans-serif;
      box-shadow: 0 4px 14px rgba(0, 0, 0, .25); transition: opacity .2s; }
    .tm-label b { display: inline-grid; place-items: center; flex: none; width: 28px; height: 28px;
      border-radius: 50%; background: #fff; color: #1f5f57; font-size: 16px; }
  `;
  document.head.appendChild(css);
  const layer = document.createElement("div");
  layer.className = "tm-layer";
  document.body.appendChild(layer);

  const finger = document.createElement("div");
  finger.className = "tm-finger";
  const R = 30;
  const C = 2 * Math.PI * R;
  const ring = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  ring.setAttribute("class", "tm-ring");
  ring.setAttribute("viewBox", "0 0 70 70");
  ring.innerHTML = `<circle cx="35" cy="35" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C}"/>`;
  const label = document.createElement("div");
  label.className = "tm-label";
  label.style.opacity = "0";
  layer.append(ring, finger, label);
  const arc = ring.querySelector("circle");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  window.__touch = {
    label(n, text) {
      label.innerHTML = `<b>${n}</b><span></span>`;
      label.querySelector("span").textContent = text;
      label.style.opacity = "1";
      return n;
    },
    async down(x, y) {
      for (const el of [finger, ring]) Object.assign(el.style, { left: x + "px", top: y + "px" });
      arc.style.transition = "none";
      arc.style.strokeDashoffset = String(C);
      finger.classList.add("on");
      await wait(150);
      return [x, y];
    },
    async ring(ms) {
      ring.classList.add("on");
      void arc.getBoundingClientRect();
      arc.style.transition = `stroke-dashoffset ${ms}ms linear`;
      arc.style.strokeDashoffset = "0";
      await wait(ms + 60);
      return ms;
    },
    async up() {
      finger.classList.remove("on");
      ring.classList.remove("on");
      await wait(150);
      return true;
    },
  };
  return "ready";
})();
