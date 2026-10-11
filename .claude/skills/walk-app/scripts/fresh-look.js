// What a reader meets the first time the app opens: how long until the page showed, which pages
// are up, whether anything lies over them, and what the app has stored already. Run it right after
// the app is taken off the simulator, so nothing from a past launch is kept:
//   xcrun simctl uninstall <iPad id> com.bytesofpurpose.hifth
//   make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en ROUTE= \
//     EVALFILE=.claude/skills/walk-app/scripts/fresh-look.js DELAY_MS=2500 PROBE_TIMEOUT_S=200
// It prints numbers, page numbers and stored-setting names only, never words off the page.
// Inside the app the files come through its own address, which WebKit keeps no timings for, so
// the file lines read -1 and none there; in a browser they give each folder's count.
(async () => {
  // A fresh launch, shape only: times, page numbers, counts and stored-setting names.
  const box = (e) => { const r = e.getBoundingClientRect(); return r.width && r.height ? r : null; };
  const nav = performance.getEntriesByType("navigation")[0];
  const paint = performance.getEntriesByType("paint").find((e) => e.name === "first-contentful-paint");
  const files = performance.getEntriesByType("resource");
  const pages = files.filter((e) => /\/pages\/.*\.svg/.test(e.name));
  const firstPage = pages.length ? Math.round(Math.min(...pages.map((e) => e.responseEnd))) : -1;
  // Every file asked for, counted by its folder under assets, so a slow one has a place to look.
  const byFolder = {};
  for (const e of files) { const m = e.name.match(/\/assets\/([^/]+)\//); const k = m ? m[1] : "other"; byFolder[k] = (byFolder[k] || 0) + 1; }
  const lastFile = files.length ? Math.round(Math.max(...files.map((e) => e.responseEnd))) : -1;
  const shownSvgs = [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")]
    .filter((e) => { const r = box(e); return r && r.right > 0 && r.left < innerWidth; });
  const shown = shownSvgs.map((e) => e.getAttribute("aria-labelledby").replace("page-label-", ""));
  // Anything drawn over the middle of each page shown: what a first tap would land on.
  const covered = shownSvgs.filter((e) => {
    const r = box(e); const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    return !(hit && hit.closest("svg[aria-labelledby^='page-label-']") === e);
  }).length;
  const dialogs = [...document.querySelectorAll("[role=dialog]")].filter(box).length;
  const keys = [];
  try { for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); } catch { keys.push("unreadable"); }
  const ms = (v) => (v == null ? -1 : Math.round(v));
  return [
    `view=${innerWidth}x${innerHeight}`,
    `lang=${document.documentElement.lang}`,
    `hash=${location.hash || "-"}`,
    `ready_ms=${ms(nav && nav.domContentLoadedEventEnd)}`,
    `load_ms=${ms(nav && nav.loadEventEnd)}`,
    `first_paint_ms=${ms(paint && paint.startTime)}`,
    `first_page_svg_ms=${firstPage}`,
    `page_svgs=${pages.length}`,
    `last_file_ms=${lastFile}`,
    `files=${Object.entries(byFolder).map(([k, n]) => `${k}:${n}`).join(",") || "none"}`,
    `shown=${shown.join("+") || "none"}`,
    `pages_covered=${covered}`,
    `dialogs=${dialogs}`,
    `stored=${keys.sort().join(",") || "none"}`,
  ].join(" ; ");
})()
