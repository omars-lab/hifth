#!/usr/bin/env node
/**
 * The note open across the foot of an upright iPad, then one thing that takes
 * its place, watched frame by frame (docs/PLAN.md, items 72 to 74).
 *
 *   node .claude/skills/walk-app/scripts/note-handoff.mjs --route /hafs-kfqc/2:49?view=one --mode close
 *
 * --url     the app, default the private build's dev server, http://localhost:5191/
 * --route   where the note opens, default /hafs-kfqc/2:49?view=one
 * --mode    what takes the note's place:
 *             close    its Close button (default)
 *             key      a key press, --key ArrowLeft by default (a page turn)
 *             back     the browser's Back, after --from <route> was open first
 *             menu     a long press on the lit verse above the note; with --pick
 *                      <text>, then the item of that menu whose words match
 *             number   a tap on the verse's number, then the --pick item (⬡ by default)
 *             chip     a look-alike chip, --chip <selector>, the "later" one by default
 *             swipe    one finger drawn across the page, --dir 1 or -1
 *             pinch    two fingers drawn apart (Chromium only: real touches)
 *             grip     the note's handle, which grows it (a second press shrinks it)
 *             hop      the first verse the note links to, followed from the note
 * --size    the window, default 1024x1366 (the large iPad upright)
 * --engine  webkit (default) or chromium
 * --lang    en-US (default) or ar
 * --shots   a path prefix: pictures in the middle and at the end. They show
 *           scripture and note text, so they go to a scratch folder only.
 * --run     with the sound going (items 76 to 78): --route is a page, such as
 *           /hafs-kfqc/p2?view=one; the surah on that page is played from its
 *           corner at --rate (3 by default) for --before ms (7000), then the
 *           number of the verse being recited is tapped and its note opened,
 *           and --wait ms later (0 by default; give it a verse's length, so
 *           the recitation has moved past the note's verse) the hand-off
 *           happens. It says which verse is heard at that moment, against the
 *           note's, and the last line says whether the sound is still going and
 *           which verse it is on, read off the sound itself.
 *
 * Prints, for 40 frames: how many sliding copies of the note stand, the copy's
 * top, the live note's top and how many drawers are up, any menu's top and
 * foot, and the page's top; then where the page ended and what is still up.
 * Boxes and numbers only, never the note's words.
 */
import { createRequire } from "node:module";

const here = new URL(".", import.meta.url);
const require = createRequire(new URL("../../../../apps/web/package.json", here));
const { webkit, chromium } = require("@playwright/test");

const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const base = arg("url", "http://localhost:5191/");
const route = arg("route", "/hafs-kfqc/2:49?view=one");
const mode = arg("mode", "close");
const [w, h] = arg("size", "1024x1366").split("x").map(Number);
const engine = arg("engine", "webkit");
const shots = arg("shots", "");
const dir = Number(arg("dir", "1"));
const CLOSE = /^Close|^إغلاق/;

const browser = await (engine === "chromium" ? chromium : webkit).launch();
const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, locale: arg("lang", "en-US") });
await ctx.addInitScript(() => localStorage.setItem("hifth.coach.v1", "1"));
const run = process.argv.includes("--run");
if (run)
  await ctx.addInitScript((rate) => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      this.volume = 0.01;
      this.playbackRate = rate;
      window.__aud ||= [];
      if (!window.__aud.includes(this)) window.__aud.push(this);
      return play.call(this);
    };
  }, Number(arg("rate", "3")));
const p = await ctx.newPage();
const from = arg("from", "");
// Back with nothing before it leaves the app, and the page with it.
if (mode === "back" && !from) throw new Error("--mode back needs --from <route>, the page to go back to");
if (mode === "back" && from) {
  await p.goto(base + "#" + from);
  await p.waitForTimeout(2000);
  await p.evaluate((r) => {
    location.hash = "#" + r;
  }, route);
} else await p.goto(base + "#" + route);
// The verse being recited, read off the lit verse's own key.
const recited = () =>
  p.evaluate(() =>
    [...document.querySelectorAll("#hifth-overlay [data-hl-group='selection']")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width && r.bottom > 0 && r.top < innerHeight;
      })
      .map((e) => (e.getAttribute("data-hl-key") || "").split("/").pop())
      .pop() ?? null,
  );
