/*
 * Held upright, a turn lands at the top of the next page (checklist: "On an
 * iPad held upright, open a verse low on its page and turn forward";
 * docs/PLAN.md, item 97). Opened on a verse low on its page, the page is
 * bigger than the screen and scrolled to its foot; the next page should start
 * at its top, just under the bars, and the page before, turned back to, should
 * show its foot where it was left. The red ribbon marking where the reader left
 * off should lie across the page's bound edge before and after (checklist: "wait
 * for the red ribbon, turn forward and back"), so the page should be left open
 * six seconds first (DELAY_MS=8000).
 *
 * Prints, at the start, after a turn forward and after a turn back: the page in
 * sight, its top and bottom against the screen, the lowest edge of the bars
 * across the top, the zoom, and how far the ribbon's middle stands from the
 * page's left edge (pages 7 and 8 here are bound on the left; "-" where it has
 * not come yet). Turns by the Next and Previous page buttons
 * where the screen has them, and by the arrow keys where it does not. Page
 * numbers, edges and the zoom only.
 * Runs in the iPad app, upright, opened on a verse:
 *   make app-probe TARGET=ipad LOCALE=en ROUTE=/hafs-kfqc/2:46 EVALFILE=.claude/skills/walk-app/scripts/turn-top-walk.js DELAY_MS=8000 PROBE_TIMEOUT_S=200
 */
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (e) => { const r = e && e.getBoundingClientRect(); return r && r.width ? r : null; };
  const on = (r) => r && r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const isAr = document.documentElement.lang === "ar";
  const zoomNow = () => {
    const t = [...document.querySelectorAll("[role=group] span")].filter((e) => on(box(e)))
      .map((e) => e.textContent.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))).find((s) => /^\d+\s?[%٪]$/.test(s));
    return t ? Number.parseInt(t, 10) : null;
  };
  const shown = () => [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")]
    .filter((e) => on(box(e)) && getComputedStyle(e).visibility === "visible")
    .map((e) => ({ n: Number(e.getAttribute("aria-labelledby").replace("page-label-", "")), b: box(e) }));
  // The bars across the top: anything that starts near the top, spans most of
  // the width and holds no page.
  const barsFoot = () => Math.round(Math.max(0, ...[...document.querySelectorAll("header, nav, [role=toolbar], [role=group]")]
    .filter((e) => !e.querySelector("svg[aria-labelledby^='page-label-']")).map(box).filter((b) => on(b) && b.top < 120 && b.bottom < innerHeight / 3 && b.width > innerWidth * 0.3).map((b) => b.bottom)));
  const ribbon = () => {
    const s = box(document.querySelector("[data-bookmark-seam]"));
    const p = shown()[0];
    return s && p ? Math.round((s.left + s.right) / 2 - p.b.left) : "-";
  };
  const look = (what) => {
    const p = shown().map((x) => `p${x.n}:top=${Math.round(x.b.top)},bottom=${Math.round(x.b.bottom)}`).join(" ");
    return `${what} view=${innerWidth}x${innerHeight} ${p || "no page"} barsFoot=${barsFoot()} zoom=${zoomNow() ?? "?"} ribbonFromEdge=${ribbon()}`;
  };
  const turn = async (forward) => {
    const name = forward ? (isAr ? "الصفحة التالية" : "Next page") : (isAr ? "الصفحة السابقة" : "Previous page");
    const b = [...document.querySelectorAll("button")].find((e) => on(box(e)) && !e.closest("[inert]") && e.getAttribute("aria-label") === name);
    if (b) b.click();
    else document.dispatchEvent(new KeyboardEvent("keydown", { key: forward ? "ArrowLeft" : "ArrowRight", bubbles: true }));
    await wait(2500);
    return b ? "button" : "key";
  };
  const out = [];
  await wait(1500);
  out.push(look("start"));
  out.push(look(`forward(${await turn(true)})`));
  out.push(look(`back(${await turn(false)})`));
  return out.join(" ; ");
})()
