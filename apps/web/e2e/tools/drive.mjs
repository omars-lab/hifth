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
 *   drag=<x>,<y>><x>,<y>      press at one point, glide to the other, let go (a page turn by its edge)
 *   eval=<js expression>      evaluate in the page and log the JSON result (measure, don't guess)
 *
 * Other flags: --browser firefox (the owner's browser; default chromium),
 * --mouse (a desktop with a real pointer, no touch — hover styles apply),
 * --clip x,y,w,h (shoot only that part of the viewport, for a close look).
 *
 * A moving picture, when a still cannot carry it (a page turn, a drawer rising):
 * --video <path>.webm records the whole run; --video <path>.gif records it and
 * turns it into a GIF with ffmpeg (--gif-width, default 720; --gif-fps, default
 * 15). A recording is made fresh whenever it is wanted, so it is not committed;
 * the command that makes it is what is kept (e2e/drive-video.spec.ts runs one).
 *
 * A deep-link hash reaches most states with no clicks at all: `#/hafs-kfqc/2:48`
 * selects that verse, `#/hafs-kfqc/p19` opens page 19. See e2e/deeplink.spec.ts.
 */
import { chromium, firefox } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
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
const [vw, vh] = String(args.viewport ?? "390x844")
  .split("x")
  .map((n) => Number(n));
const dsf = Number(args.dsf ?? 2);
const fullPage = Boolean(args.full);
const settleMs = Number(args.settle ?? 300);
const timeout = Number(args.timeout ?? 20000);
const locale = args.locale ? String(args.locale) : undefined;
const expectSel = args.expect ? String(args.expect) : undefined;
const engine = args.browser === "firefox" ? firefox : chromium;
const mouse = Boolean(args.mouse);
const clip = args.clip
  ? (([x, y, width, height]) => ({ x, y, width, height }))(String(args.clip).split(",").map(Number))
  : undefined;
const video = args.video ? resolve(String(args.video)) : undefined;
const gifWidth = Number(args["gif-width"] ?? 720);
const gifFps = Number(args["gif-fps"] ?? 15);

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
    case "eval": {
      const result = await page.evaluate((src) => (0, eval)(src), arg);
      log("eval", `result=${JSON.stringify(result)}`);
      return;
    }
    case "settle":
      await page.waitForTimeout(Number(arg));
      return;
    default:
      throw new Error(`unknown step verb: ${verb} (in "${step}")`);
  }
}

async function main() {
  mkdirSync(dirname(out), { recursive: true });
  const videoDir = video ? mkdtempSync(join(tmpdir(), "drive-video-")) : undefined;
  log("launch", `base=${base} viewport=${vw}x${vh} dsf=${dsf}`);
  const browser = await engine.launch();
  const context = await browser.newContext({
    viewport: { width: vw, height: vh },
    deviceScaleFactor: dsf,
    hasTouch: !mouse,
    locale,
    ...(videoDir ? { recordVideo: { dir: videoDir, size: { width: vw, height: vh } } } : {}),
  });
  const page = await context.newPage();

  // Surface page crashes and failed requests — a blank screenshot otherwise
  // looks like a working app that simply has nothing on it.
  page.on("pageerror", (e) => log("pageerror", `msg=${JSON.stringify(e.message)}`));
  page.on("requestfailed", (r) =>
    log("requestfailed", `url=${r.url()} err=${JSON.stringify(r.failure()?.errorText ?? "")}`),
  );

  let failed = false;
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

    const acts = args.act ? String(args.act).split(";") : [];
    for (const step of acts) await runStep(page, step);

    if (settleMs > 0) await page.waitForTimeout(settleMs);

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