// The verse being heard, read off the name of the recitation's Pause, which names
// it wherever it is, so it is known after a turn takes the verse off the screen.
// The sound's own file is no help: verses ahead are held as in-memory copies.
const heard = () =>
  p.evaluate(() => {
    const west = (s) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));
    const names = [...document.querySelectorAll("button[aria-label]")]
      .filter((e) => !e.closest("[inert]") && e.getBoundingClientRect().width)
      .map((e) => west(e.getAttribute("aria-label")))
      .filter((s) => /^(Pause|إيقاف)/.test(s));
    return names.map((s) => s.match(/(\d+):(\d+)\s*$/)?.slice(1).join(":")).find(Boolean) ?? null;
  });
if (run) {
  await p.waitForTimeout(3000);
  const page = (route.match(/\/p(\d+)/) || [])[1];
  if (!page) throw new Error("--run needs --route to be a page, such as /hafs-kfqc/p2?view=one");
  const head = await p.locator(`[data-host-page="${page}"] [data-running-head="surah"]`).first().boundingBox();
  if (!head) throw new Error(`no surah corner on page ${page}`);
  await p.mouse.move(head.x + head.width / 2, head.y + head.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(700);
  await p.mouse.up();
  await p.getByRole("menuitem").filter({ hasText: /^(Play|تلاوة)$/ }).first().click();
  await p.waitForTimeout(Number(arg("before", "7000")));
  const key = await recited();
  const num = p.locator(`[data-verse-number][data-verse-key$="/${key}"]`).first();
  const at = await num.boundingBox();
  if (!at) throw new Error(`no number on screen for the verse being recited, ${key}`);
  await p.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
  await p.waitForTimeout(700);
  await p.getByRole("menuitem").filter({ hasText: "✎" }).first().click();
  console.log(`run: note opened on ${key}`);
}
await p.getByRole("dialog").waitFor({ timeout: 30000 });
await p.waitForTimeout(1500);
if (run) {
  await p.waitForTimeout(Number(arg("wait", "0")));
  const noteFor = await p.evaluate(() =>
    ([...document.querySelectorAll("[role=dialog]")].find((d) => d.getBoundingClientRect().height)?.getAttribute("aria-label") || "")
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
      .match(/\d+:\d+/)?.[0] ?? null,
  );
  console.log(`run: at the hand-off the note is on ${noteFor} and ${await heard()} is heard`);
}

const watch = () =>
  p.evaluate(
    () =>
      new Promise((done) => {
        const out = [];
        const shown = (sel) => [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()).find((r) => r.width && r.height);
        const step = () => {
          const copies = document.querySelectorAll("[data-note-leaving]");
          const c = copies[0]?.getBoundingClientRect();
          const d = shown("[role=dialog]");
          const m = shown("[role=menu]");
          const pg = [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")]
            .map((e) => e.getBoundingClientRect())
            .find((r) => r.width && r.right > 0 && r.left < innerWidth);
          const ds = [...document.querySelectorAll("[role=dialog]")].filter((e) => e.getBoundingClientRect().height).length;
          const r = (n) => Math.round(n);
          out.push(`${copies.length}:${c ? r(c.top) : "-"}/${d ? r(d.top) : "-"}x${ds}/${m ? r(m.top) + "-" + r(m.bottom) : "-"}/p${pg ? r(pg.top) : "-"}`);
          if (out.length < 40) requestAnimationFrame(step);
          else done(out);
        };
        requestAnimationFrame(step);
      }),
  );
const shootSoon = async () => {
  if (shots) for (const n of [1, 2, 3]) await p.waitForTimeout(120).then(() => p.screenshot({ path: `${shots}-${n}.png` }));
};
const pickFromMenu = async (pick) => {
  await p.waitForTimeout(800);
  const t = watch();
  await p.getByRole("menuitem").filter({ hasText: new RegExp(pick) }).first().click();
  await shootSoon();
  return t;
};
// A line lit above the note, or a verse's number there: where a reader's thumb goes.
const above = (sel) =>
  p.evaluate((sel) => {
    const d = [...document.querySelectorAll("[role=dialog]")].map((e) => e.getBoundingClientRect()).find((r) => r.width && r.height);
    const hit = [...document.querySelectorAll(sel)].map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => r.height && r.top > 0 && (!d || r.bottom < d.top)).at(-1);
    if (!hit) return null;
    const { e, r } = hit;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, key: (e.getAttribute("data-verse-key") || "").split("/").pop() || null };
  }, sel);

