(async () => {
  // The question the Mistake pen asks ("What went wrong in …?"), tapped near each edge of every
  // page in sight: where it stands, whether all of it is on the screen, whether every button can
  // be reached, and how far it stands from the word it asks about. The question is closed each time,
  // so nothing is marked. Boxes, counts and button kinds only, never a word of the page.
  // Set window.__keep = "middle" (or another spot's name) on a line ahead of it to leave that
  // spot's question open and stop there, so the walk's picture shows it.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (e) => e?.getBoundingClientRect() ?? null;
  const on = (r) => r && r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  // Give or take a point: a choice scrolled flush to the screen's foot ends a fraction past it.
  const inside = (r) => r && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
  const f = (b) => (b ? `${Math.round(b.left)},${Math.round(b.top)}-${Math.round(b.right)},${Math.round(b.bottom)}` : "none");
  const hit = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const out = [`view=${innerWidth}x${innerHeight} lang=${document.documentElement.lang}`];
  await wait(2500);
  const kept = Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]));
  const pages = () => [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")].filter((e) => on(box(e)) && getComputedStyle(e).visibility === "visible");
  // The bar's pen has its key, M; the tray a smaller screen has instead names its pens.
  const pen = () => [...document.querySelectorAll("[role=radio][aria-keyshortcuts=M], [data-phone-bar] [role=radio][data-pen=mistake]")].find((r) => on(box(r)));
  const tray = () => [...document.querySelectorAll("[data-phone-bar] button[aria-expanded=false]")].find((b) => on(box(b)));
  if (!pen()) {
    // The bottom home folds the pens away behind one button until it is pressed.
    const home = [...document.querySelectorAll("[data-pen-home]")].find((e) => on(box(e)) || e.children.length);
    const opener = home && [...home.querySelectorAll("button")].find((b) => !b.closest("[role=toolbar]"));
    (opener || tray())?.click();
    await wait(800);
  }
  if (!pen()) return out.concat("no Mistake pen on screen").join(" ; ");
  pen().click();
  await wait(700);
  // A tray folds away once a pen is picked; the pen stays on.
  const picked = () => pen()?.getAttribute("aria-checked") ?? document.querySelector("[data-phone-bar]")?.getAttribute("data-tool");
  out.push(`pen=${picked()} pages=${pages().map((p) => p.getAttribute("aria-labelledby").replace("page-label-", "") + "@" + f(box(p))).join(" ")}`);
  const fire = (type, p, el) => el?.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: p.x, clientY: p.y, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
  const tap = async (p) => { const el = document.elementFromPoint(p.x, p.y); fire("pointerdown", p, el); await wait(60); fire("pointerup", p, el); el?.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: p.x, clientY: p.y })); };
  const marks = () => document.querySelectorAll("[data-mistake-word]").length;
  const before = marks();
  for (const svg of pages()) {
    const n = svg.getAttribute("aria-labelledby").replace("page-label-", "");
    const lines = [...svg.querySelectorAll(".ayahPolygon")].map(box).filter(on);
    if (!lines.length) { out.push(`p${n}: no verses in sight`); continue; }
    const top = Math.max(0, Math.min(...lines.map((b) => b.top))), bottom = Math.min(innerHeight - 30, Math.max(...lines.map((b) => b.bottom)));
    const left = Math.min(...lines.map((b) => b.left)), right = Math.max(...lines.map((b) => b.right));
    const spots = {
      "top-right": { x: right - 24, y: top + 14 }, "top-left": { x: left + 24, y: top + 14 },
      middle: { x: (left + right) / 2, y: (top + bottom) / 2 },
      "foot-right": { x: right - 24, y: bottom - 14 }, "foot-left": { x: left + 24, y: bottom - 14 },
    };
    for (const [name, p] of Object.entries(spots)) {
      // A verse's number is drawn as a circle and holds no word: step in off it, toward the middle.
      for (let i = 0; i < 3 && document.elementFromPoint(p.x, p.y)?.tagName.toLowerCase() === "circle"; i++) p.x += p.x > (left + right) / 2 ? -30 : 30;
      // Where the bars at the screen's foot stand over the page (an iPad mini on its side), step up
      // to the lowest line in sight: the rest is reached by dragging the page, which the browser test does.
      for (let i = 0; i < 12 && !svg.contains(document.elementFromPoint(p.x, p.y)) && p.y > top + 40; i++) p.y -= 20;
      await tap(p);
      await wait(1400);
      const ask = [...document.querySelectorAll("[data-word-parts=mistake]")].find((d) => on(box(d)));
      if (!ask) { const el = document.elementFromPoint(p.x, p.y); out.push(`p${n} ${name}: no question (under the tap: ${el?.tagName.toLowerCase()}${el?.classList.length ? "." + [...el.classList].join(".") : ""}, in a verse=${lines.some((b) => p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom) ? "yes" : "no"})`); continue; }
      const ab = box(ask);
      const buttons = [...ask.querySelectorAll("button")];
      // A choice in a row that scrolls sideways is judged scrolled to, as a finger would bring it.
      const cut = buttons.filter((b) => { b.scrollIntoView({ block: "nearest", inline: "nearest" }); return !inside(box(b)); }).length;
      const kinds = buttons.map((b) => b.dataset.part || (b.getAttribute("aria-label") ? "close" : "other"));
      // How far the question stands from the tapped point, below it or above it; below zero it
      // covers the tap. And a button drawn over by something else (the page bar) cannot be pressed.
      // The word's own edges, as the question says it measured them; the tap's spot where it does not.
      const word = ask.dataset.wordTop ? { left: p.x - 6, right: p.x + 6, top: +ask.dataset.wordTop, bottom: +ask.dataset.wordBottom } : { left: p.x - 6, right: p.x + 6, top: p.y - 6, bottom: p.y + 6 };
      const gap = Math.round(ab.top >= p.y ? ab.top - p.y : p.y - ab.bottom);
      const under = buttons.filter((b) => { b.scrollIntoView({ block: "nearest", inline: "nearest" }); const r = box(b); return !b.contains(document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2)); }).length;
      out.push(`p${n} ${name}: box=${f(ab)} docked=${ask.dataset.docked || "no"} whole=${inside(ab) ? "yes" : "no"} buttons=${buttons.length} cutOff=${cut} drawnOver=${under} coversWord=${hit(ab, word) ? "yes" : "no"} gap=${gap} ${ab.top >= p.y ? "below" : "above"} kinds=${[...new Set(kinds)].join("|")}`);
      if (window.__keep === name) return out.join(" ; ");
      // Away from the screen's foot it has no close button; Escape closes it either way.
      ask.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await wait(600);
    }
  }
  out.push(`marked=${marks() - before}`);
  if (!pen()) { tray()?.click(); await wait(800); }
  pen()?.click();
  await wait(400);
  for (const k of Object.keys(localStorage)) if (!(k in kept)) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(kept)) localStorage.setItem(k, v);
  return out.join(" ; ");
})()
