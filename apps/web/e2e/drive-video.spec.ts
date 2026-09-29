import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/*
 * The drive tool can record what it does, not only photograph the end of it.
 *
 * A page turn, a drawer rising, a wash following a thumb — a still cannot carry
 * those, and the one recording of a page turn we had was made by hand in a
 * scratch folder and would have gone with it. This runs the tool the way a
 * person would, asks for a GIF, and checks it is a real one that moves: the
 * file says GIF, and it holds more than one frame.
 */

const DRIVE = fileURLToPath(new URL("./tools/drive.mjs", import.meta.url));
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

test.skip(!hasFfmpeg, "ffmpeg is not installed, so no GIF can be made");

// Only the desktop project runs this (playwright.config.ts): the tool launches
// its own browser, so once is enough.
test("a drive run saved as .gif is a moving GIF of the run", async ({ baseURL }) => {
  test.setTimeout(60_000);

  const dir = mkdtempSync(join(tmpdir(), "drive-video-"));
  try {
    const out = join(dir, "turn.gif");
    execFileSync(
      process.execPath,
      [
        DRIVE,
        "--base", String(baseURL),
        "--hash", "#/hafs-kfqc/p8",
        "--viewport", "1280x800",
        "--mouse",
        "--act", "settle=300; press=ArrowLeft; settle=600",
        "--out", join(dir, "end.png"),
        "--video", out,
      ],
      { stdio: "pipe", timeout: 50_000 },
    );

    const gif = readFileSync(out);
    expect(gif.subarray(0, 6).toString("latin1")).toBe("GIF89a");
    // Each frame starts with an image descriptor (0x2C) right after a graphic
    // control block (21 F9 04 … 00); count those pairs.
    let frames = 0;
    for (let i = 0; i + 8 < gif.length; i++) {
      if (gif[i] === 0x21 && gif[i + 1] === 0xf9 && gif[i + 2] === 0x04 && gif[i + 7] === 0x00 && gif[i + 8] === 0x2c) frames++;
    }
    expect(frames, "a GIF of a run should move").toBeGreaterThan(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
