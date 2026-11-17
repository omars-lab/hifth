(async () => {
  // "Report a problem", pressed as Apple's reviewer would: from the settings panel, on a device
  // that may have no mail account. Says what came up after the press (a card, a dialog, nothing),
  // its buttons, and whether the panel is still there. Labels and counts only, never what a
  // reader wrote.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
  const on = (r) => r && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const label = (e) => (e.getAttribute("aria-label") || e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);
  const out = [`view=${innerWidth}x${innerHeight} lang=${document.documentElement.lang}`];
  await wait(2500);
  const open = [...document.querySelectorAll("button")].find((b) => /^(.*[·،] )?(About Hifth|عن حِفظ)/.test(b.getAttribute("aria-label") || "") && on(box(b)));
  if (!open) return out.concat("no settings button").join(" ; ");
  open.click();
  await wait(1200);
  const report = [...document.querySelectorAll("button")].find((b) => /^(Report a problem|أبلغ عن مشكلة)/.test(label(b)));
  if (!report) return out.concat("no report button").join(" ; ");
  report.scrollIntoView({ block: "center" });
  await wait(400);
  const before = document.querySelectorAll("[role=dialog], [role=alertdialog]").length;
  report.click();
  await wait(1500);
  const dialogs = [...document.querySelectorAll("[role=dialog], [role=alertdialog]")].filter((d) => on(box(d)));
  out.push(`dialogsBefore=${before} dialogsAfter=${dialogs.length}`);
  for (const d of dialogs) {
    const head = d.querySelector("h1, h2, h3");
    const buttons = [...d.querySelectorAll("button, a")].filter((b) => on(box(b))).map(label);
    out.push(`dialog "${head ? label(head) : label(d)}" buttons=[${buttons.join(" | ")}]`);
  }
  const status = [...document.querySelectorAll("[role=status]")].map((s) => s.textContent.trim()).filter(Boolean);
  out.push(`status=[${status.join(" | ")}]`);
  return out.join(" ; ");
})()
