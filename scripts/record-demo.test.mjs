// The record-demo skill's scripts turn a run of screenshots into the moving
// pictures an options note embeds: a looping GIF, a strip of numbered stills,
// and two to four option clips joined side by side. These tests feed them a
// few plain coloured frames, so they need ffmpeg and ImageMagick but no app.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const S = ".claude/skills/record-demo/scripts";
const have = (cmd, arg) => spawnSync(cmd, [arg]).status === 0;
const skip = !(have("ffmpeg", "-version") && have("magick", "-version")) && "needs ffmpeg and ImageMagick";

/** Frames the way the drive tool's --frames mode writes them: PNGs plus a timed list. */
function frames(dir, colours, secsEach = 0.2) {
  const lines = [];
  colours.forEach((c, i) => {
    const f = `f${String(i).padStart(4, "0")}.png`;
    execFileSync("magick", ["-size", "780x1688", `xc:${c}`, join(dir, f)]);
    lines.push(`file '${f}'`, `duration ${secsEach}`);
  });
  lines.push(`file 'f${String(colours.length - 1).padStart(4, "0")}.png'`);
  writeFileSync(join(dir, "frames.txt"), lines.join("\n") + "\n");
  return join(dir, "frames.txt");
}

/** Each frame's delay in hundredths of a second, from the GIF's own control blocks. */
function gifDelays(buf) {
  const out = [];
  for (let i = 0; i + 8 < buf.length; i++) {
    if (buf[i] === 0x21 && buf[i + 1] === 0xf9 && buf[i + 2] === 0x04 && buf[i + 7] === 0x00 && buf[i + 8] === 0x2c) {
      out.push(buf.readUInt16LE(i + 4));
    }
  }
  return out;
}

const size = (png) => execFileSync("magick", ["identify", "-format", "%w %h", png]).toString().trim();

