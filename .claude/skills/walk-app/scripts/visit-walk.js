// One whole visit in the real app, as a reader in the room would make it: a note open, read to
// its end, a reference in it followed and come back from, a surah played from its corner with
// the note still open, then paused. It prints only boxes, verse numbers and button names, never
// the words of a note, so its answer can be pasted into a record.
// Run it inside the iPad app on the pitch build, with a note open:
//   make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en ROUTE=/hafs-kfqc/2:48 \
//     EVALFILE=.claude/skills/walk-app/scripts/visit-walk.js DELAY_MS=2500 PROBE_TIMEOUT_S=200
// "F: no close" is expected: starting a run from the corner already shut the note.
(async () => {
  // One visit across features, shape only: boxes, verse numbers and button names, never note words.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { this.volume = 0.01; this.playbackRate = 4; return play.call(this); };
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
  const f = (b) => (b ? `${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.right)},${Math.round(b.bottom)}` : "none");
  const overlap = (a, b) => a && b ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) : 0;
  const isAr = document.documentElement.lang === "ar";
  const shownSvgs = () => [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")]
    .filter((e) => { const r = box(e); return r && r.right > 0 && r.left < innerWidth; });
  const shown = () => shownSvgs().map((e) => e.getAttribute("aria-labelledby").replace("page-label-", "")).join("+");
  // Lit verses on screen only: upright, the page left behind stays in the page with its
  // verse still lit, drawn nowhere, and counting it read as two verses lit at once.
  const onScreen = (e) => { const r = box(e); return r && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const sel = () => [...new Set([...document.querySelectorAll("#hifth-overlay [data-hl-group='selection']")].filter(onScreen).map((e) => (e.getAttribute("data-hl-key") || "?").split("/").pop()))].join("+");
  const runBtns = () => [...document.querySelectorAll("button")].filter((e) => box(e) && box(e).bottom > 0 && box(e).top < innerHeight)
    .map((e) => e.getAttribute("aria-label") || "").filter((s) => (isAr ? /^(تشغيل|إيقاف)/ : /^(Play|Pause|Stop)/).test(s)).map((s) => s.split(" ")[0]).join("/");
  const note = () => document.querySelector("[role=dialog]");
  const litBoxes = () => [...document.querySelectorAll("#hifth-overlay [data-hl-group='selection']")].map(box).filter(Boolean);
  const look = (label) => {
    const d = note(); const db = box(d);
    const ref = d && d.querySelector("header span:last-of-type");
    const lit = litBoxes(); const all = lit.reduce((s, b) => s + b.width * b.height, 0);
    const under = lit.reduce((s, b) => s + overlap(b, db), 0);
    const offScreen = lit.filter((b) => b.bottom > innerHeight || b.top < 0 || b.right > innerWidth || b.left < 0).length;
    const back = d && [...d.querySelectorAll("button")].find((b) => /↩|↪/.test(b.textContent));
    out.push(`${label}: hash=${location.hash} shown=${shown()} sel=${sel()} note=${f(db)} noteRef=${ref ? ref.textContent.replace(/\s+/g, " ").trim() : "-"} litUnderNote=${all ? Math.round(100 * under / all) : "-"}% litOff=${offScreen} back=${back ? "yes" : "no"} run=${runBtns() || "-"} notes=${document.querySelectorAll("[role=dialog]").length}`);
  };
  await wait(1200);
  out.push(`view=${innerWidth}x${innerHeight}`);
  look("A open");
  // B: the note read to its end.
  const d0 = note();
  const sc = d0 && [d0, ...d0.querySelectorAll("*")].find((e) => e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY !== "visible");
  if (sc) { sc.scrollTop = sc.scrollHeight; await wait(800); out.push(`B scrolled: top=${Math.round(sc.scrollTop)} max=${sc.scrollHeight - sc.clientHeight}`); look("B end"); sc.scrollTop = 0; await wait(500); }
  else out.push("B: no scroller in the note");
  // C: follow the first live reference.
  const cite = d0 && [...d0.querySelectorAll("button")].find((b) => !b.disabled && (isAr ? /^اذهب إلى/ : /^Go to/).test(b.getAttribute("aria-label") || ""));
  if (!cite) { out.push("C: no live reference"); return out.join(" ; "); }
  out.push("C follow=" + cite.getAttribute("aria-label"));
  cite.click(); await wait(3000); look("C after");
  // D: back.
  const d1 = note();
  const back = d1 && [...d1.querySelectorAll("button")].find((b) => /↩|↪/.test(b.textContent));
  if (back) { back.click(); await wait(3000); look("D back"); } else out.push("D: no back button");
  // E: a recitation from the corner while the note is open.
  const host = shownSvgs().map((s) => s.closest("[data-host-page]")).filter(Boolean)
    .map((h) => h.querySelector("[data-running-head='surah']")).find((h) => box(h) && overlap(box(h), box(note())) === 0);
  if (!host) { out.push("E: no uncovered surah corner"); return out.join(" ; "); }
  const r = box(host); const at = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const hit = document.elementFromPoint(at.x, at.y) || host;
  const fire = (type) => hit.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 9, pointerType: "touch", isPrimary: true, clientX: at.x, clientY: at.y, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
  fire("pointerdown"); await wait(700); fire("pointerup"); await wait(600);
  const items = [...document.querySelectorAll("[role=menuitem]")];
  const item = items.find((e) => (isAr ? /^تلاوة$/ : /^Play$/).test(e.textContent.trim()));
  if (!item) { out.push("E: no Play; items=" + items.length); return out.join(" ; "); }
  item.click();
  let last = ""; const t0 = Date.now();
  while (Date.now() - t0 < 9000) {
    const now = `shown=${shown()} sel=${sel()} run=${runBtns()} notes=${document.querySelectorAll("[role=dialog]").length}`;
    if (now !== last) { out.push(`E ${((Date.now() - t0) / 1000).toFixed(1)}s ${now}`); last = now; }
    await wait(300);
  }
  look("E playing");
  // F: close the note mid-run.
  const close = note() && [...note().querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === (isAr ? "إغلاق" : "Close"));
  if (close) close.click(); else out.push("F: no close");
  const t1 = Date.now(); last = "";
  while (Date.now() - t1 < 7000) {
    const now = `shown=${shown()} sel=${sel()} run=${runBtns()} notes=${document.querySelectorAll("[role=dialog]").length}`;
    if (now !== last) { out.push(`F ${((Date.now() - t1) / 1000).toFixed(1)}s ${now}`); last = now; }
    await wait(300);
  }
  look("F closed");
  // G: pause.
  const pause = [...document.querySelectorAll("button")].find((e) => box(e) && (isAr ? /^إيقاف/ : /^Pause/).test(e.getAttribute("aria-label") || ""));
  if (pause) { pause.click(); await wait(1200); look("G paused"); } else out.push("G: no pause");
  return out.join(" ; ");
})()
