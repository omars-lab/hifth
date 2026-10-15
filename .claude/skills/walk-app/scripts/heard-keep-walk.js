/*
 * Does a surah heard through get kept by itself (docs/PLAN.md, item 102)?
 *
 * Turns on "Also once I have heard it all", holds the first surah corner in
 * sight (on its side, page 604's route shows page 603 first: Al-Kafirun, six
 * short verses; upright, page 604: Al-Ikhlas, four), presses Play, lets every
 * verse play to its end, and then waits for a surah to be newly kept. Prints
 * how many verses ended, whether the run finished, and which surah was kept
 * and with how many bytes; then puts the setting back as it was. The surah
 * stays kept afterwards, as it would for a reader, and a surah already kept is
 * not kept again, so remove it from the info panel, or take the app off the
 * simulator, to walk it a second time.
 * Runs in the page: in the iPad or Mac app through
 *   make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en ROUTE=/hafs-kfqc/p604 EVALFILE=.claude/skills/walk-app/scripts/heard-keep-walk.js DELAY_MS=2500 PROBE_TIMEOUT_S=200
 * Numbers and surah numbers only.
 */
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const WHEN = "hifth.recitation.keep-when.v1";
  const CLAIMS = "hifth.recitation.kept.v1";
  const HEARD = "hifth.recitation.heard.v1";
  const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
  const had = new Set(Object.keys(read(CLAIMS) || {}));
  const kept = () => Object.entries(read(CLAIMS) || {}).find(([k]) => !had.has(k))?.[1];
  const before = localStorage.getItem(WHEN);
  localStorage.setItem(WHEN, "heard");
  let ended = 0;
  const play = HTMLMediaElement.prototype.play;
  const seen = new WeakSet();
  HTMLMediaElement.prototype.play = function () {
    this.volume = 0.01;
    if (!seen.has(this)) { seen.add(this); this.addEventListener("ended", () => { ended += 1; }); }
    return play.call(this);
  };
  const out = [];
  try {
    await wait(800);
    const box = (e) => { const r = e && e.getBoundingClientRect(); return r && r.width ? r : null; };
    // The neighbouring page stays mounted beside the screen, under another layer, so a
    // name counts only when it is what a finger on its middle would touch.
    const touchable = (h) => { const r = box(h); if (!r || r.left < 0 || r.right > innerWidth) return false; const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && h.contains(e); };
    const head = [...document.querySelectorAll("[data-running-head='surah']")].find(touchable);
    if (!head) return "no corner";
    const r = box(head); const at = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const hit = document.elementFromPoint(at.x, at.y) || head;
    const fire = (type) => hit.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 9, pointerType: "touch", isPrimary: true, clientX: at.x, clientY: at.y, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    fire("pointerdown"); await wait(700); fire("pointerup"); await wait(600);
    const item = [...document.querySelectorAll("[role=menuitem]")].find((e) => /^(Play|تلاوة)$/.test(e.textContent.trim()));
    if (!item) return "no Play";
    item.click();
    const pausing = () => [...document.querySelectorAll("button")].some((e) => box(e) && /^(Pause|إيقاف)/.test(e.getAttribute("aria-label") || ""));
    const t0 = Date.now();
    await wait(1500);
    while (Date.now() - t0 < 90000 && pausing()) await wait(250);
    out.push(`ended=${ended}`, `finished=${pausing() ? "no" : "yes"}`, `run_s=${Math.round((Date.now() - t0) / 1000)}`);
    const t1 = Date.now();
    while (Date.now() - t1 < 30000 && !kept()) await wait(250);
    const claim = kept();
    const heard = Object.values(read(HEARD) || {}).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
    out.push(`already=${[...had].join(",") || "none"}`, `kept=${claim ? claim.surah : "none"}`, `bytes=${claim ? claim.bytes : 0}`, `keep_s=${Math.round((Date.now() - t1) / 1000)}`, `heard_left=${heard}`);
  } finally {
    HTMLMediaElement.prototype.play = play;
    if (before === null) localStorage.removeItem(WHEN); else localStorage.setItem(WHEN, before);
  }
  return out.join(" ; ");
})()