let trail;
if (mode === "close") {
  const t = watch();
  await p.getByRole("dialog").getByRole("button", { name: CLOSE }).first().click();
  trail = await t;
} else if (mode === "key") {
  const t = watch();
  await p.keyboard.press(arg("key", "ArrowLeft"));
  trail = await t;
} else if (mode === "back") {
  const t = watch();
  await p.evaluate(() => history.back());
  trail = await t;
} else if (mode === "grip") {
  const t = watch();
  await p.getByRole("dialog").getByRole("button", { name: /^(Show all of the note|اعرض التفسير كله)/ }).click();
  trail = await t;
} else if (mode === "hop") {
  const t = watch();
  await p.getByRole("dialog").getByRole("button", { name: /^(Go to|Hop to)|^(انتقل|اذهب)/ }).first().click();
  trail = await t;
} else if (mode === "chip") {
  const t = watch();
  await p.locator(arg("chip", 'button[data-direction="later"]')).first().click();
  await shootSoon();
  trail = await t;
} else if (mode === "menu" || mode === "number") {
  const at = await above(mode === "menu" ? "#hifth-overlay .hl-sel" : "[data-verse-number]");
  if (!at) throw new Error("nothing to press above the note");
  if (at.key) console.log(`${mode}: pressing the number of ${at.key}` + (run ? `, while ${await recited()} is recited` : ""));
  if (mode === "menu") {
    await p.mouse.move(at.x, at.y);
    await p.mouse.down();
    const pick = arg("pick", "");
    if (!pick) {
      const t = watch();
      await p.waitForTimeout(600);
      await p.mouse.up();
      trail = await t;
    } else {
      await p.waitForTimeout(700);
      await p.mouse.up();
      trail = await pickFromMenu(pick);
    }
  } else {
    const t = watch();
    await p.mouse.click(at.x, at.y);
    console.log("tap=" + (await t).join(","));
    if (run) console.log(`after the tap: sound=${(await p.evaluate(() => (window.__aud || []).some((a) => !a.paused))) ? "going" : "stopped"}`);
    trail = await pickFromMenu(arg("pick", "⬡"));
  }
} else if (mode === "swipe" || mode === "pinch") {
  const y = Number(arg("y", "400"));
  const x = w / 2;
  const t = watch();
  if (mode === "swipe") {
    // One finger, as pointer events, which is what the page listens to for a turn.
    const finger = (type, cx) =>
      p.evaluate(
        ({ type, cx, x, y }) => {
          const held = (window.__swipeAt ??= document.elementFromPoint(x, y));
          held?.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: "touch", isPrimary: true, clientX: cx, clientY: y, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
        },
        { type, cx, x, y },
      );
    await finger("pointerdown", x);
    for (let k = 1; k <= 8; k++) {
      await finger("pointermove", x + dir * k * 40);
      await p.waitForTimeout(16);
    }
    await finger("pointerup", x + dir * 320);
  } else {
    // Real touches: a pinch built from pointer events alone never reaches the page.
    if (engine !== "chromium") throw new Error("--mode pinch needs --engine chromium");
    const cdp = await ctx.newCDPSession(p);
    const at = (k) => [
      { x: x - 60 - dir * k * 15, y, id: 1 },
      { x: x + 60 + dir * k * 15, y, id: 2 },
    ];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(0) });
    await p.waitForTimeout(300);
    for (let k = 1; k <= 10; k++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(k) });
      await p.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  trail = await t;
} else throw new Error(`no such --mode: ${mode}`);

if (shots) {
  await p.waitForTimeout(180);
  await p.screenshot({ path: `${shots}-mid.png` });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${shots}-after.png` });
}
await p.waitForTimeout(1200);
const end = await p.evaluate(() => {
  const e = [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")].find((e) => e.getBoundingClientRect().width);
  return {
    page: e ? e.getAttribute("aria-labelledby").replace("page-label-", "") : null,
    pageTop: e ? Math.round(e.getBoundingClientRect().top) : null,
    zoom: (document.body.innerText.match(/[\d٠-٩]+[%٪]/) || [""])[0],
    copies: document.querySelectorAll("[data-note-leaving]").length,
    dialogs: [...document.querySelectorAll("[role=dialog]")].filter((d) => d.getBoundingClientRect().height).length,
    menus: document.querySelectorAll("[role=menu]").length,
    sound: (window.__aud || []).some((a) => !a.paused) ? "going" : "stopped",
  };
});
if (run) {
  end.recited = await recited();
  end.heard = await heard();
}
console.log(`mode=${mode} frames(copies:copyTop/noteTop x drawers/menu/page)=` + trail.join(","));
console.log("end=" + JSON.stringify(end));
await browser.close();
