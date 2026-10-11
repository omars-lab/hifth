(async () => {
  // The page tools in the apps, in whichever home the setting gives them. Boxes, counts and the
  // tools' own names only, never a word of the page.
  //   window.__mark = false   only say where the pens sit; true (default) also pick each pen
  //                           and, for the ones that mark by a tap, tap a verse and say what it left
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // A wrapper that only groups its children (the bottom home's) draws no box: take theirs, together.
  const box = (e) => {
    if (!e) return null;
    const r = e.getBoundingClientRect();
    if (r.width) return r;
    const kids = [...e.children].map(box).filter(Boolean);
    if (!kids.length) return null;
    const [l, t, rr, b] = [Math.min(...kids.map((k) => k.left)), Math.min(...kids.map((k) => k.top)), Math.max(...kids.map((k) => k.right)), Math.max(...kids.map((k) => k.bottom))];
    return { left: l, top: t, right: rr, bottom: b, width: rr - l, height: b - t };
  };
  const on = (r) => r && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const f = (b) => (b ? `${Math.round(b.left)},${Math.round(b.top)}-${Math.round(b.right)},${Math.round(b.bottom)}` : "none");
  const hit = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const out = [`view=${innerWidth}x${innerHeight} lang=${document.documentElement.lang}`];
  await wait(2500);
  // Marks made here are put back as they were at the end, so the walk leaves the app's pages
  // clean: the reader's own marks and settings (the two small databases, and plain storage).
  const kept = Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]));
  const req = (r) => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const DBS = ["hifth.bookmarks.v1", "hifth.revision.v1"];
  const snap = async () => {
    // Only a database the app has already made: opening one that is not there would make it
    // empty, at the version the app expects, and the app would never lay out its stores.
    const have = new Set((await indexedDB.databases()).map((d) => d.name));
    const all = {};
    for (const name of DBS.filter((n) => have.has(n))) {
      const db = await req(indexedDB.open(name));
      all[name] = {};
      for (const store of db.objectStoreNames) all[name][store] = await req(db.transaction(store).objectStore(store).getAll());
      db.close();
    }
    return all;
  };
  const keptDb = await snap();
  const restore = async () => {
    for (const k of Object.keys(localStorage)) if (!(k in kept)) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(kept)) localStorage.setItem(k, v);
    // A database the app made during the walk was empty before it: empty its stores again.
    const have = new Set((await indexedDB.databases()).map((d) => d.name));
    for (const name of DBS.filter((n) => have.has(n))) {
      const db = await req(indexedDB.open(name));
      for (const store of db.objectStoreNames) {
        const rows = keptDb[name]?.[store] || [];
        const tx = db.transaction(store, "readwrite"); const os = tx.objectStore(store);
        os.clear(); for (const row of rows) os.put(row);
        await new Promise((ok) => { tx.oncomplete = ok; tx.onerror = ok; });
      }
      db.close();
    }
  };
  // What differs from the copy, by store and row count, or "" when nothing does.
  const unlike = async () => {
    const now = await snap();
    const empty = (o) => Object.values(o || {}).every((rows) => rows.length === 0);
    for (const n of Object.keys(now)) if (!keptDb[n] && empty(now[n])) delete now[n];
    const names = new Set([...Object.keys(now), ...Object.keys(keptDb)]);
    return [...names].flatMap((n) => [...new Set([...Object.keys(now[n] || {}), ...Object.keys(keptDb[n] || {})])]
      .filter((st) => JSON.stringify(now[n]?.[st]) !== JSON.stringify(keptDb[n]?.[st]))
      .map((st) => `${n}/${st}:${keptDb[n]?.[st]?.length ?? "none"}→${now[n]?.[st]?.length ?? "none"}`)).join(",");
  };
  // The next leaf waits behind, hidden but laid out where it will slide in: not a page in sight.
  const pages = () => [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")].filter((e) => on(box(e)) && getComputedStyle(e).visibility === "visible");
  const homeEl = () => [...document.querySelectorAll("[data-pen-home]")].find((e) => on(box(e)));
  let home = homeEl();
  if (!home) return out.concat("no pens on screen").join(" ; ");
  out.push(`home=${home.dataset.penHome} box=${f(box(home))} pages=${pages().map((p) => p.getAttribute("aria-labelledby").replace("page-label-", "") + "@" + f(box(p))).join(" ")}`);
  const markUp = [...home.querySelectorAll("button")].find((b) => !b.closest("[role=toolbar]") && !home.querySelector("[role=radio]"));
  if (markUp) { markUp.click(); await wait(800); home = homeEl(); out.push(`opened by ${markUp.getAttribute("aria-label") || markUp.textContent.trim()}`); }
  const radios = () => [...home.querySelectorAll("[role=radio][aria-keyshortcuts]")].filter((r) => on(box(r)));
  const where = () => {
    const hb = box(home.querySelector("[role=toolbar]") || home);
    const main = box(document.querySelector("main"));
    const cut = radios().filter((r) => { const b = box(r); return b.left < 0 || b.right > innerWidth || b.top < 0 || b.bottom > innerHeight; }).length;
    return `pens=${f(hb)} onPage=${pages().filter((p) => hit(box(p), hb)).length} pastMain=${main && hb && (hb.top < main.top - 1 || hb.bottom > main.bottom + 1) ? "yes" : "no"} cutOff=${cut}`;
  };
  out.push(`radios=${radios().map((r) => r.getAttribute("aria-label")).join("|")} ${where()}`);
  if (window.__mark === false) return out.join(" ; ");
  // A verse in the middle of the first page in sight, and the pointer events a finger makes on it.
  const svg = pages()[0];
  const polys = [...svg.querySelectorAll(".ayahPolygon")].filter((p) => on(box(p)));
  const poly = polys[Math.floor(polys.length / 2)];
  const pb = box(poly);
  const at = (dx = 0) => ({ x: pb.left + pb.width / 2 + dx, y: pb.top + pb.height / 2 });
  const fire = (type, p, el) => el?.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: p.x, clientY: p.y, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
  const tap = async (p) => { const el = document.elementFromPoint(p.x, p.y); fire("pointerdown", p, el); await wait(60); fire("pointerup", p, el); el?.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: p.x, clientY: p.y })); };
  const count = () => ({
    mistakes: document.querySelectorAll("[data-mistake-word]").length,
    pins: document.querySelectorAll("[data-note-pin]").length,
    ink: document.querySelectorAll("#hifth-overlay .hl-hlt").length,
    dialogs: [...document.querySelectorAll("[role=dialog]")].filter((d) => on(box(d))).length,
    loupe: document.querySelectorAll("[data-loupe], [class*=loupe]").length,
  });
  const diff = (a, b) => Object.keys(a).filter((k) => a[k] !== b[k]).map((k) => `${k}${a[k]}→${b[k]}`).join(",") || "nothing";
  const close = async () => { for (let i = 0; i < 2; i++) { (document.activeElement || document.body).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await wait(500); } };
  // The pens that mark by a drag: a made-up pointer does not start the page's drag gesture
  // (tried four ways on 2026-10-11), so the walk only picks them; the browser tests drag them
  // in WebKit at the iPad's size.
  const DRAG = new Set(["H", "C", "J"]);
  for (const k of radios().map((r) => r.getAttribute("aria-keyshortcuts"))) {
    const radio = radios().find((x) => x.getAttribute("aria-keyshortcuts") === k);
    const r = `${k}:${radio?.getAttribute("aria-label")}`;
    if (!radio) { out.push(`${r}: gone`); continue; }
    radio.click();
    await wait(700);
    home = homeEl();
    const checked = radios().find((x) => x.getAttribute("aria-keyshortcuts") === k)?.getAttribute("aria-checked");
    if (DRAG.has(k)) { out.push(`${r}: checked=${checked} (marks by a drag; not dragged here) ${where()}`); continue; }
    const before = count();
    await tap(at());
    await wait(1500);
    const after = count();
    out.push(`${r}: checked=${checked} left=${diff(before, after)} ${where()}`);
    await close();
    await wait(400);
    home = homeEl() || home;
  }
  await wait(1500);
  await restore();
  const left = await unlike();
  const plain = Object.keys(localStorage).filter((k) => localStorage.getItem(k) !== kept[k]).concat(Object.keys(kept).filter((k) => !(k in localStorage)));
  out.push(`put back=${!left && plain.length === 0 ? "yes" : `no (${[left, ...plain].filter(Boolean).join(",")})`}`);
  return out.join(" ; ");
})()
