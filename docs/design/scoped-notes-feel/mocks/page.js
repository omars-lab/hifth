/*
 * Shared by the scoped-notes options mocks: where each verse sits on the
 * screen, the three made-up notes every option uses, and a small "added" line.
 * Injected into the live app by `make drive`; nothing here is part of the app.
 */
(() => {
  // A verse's outline is a few rectangles, one per line it runs over. The verse
  // starts at the right edge of the first and ends, at its number, on the left
  // edge of the last (the page reads right to left).
  function lines(n) {
    const path = document.getElementById("verse-" + n);
    if (!path) return [];
    const m = path.getScreenCTM();
    const rects = [];
    let x = 0, y = 0, sx = 0, sy = 0, pts = [];
    const close = () => {
      if (!pts.length) return;
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const a = new DOMPoint(Math.min(...xs), Math.min(...ys)).matrixTransform(m);
      const b = new DOMPoint(Math.max(...xs), Math.max(...ys)).matrixTransform(m);
      rects.push({ left: a.x, top: a.y, right: b.x, bottom: b.y });
      pts = [];
    };
    for (const [, c, args] of path.getAttribute("d").matchAll(/([MmHhVvZz])([^MmHhVvZz]*)/g)) {
      const v = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (c === "M" || c === "m") { close(); x = c === "M" ? v[0] : x + v[0]; y = c === "M" ? v[1] : y + v[1]; sx = x; sy = y; }
      else if (c === "h") x += v[0];
      else if (c === "H") x = v[0];
      else if (c === "v") y += v[0];
      else if (c === "V") y = v[0];
      else if (c === "z" || c === "Z") { close(); x = sx; y = sy; continue; }
      pts.push([x, y]);
    }
    close();
    return rects;
  }

  // The made-up notes: one look-alike note across the Qur'an, one for this
  // page, one for the juz. Global verse numbers, as the outlines are named.
  const NOTES = [
    { id: "look", title: "Bani Isra'il look-alikes", scope: "Whole Qur'an", verses: [55, 129, 130], keys: "2:48 · 2:122 · 2:123",
      text: "2:48 puts intercession before ransom; 2:123 swaps them. Mixed these up twice." },
    { id: "p7", title: "Page 7 slips", scope: "Page 7", verses: [47, 51], keys: "2:40 · 2:44", text: "Rushed the end of 2:40 both times." },
    { id: "j1", title: "Juz 1 madd to watch", scope: "Juz 1", verses: [12, 30, 51, 54, 70], keys: "", text: "" },
  ];

  const css = document.createElement("style");
  css.textContent = `
    .sn-toast { position: fixed; left: 50%; bottom: 190px; transform: translateX(-50%); z-index: 9999;
      background: #26201a; color: #fbf8f2; font: 14px var(--font-chrome); padding: 10px 14px; border-radius: 10px;
      display: flex; gap: 14px; align-items: center; box-shadow: var(--shadow-2); white-space: nowrap; }
    .sn-toast b { color: #9fd3ca; font-weight: 600; }
  `;
  document.head.append(css);

  function toast(msg) {
    document.querySelector(".sn-toast")?.remove();
    const t = document.createElement("div");
    t.className = "sn-toast";
    t.innerHTML = `<span>${msg}</span><b>Undo</b>`;
    document.body.append(t);
  }

  window.SN = { lines, NOTES, toast };
  return "page helpers ready";
})();
