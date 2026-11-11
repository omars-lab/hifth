(async () => {
  // The page in settings that explains the pencil's pens, in the apps: opened, its pens counted
  // and measured against the sheet, the highlighter pressed, and what the reader's own pen and
  // page were before and after. Boxes, counts and the pens' own names only.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
  const on = (r) => r && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const f = (b) => (b ? `${Math.round(b.left)},${Math.round(b.top)}-${Math.round(b.right)},${Math.round(b.bottom)}` : "none");
  const out = [`view=${innerWidth}x${innerHeight} lang=${document.documentElement.lang}`];
  await wait(2500);
  // Everything a press on that page must leave alone.
  const kept = () => {
    const all = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); all[k] = localStorage.getItem(k); }
    const tools = [...document.querySelectorAll("[data-tool]")].filter((e) => !e.closest("[data-pen-guide]")).map((e) => e.dataset.tool);
    const drawn = [...document.querySelectorAll("main svg")].map((s) => s.querySelectorAll("*").length);
    return JSON.stringify({ all, tools, drawn, pen: document.documentElement.dataset.pen, wordPen: document.documentElement.dataset.wordPen });
  };
  const open = [...document.querySelectorAll("button")].find((b) => /^(.*[·،] )?(About Hifth|عن حِفظ)/.test(b.getAttribute("aria-label") || "") && on(box(b)));
  if (!open) return out.concat("no settings button").join(" ; ");
  open.click();
  await wait(1200);
  const entry = document.querySelector("[data-pen-guide-open]");
  if (!entry) return out.concat("no button for the pens' page").join(" ; ");
  const before = kept();
  // As a reader would: scrolled to, then pressed, so Back has a place to return to.
  entry.scrollIntoView({ block: "center" });
  await wait(400);
  entry.click();
  await wait(700);
  const guide = document.querySelector("[data-pen-guide]");
  if (!guide) return out.concat("the pens' page did not open").join(" ; ");
  const sheet = guide.closest("[role=dialog]");
  const pens = guide.querySelector("[data-pencil-pens]");
  const radios = () => [...pens.querySelectorAll("[role=radio]")];
  const unexplained = () => radios().filter((b) => { const line = document.getElementById(b.getAttribute("aria-describedby") || ""); return !line || !box(line) || line.textContent.trim().length < 30; }).map((b) => b.getAttribute("aria-label"));
  out.push(`sheet=${f(box(sheet))} layout=${pens.dataset.pencilPens} pens=${radios().length} names=${radios().map((b) => b.getAttribute("aria-label")).join(",")} unexplained=${unexplained().join(",") || "none"}`);
  const highlight = pens.querySelector("[role=radio][data-tool-name='highlight'], [role=radio][data-tool='highlight']") || radios()[2];
  highlight.click();
  await wait(500);
  pens.scrollIntoView({ block: "center" });
  await wait(500);
  const sb = box(sheet);
  const cut = radios().map(box).filter((r) => r && (r.left < sb.left - 1 || r.right > sb.right + 1 || r.left < 0 || r.right > innerWidth)).length;
  const small = radios().map(box).filter((r) => r && (r.width < 43.5 || r.height < 43.5)).length;
  out.push(`highlighter on: pens=${radios().length} pensBox=${f(box(pens))} cutAtSides=${cut} under44=${small} unexplained=${unexplained().join(",") || "none"} sideways=${sheet.scrollWidth - sheet.clientWidth}`);
  // A colour of each kind, then another tool.
  const groups = [...pens.querySelectorAll("[role=radiogroup]")];
  for (const g of groups.slice(1)) { const r = [...g.querySelectorAll("[role=radio]")].pop(); r?.click(); await wait(150); }
  out.push(`groups=${groups.length} picked=${groups.slice(1).map((g) => g.querySelector("[aria-checked=true]")?.getAttribute("aria-label")).join(",")}`);
  out.push(`readerUntouched=${kept() === before ? "yes" : "no"}`);
  if (window.__back !== false) {
    [...guide.querySelectorAll("button")].find((b) => !b.closest("[data-pencil-pens]"))?.click();
    await wait(500);
    out.push(`back: page=${document.querySelector("[data-pen-guide]") ? "still there" : "gone"} settings=${on(box(document.querySelector("[data-pen-guide-open]"))) ? "in sight" : "not in sight"} focusOnItsButton=${document.activeElement === document.querySelector("[data-pen-guide-open]") ? "yes" : "no"}`);
  }
  return out.join(" ; ");
})()
