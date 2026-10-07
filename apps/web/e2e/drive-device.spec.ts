import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/*
 * Walking the app means walking it the way each reader holds it: a desk, an
 * iPad upright and on its side, a phone upright and on its side. The walk-app
 * skill names those by word, and the drive tool turns the word into the window,
 * the finger or mouse, and the first-run hint already seen, so a walk on "an iPad
 * on its side" is the same walk every time instead of numbers retyped from
 * memory.
 */

const DRIVE = fileURLToPath(new URL("./tools/drive.mjs", import.meta.url));

const drive = (baseURL: string | undefined, ...flags: string[]) => {
  const dir = mkdtempSync(join(tmpdir(), "drive-device-"));
  try {
    return execFileSync(
      process.execPath,
      [
        DRIVE,
        "--base", String(baseURL),
        "--hash", "#/hafs-kfqc/p7",
        "--locale", "en-US",
        "--act", "eval=[innerWidth, innerHeight, matchMedia('(pointer: coarse)').matches, localStorage.getItem('hifth.coach.v1')]",
        "--out", join(dir, "shot.png"),
        ...flags,
      ],
      { stdio: "pipe", timeout: 50_000 },
    ).toString();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("a named device sets the window and the finger; --seen-coach skips the first-run hint", async ({ baseURL }) => {
  test.setTimeout(120_000);
  expect(drive(baseURL, "--device", "ipad-side", "--seen-coach")).toMatch(/ev=eval result=\[1180,820,true,"1"\]/);
  expect(drive(baseURL, "--device", "desktop", "--seen-coach")).toMatch(/ev=eval result=\[1440,900,false,"1"\]/);
});

test("an unknown device is refused with the names it knows", async ({ baseURL }) => {
  let said = "";
  try {
    drive(baseURL, "--device", "tablet");
  } catch (e) {
    said = String((e as { stderr?: Buffer }).stderr ?? e);
  }
  expect(said).toMatch(/unknown device "tablet".*phone-side/s);
});

test("without --seen-coach the first-run hint is still owed", async ({ baseURL }) => {
  test.setTimeout(60_000);
  expect(drive(baseURL, "--device", "phone")).toMatch(/ev=eval result=\[390,844,true,null\]/);
});

test("make drive points at the picture it wrote, whole path or under the app", () => {
  // `make -n` prints what it would run without running it, so this needs no browser.
  const root = fileURLToPath(new URL("../../..", import.meta.url));
  const said = (out: string) =>
    execFileSync("make", ["-s", "-n", "-C", root, "drive", `OUT=${out}`], { stdio: "pipe" }).toString();
  expect(said("/tmp/walk/shot.png")).toContain("→ open /tmp/walk/shot.png");
  expect(said("test-results/walk/shot.png")).toContain("→ open apps/web/test-results/walk/shot.png");
});
