(async () => {
  // The record of what was opened, day by day, in the apps. It writes three made-up days into
  // the device's record (today, two days back and eight days back, on page 7), opens the record,
  // and measures the month and the list of days; then it puts the record and the remembered
  // layout back as they were. `window.__leave = "month";` (or "days") on a line ahead of it
  // leaves that layout open for a picture, and the made-up days in the record: run it once more
  // without the line to take them out. Boxes, counts and day stamps only.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
  const f = (b) => (b ? `${Math.round(b.left)},${Math.round(b.top)}-${Math.round(b.right)},${Math.round(b.bottom)}` : "none");
  const out = [`view=${innerWidth}x${innerHeight} lang=${document.documentElement.lang} dir=${document.documentElement.dir}`];
  await wait(2000);
  const VIEW = "hifth.record.view.v1";
  const MADE = "hifth.walk.record-days.made";
  const two = (n) => String(n).padStart(2, "0");
  const stamp = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  const back = (n) => { const d = new Date(); d.setHours(10, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open("hifth.revision.v1", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("days", { keyPath: "day" }); r.result.createObjectStore("meta", { keyPath: "id" }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const run = (mode, work) => new Promise((res, rej) => { const tx = db.transaction(["days", "meta"], mode); const got = work(tx); tx.oncomplete = () => res(got); tx.onerror = () => rej(tx.error); });
  const get = (store, key) => run("readonly", (tx) => { const q = tx.objectStore(store).get(key); const hold = {}; q.onsuccess = () => { hold.value = q.result; }; return hold; }).then((h) => h.value);
  // What a run that was left open for a picture wrote: taken out first, so nothing made up stays.
  const undo = async () => {
    const made = JSON.parse(localStorage.getItem(MADE) || "null");
    if (!made) return false;
    await run("readwrite", (tx) => {
      for (const [day, was] of Object.entries(made.days)) { if (was) tx.objectStore("days").put(was); else tx.objectStore("days").delete(day); }
      if (made.since) tx.objectStore("meta").put(made.since); else tx.objectStore("meta").delete("since");
    });
    if (made.view === null) localStorage.removeItem(VIEW); else localStorage.setItem(VIEW, made.view);
    localStorage.removeItem(MADE);
    return true;
  };
  if (await undo()) out.push("took out the days an earlier run left");
  const key = (v) => `quran/hafs-kfqc/${v}`;
  const tz = -new Date().getTimezoneOffset();
  const look = (d, v, more = {}) => ({ key: key(v), page: 7, at: d.getTime(), tz, ...more });
  const plan = [
    [back(0), [look(back(0), "2:42", { slip: true, what: "sign" }), look(back(0), "2:43")]],
    [back(2), [look(back(2), "2:38", { endKey: key("2:48") }), look(back(2), "2:45", { slip: true, what: "sign" }), look(back(2), "2:46", { slip: true }), look(back(2), "2:47", { slip: true, what: "verse" })]],
    [back(8), [look(back(8), "2:40")]],
  ];
  const made = { days: {}, since: (await get("meta", "since")) || null, view: localStorage.getItem(VIEW) };
  for (const [d] of plan) made.days[stamp(d)] = (await get("days", stamp(d))) || null;
  localStorage.setItem(MADE, JSON.stringify(made));
  await run("readwrite", (tx) => {
    for (const [d, events] of plan) tx.objectStore("days").put({ day: stamp(d), events: [...(made.days[stamp(d)]?.events || []), ...events] });
    if (!made.since || made.since.day > stamp(back(8))) tx.objectStore("meta").put({ id: "since", day: stamp(back(8)) });
  });
  localStorage.setItem(VIEW, "month");

  const open = [...document.querySelectorAll("button")].find((b) => /(what you have opened|ما فتحتَه من المصحف)$/.test(b.getAttribute("aria-label") || ""));
  if (!open) { await undo(); db.close(); return out.concat("no button for the record").join(" ; "); }
  open.click();
  await wait(1500);
  const sheet = [...document.querySelectorAll("[role=dialog]")].find((d) => d.querySelector("[data-day]"));
  if (!sheet) { await undo(); db.close(); return out.concat("the record did not open on the month").join(" ; "); }
  const sb = box(sheet);
  const squares = [...sheet.querySelectorAll("[data-day]")];
  const boxes = squares.map(box);
  const offSides = boxes.filter((r) => r && (r.left < sb.left - 1 || r.right > sb.right + 1)).length;
  const short = boxes.filter((r) => r && r.height < 39.5).length;
  const worked = squares.filter((s) => s.dataset.state === "worked").map((s) => `${s.dataset.day}:${s.dataset.mistakes || 0}`);
  const first = boxes[0];
  out.push(`month: sheet=${f(sb)} squares=${squares.length} firstSquare=${f(first)} offSides=${offSides} under40tall=${short} worked=${worked.join(",")} outside=${squares.filter((s) => s.dataset.state === "outside").length} sideways=${sheet.scrollWidth - sheet.clientWidth}`);
  const steps = [...sheet.querySelectorAll("button")].filter((b) => /^[‹›]$/.test(b.textContent.trim()));
  out.push(`arrows: earlierLeftOfLater=${steps.length === 2 ? (box(steps[0]).left < box(steps[1]).left ? "yes" : "no") : "missing"} turnedByOurStyle=${steps.some((b) => getComputedStyle(b).transform !== "none") ? "yes" : "no"} laterOff=${steps[1]?.disabled ? "yes" : "no"}`);
  const day = sheet.querySelector(`[data-day="${stamp(back(2))}"]`);
  day?.click();
  await wait(400);
  const shown = [...sheet.querySelectorAll("[data-mistake]")];
  out.push(`day pressed: pressed=${day?.getAttribute("aria-pressed")} mistakes=${shown.length} mistakesUnder44tall=${shown.map(box).filter((r) => r && r.height < 43.5).length} mistakesOffSides=${shown.map(box).filter((r) => r && (r.left < sb.left - 1 || r.right > sb.right + 1)).length}`);
  const radios = [...sheet.querySelectorAll("[role=radio]")];
  const views = radios.slice(0, 3);
  views[2]?.click();
  await wait(500);
  const rows = [...sheet.querySelectorAll("ul[aria-label] > li")];
  out.push(`days: rows=${rows.length} mistakes=${sheet.querySelectorAll("[data-mistake]").length} widest=${Math.round(Math.max(0, ...rows.map((r) => box(r)?.width || 0)))} sideways=${sheet.scrollWidth - sheet.clientWidth} words"slip"=${/\bslips?\b/i.test(sheet.innerText) ? "yes" : "no"}`);
  if (window.__leave === "month" || window.__leave === "days") {
    (window.__leave === "month" ? views[1] : views[2])?.click();
    await wait(400);
    sheet.querySelector(`[data-day="${stamp(back(2))}"]`)?.click();
    views[0]?.scrollIntoView({ block: "start" });
    db.close();
    return out.concat(`left open on ${window.__leave}, made-up days still in the record`).join(" ; ");
  }
  await undo();
  db.close();
  out.push(`put back: view=${localStorage.getItem(VIEW) ?? "none"}`);
  return out.join(" ; ");
})()
