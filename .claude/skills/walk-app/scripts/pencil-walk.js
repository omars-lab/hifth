(async () => {
  // The Apple Pencil's double-tap and squeeze, played as the iPad app hands them to the page
  // (docs/PLAN.md, 96): a squeeze near two corners of the screen, a pick, the double-tap swap,
  // and the colour palette setting. Where the pens stand, whether all of them are on the screen
  // and off the tip, and which tool is in hand. Boxes, counts and tool names only. The simulator
  // cannot send a real gesture, so this checks the page's side; the pencil is manual testing 19.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(2500);
  const f = (b) => (b ? `${Math.round(b.left)},${Math.round(b.top)}-${Math.round(b.right)},${Math.round(b.bottom)}` : "none");
  const out = [`view=${innerWidth}x${innerHeight} lang=${document.documentElement.lang} api=${typeof window.__HIFTH_PAGE__?.pencil}`];
  const pen = (e) => window.__HIFTH_PAGE__?.pencil(e);
  const tool = () => document.querySelector("[data-page][data-tool]")?.dataset.tool;
  const pens = () => document.querySelector("[data-pencil-pens]");
  const report = (name, tip) => {
    const el = pens();
    if (!el) return out.push(`${name}=none tool=${tool()}`);
    const r = el.getBoundingClientRect();
    const whole = r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    const covers = tip && tip.x >= r.left && tip.x <= r.right && tip.y >= r.top && tip.y <= r.bottom;
    out.push(`${name}: box=${f(r)} whole=${whole ? "yes" : "no"} coversTip=${covers ? "yes" : "no"} radios=${el.querySelectorAll("[role=radio]").length} tool=${tool()}`);
  };
  for (const tip of [{ x: 200, y: 300 }, { x: innerWidth - 60, y: innerHeight - 120 }]) {
    pen({ kind: "squeeze", pref: "palette", ...tip });
    await wait(400);
    report(`squeeze@${tip.x},${tip.y}`, tip);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await wait(300);
    out.push(`afterEscape=${pens() ? "open" : "closed"}`);
  }
  pen({ kind: "squeeze", pref: "palette", x: 300, y: 300 });
  await wait(400);
  pens()?.querySelector("[role=radio][aria-keyshortcuts=M]")?.click();
  await wait(400);
  out.push(`pickM: pens=${pens() ? "open" : "closed"} tool=${tool()}`);
  pen({ kind: "doubleTap", pref: "eraser" });
  await wait(300);
  out.push(`tap1 tool=${tool()}`);
  pen({ kind: "doubleTap", pref: "previous" });
  await wait(300);
  out.push(`tap2 tool=${tool()}`);
  pen({ kind: "doubleTap", pref: "eraser" });
  await wait(300);
  pen({ kind: "doubleTap", pref: "colours", x: 400, y: 400 });
  await wait(400);
  report("colours", { x: 400, y: 400 });
  return out.join(" ; ");
})()
