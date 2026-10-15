/*
 * Does a note stay open, its verse in sight, when the iPad is handed across a
 * table and turned (checklist: "Open a note with the iPad on its side, turn it
 * upright, then back")?
 *
 * The page cannot turn the simulator, so the sideways probe's UI test does,
 * at the seconds TURNS names; this only watches. After each change of screen
 * size has settled it prints the screen, whether the note is up, how many of
 * the lit verse's lines there are, how many sit wholly on the screen, how many
 * any part of the note covers, and the zoom. After the second turn (back on its
 * side) it presses Zoom in up to `window.__zoom` percent (150 unless set; 0
 * skips it), so the third and fourth turns are walked zoomed in. It ends at the
 * fourth turn or after `window.__watch` ms (60000 unless set), and says how many
 * turns it saw: a walk that saw none checked nothing.
 * Runs in the iPad app, on its side, opened on a verse's note:
 *   make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en "ROUTE=/hafs-kfqc/2:255?open=commentary" EVALFILE=.claude/skills/walk-app/scripts/hand-turn-walk.js DELAY_MS=2500 TURNS=12,22,34,44 PROBE_TIMEOUT_S=200
 * Boxes, counts and the zoom only, never note words.
 */
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (e) => { const r = e && e.getBoundingClientRect(); return r && r.width ? r : null; };
  const on = (r) => r && r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const inside = (r) => r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
  const meets = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
  const f = (b) => (b ? `${Math.round(b.left)},${Math.round(b.top)}-${Math.round(b.right)},${Math.round(b.bottom)}` : "none");
  const watch = window.__watch ?? 60000;
  const target = window.__zoom ?? 150;
  const isAr = document.documentElement.lang === "ar";
  const zoomNow = () => {
    const shown = [...document.querySelectorAll("[role=group] span")].filter((e) => on(box(e)));
    const t = shown.map((e) => e.textContent.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))).find((s) => /^\d+\s?[%٪]$/.test(s));
    return t ? Number.parseInt(t, 10) : null;
  };
  const look = (label) => {
    const note = [...document.querySelectorAll("[role=dialog]")].map(box).find(on) || null;
    const lit = [...document.querySelectorAll("#hifth-overlay [data-hl-group='selection']")].map(box).filter((b) => b && b.width);
    const whole = lit.filter(inside).length;
    const under = note ? lit.filter((b) => meets(b, note)).length : 0;
    const span = lit.length ? { left: Math.min(...lit.map((b) => b.left)), top: Math.min(...lit.map((b) => b.top)), right: Math.max(...lit.map((b) => b.right)), bottom: Math.max(...lit.map((b) => b.bottom)) } : null;
    return `${label} view=${innerWidth}x${innerHeight} note=${note ? f(note) : "none"} lines=${lit.length} verse=${f(span)} wholeOnScreen=${whole} underNote=${under} zoom=${zoomNow() ?? "?"}`;
  };
  const out = [];
  await wait(1500);
  out.push(look("start"));
  const t0 = Date.now();
  let last = `${innerWidth}x${innerHeight}`;
  let turns = 0;
  while (Date.now() - t0 < watch && turns < 4) {
    await wait(250);
    const now = `${innerWidth}x${innerHeight}`;
    if (now === last) continue;
    last = now;
    turns += 1;
    await wait(1800);
    out.push(look(`turn${turns}@${Math.round((Date.now() - t0) / 1000)}s`));
    if (turns === 2 && target > 0) {
      const plus = [...document.querySelectorAll("button")].find((e) => on(box(e)) && !e.closest("[inert]") && e.getAttribute("aria-label") === (isAr ? "تكبير" : "Zoom in"));
      for (let i = 0; plus && i < 6 && (zoomNow() ?? 0) < target; i++) { plus.click(); await wait(500); }
      await wait(1200);
      out.push(look(plus ? "zoomed" : "no Zoom in button"));
    }
  }
  out.push(`turnsSeen=${turns}`);
  return out.join(" ; ");
})()
