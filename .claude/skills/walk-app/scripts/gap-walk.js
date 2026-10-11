/*
 * How long the silence is between two verses of a run (docs/PLAN.md, item 63).
 *
 * Holds the surah corner, presses Play, and times each verse's end to the next
 * one sounding, for five gaps; then pauses. Numbers only, never note words.
 * Runs in the page: in the iPad or Mac app through
 *   make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en ROUTE=/hafs-kfqc/p600 EVALFILE=.claude/skills/walk-app/scripts/gap-walk.js DELAY_MS=2500 PROBE_TIMEOUT_S=200
 * and in Chromium at three connection speeds through gap-throttle.mjs.
 */
(async () => {
  // How long the silence is between one verse's end and the next one sounding, in a run.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  let endedAt = 0; const gaps = []; const seen = new WeakSet();
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    this.volume = 0.01;
    if (!seen.has(this)) {
      seen.add(this);
      this.addEventListener("ended", () => { endedAt = performance.now(); });
      this.addEventListener("playing", () => { if (endedAt) { gaps.push(Math.round(performance.now() - endedAt)); endedAt = 0; } });
    }
    return play.call(this);
  };
  await wait(800);
  const box = (e) => { const r = e && e.getBoundingClientRect(); return r && r.width ? r : null; };
  const head = [...document.querySelectorAll("[data-running-head='surah']")].find((h) => box(h) && box(h).left > 0 && box(h).right < innerWidth);
  if (!head) return "no corner";
  const r = box(head); const at = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const hit = document.elementFromPoint(at.x, at.y) || head;
  const fire = (type) => hit.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 9, pointerType: "touch", isPrimary: true, clientX: at.x, clientY: at.y, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
  fire("pointerdown"); await wait(700); fire("pointerup"); await wait(600);
  const item = [...document.querySelectorAll("[role=menuitem]")].find((e) => /^(Play|تلاوة)$/.test(e.textContent.trim()));
  if (!item) return "no Play";
  item.click();
  const t0 = Date.now();
  while (Date.now() - t0 < 60000 && gaps.length < 5) await wait(250);
  out.push("gaps_ms=" + gaps.join(","));
  const pause = [...document.querySelectorAll("button")].find((e) => /^(Pause|إيقاف)/.test(e.getAttribute("aria-label") || ""));
  if (pause) pause.click();
  return out.join(" ; ");
})()
