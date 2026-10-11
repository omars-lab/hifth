(async () => {
  // The look-alike list on the verse a route opens, in the apps. Boxes, counts and verse
  // numbers only, never the words a row or its note carries.
  //   window.__step = "list"        (default) what the route opened, and every row's reason
  //   window.__step = "open-last"   open the last row that offers a comparison; is it in sight?
  //   window.__step = "open-first"  the same for the first, with the list still at its start
  //   window.__step = "passage"     the first passage row: which verse it names, where it hops
  //   window.__step = "share"       close the verse's note, press Share; what the card covers
  //   window.__step = "bars"        where the look-alike buttons sit with the note up, then away
  //   window.__step = "key"         the tajweed key a `?open=key` route opens, scrolled to its end
  //   window.__dir  = "later"       press that rail button first (loop, earlier, later, root)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
  const on = (r) => r && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const f = (b) => (b ? `${Math.round(b.left)},${Math.round(b.top)}-${Math.round(b.right)},${Math.round(b.bottom)}` : "none");
  const nums = (s) => (s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).match(/\d+(?::\d+)?/g)?.join("~") || "?";
  const overlap = (a, b) => (a && b ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) : 0);
  const out = [`view=${innerWidth}x${innerHeight} lang=${document.documentElement.lang}`];
  const dialogs = () => [...document.querySelectorAll("[role=dialog]")].filter((e) => on(box(e)));
  const sheet = () => dialogs().find((d) => d.querySelector("[class*=rowText]"));
  const rows = () => [...(sheet()?.querySelectorAll("ul > li") || [])];
  const railOf = () => [...document.querySelectorAll("[role=group]")].find((g) => g.querySelector("button[data-direction]") && on(box(g)));
  const hopOf = (li) => li.querySelector("button[aria-label], a[aria-label]");
  const keyOf = (li) => nums(hopOf(li)?.getAttribute("aria-label"));
  const chips = () => [...document.querySelectorAll("[role=group] button[data-direction]")].filter((e) => on(box(e)));
  await wait(2500);
  if (window.__dir) {
    const chip = chips().find((c) => c.dataset.direction === window.__dir);
    if (!chip) return out.concat(`no ${window.__dir} button; buttons=${chips().map((c) => c.dataset.direction).join(",")}`).join(" ; ");
    chip.click();
    await wait(1200);
  }
  const look = () => {
    const s = sheet();
    const ds = dialogs();
    const rs = rows();
    const reasonless = rs.filter((li) => {
      const t = li.querySelector("button[aria-expanded], [class*=rowText]");
      const comparable = li.querySelector("button[aria-expanded]");
      const range = /[–-]/.test(hopOf(li)?.getAttribute("aria-label") || "");
      const said = [...(t?.children || [])].slice(1).some((c) => (c.textContent || "").trim().length);
      return !(comparable || range || said);
    });
    const text = s?.textContent || "";
    const arrows = { plain: (text.match(/↔︎/g) || []).length, emoji: (text.match(/↔️/g) || []).length };
    arrows.bare = (text.match(/↔/g) || []).length - arrows.plain - arrows.emoji;
    const notes = [...(s?.querySelectorAll("[lang]") || [])].map((e) => e.getAttribute("lang"));
    const head = box(s?.querySelector("header"));
    const close = box(s?.querySelector("header button"));
    const cs = chips().map((c) => `${c.dataset.direction}@${f(box(c))}${overlap(box(c), close) ? "!onClose" : ""}`);
    return `dialogs=${ds.length} list=${s ? "yes" : "no"} other=${ds.filter((d) => d !== s).length} sheet=${f(box(s))} side=${s?.dataset.side ?? "-"} head=${f(head)} rows=${rs.length} keys=${rs.map(keyOf).join(",")} comparable=${rs.filter((li) => li.querySelector("button[aria-expanded]")).length} reasonless=${reasonless.map(keyOf).join(",") || 0} noteLangs=${notes.join(",") || "-"} arrows=plain${arrows.plain}/emoji${arrows.emoji}/bare${arrows.bare} chips=[${cs.join(" ")}]`;
  };
  out.push("A " + look());
  const step = window.__step || "list";
  if (step === "open-last" || step === "open-first") {
    const open = rows().filter((li) => li.querySelector("button[aria-expanded]"));
    const li = step === "open-last" ? open[open.length - 1] : open[0];
    if (!li) return out.concat("no row offers a comparison").join(" ; ");
    li.querySelector("button[aria-expanded]").click();
    for (const ms of [600, 1500]) {
      await wait(ms === 600 ? 600 : 900);
      const s = sheet(); const sb = box(s); const head = box(s?.querySelector("header"));
      const rb = box(li); const lb = box(li.querySelector("[class*=rowLabel]"));
      const top = Math.max(head?.bottom ?? 0, sb?.top ?? 0, 0); const bottom = Math.min(sb?.bottom ?? innerHeight, innerHeight);
      const whole = rb && rb.top >= top - 1 && rb.bottom <= bottom + 1;
      const name = lb && lb.top >= top - 1 && lb.bottom <= bottom + 1;
      out.push(`B+${ms} ${keyOf(li)} expanded=${li.querySelector("button[aria-expanded]").getAttribute("aria-expanded")} row=${f(rb)} name=${f(lb)} room=${Math.round(top)}-${Math.round(bottom)} whole=${whole ? "yes" : "no"} nameInSight=${name ? "yes" : "no"} nameUnderHead=${lb && head ? Math.round(lb.top - head.bottom) : "-"}`);
    }
  } else if (step === "share" || step === "bars") {
    // share: press the verse's Share; does the card cover a line of the verse, or a button?
    // bars: no card; where the look-alike buttons sit, and what the verse's drawer covers.
    const hit = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const note = dialogs().find((d) => d !== sheet());
    const bars = () => {
      const svg = [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")].map(box).find(on);
      const topBand = svg && { left: svg.left, right: svg.right, top: svg.top, bottom: svg.top + svg.height * 0.1 };
      const rail = railOf();
      const drawer = dialogs().find((d) => d !== sheet());
      const db = box(drawer);
      const cut = buttons(drawer).filter(([b, r]) => !rail?.contains(b) && hit(r, db) && !(r.top >= db.top && r.bottom <= db.bottom && r.left >= db.left && r.right <= db.right)).length;
      return `page=${f(svg)} rail=${rail ? `${f(box(rail))} home=${rail.dataset.home ?? "-"} card=${rail.dataset.card ?? "-"} inDrawer=${drawer?.contains(rail) ? "yes" : "no"}` : "none"} chipsOnTopLines=${chips().filter((c) => hit(box(c), topBand)).length} drawer=${f(db)} buttonsHalfUnderDrawer=${cut}`;
    };
    const lines = () => [...document.querySelectorAll("#hifth-overlay .hl-sel")].map(box).filter(on);
    const buttons = (not) => [...document.querySelectorAll("button")].filter((b) => !not?.contains(b)).map((b) => [b, box(b)]).filter(([, r]) => on(r));
    if (step === "share") {
      // The private build opens the verse's note; Share is behind it, so close it first.
      if (note) { [...note.querySelectorAll("button")].find((b) => /^(Close|إغلاق)$/.test(b.getAttribute("aria-label") || ""))?.click(); await wait(1200); out.push(`note closed=${dialogs().length === 0 ? "yes" : "no"}`); }
      const name = document.documentElement.lang === "ar" ? "شارك" : "Share this ayah as a link";
      const btn = [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || "").includes(name) && !b.closest("[role=dialog]") && on(box(b)));
      if (!btn) return out.concat("no Share button").join(" ; ");
      btn.click();
      for (const ms of [1500, 2300]) {
        await wait(ms === 1500 ? 1500 : 800);
        const card = dialogs().find((d) => (d.getAttribute("aria-label") || "").includes(name));
        const cb = box(card);
        const ls = lines();
        out.push(`S+${ms} card=${f(cb)} lines=${ls.length} linesUnderCard=${ls.filter((l) => hit(l, cb)).length} buttonsUnderCard=${buttons(card).filter(([, r]) => hit(r, cb)).length} cardButtonsCut=${[...(card?.querySelectorAll("button") || [])].map(box).filter((r) => r && (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth)).length}`);
      }
    } else {
      // Up, then put away with Escape twice, as the checklist walks it.
      out.push(`R up: ${bars()}`);
      for (let i = 0; i < 2; i++) { (document.activeElement || document.body).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await wait(900); }
      out.push(`R away: ${bars()}`);
    }
  } else if (step === "key") {
    // The tajweed key a `?open=key` route opens: scrolled to its end, are its title and close
    // button still on top, and is the credit's web address on one line inside the card?
    const key = dialogs()[0];
    if (!key) return out.concat("no key open").join(" ; ");
    const flags = () => Object.keys(key.dataset).join(",") || "-";
    out.push(`K card=${f(box(key))} more=${key.scrollHeight - key.clientHeight} flags=${flags()} numbers=${nums(key.textContent)}`);
    key.scrollTo({ top: key.scrollHeight });
    await wait(800);
    const kb = box(key);
    const onTop = (el) => { const r = box(el); return r && r.top >= kb.top - 1 && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("header") !== null ? "yes" : "no"; };
    const link = key.querySelector("p a[href^='https://']");
    const range = document.createRange();
    if (link) range.selectNodeContents(link);
    const lines = link ? new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size : 0;
    const lb = box(link);
    out.push(`K end: scrolled=${Math.round(key.scrollTop)} close=${onTop(key.querySelector("header button"))} title=${onTop(key.querySelector("h2, [role=heading]"))} addressLines=${lines} addressFits=${lb && lb.left >= kb.left - 1 && lb.right <= kb.right + 1 ? "yes" : "no"} addressInSight=${lb && lb.bottom <= kb.bottom + 1 ? "yes" : "no"} flags=${flags()}`);
  } else if (step === "passage") {
    const li = rows().find((r) => /[–-]/.test(hopOf(r)?.getAttribute("aria-label") || ""));
    if (!li) return out.concat("no passage row").join(" ; ");
    const t = li.querySelector("[class*=rowText]");
    const said = [...(t?.children || [])].slice(1).map((c) => nums(c.textContent)).join("|");
    out.push(`P ${keyOf(li)} versesNamed=${said || "-"}`);
    const hop = li.querySelector("[class*=hop]");
    if (!hop || hop.disabled) return out.concat("P: no hop").join(" ; ");
    hop.click();
    await wait(2500);
    out.push(`P after hop: hash=${location.hash.replace(/\?.*/, "")}`);
  }
  return out.join(" ; ");
})()
