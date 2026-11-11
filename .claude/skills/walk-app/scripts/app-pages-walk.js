(async () => {
  // The row of page icons along the bottom, in the apps. It switches the row on from the info
  // panel, measures the row against the screen and the bar above it, opens settings as a page
  // and measures that, goes back to the mus'haf, then switches the row off again so the device
  // is left as it was. `window.__leave = "row";` (or "settings") on a line ahead of it leaves
  // that on the screen for a picture, with the row still on: run it once more without the line
  // to switch it off. Boxes and counts only.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
  const on = (r) => r && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const f = (b) => (b ? `${Math.round(b.left)},${Math.round(b.top)}-${Math.round(b.right)},${Math.round(b.bottom)}` : "none");
  const out = [`view=${innerWidth}x${innerHeight} lang=${document.documentElement.lang} dir=${document.documentElement.dir}`];
  await wait(2500);
  const leaf = () => [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")].find((e) => on(box(e)) && getComputedStyle(e).visibility === "visible");
  const row = () => document.querySelector("nav [data-app-page]")?.closest("nav");
  const choose = async (choice) => {
    const open = [...document.querySelectorAll("button")].find((b) => /^(.*[·،] )?(About Hifth|عن حِفظ)/.test(b.getAttribute("aria-label") || "") && on(box(b)));
    if (!open) return "no button for the info panel";
    open.click();
    await wait(1200);
    const pick = document.querySelector(`[data-app-pages="${choice}"]`);
    if (!pick) return "the info panel has no choice for the row";
    pick.click();
    await wait(600);
    // A made-up Escape is not heard by the panel; its own close button is.
    pick.closest("[role=dialog]")?.querySelector("header button")?.click();
    await wait(900);
    return document.querySelector(`[data-app-pages="${choice}"]`) ? "the info panel did not close" : "";
  };
  const before = box(leaf());
  out.push(`before: page=${f(before)} row=${row() ? "already on" : "off"}`);
  if (!row()) { const said = await choose("row"); if (said) return out.concat(said).join(" ; "); }
  const nav = row();
  if (!nav) return out.concat("the row did not come on").join(" ; ");
  const nb = box(nav);
  const icons = [...nav.querySelectorAll("[data-app-page]")];
  const ib = icons.map(box);
  // The bar that stood lowest before the row: nothing of it may lie under the row.
  const above = [...document.querySelectorAll("footer, [role=slider]")].map(box).filter(Boolean);
  const under = above.filter((r) => r.bottom > nb.top + 1).length;
  out.push(`row: box=${f(nb)} belowScreen=${Math.round(nb.bottom - innerHeight)} icons=${icons.map((b) => b.dataset.appPage).join(",")} iconBoxes=${ib.map(f).join("|")} iconsUnder44=${ib.filter((r) => r && (r.height < 43.5 || r.width < 43.5)).length} barsUnderRow=${under} page=${f(box(leaf()))} sideways=${document.documentElement.scrollWidth - innerWidth}`);
  // How much of the row's height is kept clear for the home bar.
  out.push(`homeBarRoom=${Math.round(parseFloat(getComputedStyle(nav).paddingBottom) || 0)} lowestIconBottom=${Math.round(Math.max(...ib.map((r) => r.bottom)))}`);
  const kept = leaf();
  if (kept) kept.__walkKept = true;
  nav.querySelector('[data-app-page="settings"]')?.click();
  await wait(1200);
  const sheet = document.querySelector('[role=dialog][data-as="page"]');
  if (!sheet) { out.push("settings did not open as a page"); }
  else {
    const sb = box(sheet);
    const groups = [...sheet.querySelectorAll("[role=radiogroup]")];
    const wide = groups.map(box).filter(Boolean);
    out.push(`settings: box=${f(sb)} gapToRow=${Math.round(box(row()).top - sb.bottom)} groups=${groups.length} widestGroup=${Math.round(Math.max(0, ...wide.map((r) => r.width)))} offSides=${wide.filter((r) => r.left < -1 || r.right > innerWidth + 1).length} closeButton=${[...sheet.querySelectorAll("header button")].filter((b) => on(box(b))).length} sideways=${sheet.scrollWidth - sheet.clientWidth}`);
    if (window.__leave === "settings") return out.concat("left open on settings, the row still on").join(" ; ");
  }
  row()?.querySelector('[data-app-page="mushaf"]')?.click();
  await wait(900);
  const back = leaf();
  out.push(`back: page=${f(box(back))} sameDrawing=${back && back.__walkKept ? "yes" : "no"} settingsGone=${document.querySelector('[role=dialog][data-as="page"]') ? "no" : "yes"}`);
  if (window.__leave === "row") return out.concat("left with the row on").join(" ; ");
  const said = await choose("off");
  out.push(said || `put back: row=${row() ? "still on" : "off"} page=${f(box(leaf()))}`);
  return out.join(" ; ");
})()
