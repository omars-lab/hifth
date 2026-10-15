/*
 * Does a surah kept on the device play from the device (docs/PLAN.md, item 101)?
 *
 * The simulator shares the Mac's network, so this cuts the recitation off in the
 * page instead: every fetch of a recitation file is refused, and a verse that
 * would have to come from the network is counted. Then it holds the first surah
 * name a finger could touch, presses Play, and lets the surah play to its end.
 * Prints how many verses ended, how many played from a copy on the device and
 * how many asked the network, how many fetches were refused, and how long the
 * press took to sound. Keep the surah first (its menu's "Keep its recitation",
 * or scripts/heard-keep-walk.js). A surah that is not kept still sounds, since
 * the page cannot stop the sound element loading its own file: it shows as
 * fromNet, the fetches made ahead of it as refused (walked 2026-10-15: 112 kept,
 * fromCopy=4 fromNet=0; page 602, not kept, fromCopy=0 fromNet=4 refused=4).
 * On its side, page 604's route shows Al-Kafirun (109) first; upright, Al-Ikhlas
 * (112).
 * Runs in the page: in the iPad or Mac app through
 *   make app-probe TARGET=ipad LOCALE=en ROUTE=/hafs-kfqc/p604 EVALFILE=.claude/skills/walk-app/scripts/kept-play-walk.js DELAY_MS=2500 PROBE_TIMEOUT_S=200
 * Numbers and surah numbers only.
 */
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const CLAIMS = "hifth.recitation.kept.v1";
  let kept = [];
  try { kept = Object.keys(JSON.parse(localStorage.getItem(CLAIMS) || "{}")); } catch { /* none */ }
  const audio = (u) => /\.(mp3|m4a|ogg|opus)(\?|$)/.test(String(u));
  const fetchWas = window.fetch;
  let refused = 0;
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input && input.url;
    if (audio(url)) { refused += 1; return Promise.reject(new TypeError("offline (walk)")); }
    return fetchWas.call(this, input, init);
  };
  let ended = 0, fromCopy = 0, fromNet = 0, firstMs = null, pressed = 0;
  const play = HTMLMediaElement.prototype.play;
  const seen = new WeakSet();
  HTMLMediaElement.prototype.play = function () {
    this.volume = 0.01;
    if (!seen.has(this)) {
      seen.add(this);
      this.addEventListener("ended", () => { ended += 1; });
      this.addEventListener("playing", () => {
        if (this.currentSrc.startsWith("blob:")) fromCopy += 1; else fromNet += 1;
        if (firstMs === null && pressed) firstMs = Date.now() - pressed;
      });
    }
    return play.call(this);
  };
  const out = [`kept=${kept.join(",") || "none"}`];
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
    pressed = Date.now();
    item.click();
    const pausing = () => [...document.querySelectorAll("button")].some((e) => box(e) && /^(Pause|إيقاف)/.test(e.getAttribute("aria-label") || ""));
    await wait(1500);
    while (Date.now() - pressed < 90000 && pausing()) await wait(250);
    out.push(`ended=${ended}`, `fromCopy=${fromCopy}`, `fromNet=${fromNet}`, `refused=${refused}`, `first_ms=${firstMs ?? "none"}`, `finished=${pausing() ? "no" : "yes"}`);
  } finally {
    HTMLMediaElement.prototype.play = play;
    window.fetch = fetchWas;
  }
  return out.join(" ; ");
})()
