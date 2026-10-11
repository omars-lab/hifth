/*
 * How long the silence is between two verses of a run (docs/PLAN.md, item 63).
 *
 * Holds the surah corner, presses Play, and times each verse's end to the next
 * one sounding, for five gaps, and the wait from pressing Play to the first verse
 * sounding (first_ms, with first_from "held" when it played from a copy in hand
 * and "net" when not); then pauses. Two numbers may be set on the page before
 * it runs: window.__gapPause, the ms between the menu opening and the press
 * (default 600), and window.__gapCount, how many gaps to time (default 5).
 * Each gap reads like 120@002041.mp3/after4s: the silence in ms, the file it
 * waited for ("held" when it played from a copy already in hand), and how long
 * the verse before it ran. Numbers only, never note words.
 * Runs in the page: in the iPad or Mac app through
 *   make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en ROUTE=/hafs-kfqc/p600 EVALFILE=.claude/skills/walk-app/scripts/gap-walk.js DELAY_MS=2500 PROBE_TIMEOUT_S=200
 * and in Chromium at three connection speeds through gap-throttle.mjs.
 */
(async () => {
  // How long the silence is between one verse's end and the next one sounding, in a run.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  let endedAt = 0; const gaps = []; const seen = new WeakSet();
  // And the wait from pressing Play to the first verse sounding.
  let pressedAt = 0; let first = -1; let firstFrom = "";
  const pauseMs = window.__gapPause ?? 600;
  const count = window.__gapCount ?? 5;
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    this.volume = 0.01;
    if (!seen.has(this)) {
      seen.add(this);
      // Each gap names the file it waited for and how long the verse before it sounded.
      // The app points the player at the next file inside its own end listener,
      // so the length is read while the verse still sounds, not at its end.
      let length = 0; let before = 0;
      this.addEventListener("timeupdate", () => { if (this.duration > 0) length = this.duration; });
      this.addEventListener("ended", () => { endedAt = performance.now(); before = length; });
      this.addEventListener("playing", () => {
        if (first < 0 && pressedAt) {
          first = Math.round(performance.now() - pressedAt);
          firstFrom = this.currentSrc.startsWith("blob:") ? "held" : "net";
        }
        if (!endedAt) return;
        const file = this.currentSrc.startsWith("blob:") ? "held" : this.currentSrc.split("/").pop();
        gaps.push(`${Math.round(performance.now() - endedAt)}@${file}/after${Math.round(before)}s`);
        endedAt = 0;
      });
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
  fire("pointerdown"); await wait(700); fire("pointerup"); await wait(pauseMs);
  const item = [...document.querySelectorAll("[role=menuitem]")].find((e) => /^(Play|تلاوة)$/.test(e.textContent.trim()));
  if (!item) return "no Play";
  pressedAt = performance.now();
  item.click();
  const t0 = Date.now();
  while (Date.now() - t0 < 60000 && (gaps.length < count || first < 0)) await wait(250);
  out.push("first_ms=" + first, "first_from=" + firstFrom, "gaps_ms=" + gaps.join(","));
  const pause = [...document.querySelectorAll("button")].find((e) => /^(Pause|إيقاف)/.test(e.getAttribute("aria-label") || ""));
  if (pause) pause.click();
  return out.join(" ; ");
})()
