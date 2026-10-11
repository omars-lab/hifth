(async () => {
  // Settings in the apps, scrolled to the end: one line under the title, nothing cut off, and
  // which choices this screen offers against how many pages it shows. Boxes, counts and the
  // choices' own ids only.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
  const on = (r) => r && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const f = (b) => (b ? `${Math.round(b.left)},${Math.round(b.top)}-${Math.round(b.right)},${Math.round(b.bottom)}` : "none");
  const out = [`view=${innerWidth}x${innerHeight} lang=${document.documentElement.lang}`];
  await wait(2500);
  // The next leaf waits behind, hidden but laid out where it will slide in: not a page in sight.
  const pages = [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")].filter((e) => on(box(e)) && getComputedStyle(e).visibility === "visible");
  out.push(`pages=${pages.length}`);
  const open = [...document.querySelectorAll("button")].find((b) => /^(About Hifth|عن حِفظ)/.test(b.getAttribute("aria-label") || "") && on(box(b)));
  if (!open) return out.concat("no settings button").join(" ; ");
  open.click();
  await wait(1200);
  const sheet = [...document.querySelectorAll("[role=dialog]")].find((d) => on(box(d)) && d.querySelector("[aria-labelledby^='colophon-']"));
  if (!sheet) return out.concat("no settings sheet").join(" ; ");
  const head = sheet.querySelector("header");
  const first = head?.nextElementSibling;
  const lineUnder = parseFloat(getComputedStyle(head).borderBottomWidth) || 0;
  const lineOver = first ? parseFloat(getComputedStyle(first).borderTopWidth) || 0 : 0;
  const ids = [...new Set([...sheet.querySelectorAll("section[aria-labelledby^='colophon-']")].map((s) => s.getAttribute("aria-labelledby").replace("colophon-", "")))];
  out.push(`sheet=${f(box(sheet))} linesUnderTitle=${(lineUnder > 0 ? 1 : 0) + (lineOver > 0 ? 1 : 0)} choices=${ids.join(",")}`);
  // Scroll whatever scrolls inside the sheet to its end.
  const scroller = [sheet, ...sheet.querySelectorAll("*")].find((e) => e.scrollHeight > e.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
  if (scroller) { scroller.scrollTo({ top: scroller.scrollHeight }); await wait(800); }
  const sb = box(scroller || sheet);
  const last = [...sheet.querySelectorAll("section")].pop();
  const lb = box(last);
  const wide = [...sheet.querySelectorAll("button, a, [role=radio]")].map(box).filter((r) => r && on(r) && (r.left < sb.left - 1 || r.right > sb.right + 1)).length;
  out.push(`end: scrolled=${scroller ? Math.round(scroller.scrollTop) + "/" + (scroller.scrollHeight - scroller.clientHeight) : "no scroll"} lastSection=${f(lb)} lastInSight=${lb && lb.bottom <= Math.min(sb.bottom, innerHeight) + 1 ? "yes" : "no"} sideways=${scroller ? scroller.scrollWidth - scroller.clientWidth : 0} cutAtSides=${wide}`);
  return out.join(" ; ");
})()
