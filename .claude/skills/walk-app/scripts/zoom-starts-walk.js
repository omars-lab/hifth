/*
 * Zooming in on the open book keeps the starts of the lines in sight
 * (checklist: "On an iPad on its side, press + to 200% and 300% on the open
 * book"; docs/PLAN.md, item 100). A line of the mus'haf begins at its
 * right-hand edge, so the right-hand page's outer edge and the left-hand
 * page's edge at the fold should both stay on the screen.
 *
 * Presses Zoom in to 200% and 300% and prints, each time, the screen's width,
 * the right-hand page's right edge and the left-hand page's; then turns to the
 * next opening at 200% and prints the same; then zooms back to 100% and says
 * how far the right-hand page stands from where it stood at the start; then
 * shows one page, zooms to 400% and prints that page's right edge against the
 * stage's. It copies the reader's settings first and puts them back at the
 * end. Page numbers, edges and the zoom only.
 * Runs in the iPad app, on its side, on a page:
 *   make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en ROUTE=/hafs-kfqc/p8 EVALFILE=.claude/skills/walk-app/scripts/zoom-starts-walk.js DELAY_MS=2500 PROBE_TIMEOUT_S=200
 */
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (e) => { const r = e && e.getBoundingClientRect(); return r && r.width ? r : null; };
  const on = (r) => r && r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const kept = Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]));
  const isAr = document.documentElement.lang === "ar";
  const label = (en, ar) => (isAr ? ar : en);
  const button = (name) => [...document.querySelectorAll("button, [role=radio]")].find((e) => on(box(e)) && !e.closest("[inert]") && e.getAttribute("aria-label") === name);
  const zoomNow = () => {
    const t = [...document.querySelectorAll("[role=group] span")].filter((e) => on(box(e)))
      .map((e) => e.textContent.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))).find((s) => /^\d+\s?[%٪]$/.test(s));
    return t ? Number.parseInt(t, 10) : null;
  };
  const zoomTo = async (target) => {
    const name = (zoomNow() ?? 0) < target ? label("Zoom in", "تكبير") : label("Zoom out", "تصغير");
    for (let i = 0; i < 10 && zoomNow() !== target; i++) { button(name)?.click(); await wait(600); }
    await wait(1200);
    return zoomNow();
  };
  // Shown pages, right-hand first.
  const pages = () => [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")]
    .filter((e) => on(box(e)) && getComputedStyle(e).visibility === "visible")
    .map((e) => ({ n: Number(e.getAttribute("aria-labelledby").replace("page-label-", "")), b: box(e) }))
    .sort((a, b) => b.b.right - a.b.right);
  const look = (what) => {
    const p = pages();
    const edges = p.map((x) => `p${x.n}:right=${Math.round(x.b.right)}`).join(",");
    const startsOn = p.every((x) => x.b.right <= innerWidth + 1 && x.b.right > 0);
    return `${what} zoom=${zoomNow() ?? "?"} view=${innerWidth} ${edges} lineStartsOnScreen=${startsOn ? "yes" : "no"}`;
  };
  const out = [];
  await wait(1500);
  out.push(look("start"));
  const startRight = pages()[0]?.b.right ?? 0;
  for (const z of [200, 300]) { await zoomTo(z); out.push(look(`at${z}`)); }
  await zoomTo(200);
  button(label("Next page", "الصفحة التالية"))?.click();
  await wait(2500);
  out.push(look("nextOpening"));
  await zoomTo(100);
  out.push(`${look("back")} movedFromStart=${Math.round((pages()[0]?.b.right ?? 0) - startRight)}`);
  const one = button(label("One page", "صفحة واحدة"));
  if (one) {
    one.click();
    await wait(2000);
    await zoomTo(400);
    const main = box(document.querySelector("main"));
    const p = pages()[0];
    out.push(`onePage zoom=${zoomNow() ?? "?"} p${p?.n}:right=${Math.round(p?.b.right ?? 0)} stageRight=${Math.round(Math.min(main?.right ?? innerWidth, innerWidth))}`);
    await zoomTo(100);
    button(label("Two pages", "صفحتان"))?.click();
    await wait(1200);
  } else out.push("no One page button");
  for (const k of Object.keys(localStorage)) if (!(k in kept)) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(kept)) localStorage.setItem(k, v);
  return out.join(" ; ");
})()
