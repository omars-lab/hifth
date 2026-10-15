// A scholar following a thread: from a note, a reference whose own note has references, then a
// second reference from there, then Back twice to where they began. At each step it prints the
// verse lit, the pages shown, the note's box, how much of the lit verse lies under the note and
// whether a Back button is offered; verse numbers, boxes and button names only, never note words.
//   make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en "ROUTE=/hafs-kfqc/2:48?open=commentary" \
//     EVALFILE=.claude/skills/walk-app/scripts/thread-walk.js DELAY_MS=2500 PROBE_TIMEOUT_S=240
// "F: no back button" is expected: back at the start there is nothing to go back to.
(async () => {
  // Two references deep from a note, then back twice: verse numbers, boxes and button names only.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
  const f = (b) => (b ? `${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.right)},${Math.round(b.bottom)}` : "none");
  const isAr = document.documentElement.lang === "ar";
  const note = () => document.querySelector("[role=dialog]");
  const shown = () => [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")].filter((e) => { const r = box(e); return r && r.right > 0 && r.left < innerWidth; }).map((e) => e.getAttribute("aria-labelledby").replace("page-label-", "")).join("+");
  const onScreen = (e) => { const r = box(e); return r && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const sel = () => [...new Set([...document.querySelectorAll("#hifth-overlay [data-hl-group='selection']")].filter(onScreen).map((e) => (e.getAttribute("data-hl-key") || "?").split("/").pop()))].join("+");
  const backBtn = () => note() && [...note().querySelectorAll("button")].find((b) => /↩|↪/.test(b.textContent) && !/^(Hop|انتقل)/.test(b.getAttribute("aria-label") || ""));
  const look = (label) => {
    const d = note(); const ref = d && d.querySelector("header span:last-of-type");
    const b = backBtn();
    const lit = [...document.querySelectorAll("#hifth-overlay [data-hl-group='selection']")].map(box).filter(Boolean).filter((r) => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth);
    const db = box(d); const area = lit.reduce((s, r) => s + r.width * r.height, 0);
    const under = db ? lit.reduce((s, r) => s + Math.max(0, Math.min(r.right, db.right) - Math.max(r.left, db.left)) * Math.max(0, Math.min(r.bottom, db.bottom) - Math.max(r.top, db.top)), 0) : 0;
    out.push(`${label}: litUnderNote=${area ? Math.round(100 * under / area) : "-"}% hash=${location.hash} shown=${shown()} sel=${sel()} note=${f(box(d))} noteRef=${ref ? ref.textContent.replace(/\s+/g, " ").trim() : "-"} back=${b ? (b.getAttribute("aria-label") || "yes") : "no"} notes=${document.querySelectorAll("[role=dialog]").length}`);
  };
  const refs = () => note() ? [...note().querySelectorAll("button")].filter((b) => !b.disabled && (isAr ? /^اذهب إلى/ : /^Go to/).test(b.getAttribute("aria-label") || "")) : [];
  await wait(1200);
  out.push(`view=${innerWidth}x${innerHeight}`);
  look("A open");
  const start = (location.hash.match(/\d+:\d+/) || [""])[0];
  const here = () => (location.hash.match(/\d+:\d+/) || [""])[0];
  // B: a reference whose note has references of its own (tried in order, backing out of dead ends).
  let tried = 0;
  for (let i = 0; i < 8; i++) {
    const r = refs()[i];
    if (!r) { out.push(`B: ran out after ${tried}`); break; }
    tried++;
    const label = r.getAttribute("aria-label");
    r.click(); await wait(2500);
    if (refs().length) { out.push(`B follow=${label} (try ${tried})`); look("B after"); break; }
    const b = backBtn(); if (!b) { out.push(`B: dead end ${label} and no back`); break; }
    b.click(); await wait(2500);
  }
  const cur = here();
  const r2 = refs().find((b) => { const l = b.getAttribute("aria-label") || ""; return !l.includes(cur) && !l.includes(start); });
  if (r2) { out.push(`C follow=${r2.getAttribute("aria-label")} (of ${refs().length})`); r2.click(); await wait(3000); look("C after"); }
  else out.push("C: no second reference");
  for (const step of ["D", "E", "F"]) {
    const b = backBtn();
    if (!b) { out.push(`${step}: no back button`); break; }
    b.click(); await wait(3000); look(`${step} back`);
  }
  return out.join(" ; ");
})()
