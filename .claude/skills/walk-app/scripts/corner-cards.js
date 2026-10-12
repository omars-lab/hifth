(async () => {
  // Each card that stands in a corner, opened on its own over the lit verse: the note, the
  // roots list (also scrolled to its end), and the first two look-alike lists. For each: the
  // cards' boxes, the page's box, how much of the lit verse is under a card, how many lit lines
  // run past the screen's edge, and whether a look-alike button sits on the page or on a
  // card's Close. Boxes and numbers only, never words, so it is safe on the private build.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const f = (r) => (r ? `${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)}` : "none");
  const cut = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const isClose = (b) => /^(Close|إغلاق)$/.test((b.getAttribute("aria-label") || b.textContent || "").trim());
  // On a phone the note and the lists rise from the foot across the whole width: set
  // `window.__wide = true;` on a line before the script to count them (a whole-screen box is
  // still left out).
  const wide = window.__wide === true;
  // Only the outer card: a section inside a card's scroll is clipped by it, and one scrolled out
  // of sight counted as a card over the page (51% under, on a large iPad upright).
  const cards = () => {
    const all = [...document.querySelectorAll("[role=dialog], section")]
      .map((e) => [e, e.getBoundingClientRect()])
      .filter(([e, r]) => r.width > 200 && r.height > 80 && (wide ? r.height < innerHeight - 60 : r.width < innerWidth - 40) && getComputedStyle(e).visibility !== "hidden");
    return all.filter(([e]) => !all.some(([o]) => o !== e && o.contains(e)));
  };
  const look = (t) => {
    const lit = [...document.querySelectorAll("#hifth-overlay [data-hl-group='selection']")].map((e) => e.getBoundingClientRect()).filter((r) => r.width);
    const all = lit.reduce((s, b) => s + b.width * b.height, 0);
    const cs = cards();
    const under = lit.reduce((s, b) => s + Math.max(0, ...cs.map(([, c]) => cut(b, c))), 0);
    const off = lit.filter((b) => b.left < -1 || b.right > innerWidth + 1).length;
    const page = [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")].find((e) => e.getBoundingClientRect().width && getComputedStyle(e).visibility === "visible");
    const p = page?.getBoundingClientRect();
    const closes = [...document.querySelectorAll("[role=dialog] button")].filter(isClose).map((b) => b.getBoundingClientRect());
    const chips = [...document.querySelectorAll("button[data-direction]")].map((b) => b.getBoundingClientRect()).filter((r) => r.width);
    const chipsOnPage = chips.filter((c) => p && !cs.some(([, k]) => cut(c, k) > 0) && cut(c, p) > 0).length;
    const chipsOnClose = chips.filter((c) => closes.some((x) => cut(c, x) > 0)).length;
    return `${t}: cards=${cs.map(([e, c]) => `${e.tagName}${e.dataset.tall ? "(tall)" : ""}@${f(c)}`).join("|") || "none"} page=${f(p)} under=${all ? Math.round((100 * under) / all) : "-"}% off=${off} chipsOnPage=${chipsOnPage} chipsOnClose=${chipsOnClose}`;
  };
  const closeTop = async () => { const c = [...document.querySelectorAll("[role=dialog] button")].find(isClose); c?.click(); await wait(1200); };
  await wait(1500);
  const out = [`view=${innerWidth}x${innerHeight}`, look("opened")];
  await closeTop();
  out.push(look("closed"));
  // The roots button is in the verse's drawer, which is up only with nothing else open.
  const roots = [...document.querySelectorAll("button")].find((b) => /^(Roots ·|الجذور)/.test((b.getAttribute("aria-label") || b.textContent || "").trim()));
  if (roots) {
    roots.click(); await wait(1800); out.push(look("roots"));
    const sc = cards().map(([e]) => e).find((e) => e.scrollHeight > e.clientHeight + 4);
    if (sc) { sc.scrollTop = sc.scrollHeight; await wait(1200); out.push(look("roots-end")); }
    await closeTop();
  } else out.push("no roots button");
  const chips = [...document.querySelectorAll("button[data-direction]")];
  out.push(`chips=${chips.length}`);
  for (const chip of chips.slice(0, 2)) { chip.click(); await wait(1800); out.push(look(`chip-${chip.dataset.direction}`)); chip.click(); await wait(900); }
  return out.join(" ; ");
})()
