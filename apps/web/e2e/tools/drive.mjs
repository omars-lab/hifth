/**
 * drive.mjs — open the running Hifth app, do a few things, take a picture.
 *
 * This is the headless eye. When a change needs to be *seen* rather than
 * asserted — a commentary sheet that should rise, a hop that should land on the
 * right page, a wash that should read at phone size — and there is no browser
 * window to look through, this drives a real Chromium against the dev or preview
 * server, runs a short list of steps, and writes a PNG someone (or an agent) can
 * open. It is the mechanism behind the `run-app` skill's promise to "screenshot
 * the app".
 *
 * It is NOT a test. It has no baselines and asserts nothing on its own — the
 * `testing` skill owns the suites that hold the UI still (e2e, golden). This is
 * for looking and for a quick end-to-end sanity check of a flow. Its one
 * optional assertion, `--expect`, exists only so a flow that silently failed
 * exits non-zero instead of handing back a screenshot of the wrong screen.
 *
 * One stable command; the variation rides in the flags (CLAUDE.md → "Run one
 * simple command, not a compound one"):
 *
 *   node apps/web/e2e/tools/drive.mjs \
 *     --base http://localhost:5173 \      # dev (5173) or preview (4173); default dev
 *     --hash '#/hafs-kfqc/1:1' \          # deep-link a verse/page — no polygon math
 *     --act 'clickrole=button|Study Quran commentary; settle=400' \
 *     --expect 'div[role="dialog"]' \     # fail loudly if the flow didn't land
 *     --out apps/web/test-results/drive/fatiha-commentary.png \
 *     --locale en-US                      # English chrome (the pitch default)
 *
 * The action DSL (`--act`, steps joined by ';', verb and arg split on the first '='):
 *
 *   wait=<css>                 wait until a CSS match is visible
 *   waitrole=<role>|<name>     wait until a role with an accessible name (substring) is visible
 *   click=<css>               click the first visible CSS match
 *   clickrole=<role>|<name>    click a role by accessible name (substring, case-insensitive)
 *   fill=<css>|<text>          type text into an input
 *   press=<Key>               keyboard press (e.g. Escape, Enter)
 *   scroll=<css>|<bottom|top|±px>  scroll a container so a shot catches what is below its fold
 *   settle=<ms>               pause (for an animation to finish before the shot)
 *   move=<x>,<y>              move the mouse to a viewport point (hover states)
 *   drag=<x>,<y>><x>,<y>      press at one point, glide to the other, let go (a mouse: a page turn by its edge)
 *   swipe=<x>,<y>><x>,<y>     the same with a real finger (a phone or iPad swipe; Chromium only)
 *   eval=<js expression>      evaluate in the page and log the JSON result (measure, don't guess)
 *   evalfile=<path>           the same, with the script read from a file (an option mocked into the real app)
 *   tap=<css | x,y>           a real finger, down and up at once (aimed at a point that is really on the element)
 *   hold=<css | x,y>|<ms>     a real finger, kept down that long (default 800), then lifted
 *   step=<n>|<text>           the numbered step label a recording shows (needs --marks)
 *
 * tap= and hold= go through Chromium's own touch input, so the app reacts as it
 * would to a finger; with --mouse they press the mouse instead. A CSS target is
 * aimed the way e2e/ayah.ts aims a tap: a verse that wraps a line has a gap at
 * its centre that belongs to its neighbour, so the point is searched for.
 *
 * Other flags: --browser firefox (the owner's browser; default chromium),
 * --mouse (a desktop with a real pointer, no touch — hover styles apply),
 * --device <name> (the way a reader holds it, by name: desktop, laptop, ipad,
 * ipad-side, ipad-big-side, phone, phone-side — the window size, and a finger
 * or a mouse; an explicit --viewport or --mouse still wins), --seen-coach (the
 * first-run hint already dismissed, as for a returning reader),
 * --clip x,y,w,h (shoot only that part of the viewport, for a close look).
 *
 * Showing a finger in a moving picture: --marks loads the record-demo skill's
 * touch-marks.js before the first step, which draws a grey fingertip under every
 * touch, a ring that fills while it is held (--mark-hold <ms>, default 500: match
 * the app's hold) and a ripple for a tap; --mark-fade <ms> (default 300; 0 = gone
 * at once) is how fast the mark fades on lift.
 *
 * --frames <dir> takes screenshots instead of a video, as fast as they come, at
 * the phone's full sharpness, from the first step to the end, and writes
 * frames.txt beside them: each frame and how long it shows. The record-demo
 * skill's make-gif.sh turns that into the GIF a note embeds. Frames beat --video
 * for a clip you commit: the browser's video is half as sharp and flickers.
 *
 * A moving picture, when a still cannot carry it (a page turn, a drawer rising):
 * --video <path>.webm records the whole run; --video <path>.gif records it and
 * turns it into a GIF with ffmpeg (--gif-width, default 720; --gif-fps, default
 * 15). A recording is made fresh whenever it is wanted, so it is not committed;
 * the command that makes it is what is kept. The record-demo skill is the guide;
 * e2e/drive-video.spec.ts runs one.
 *
 * A deep-link hash reaches most states with no clicks at all: `#/hafs-kfqc/2:48`
 * selects that verse, `#/hafs-kfqc/p19` opens page 19. See e2e/deeplink.spec.ts.
 */
