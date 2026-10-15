/*
 * Does the Mistake pen's "Went into another verse..." ask where it pulled you, in the app?
 *
 * Picks the Mistake pen (from the bar, the bottom home, or the tray a smaller screen has
 * instead), taps a word 40% of the way down the middle of the first page in sight, and prints
 * the question's box, the kinds it offers and how many are pressed. Then presses "another"
 * and prints the verse picker's box, whether all of it is on the screen, how many buttons it
 * has, how many run off the screen or are drawn over, and whether it covers the tap; how many
 * red marks the press left and how many words on screen say "slip" (both should be 0); and
 * whether Escape closes the picker. The reader's settings are put back at the end.
 * `window.__leaveUp = true;` on a line ahead of it stops before Escape and leaves the picker up,
 * for a picture. Walked 2026-10-15 on the 13-inch iPad and the mini, both ways up, in English
 * and Arabic: kinds word,sign,sign,sign,another, none pressed, the picker whole with 2 buttons,
 * not over the tap, no red mark, no "slip", gone after Escape.
 * Runs in the page: in the iPad or Mac app through
 *   make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en ROUTE=/hafs-kfqc/p7 EVALFILE=.claude/skills/walk-app/scripts/another-walk.js DELAY_MS=2500 PROBE_TIMEOUT_S=200
 * Boxes, counts and the question's own kinds only.
 */
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (e) => e?.getBoundingClientRect() ?? null;
  const on = (r) => r && r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const inside = (r) => r && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
  const f = (b) => (b ? `${Math.round(b.left)},${Math.round(b.top)}-${Math.round(b.right)},${Math.round(b.bottom)}` : "none");
  const out = [`view=${innerWidth}x${innerHeight} lang=${document.documentElement.lang}`];
  await wait(2500);
  const kept = Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]));
  const pages = () => [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")].filter((e) => on(box(e)) && getComputedStyle(e).visibility === "visible");
  const pen = () => [...document.querySelectorAll("[role=radio][aria-keyshortcuts=M], [data-phone-bar] [role=radio][data-pen=mistake]")].find((r) => on(box(r)));
  const tray = () => [...document.querySelectorAll("[data-phone-bar] button[aria-expanded=false]")].find((b) => on(box(b)));
  if (!pen()) {
    const home = [...document.querySelectorAll("[data-pen-home]")].find((e) => on(box(e)) || e.children.length);
    const opener = home && [...home.querySelectorAll("button")].find((b) => !b.closest("[role=toolbar]"));
    (opener || tray())?.click();
    await wait(800);
  }
  if (!pen()) return out.concat("no Mistake pen on screen").join(" ; ");
  pen().click();
  await wait(700);
  const fire = (type, p, el) => el?.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: p.x, clientY: p.y, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
  const tap = async (p) => { const el = document.elementFromPoint(p.x, p.y); fire("pointerdown", p, el); await wait(60); fire("pointerup", p, el); el?.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: p.x, clientY: p.y })); };
  const marks = () => document.querySelectorAll("[data-mistake-word]").length;
  const before = marks();
  const svg = pages()[0];
  const lines = [...svg.querySelectorAll(".ayahPolygon")].map(box).filter(on);
  const left = Math.min(...lines.map((b) => b.left)), right = Math.max(...lines.map((b) => b.right));
  const top = Math.min(...lines.map((b) => b.top)), bottom = Math.max(...lines.map((b) => b.bottom));
  const p = { x: (left + right) / 2, y: top + (bottom - top) * 0.4 };
  for (let i = 0; i < 3 && document.elementFromPoint(p.x, p.y)?.tagName.toLowerCase() === "circle"; i++) p.x += 30;
  await tap(p);
  await wait(1400);
  const ask = [...document.querySelectorAll("[data-word-parts=mistake]")].find((d) => on(box(d)));
  if (!ask) return out.concat("no question").join(" ; ");
  const kinds = [...ask.querySelectorAll("button")].map((b) => b.dataset.part || (b.getAttribute("aria-label") ? "close" : "other"));
  out.push(`asked=${f(box(ask))} kinds=${kinds.join(",")} pressed=${ask.querySelectorAll("[aria-pressed=true]").length}`);
  const another = ask.querySelector("[data-part=another]");
  if (!another) return out.concat("no another").join(" ; ");
  another.click();
  await wait(1400);
  const picker = [...document.querySelectorAll("[data-jump-picker]")].find((d) => on(box(d)));
  const chrome = [...document.querySelectorAll("button,[role=dialog] h2,[role=dialog] h3,[role=status]")].filter((e) => on(box(e)));
  const slipWords = chrome.filter((e) => /\bslip/i.test(e.textContent + " " + (e.getAttribute("aria-label") || ""))).length;
  out.push(`picker=${picker ? f(box(picker)) : "none"} whole=${picker && inside(box(picker)) ? "yes" : "no"}`);
  if (picker) {
    const bs = [...picker.querySelectorAll("button")];
    const under = bs.filter((b) => { const r = box(b); return on(r) && !b.contains(document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2)); }).length;
    out.push(`pickerButtons=${bs.length} cutOff=${bs.filter((b) => !inside(box(b))).length} drawnOver=${under} coversTap=${box(picker).top <= p.y && box(picker).bottom >= p.y && box(picker).left <= p.x && box(picker).right >= p.x ? "yes" : "no"}`);
  }
  out.push(`redMarks=${marks() - before} slipWordsOnScreen=${slipWords}`);
  if (window.__leaveUp) return out.join(" ; ");
  document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await wait(800);
  out.push(`pickerAfterEscape=${[...document.querySelectorAll("[data-jump-picker]")].some((d) => on(box(d))) ? "up" : "gone"}`);
  if (!pen()) { tray()?.click(); await wait(800); }
  pen()?.click();
  await wait(400);
  for (const k of Object.keys(localStorage)) if (!(k in kept)) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(kept)) localStorage.setItem(k, v);
  return out.join(" ; ");
})()
