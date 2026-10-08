import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { plainName } from "../native/scripts/name-attachments.mjs";

// The simulator's pictures come out of a test run named by random ids; the
// walker needs to know which picture is which route.
test("a picture keeps the name the test gave it, without the id XCTest adds", () => {
  assert.equal(
    plainName("side-1-hafs-kfqc_2-255_open-commentary_0_A2120684-9E62-49FE-9D16-39B123574E6E.png"),
    "side-1-hafs-kfqc_2-255_open-commentary.png",
  );
});

test("a name with no id on it is left as it is", () => {
  assert.equal(plainName("upright-2-hafs-kfqc_p45.png"), "upright-2-hafs-kfqc_p45.png");
});

test("run on a folder: renames each exported picture after its manifest entry", () => {
  const dir = mkdtempSync(join(tmpdir(), "walk-"));
  writeFileSync(join(dir, "AAAA.png"), "x");
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify([
      { attachments: [{ exportedFileName: "AAAA.png", suggestedHumanReadableName: "side-1-hafs-kfqc_p45_0_B6C1E2F0-0000-0000-0000-000000000000.png" }] },
    ]),
  );
  const script = fileURLToPath(new URL("../native/scripts/name-attachments.mjs", import.meta.url));
  const r = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(dir, "side-1-hafs-kfqc_p45.png")));
  assert.ok(!existsSync(join(dir, "AAAA.png")));
  assert.match(r.stdout, /side-1-hafs-kfqc_p45\.png/);
});