test("make-gif turns timed frames into a phone-wide looping GIF that rests on its last frame", { skip }, () => {
  const dir = mkdtempSync(join(tmpdir(), "make-gif-"));
  try {
    const list = frames(dir, ["#faf7f0", "#e0a030", "#14181c", "#3070c0"]);
    const gif = join(dir, "clip.gif");
    execFileSync("bash", [`${S}/make-gif.sh`, "--in", list, "--out", gif], { stdio: "pipe" });
    const buf = readFileSync(gif);
    assert.equal(buf.subarray(0, 6).toString("latin1"), "GIF89a");
    assert.equal(buf.readUInt16LE(6), 390, "390 wide, the phone's own width");
    const delays = gifDelays(buf);
    assert.ok(delays.length >= 4, `expected at least 4 frames, got ${delays.length}`);
    // The end is held a second and a half so the eye can read it before the loop restarts.
    const tail = delays.slice(1).reduce((a, d, i, all) => (i >= all.length - 16 ? a + d : a), 0);
    assert.ok(tail >= 150, `the last frame should be held ~1.5 s, got ${tail} cs over the tail`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("make-gif --start skips the opening of a frames recording, so the clip opens on the set-up page", { skip }, () => {
  const dir = mkdtempSync(join(tmpdir(), "make-gif-start-"));
  try {
    // Half a second of the page before the option's script ran, then the option.
    const list = frames(dir, ["#14181c", "#e0a030", "#e0a030", "#e0a030"], 0.5);
    const gif = join(dir, "clip.gif");
    execFileSync("bash", [`${S}/make-gif.sh`, "--in", list, "--out", gif, "--start", "0.6"], { stdio: "pipe" });
    const first = execFileSync("magick", [`${gif}[0]`, "-format", "%[pixel:p{195,400}]", "info:"]).toString();
    assert.match(first, /srgb\(22\d,1[56]\d,[3-5]\d\)|#E0A030/i, `the first frame should be the option, got ${first}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const total = (gif) => gifDelays(readFileSync(gif)).reduce((a, d) => a + d, 0);

const packer = spawnSync("which", ["gifsicle"]).status === 0;

test("make-gif's clips all come out at the one standard pace, packed, so the docs check passes them", { skip: skip || (!packer && "needs gifsicle") }, () => {
  // Owner, 2026-10-02: "slow all gifs … standardize the speed", and "does our hook also make
  // sure the gif is as efficient/small as possible?"
  const dir = mkdtempSync(join(tmpdir(), "make-gif-pace-"));
  try {
    const list = frames(dir, ["#faf7f0", "#e0a030", "#14181c", "#3070c0", "#faf7f0", "#e0a030"], 0.1);
    const fromFrames = join(dir, "from-frames.gif");
    execFileSync("bash", [`${S}/make-gif.sh`, "--in", list, "--out", fromFrames], { stdio: "pipe" });
    // A clip made at real speed by some other tool, at its own odd pace (12 a second).
    const real = join(dir, "real.gif");
    execFileSync("magick", ["-delay", "8", "-size", "200x120", "xc:#faf7f0", "xc:#e0a030", "xc:#14181c", "xc:#3070c0", "xc:#faf7f0", "xc:#e0a030", "-loop", "0", real]);
    const retimed = join(dir, "retimed.gif");
    execFileSync("bash", [`${S}/make-gif.sh`, "--in", real, "--out", retimed], { stdio: "pipe" });
    for (const gif of [fromFrames, retimed]) {
      const delays = gifDelays(readFileSync(gif)).slice(0, -1);
      assert.deepEqual([...new Set(delays)], [20], `${gif}: every frame but the last shown 0.2 s, got ${delays}`);
    }
    const root = makeFixture({
      "docs/a.gif": readFileSync(fromFrames),
      "docs/b.gif": readFileSync(retimed),
    });
    try {
      const r = runGate("gifs", root);
      assert.equal(r.status, 0, r.out);
    } finally {
      dropFixture(root);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("make-gif plays a recording twice as slow as it happened, so a reader can follow each tap", { skip }, () => {
  // Owner, 2026-10-02: at the app's real speed the option clips were too quick to follow.
  const dir = mkdtempSync(join(tmpdir(), "make-gif-slow-"));
  try {
    const list = frames(dir, ["#faf7f0", "#e0a030", "#14181c", "#3070c0"], 0.5);
    const real = join(dir, "real.gif");
    const slowed = join(dir, "slowed.gif");
    execFileSync("bash", [`${S}/make-gif.sh`, "--in", list, "--out", real, "--slow", "1"], { stdio: "pipe" });
    execFileSync("bash", [`${S}/make-gif.sh`, "--in", list, "--out", slowed], { stdio: "pipe" });
    // Twice as slow adds the recording's own length again; the 1.5 s end hold is the same in both.
    const recorded = total(real) - 150;
    const added = total(slowed) - total(real);
    assert.ok(Math.abs(added - recorded) <= 20, `expected ~${recorded} cs more, got ${added}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("make-gif slows a GIF that is already made, keeping its width", { skip }, () => {
  const dir = mkdtempSync(join(tmpdir(), "make-gif-reslow-"));
  try {
    const list = frames(dir, ["#faf7f0", "#e0a030", "#14181c", "#3070c0"], 0.5);
    const made = join(dir, "made.gif");
    const slower = join(dir, "slower.gif");
    execFileSync("bash", [`${S}/make-gif.sh`, "--in", list, "--out", made, "--width", "240", "--slow", "1"], { stdio: "pipe" });
    execFileSync("bash", [`${S}/make-gif.sh`, "--in", made, "--out", slower], { stdio: "pipe" });
    const buf = readFileSync(slower);
    assert.equal(buf.readUInt16LE(6), 240, "kept at the width it was made");
    // The moving part doubles; the end hold stays the standard 1.5 s rather than doubling too.
    const moving = (gif) => total(gif) - gifDelays(readFileSync(gif)).at(-1);
    const ratio = moving(slower) / moving(made);
    assert.ok(ratio > 1.9 && ratio < 2.1, `expected the moving part twice as long, got ${ratio.toFixed(2)}×`);
    assert.equal(gifDelays(buf).at(-1), 150, "the end held 1.5 s");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("make-gif refuses a GIF over its size limit and says what to try next", { skip }, () => {
  const dir = mkdtempSync(join(tmpdir(), "make-gif-"));
  try {
    const list = frames(dir, ["#faf7f0", "#e0a030", "#14181c"]);
    const gif = join(dir, "clip.gif");
    const r = spawnSync("bash", [`${S}/make-gif.sh`, "--in", list, "--out", gif, "--max-bytes", "100"]);
    assert.notEqual(r.status, 0);
    const said = r.stdout.toString() + r.stderr.toString();
    assert.match(said, /ev=too_big bytes=\d+ limit=100/);
    assert.match(said, /--width \d+/, "suggests a smaller width");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("frame-strip lays the chosen moments side by side, one per label", { skip }, () => {
  const dir = mkdtempSync(join(tmpdir(), "frame-strip-"));
  try {
    const list = frames(dir, ["#faf7f0", "#e0a030", "#14181c", "#3070c0"], 0.5);
    const out = join(dir, "strip.png");
    execFileSync("bash", [`${S}/frame-strip.sh`, "--in", list, "--at", "0.1,0.6,1.6", "--labels", "before|finger down|menu up", "--out", out], { stdio: "pipe" });
    const [w, h] = size(out).split(" ").map(Number);
    assert.ok(w >= 3 * 390 && w < 4 * 390, `three 390-wide stills in a row, got ${w}x${h}`);
    // The second still was taken at 0.6 s, inside the amber frame.
    const px = execFileSync("magick", [out, "-format", `%[pixel:p{${Math.round(w / 2)},${Math.round(h / 2)}}]`, "info:"]).toString();
    assert.match(px, /srgb\(22[0-9],1[56][0-9],[3-5][0-9]\)|#E0A030/i, `middle still should be amber, got ${px}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("side-by-side joins option clips into one GIF, each under its letter, the shorter held to the longer", { skip }, () => {
  const dir = mkdtempSync(join(tmpdir(), "side-by-side-"));
  try {
    const a = join(dir, "a"), b = join(dir, "b");
    execFileSync("mkdir", [a, b]);
    execFileSync("bash", [`${S}/make-gif.sh`, "--in", frames(a, ["#faf7f0", "#e0a030"]), "--out", join(dir, "a.gif")], { stdio: "pipe" });
    execFileSync("bash", [`${S}/make-gif.sh`, "--in", frames(b, ["#faf7f0", "#3070c0", "#14181c", "#e0a030"], 0.5), "--out", join(dir, "b.gif")], { stdio: "pipe" });
    const out = join(dir, "ab.gif");
    execFileSync("bash", [`${S}/side-by-side.sh`, "--out", out, `A=${join(dir, "a.gif")}`, `B=${join(dir, "b.gif")}`], { stdio: "pipe" });
    const buf = readFileSync(out);
    assert.equal(buf.subarray(0, 6).toString("latin1"), "GIF89a");
    assert.ok(buf.readUInt16LE(6) >= 780, "two 390-wide clips side by side");
    assert.ok(buf.readUInt16LE(8) > readFileSync(join(dir, "a.gif")).readUInt16LE(8), "a letter above each clip");
    assert.ok(statSync(out).size <= 1_000_000);
    // As long as the longer clip: B is 2 s plus its 1.5 s rest.
    const secs = gifDelays(buf).reduce((x, d) => x + d, 0) / 100;
    assert.ok(secs >= 3.2, `expected at least 3.2 s, got ${secs}`);
    // The joined clip keeps the clips' own pace and is packed, like any clip in the docs.
    if (packer) {
      const root = makeFixture({ "docs/ab.gif": buf });
      try {
        const r = runGate("gifs", root);
        assert.equal(r.status, 0, r.out);
      } finally {
        dropFixture(root);
      }
    }
    // --width narrows each clip, the way to bring three phones under the size limit.
    const narrow = join(dir, "narrow.gif");
    execFileSync("bash", [`${S}/side-by-side.sh`, "--out", narrow, "--width", "200", `A=${join(dir, "a.gif")}`, `B=${join(dir, "b.gif")}`], { stdio: "pipe" });
    const w = readFileSync(narrow).readUInt16LE(6);
    assert.ok(w >= 400 && w <= 430, `two 200-wide clips and a gap, got ${w}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