import { chromium, firefox } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const log = (ev, extra = "") =>
  console.log(`[drive] ev=${ev}${extra ? " " + extra : ""}`);

/** Minimal `--flag value` / `--flag=value` / bare-boolean parser. */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq !== -1) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out[a.slice(2)] = true; // bare boolean flag
      } else {
        out[a.slice(2)] = next;
        i++;
      }
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

const base = String(args.base ?? "http://localhost:5173").replace(/\/$/, "");
const hash = args.hash ? String(args.hash) : "";
const url = base + "/" + (hash.startsWith("#") ? hash : hash ? "#" + hash : "");
// The default lands in the app's own test-results wherever the tool is run
// from; a relative default once nested a stray apps/web/apps/web/ folder.
const out = args.out
  ? resolve(String(args.out))
  : fileURLToPath(new URL("../../test-results/drive/shot.png", import.meta.url));
// The ways a reader holds the app, by name, so a walk on "an iPad on its side"
// is the same window every time. The walk-app skill's checklist uses these words.
const DEVICES = {
  desktop: { viewport: "1440x900", mouse: true },
  laptop: { viewport: "1280x800", mouse: true },
  ipad: { viewport: "1024x1366" },
  "ipad-side": { viewport: "1180x820" },
  "ipad-big-side": { viewport: "1366x1024" },
  phone: { viewport: "390x844" },
  "phone-side": { viewport: "844x390" },
};
const device = args.device ? DEVICES[String(args.device)] : {};
if (!device) {
  console.error(`[drive] unknown device "${args.device}"; known: ${Object.keys(DEVICES).join(", ")}`);
  process.exit(2);
}
const [vw, vh] = String(args.viewport ?? device.viewport ?? "390x844")
  .split("x")
  .map((n) => Number(n));
const dsf = Number(args.dsf ?? 2);
const fullPage = Boolean(args.full);
const settleMs = Number(args.settle ?? 300);
const timeout = Number(args.timeout ?? 20000);
const locale = args.locale ? String(args.locale) : undefined;
const expectSel = args.expect ? String(args.expect) : undefined;
const engine = args.browser === "firefox" ? firefox : chromium;
const mouse = Boolean(args.mouse ?? device.mouse);
const seenCoach = Boolean(args["seen-coach"]);
const clip = args.clip
  ? (([x, y, width, height]) => ({ x, y, width, height }))(String(args.clip).split(",").map(Number))
  : undefined;
const video = args.video ? resolve(String(args.video)) : undefined;
const gifWidth = Number(args["gif-width"] ?? 720);
const gifFps = Number(args["gif-fps"] ?? 15);
const marks = Boolean(args.marks);
const markHold = Number(args["mark-hold"] ?? 500);
const markFade = Number(args["mark-fade"] ?? 300);
const framesDir = args.frames ? resolve(String(args.frames)) : undefined;
const MARKS_JS = fileURLToPath(new URL("../../../../.claude/skills/record-demo/scripts/touch-marks.js", import.meta.url));

/**
 * Where a finger should land for `css | x,y`. A CSS target is brought on screen
 * and searched for a point the browser itself says is on it (see e2e/ayah.ts).
 */
async function pointFor(page, target) {
  const xy = /^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/.exec(target);
  if (xy) return { x: Number(xy[1]), y: Number(xy[2]) };
  const el = page.locator(target).filter({ visible: true }).first();
  await el.waitFor({ timeout });
  await el.scrollIntoViewIfNeeded({ timeout });
  const at = await el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    const steps = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9];
    for (const fy of steps) {
      for (const fx of steps) {
        const x = r.x + r.width * fx;
        const y = r.y + r.height * fy;
        if (x < 0 || y < 0 || x > globalThis.innerWidth || y > globalThis.innerHeight) continue;
        const hit = globalThis.document.elementFromPoint(x, y);
        if (hit && (hit === node || node.contains(hit))) return { x, y };
      }
    }
    return null;
  });
  if (!at) throw new Error(`no point a finger can hit on ${target}`);
  return at;
}

