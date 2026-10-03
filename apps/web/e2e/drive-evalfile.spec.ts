import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/*
 * The drive tool can run a script kept in a file before it takes its picture.
 *
 * An options note shows each option as a photograph of the real app with that
 * option mocked into it — a new button in the menu, the bars gone. The mock is
 * a few lines of page script, too long to pass on the command line, and it has
 * to be kept beside the note so the picture can be taken again. This runs the
 * tool with such a file and checks the script ran in the page.
 */

const DRIVE = fileURLToPath(new URL("./tools/drive.mjs", import.meta.url));

// Only the desktop project runs this (playwright.config.ts): the tool launches
// its own browser, so once is enough.
test("a drive run can run a page script kept in a file", async ({ baseURL }) => {
  test.setTimeout(60_000);

  const dir = mkdtempSync(join(tmpdir(), "drive-evalfile-"));
  try {
    const script = join(dir, "mock.js");
    writeFileSync(script, 'document.body.dataset.mocked = "yes";\ndocument.body.dataset.mocked;\n');
    const log = execFileSync(
      process.execPath,
      [
        DRIVE,
        "--base", String(baseURL),
        "--hash", "#/hafs-kfqc/p8",
        "--act", `settle=200; evalfile=${script}; eval=document.body.dataset.mocked`,
        "--out", join(dir, "shot.png"),
      ],
      { stdio: "pipe", timeout: 50_000 },
    ).toString();
    expect(log).toMatch(/ev=eval result="yes"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// A mock that sets up saved data has to reopen the page for the app to read
// it, and the finger marks were loaded only once, before the first step: the
// first step label after the reload stopped the recording.
test("the finger marks come back after a page script reopens the page", async ({ baseURL }) => {
  test.setTimeout(60_000);
  const dir = mkdtempSync(join(tmpdir(), "drive-reload-"));
  try {
    const log = execFileSync(
      process.execPath,
      [
        DRIVE,
        "--base", String(baseURL),
        "--hash", "#/hafs-kfqc/p8",
        "--marks",
        "--act", "settle=200; eval=setTimeout(() => location.reload(), 20), 1; settle=2500; step=1|After the reload",
        "--out", join(dir, "shot.png"),
      ],
      { stdio: "pipe", timeout: 50_000 },
    ).toString();
    expect(log).not.toMatch(/ev=error/);
    expect(log).toMatch(/ev=marks .*reloaded/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
