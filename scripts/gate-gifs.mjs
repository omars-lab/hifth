#!/usr/bin/env node
/**
 * Gate: every moving picture in the docs plays at one pace and is packed small.
 *
 * Pace. The option clips record the app at its real speed, and at that speed a
 * reader cannot follow which tap did what (owner, 2026-10-02: "can we slow down
 * the gifs?", then "slow all gifs … standardize the speed"). So every clip is
 * slowed to half speed, and the record-demo GIF script makes them all one way:
 * ten frames a second recorded, each frame shown for 0.2 s. That makes the
 * pace readable straight off the file. Every frame but the last must be shown
 * 0.2 s, or a whole number of 0.2 s steps where the script kept a still moment
 * as one frame (the same picture repeated is bytes for nothing). The last is
 * the hold before the loop restarts, and may be any length. A clip at 0.1 s, or
 * with any frame between steps, is one nobody slowed.
 *
 * What it cannot see: a clip slowed more than the standard, whose frames all
 * last 0.4 s. From the file that looks the same as a clip of still moments, and
 * an earlier draft that refused it also refused honest clips with no quick
 * motion in them. The script's default of half speed is what keeps that one.
 *
 * Size. A GIF is committed for good, and every re-make costs its full size in
 * history. The script packs each clip with gifsicle's lossless optimiser, which
 * changes no pixel and saved 2 to 9% on the clips committed before it did. A
 * clip it could still shrink by more than 1% was made some other way and is
 * refused; so is any clip over 1 MB, the script's own limit.
 */
import { readdirSync, readFileSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const ROOT = process.env.HIFTH_GATE_ROOT ?? new URL("..", import.meta.url).pathname;
const DOCS = join(ROOT, "docs");

/** Hundredths of a second each frame is shown, the standard pace. */
const PACE = 20;
/** Bytes; the GIF script refuses anything larger. */
const LIMIT = 1024 * 1024;
/** A clip the optimiser shrinks by more than this share was not packed. */
const SLACK = 0.01;

/** How long each frame is shown, in hundredths of a second, read from the file itself. */
export function gifDelays(buf) {
  const out = [];
  for (let i = 0; i + 8 < buf.length; i++) {
    if (buf[i] === 0x21 && buf[i + 1] === 0xf9 && buf[i + 2] === 0x04 && buf[i + 7] === 0x00 && buf[i + 8] === 0x2c) {
      out.push(buf.readUInt16LE(i + 4));
    }
  }
  return out;
}

function gifs(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return gifs(p);
    return d.name.endsWith(".gif") ? [p] : [];
  });
}

const secs = (cs) => `${(cs / 100).toFixed(1)} s`;
const kb = (b) => `${Math.round(b / 1024)} KB`;

const files = gifs(DOCS);
if (files.length === 0) {
  console.error("gate:gifs — FAIL: no GIFs under docs/; a check that looks nowhere passes everything");
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "gate-gifs-"));
const problems = [];
try {
  for (const file of files) {
    const rel = relative(ROOT, file);
    const buf = readFileSync(file);
    const body = gifDelays(buf).slice(0, -1);
    const off = body.filter((d) => d % PACE !== 0);
    if (off.length) {
      const seen = [...new Set(off)].map(secs).join(", ");
      problems.push(
        `${rel}: ${off.length} frames shown ${seen} each; the standard is ${secs(PACE)} a frame (half the app's real speed).\n` +
          `    Re-time it: .claude/skills/record-demo/scripts/make-gif.sh --in <the real-speed clip> --out ${rel}`,
      );
    }
    const size = statSync(file).size;
    if (size > LIMIT) problems.push(`${rel}: ${kb(size)}, over the 1 MB limit. Shorten it or narrow it.`);
    const packed = join(tmp, "packed.gif");
    const r = spawnSync("gifsicle", ["-O3", file, "-o", packed]);
    if (r.error || r.status !== 0) {
      problems.push(`${rel}: gifsicle could not read it (${r.error?.message ?? r.stderr}); install it with brew install gifsicle`);
      continue;
    }
    const smaller = size - statSync(packed).size;
    if (smaller > size * SLACK) {
      problems.push(
        `${rel}: could be ${kb(smaller)} smaller without changing a pixel. Pack it: gifsicle -O3 ${rel} -o ${rel}`,
      );
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (problems.length) {
  console.error(`gate:gifs — FAIL:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`gate:gifs — OK (${files.length} clips, every frame in ${secs(PACE)} steps, all packed, all under 1 MB)`);