const cdpSessions = new WeakMap();
/** A real finger down at one point, moved to the other over a quarter second, lifted. */
async function swipe(page, from, to) {
  if (mouse) throw new Error("swipe= is a finger; drop --mouse, or use drag=");
  if (engine !== chromium) throw new Error("swipe= sends touches through Chromium's own input; drop --browser firefox");
  if (!cdpSessions.has(page)) cdpSessions.set(page, await page.context().newCDPSession(page));
  const cdp = cdpSessions.get(page);
  log("touch_down", `kind=swipe x=${from[0]} y=${from[1]}`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from[0], y: from[1], id: 1 }] });
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    const x = from[0] + ((to[0] - from[0]) * i) / steps;
    const y = from[1] + ((to[1] - from[1]) * i) / steps;
    await page.waitForTimeout(20);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y, id: 1 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  log("touch_up", `kind=swipe x=${to[0]} y=${to[1]}`);
}

/** Put a real finger down on `target`, keep it there `ms`, lift it. */
async function touch(page, kind, target, ms) {
  const { x, y } = await pointFor(page, target);
  log("touch_down", `kind=${kind} x=${Math.round(x)} y=${Math.round(y)}`);
  const downAt = Date.now();
  if (mouse) {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
  } else {
    if (engine !== chromium) throw new Error(`${kind}= sends touches through Chromium's own input; drop --browser firefox`);
    if (!cdpSessions.has(page)) cdpSessions.set(page, await page.context().newCDPSession(page));
    const cdp = cdpSessions.get(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await page.waitForTimeout(ms);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  log("touch_up", `kind=${kind} held_ms=${Date.now() - downAt}`);
}

/**
 * Screenshots as fast as they come until stopped, each stamped with the time it
 * was taken. stop() writes frames.txt for ffmpeg's concat reader: every frame
 * shows until the next was taken, and the last for one frame's length (the
 * record-demo skill's make-gif.sh adds the rest at the end).
 */
function startFrames(page, dir) {
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (/^f\d{4}\.png$|^frames\.txt$/.test(f)) rmSync(join(dir, f));
  const stamps = [];
  let filming = true;
  const loop = (async () => {
    while (filming) {
      const t = Date.now();
      const f = `f${String(stamps.length).padStart(4, "0")}.png`;
      try {
        writeFileSync(join(dir, f), await page.screenshot({ type: "png" }));
      } catch (e) {
        log("frame_error", `msg=${JSON.stringify(String(e && e.message ? e.message : e))}`);
        break;
      }
      stamps.push([f, t]);
    }
  })();
  log("frames_start", `dir=${dir}`);
  return async () => {
    filming = false;
    await loop;
    if (stamps.length === 0) throw new Error("no frames were taken");
    const gaps = stamps.slice(1).map(([, t], i) => t - stamps[i][1]);
    const each = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 100;
    const lines = stamps.flatMap(([f, t], i) => [
      `file '${f}'`,
      `duration ${(((i + 1 < stamps.length ? stamps[i + 1][1] : t + each) - t) / 1000).toFixed(3)}`,
    ]);
    lines.push(`file '${stamps.at(-1)[0]}'`); // concat counts the last duration only if the file is named again
    writeFileSync(join(dir, "frames.txt"), lines.join("\n") + "\n");
    const secs = (stamps.at(-1)[1] - stamps[0][1]) / 1000;
    log("frames", `n=${stamps.length} secs=${secs.toFixed(2)} fps=${(stamps.length / Math.max(secs, 0.001)).toFixed(1)} out=${join(dir, "frames.txt")}`);
  };
}

/** Resolve a `role|name` pair to a Playwright locator (name is a substring). */
function byRole(page, spec) {
  const [role, ...rest] = spec.split("|");
  const name = rest.join("|").trim();
  return page.getByRole(role.trim(), {
    name: name ? new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : undefined,
  });
}

async function runStep(page, step) {
  const trimmed = step.trim();
  if (!trimmed) return;
  const eq = trimmed.indexOf("=");
  const verb = (eq === -1 ? trimmed : trimmed.slice(0, eq)).trim();
  const arg = eq === -1 ? "" : trimmed.slice(eq + 1).trim();
  log("step", `verb=${verb} arg=${JSON.stringify(arg)}`);
  switch (verb) {
    case "wait":
      await page.locator(arg).filter({ visible: true }).first().waitFor({ timeout });
      return;
    case "waitrole":
      await byRole(page, arg).first().waitFor({ state: "visible", timeout });
      return;
    case "click":
      await page.locator(arg).filter({ visible: true }).first().click({ timeout });
      return;
    case "clickrole":
      await byRole(page, arg).first().click({ timeout });
      return;
    case "fill": {
      const [sel, ...text] = arg.split("|");
      await page.locator(sel.trim()).first().fill(text.join("|"), { timeout });
      return;
    }
    case "press":
      await page.keyboard.press(arg);
      return;
    case "scroll": {
      // scroll=<css>|<bottom|top|±px> — scroll a container (e.g. a drawer whose
      // content runs past the fold) so a shot can catch what is below it.
      const [sel, ...restArg] = arg.split("|");
      const how = (restArg.join("|") || "bottom").trim();
      await page.locator(sel.trim()).first().evaluate((el, h) => {
        if (h === "bottom") el.scrollTop = el.scrollHeight;
        else if (h === "top") el.scrollTop = 0;
        else el.scrollTop += Number(h);
      }, how);
      return;
    }
    case "move": {
      const [x, y] = arg.split(",").map(Number);
      await page.mouse.move(x, y, { steps: 4 });
      return;
    }
    case "drag": {
      const [from, to] = arg.split(">").map((p) => p.split(",").map(Number));
      await page.mouse.move(from[0], from[1]);
      await page.mouse.down();
      await page.mouse.move(to[0], to[1], { steps: 20 });
      await page.mouse.up();
      return;
    }
    case "swipe": {
      const [from, to] = arg.split(">").map((p) => p.split(",").map(Number));
      await swipe(page, from, to);
      return;
    }
    case "eval": {
      const result = await page.evaluate((src) => (0, eval)(src), arg);
      log("eval", `result=${JSON.stringify(result)}`);
      return;
    }
    case "evalfile": {
      // A mock kept beside an options note: too long for the command line, and
      // kept so the picture can be taken again.
      const result = await page.evaluate((src) => (0, eval)(src), readFileSync(resolve(arg), "utf8"));
      log("eval", `result=${JSON.stringify(result)}`);
      return;
    }
    case "settle":
      await page.waitForTimeout(Number(arg));
      return;
    case "tap":
      await touch(page, "tap", arg, 60);
      return;
    case "hold": {
      const [target, ms] = arg.split("|");
      await touch(page, "hold", target.trim(), Number(ms ?? 800));
      return;
    }
    case "step": {
      const [n, ...text] = arg.split("|");
      const say = () =>
        page.evaluate(([num, t]) => (globalThis.__step ? globalThis.__step(num, t) : null), [
          Number(n),
          text.join("|").trim(),
        ]);
      let said = await say();
      // A page script that reopened the page took the marks with it; the load
      // handler puts them back, but may not have finished yet.
      if (said === null && marks) {
        await installMarks(page, "reloaded");
        said = await say();
      }
      if (said === null) throw new Error("step= needs the finger marks loaded: add --marks");
      if (typeof said === "string") log("warn", `msg=${JSON.stringify(said)}`);
      return;
    }
    default:
      throw new Error(`unknown step verb: ${verb} (in "${step}")`);
  }
}

/**
 * The finger marks live in the page, so a reload loses them: put in once after
 * the first load, and again after every later one (a mock that seeds saved
 * data reopens the page so the app reads it).
 */
async function installMarks(page, why) {
  await page.evaluate(([h, f]) => Object.assign(globalThis, { TOUCH_HOLD_MS: h, TOUCH_FADE_MS: f }), [markHold, markFade]);
  const said = await page.evaluate((src) => (0, eval)(src), readFileSync(MARKS_JS, "utf8"));
  log("marks", `result=${JSON.stringify(said)} ${why} hold_ms=${markHold} fade_ms=${markFade}`);
}

async function main() {
  mkdirSync(dirname(out), { recursive: true });
  const videoDir = video ? mkdtempSync(join(tmpdir(), "drive-video-")) : undefined;
  log("launch", `base=${base} device=${args.device ?? "-"} viewport=${vw}x${vh} dsf=${dsf} mouse=${mouse}`);
  const browser = await engine.launch();
  const context = await browser.newContext({
    viewport: { width: vw, height: vh },
    deviceScaleFactor: dsf,
    hasTouch: !mouse,
    locale,
    ...(videoDir ? { recordVideo: { dir: videoDir, size: { width: vw, height: vh } } } : {}),
  });
  // The same key the app's first-run hint keeps (src/coach.ts).
  if (seenCoach) await context.addInitScript(() => globalThis.localStorage.setItem("hifth.coach.v1", "1"));
  const page = await context.newPage();

  // Surface page crashes and failed requests — a blank screenshot otherwise
  // looks like a working app that simply has nothing on it.
  page.on("pageerror", (e) => log("pageerror", `msg=${JSON.stringify(e.message)}`));
  page.on("requestfailed", (r) =>
    log("requestfailed", `url=${r.url()} err=${JSON.stringify(r.failure()?.errorText ?? "")}`),
  );

  let failed = false;
  let stopFrames;
  try {
    log("goto", `url=${url}`);
    await page.goto(url, { waitUntil: "load", timeout });
    // Every screen has a mushaf; wait for one to be actually visible (PageStage
    // keeps prior pages mounted and hidden — see e2e/shots.spec.ts).
    await page
      .locator("svg[role='group']")
      .filter({ visible: true })
      .first()
      .waitFor({ timeout })
      .catch(() => log("warn", "no visible mushaf svg — continuing anyway"));

    if (marks) {
      await installMarks(page, "first");
      page.on("load", () =>
        installMarks(page, "reloaded").catch((e) => log("warn", `msg=${JSON.stringify("marks: " + e.message)}`)),
      );
    }
    stopFrames = framesDir ? startFrames(page, framesDir) : undefined;

    const acts = args.act ? String(args.act).split(";") : [];
    for (const step of acts) await runStep(page, step);

    if (settleMs > 0) await page.waitForTimeout(settleMs);
    if (stopFrames) await stopFrames();
    stopFrames = undefined;

    if (expectSel) {
      const ok = await page
        .locator(expectSel)
        .filter({ visible: true })
        .first()
        .isVisible()
        .catch(() => false);
      if (!ok) {
        failed = true;
        log("expect_fail", `selector=${JSON.stringify(expectSel)}`);
      } else {
        log("expect_ok", `selector=${JSON.stringify(expectSel)}`);
      }
    }

    await page.screenshot({ path: out, fullPage, clip });
    log("shot", `out=${out}`);
  } catch (e) {
    failed = true;
    log("error", `msg=${JSON.stringify(String(e && e.message ? e.message : e))}`);
    // Still try to capture what was on screen when it broke.
    await page.screenshot({ path: out, fullPage }).catch(() => {});
  } finally {
    // A step that failed leaves the screenshots running; stop them before the page goes.
    if (stopFrames) await stopFrames().catch(() => {});
    // The recording is finished by closing the page's context and can only be
    // saved while the browser is still up, so it goes between the two.
    await context.close();
    if (video && videoDir) {
      try {
        await saveVideo(page, video, videoDir);
      } catch (e) {
        failed = true;
        log("video_error", `msg=${JSON.stringify(String(e && e.message ? e.message : e))}`);
      } finally {
        rmSync(videoDir, { recursive: true, force: true });
      }
    }
    await browser.close();
  }

  if (failed) process.exit(1);
  console.log(`\n  wrote ${out}\n`);
}

/**
 * Keep the run's recording: as it is for .webm, or as a GIF for .gif. The GIF
 * draws its colours from the video itself, so the page's paper and ink stay
 * true instead of banding. ffmpeg gets a timeout so a stuck conversion ends the
 * run instead of hanging it.
 */
async function saveVideo(page, target, dir) {
  mkdirSync(dirname(target), { recursive: true });
  const asGif = target.endsWith(".gif");
  const webm = asGif ? join(dir, "run.webm") : target;
  await page.video().saveAs(webm);
  if (!asGif) {
    log("video", `out=${target}`);
  } else {
    log("gif_start", `out=${target} width=${gifWidth} fps=${gifFps}`);
    const vf = `fps=${gifFps},scale=${gifWidth}:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse`;
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", webm, "-vf", vf, target], {
      stdio: "inherit",
      timeout: 120000,
    });
    log("gif_done", `out=${target}`);
  }
  console.log(`\n  wrote ${target}\n`);
}

main().catch((e) => {
  log("fatal", `msg=${JSON.stringify(String(e && e.message ? e.message : e))}`);
  process.exit(1);
});
