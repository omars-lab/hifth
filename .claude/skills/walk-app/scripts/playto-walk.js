(async () => {
  // "Play to": a long press on one verse, Play to from its small menu, then a tap on the verse
  // the run should end at. Then it watches, at each change, the verse heard (read off the
  // recitation's Pause), the verse lit and the verse ringed, and once the run has ended which
  // verse is lit. Set before it runs, on a line ahead of it: window.__from and window.__to, the
  // two verses' numbers on the page (default 46 and 48, that is 2:39 to 2:41 on page 7);
  // window.__rate, how fast the sound plays (3 by default); window.__watch, how long to wait for
  // the end (ms); window.__mode = "listen" instead taps the first verse, shuts its note if one
  // opens, and presses Listen on its tools, then watches the same way. The sound plays quietly, never silent: a silent start proves nothing about
  // whether the next verse may start on its own. Verse numbers and button names only.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [`view=${innerWidth}x${innerHeight} lang=${document.documentElement.lang}`];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { this.volume = 0.01; this.playbackRate = Number(window.__rate || 3); window.__aud ||= []; if (!window.__aud.includes(this)) window.__aud.push(this); return play.call(this); };
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
  const on = (r) => r && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const isAr = document.documentElement.lang === "ar";
  const keys = (group) => [...new Set([...document.querySelectorAll(`#hifth-overlay [data-hl-group='${group}']`)].filter((e) => on(box(e))).map((e) => (e.getAttribute("data-hl-key") || "?").split("/").pop()))].join("+") || "none";
  const heard = () => { const b = [...document.querySelectorAll("button")].find((e) => on(box(e)) && !e.closest("[inert]") && (isAr ? /^إيقاف/ : /^Pause/).test(e.getAttribute("aria-label") || "")); const m = b && (b.getAttribute("aria-label") || "").match(/[\d٠-٩]+:[\d٠-٩]+$/); return m ? m[0].replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))) : "-"; };
  const verse = (n) => [...document.querySelectorAll(`#verse-${n}`)].find((e) => on(box(e)));
  const press = async (el, ms) => {
    // Aim where the page answers with this verse, not at its box's middle: a verse that wraps a
    // line is two strips, and the middle of the box around both can be its neighbour's words.
    const r = box(el); const steps = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9]; let at = null;
    for (const fy of steps) for (const fx of steps) { const x = r.left + r.width * fx, y = r.top + r.height * fy; if (!at && x > 0 && y > 0 && x < innerWidth && y < innerHeight && el.contains(document.elementFromPoint(x, y))) at = { x, y }; }
    if (!at) return false;
    const hit = document.elementFromPoint(at.x, at.y);
    const fire = (type) => hit.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 11, pointerType: "touch", isPrimary: true, clientX: at.x, clientY: at.y, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    fire("pointerdown"); await wait(ms); fire("pointerup");
    if (ms < 300) hit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y }));

    return true;
  };
  await wait(1500);
  const from = verse(Number(window.__from || 46));
  const to = verse(Number(window.__to || 48));
  if (window.__mode === "listen") {
    if (!from) return `${out[0]} ; no verse ${window.__from || 46} on screen`;
    if (!(await press(from, 80))) return `${out[0]} ; no point on verse ${window.__from || 46} a finger can hit`;
    await wait(1200);
    const lit = keys("selection");
    const note = document.querySelector("[role=dialog]");
    const close = note && [...note.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === (isAr ? "إغلاق" : "Close"));
    out.push(`tapped: lit=${lit} note=${note ? "open" : "none"}`);
    if (close) { close.click(); await wait(900); }
    const tools = [...document.querySelectorAll("button")].filter((e) => on(box(e)) && !e.closest("[inert]") && (isAr ? /^استمع إلى/ : /^Listen to /).test(e.getAttribute("aria-label") || "") && (e.getAttribute("aria-label") || "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).endsWith(lit));
    out.push(`after close: note=${document.querySelector("[role=dialog]") ? "open" : "none"} listen=${tools.length}`);
    if (!tools.length) return out.join(" ; ");
    tools[0].click();
  } else {
  if (!from || !to) return `${out[0]} ; no verse ${from ? window.__to || 48 : window.__from || 46} on screen`;
  if (!(await press(from, 700))) return `${out[0]} ; no point on verse ${window.__from || 46} a finger can hit`;
  await wait(600);
  out.push(`held: lit=${keys("selection")}`);
  const item = [...document.querySelectorAll("[role=menuitem]")].find((e) => (isAr ? /^تلاوة إلى$/ : /^Play to$/).test(e.textContent.trim()));
  if (!item) return `${out[0]} ; no Play to; items=${[...document.querySelectorAll("[role=menuitem]")].map((e) => e.textContent.trim().slice(0, 12)).join("|")}`;
  item.click(); await wait(500);
  out.push(`picking: lit=${keys("selection")}`);
  if (!(await press(to, 80))) return `${out.join(" ; ")} ; no point on verse ${window.__to || 48} a finger can hit`;
  }
  let last = ""; const t0 = Date.now(); let ended = 0;
  while (Date.now() - t0 < Number(window.__watch || 40000)) {
    const h = heard();
    const now = `heard=${h} lit=${keys("selection")} ring=${keys("heard")}`;
    if (now !== last) { out.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${now}`); last = now; }
    if (h === "-" && Date.now() - t0 > 3000) { if (!ended) ended = Date.now(); else if (Date.now() - ended > 2500) break; } else ended = 0;
    await wait(150);
  }
  out.push(`end: lit=${keys("selection")} ring=${keys("heard")} played=${(window.__aud || []).length} sounding=${(window.__aud || []).filter((a) => !a.paused).length}`);
  const stop = [...document.querySelectorAll("button")].find((e) => on(box(e)) && (isAr ? /^إيقاف/ : /^Pause/).test(e.getAttribute("aria-label") || ""));
  if (stop) stop.click();
  return out.join(" ; ");
})()
