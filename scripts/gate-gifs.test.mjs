/**
 * The moving pictures in the docs all play at one pace, half the speed the app
 * really moves (owner, 2026-10-02: "slow all gifs … standardize the speed"),
 * and each is packed as small as it losslessly goes ("does our hook also make
 * sure the gif is as efficient/small as possible?").
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const has = (bin) => spawnSync("which", [bin]).status === 0;
const skip = !(has("magick") && has("gifsicle")) && "needs ImageMagick and gifsicle";

/** A small GIF of `colours`, each frame shown `delay` hundredths of a second (or one per frame), packed or not. */
function gif(colours, delay, { packed = true, last = 150 } = {}) {
  const at = (i) => (Array.isArray(delay) ? delay[i] : delay);
  const root = makeFixture({});
  const raw = join(root, "raw.gif");
  const frames = colours.flatMap((c, i) => [
    "-delay", String(i === colours.length - 1 ? last : at(i)),
    "-size", "120x80", `xc:${c}`,
    "-fill", "#14181c", "-draw", `rectangle ${10 + i * 20},10 ${30 + i * 20},40`,
  ]);
  execFileSync("magick", [...frames, "-loop", "0", raw]);
  const out = join(root, "out.gif");
  if (packed) execFileSync("gifsicle", ["-O3", raw, "-o", out]);
  // Unpacked: every frame repeated in full, which is what a lazy encoder writes.
  else execFileSync("magick", [raw, "-coalesce", out]);
  const buf = readFileSync(out);
  dropFixture(root);
  return buf;
}

const COLOURS = ["#faf7f0", "#faf7f0", "#faf7f0", "#faf7f0", "#faf7f0", "#faf7f0"];

function check(files) {
  const root = makeFixture(files);
  try {
    return runGate("gifs", root);
  } finally {
    dropFixture(root);
  }
}

test("gate:gifs passes a clip at the standard pace, packed", { skip }, () => {
  const r = check({ "docs/design/x/clip.gif": gif(COLOURS, 20) });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /gate:gifs — OK/);
});

test("gate:gifs refuses a clip playing at the app's real speed", { skip }, () => {
  const r = check({ "docs/design/x/clip.gif": gif(COLOURS, 10) });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /docs\/design\/x\/clip\.gif/);
  assert.match(r.out, /0\.1 s/);
});

test("gate:gifs passes a clip made only of still moments, none of them quick", { skip }, () => {
  // A side-by-side of clips that change every half second has no 0.2 s frame at all.
  const r = check({ "docs/design/x/clip.gif": gif(COLOURS, [40, 100, 60, 40, 200, 40]) });
  assert.equal(r.status, 0, r.out);
});

test("gate:gifs passes a still moment kept as one longer frame, a whole number of steps", { skip }, () => {
  const r = check({ "docs/x.gif": gif(COLOURS, [20, 60, 20, 40, 20, 20]) });
  assert.equal(r.status, 0, r.out);
});

test("gate:gifs refuses a frame between steps, which only an unslowed clip has", { skip }, () => {
  const r = check({ "docs/x.gif": gif(COLOURS, [20, 30, 20, 20, 20, 20]) });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /0\.3 s/);
});

test("gate:gifs lets the last frame be held longer or shorter", { skip }, () => {
  assert.equal(check({ "docs/x.gif": gif(COLOURS, 20, { last: 300 }) }).status, 0);
  assert.equal(check({ "docs/x.gif": gif(COLOURS, 20, { last: 10 }) }).status, 0);
});

test("gate:gifs refuses a clip that could be packed smaller without changing a pixel", { skip }, () => {
  const r = check({ "docs/design/x/clip.gif": gif(COLOURS, 20, { packed: false }) });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /smaller/);
  assert.match(r.out, /gifsicle -O3/);
});

test("gate:gifs refuses a clip over the size limit", { skip }, () => {
  const big = Buffer.concat([gif(COLOURS, 20), Buffer.alloc(1024 * 1024)]);
  const r = check({ "docs/design/x/clip.gif": big });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /1 MB/);
});

test("gate:gifs refuses a docs tree with no clips at all, so it cannot pass by looking nowhere", () => {
  const r = check({ "docs/readme.md": "nothing moves here" });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /no GIFs/);
});
