(async () => {
  // A surah played from its corner, then a note opened on the verse being recited, from its
  // number's menu (docs/PLAN.md, items 76 and 77). Boxes, verse numbers and button names only,
  // never note words. Set before it runs, from a Playwright page: window.__before, how long
  // the run plays first (ms, 14000 by default, so the second verse is heard); window.__after,
  // how long it watches with the note up; window.__mode "bare" (a tap on bare page) or "hold"
  // (a long press on the verse being recited) instead of the number and the note, or "turn" (a
  // swipe with the note up, in place of its Pause; window.__turnBy "key" turns by the arrow key,
  // for the Mac); window.__page,
  // the page whose surah corner to play; window.__rate, how fast the sound plays.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { this.volume = 0.01; window.__aud ||= []; if (!window.__aud.includes(this)) window.__aud.push(this); this.playbackRate = Number(window.__rate || 1); return play.call(this); };
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
  const on = (r) => r && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const f = (b) => (b ? `${Math.round(b.top)}-${Math.round(b.bottom)}` : "none");
  const isAr = document.documentElement.lang === "ar";
  const shown = () => [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")].filter((e) => on(box(e))).map((e) => e.getAttribute("aria-labelledby").replace("page-label-", "")).join("+");
  const litBoxes = () => [...document.querySelectorAll("#hifth-overlay [data-hl-group='selection']")].map(box).filter(on);
  const sel = () => [...new Set([...document.querySelectorAll("#hifth-overlay [data-hl-group='selection']")].filter((e) => on(box(e))).map((e) => (e.getAttribute("data-hl-key") || "?").split("/").pop()))].join("+");
  const note = () => [...document.querySelectorAll("[role=dialog]")].find((e) => box(e));
  // The copy of a closing note that slides away is inert: nobody can press it, so it is not counted.
  const runBtns = () => [...document.querySelectorAll("button")].filter((e) => on(box(e)) && !e.closest("[inert]")).map((e) => e.getAttribute("aria-label") || "").filter((s) => (isAr ? /^(تشغيل|إيقاف)/ : /^(Play|Pause|Stop)/).test(s)).map((s) => s.split(" ")[0]).join("/");
  const look = () => {
    const nb = box(note());
    const lit = litBoxes();
    const all = lit.reduce((s, b) => s + b.width * b.height, 0);
    const under = nb ? lit.reduce((s, b) => s + Math.max(0, Math.min(b.right, nb.right) - Math.max(b.left, nb.left)) * Math.max(0, Math.min(b.bottom, nb.bottom) - Math.max(b.top, nb.top)), 0) : 0;
    return `shown=${shown()} sel=${sel()} lit=${lit.length ? f({ top: Math.min(...lit.map((b) => b.top)), bottom: Math.max(...lit.map((b) => b.bottom)) }) : "none"} note=${f(nb)} litUnderNote=${all ? Math.round((100 * under) / all) : 0}% run=${runBtns()} audio=${(window.__aud || []).map((a) => (a.paused ? "p" : "P") + Math.round(a.currentTime)).join(",")} pressed=${[...document.querySelectorAll("button[aria-pressed=true]")].filter((e) => on(box(e)) && !e.closest("[inert]")).length}`;
  };
  await wait(1500);
  // A: play the surah from its corner.
  const mid = (b) => document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  // window.__page picks the surah corner on that page (the open book shows two).
  const heads = [...document.querySelectorAll(window.__page ? `[data-host-page="${window.__page}"] [data-running-head='surah']` : "[data-running-head='surah']")];
  const host = heads.find((h) => on(box(h)) && h.contains(mid(box(h))));
  if (!host) return `A: no reachable surah corner; heads=${heads.map((h) => f(box(h)) + ":" + (box(h) ? mid(box(h))?.tagName : "-")).join(",")}`;
  if (!host) return "A: no surah corner on screen";
  const r = box(host); const at = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const hit = document.elementFromPoint(at.x, at.y) || host;
  const fire = (type) => hit.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 9, pointerType: "touch", isPrimary: true, clientX: at.x, clientY: at.y, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
  fire("pointerdown"); await wait(700); fire("pointerup"); await wait(600);
  const item = [...document.querySelectorAll("[role=menuitem]")].find((e) => (isAr ? /^تلاوة$/ : /^Play$/).test(e.textContent.trim()));
  if (!item) return `A: no Play; host=${f(r)} hit=${hit.tagName} items=${[...document.querySelectorAll("[role=menuitem]")].map((e) => e.textContent.trim().slice(0, 10)).join("|")}`;
  item.click();
  await wait(Number(window.__before || 14000));
  out.push("A playing: " + look());
  if (window.__mode === "bare" || window.__mode === "hold") {
    const lit = litBoxes()[0];
    const pt = window.__mode === "bare" ? { x: innerWidth / 2, y: lit.top - 120 } : { x: lit.left + lit.width / 2, y: lit.top + lit.height / 2 };
    const el = document.elementFromPoint(pt.x, pt.y);
    const fire2 = (type) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 11, pointerType: "touch", isPrimary: true, clientX: pt.x, clientY: pt.y, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    fire2("pointerdown"); await wait(window.__mode === "bare" ? 80 : 700); fire2("pointerup");
    if (window.__mode === "bare") el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: pt.x, clientY: pt.y }));
    await wait(700);
    out.push(`${window.__mode} at ${el.tagName}: ${look()} menu=${[...document.querySelectorAll("[role=menuitem]")].map((e) => e.textContent.trim().slice(0, 10)).join("|")}`);
    return out.join(" ; ");
  }
  // B: the number of the verse being recited, then its note.
  const key = sel().split("+").pop();
  const num = [...document.querySelectorAll("[data-verse-number]")].find((n) => [key, "/" + key].some((k) => (n.getAttribute("data-verse-key") || "").endsWith(k)) && on(box(n)));
  if (!num) { out.push(`B: no number on screen for ${key}`); return out.join(" ; "); }
  num.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  await wait(700);
  const items = [...document.querySelectorAll("[role=menuitem]")];
  out.push(`B after tap: ${look()}`); out.push(`B menu for ${key}: ${items.map((e) => e.textContent.trim().slice(0, 12)).join("|")}`);
  const noteItem = items.find((e) => e.textContent.includes("✎"));
  if (!noteItem) return out.join(" ; ");
  noteItem.click();
  let last = ""; const t0 = Date.now();
  while (Date.now() - t0 < Number(window.__after || 12000)) {
    const now = look();
    if (now !== last) { out.push(`C ${((Date.now() - t0) / 1000).toFixed(1)}s ${now}`); last = now; }
    await wait(250);
  }
  const lbl = (e) => (e.getAttribute("aria-label") || e.textContent || "").trim();
  const pauses = [...document.querySelectorAll("button,[role=button],[role=menuitem]")].filter((e) => on(box(e)) && /Pause|Stop|⏸/.test(lbl(e)));
  out.push(`D pause controls on screen=${pauses.length} inNote=${pauses.filter((e) => e.closest("[role=dialog]")).length} at=${pauses.map((e) => f(box(e))).join(",")}`);
  // T, with window.__mode "turn": a one-finger swipe turns the page by hand with the note up;
  // the recitation plays on (items 59 and 79).
  if (window.__mode === "turn") {
    if (window.__turnBy === "key") {
      // A desktop spread turns only from its outer edge, so the Mac turns by the arrow key.
      for (const type of ["keydown", "keyup"]) document.body.dispatchEvent(new KeyboardEvent(type, { key: "ArrowLeft", code: "ArrowLeft", bubbles: true, cancelable: true }));
    } else {
      const pt = { x: innerWidth / 2, y: Math.min(400, innerHeight / 3) };
      const el = document.elementFromPoint(pt.x, pt.y);
      const finger = (type, cx) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: "touch", isPrimary: true, clientX: cx, clientY: pt.y, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
      finger("pointerdown", pt.x);
      for (let k = 1; k <= 8; k++) { finger("pointermove", pt.x + k * 40); await wait(16); }
      finger("pointerup", pt.x + 320);
    }
    await wait(2500);
    out.push(`T after a ${window.__turnBy === "key" ? "key" : "swipe"}: ${look()}`);
    return `view=${innerWidth}x${innerHeight} ; ` + out.join(" ; ");
  }
  // E: the note's own Pause (item 77): the sound stops and the same note stays up.
  const noteFor = () => (note()?.getAttribute("aria-label") || "").match(/\d+:\d+/)?.[0] || "none";
  const before = noteFor();
  const pause = [...(note()?.querySelectorAll("button") || [])].find((e) => on(box(e)) && (isAr ? /^إيقاف/ : /^Pause/).test(e.getAttribute("aria-label") || ""))
    || [...document.querySelectorAll("button")].find((e) => on(box(e)) && (isAr ? /^إيقاف/ : /^Pause/).test(e.getAttribute("aria-label") || ""));
  if (pause) { pause.click(); await wait(1500); out.push(`E after ${pause.closest("[role=dialog]") ? "the note's" : "a"} Pause: noteFor ${before}->${noteFor()} ${look()}`); }
  return `view=${innerWidth}x${innerHeight} ; ` + out.join(" ; ");
})()
