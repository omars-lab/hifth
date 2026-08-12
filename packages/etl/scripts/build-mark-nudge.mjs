/**
 * Builds the other page: one mark, one rectangle in the wrong place, and a
 * reader who drags it to where it belongs.
 *
 * ## Why there is a second instrument at all
 *
 * The forced-choice page can settle one thing — is the corrected rectangle
 * preferred to the one that ships? — and it settles it well, because two
 * unlabelled panels give a person nothing to agree with. What it cannot do is
 * say *by how much*, or *in which direction the correction is still wrong*,
 * because the only two answers on offer are the two we thought of. If our
 * proposed move is right in direction and short by a third, every trial says
 * yes and no trial says short.
 *
 * This asks it the other way round. Nothing to choose between; a rectangle that
 * starts plainly displaced, and a hand that puts it where it goes. Where it
 * lands is a measurement in page units, and subtracting our correction from it
 * leaves the residual — the number that would actually change the boxes.
 *
 * ## Why it is not a button on the other page
 *
 * Because dragging a box into place inside a two-panel trial *is* the answer
 * key. Whichever of the two starting positions the landing is nearer is, by
 * construction, the one we called right, and the blinding that makes the count
 * evidence is gone. Offering the drag *after* the answer leaks nearly as badly
 * over a session: the correction points the same way on almost every page, so a
 * reader learns its direction long before the trials run out and spends the rest
 * of the hour reporting the rule rather than the ink.
 *
 * ## What this page still will not do
 *
 * Tell you how you are doing. No target, no snapping, no "close!", no verdict at
 * the end beyond a count of what you placed. It does not know the answer: the
 * correction is stripped out of the trials before they reach the page, and only
 * the scorer ever puts it back.
 *
 * ## Running it
 *
 *   node packages/etl/scripts/build-mark-nudge.mjs [--count 60] [--seed 23]
 *
 * Then open the page it names, place them, and save the file it offers at the
 * end. Read it with `score-mark-nudge.mjs`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { planNudge, readers, windowFor } from "./lib/adjudication.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ETL = join(HERE, "..");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const seed = Number(arg("--seed", 23));
const count = Number(arg("--count", 60));
const shiftPath = arg("--shift", join(ETL, "out", "mark-shift.json"));
const outPath = arg("--out", join(ETL, "out", "mark-nudge.html"));
/** How wide the panel is drawn, in pixels. One page unit is then ~21 px. */
const PANEL = Number(arg("--panel", 460));

const shiftText = readFileSync(shiftPath, "utf8");
const shift = JSON.parse(shiftText);

/**
 * A fingerprint of the displacements this session was built from — the same
 * guard the forced choice carries, for the same reason. The scorer rebuilds the
 * session from the seed and this file, and if it has been re-measured in between
 * then every residual it prints is a subtraction of the wrong number.
 */
function fingerprint(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const n2 = (v) => Math.round(v * 100) / 100;
const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);

/** The page's own outlines, clipped to the window. Ink and nothing else. */
function inkPaths(shapes, vx, vy, side) {
  const parts = [];
  for (const s of shapes) {
    const ds = [];
    for (const ring of s.rings) {
      let lo = Infinity;
      let hi = -Infinity;
      let loy = Infinity;
      let hiy = -Infinity;
      for (let i = 0; i < ring.length; i += 2) {
        if (ring[i] < lo) lo = ring[i];
        if (ring[i] > hi) hi = ring[i];
        if (ring[i + 1] < loy) loy = ring[i + 1];
        if (ring[i + 1] > hiy) hiy = ring[i + 1];
      }
      if (hi < vx || lo > vx + side || hiy < vy || loy > vy + side) continue;
      let d = `M${n2(ring[0])} ${n2(ring[1])}`;
      for (let i = 2; i < ring.length; i += 2) d += `L${n2(ring[i])} ${n2(ring[i + 1])}`;
      ds.push(`${d}Z`);
    }
    if (ds.length) parts.push(`<path d="${ds.join("")}" fill="var(--ink)" fill-rule="${s.fillRule}"/>`);
  }
  return parts.join("");
}

const t0 = Date.now();
const { trials, repeats, skippedForInk, pages } = planNudge({ seed, count, shifts: shift.shifts });

const inks = new Map();
for (const p of new Set(trials.map((t) => t.page))) inks.set(p, readers.inkFor(p));

/**
 * The trials as the page holds them.
 *
 * `shift` — what our measurement proposes — is on the planned trial and is never
 * read here. It reaches no markup, no data attribute and no comment: anybody can
 * view the source of this page and find no target in it, which is the only
 * version of that claim worth making. What the reader is given is where the
 * rectangle starts, which is a random direction away from where the app draws it
 * today and therefore says nothing about where it ought to end up.
 */
const cards = trials
  .map((t) => {
    const [x, y, w, h] = t.box;
    const side = windowFor(t.box);
    const [jx, jy] = t.jitter;
    const vx = x + w / 2 - side / 2 + jx;
    const vy = y + h / 2 - side / 2 + jy;
    const [sx, sy] = t.start;
    return `<section class="trial" data-i="${t.i}" data-id="${esc(t.id)}"
 data-x="${n2(x)}" data-y="${n2(y)}" data-w="${n2(w)}" data-h="${n2(h)}"
 data-vx="${n2(vx)}" data-vy="${n2(vy)}" data-side="${n2(side)}"
 data-sx="${n2(sx)}" data-sy="${n2(sy)}" hidden>
<svg viewBox="${n2(vx)} ${n2(vy)} ${n2(side)} ${n2(side)}" width="${PANEL}" height="${PANEL}" aria-hidden="true">${inkPaths(inks.get(t.page), vx, vy, side)}<rect class="hit" x="${n2(x + sx)}" y="${n2(y + sy)}" width="${n2(w)}" height="${n2(h)}" fill="none" stroke="var(--box)" stroke-width="${n2(side / 300)}"/></svg>
<p class="where">page ${t.page} · ${t.surah}:${t.aya}</p>
</section>`;
  })
  .join("\n");

const head = {
  built: new Date().toISOString(),
  kind: "nudge",
  seed,
  count: trials.length,
  repeats,
  pages,
  shiftRan: shift.ran,
  shiftFingerprint: fingerprint(shiftText),
  /**
   * What this build put on the screen. The forced-choice page carries the same
   * field for the same reason: a reading that assumes a question was asked when
   * the page had no way to ask it manufactures a finding out of a missing
   * feature.
   */
  asks: ["place", "size"],
};

const html = `<!doctype html><meta charset="utf-8"><title>Hifth — put the box where it goes</title>
<style>
:root{color-scheme:light dark;--ink:#231f20;--box:#d33;--paper:#fff}
@media (prefers-color-scheme:dark){:root{--ink:#e8e4de;--box:#ff6b5e;--paper:#141414}}
body{font:15px/1.55 system-ui,sans-serif;margin:0;padding:22px;max-width:1100px}
h1{font-size:20px;margin:0 0 4px}
.intro{max-width:56em}
.intro h2{font-size:16px;margin:20px 0 4px}
.intro p{margin:0 0 8px}
.trial{display:flex;flex-direction:column;align-items:center}
svg{background:var(--paper);border:1px solid #8886;border-radius:6px;display:block;max-width:100%;height:auto;touch-action:none;cursor:grab}
svg.dragging{cursor:grabbing}
.hit{pointer-events:none}
.where{text-align:center;color:#8a8a8a;font-size:12px;margin:10px 0 0}
.bar{height:6px;background:#8883;border-radius:3px;overflow:hidden;margin:0 0 16px}
.bar i{display:block;height:100%;background:currentColor;width:0}
.ask{text-align:center;font-weight:600;margin:0 0 12px}
.acts{display:flex;gap:10px;justify-content:center;margin:16px 0 0;flex-wrap:wrap;align-items:center}
button{font:inherit;padding:9px 18px;border-radius:8px;border:1px solid #8886;background:#8881;cursor:pointer}
button:hover:not(:disabled){background:#8883}
button:disabled{opacity:.45;cursor:default}
button:focus-visible{outline:2px solid currentColor;outline-offset:2px}
kbd{font:12px ui-monospace,monospace;border:1px solid #8886;border-radius:4px;padding:0 4px}
.done{max-width:52em}
.count{color:#8a8a8a;font-size:13px;text-align:center;margin:0 0 10px}
/* Outline rather than fill, so the pressed state stays legible in both colour
   schemes — a solid --box behind the label is white-on-pink one way and
   near-black-on-salmon the other, and this page is worked for half an hour. */
#size{font-size:14px;padding:7px 14px}
#size[aria-pressed="true"]{color:var(--box);border-color:var(--box);font-weight:700;
  box-shadow:inset 0 0 0 1px var(--box)}
</style>
<h1>Put the box where it goes</h1>

<div id="intro" class="intro">
<h2>What are you being asked to do?</h2>
<p>You will see a small piece of a page of the mus'haf with one red rectangle drawn on
it. The rectangle starts in the wrong place, every time and on purpose. Drag it until it
closes around a single vowel or mark — the one nearest to where it started — and then
press <em>place it</em>.</p>

<h2>Why not just ask you whether a box looks right?</h2>
<p>Because that question can only be answered yes or no, and the answer we actually need
is a distance. The app already has its own idea of where these rectangles should move to,
worked out by measurement. If we show you that idea and ask whether you agree, we learn
nothing we did not already believe. If instead you place them yourself, without ever
seeing what the machine thinks, the gap between where you put them and where it wanted
them is a real number — and that gap is what gets fixed.</p>

<h2>How exact do you need to be?</h2>
<p>As exact as you can be without labouring over it. You are not expected to be perfect,
and nothing depends on any single placement: some marks come round a second time, and the
distance between your two goes at the same mark is how we work out how precise you are.
Everything else is read against that. So place each one honestly and move on — a careful
guess is worth much more than a slow one.</p>

<h2>What if the box is the wrong size for the mark?</h2>
<p>Put it in the best place you can anyway, and tick <em>the box is the wrong size</em>.
Where a rectangle sits and how big it is are two different faults with two different
repairs, and this page is only about where it sits. The tick is counted on its own and it
never costs the placement.</p>

<h2>How long does it take, and can you stop?</h2>
<p>${trials.length} of them, and about ${Math.max(3, Math.round(trials.length * 0.25))} minutes.
Your place is kept in this browser, so you can close the page and come back. You are never
told how close you were, at any point — being told would teach you where the answer tends
to lie, and after that you would be placing from the rule instead of from the ink.</p>

<h2>Keys</h2>
<p>Drag with the mouse or a finger. <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> to
nudge, hold <kbd>shift</kbd> for a bigger step, <kbd>enter</kbd> to place it,
<kbd>S</kbd> to say the box is the wrong size.</p>
<div class="acts"><button id="start">Start</button></div>
</div>

<main id="work" hidden>
<div class="bar"><i id="fill"></i></div>
<p class="count" id="count"></p>
<p class="ask">Drag the rectangle onto the mark nearest where it started.</p>
${cards}
<div class="acts">
<button id="place" disabled>Place it <kbd>enter</kbd></button>
</div>
<div class="acts">
<button id="size" type="button" aria-pressed="false">The box is the wrong size <kbd>S</kbd></button>
</div>
<p class="count" id="hint">Move it first — it always starts in the wrong place, so leaving it alone is not an answer.</p>
</main>

<div id="done" class="done" hidden>
<h2>That is all of them — thank you.</h2>
<p>Save the file below and hand it to whoever asked you to do this. It holds where you put
each rectangle and nothing else; what that means is worked out separately, from the same
recipe that built this page.</p>
<div class="acts"><button id="save">Save the placements</button></div>
<p class="count" id="tally"></p>
<p class="count" id="banked" hidden></p>
</div>

<script id="head" type="application/json">${JSON.stringify(head)}</script>
<script>
const HEAD = JSON.parse(document.getElementById("head").textContent);
const KEY = "hifth.nudge." + HEAD.seed + "." + HEAD.shiftFingerprint;
const cards = [...document.querySelectorAll(".trial")];
const work = document.getElementById("work");
const intro = document.getElementById("intro");
const done = document.getElementById("done");
const fill = document.getElementById("fill");
const count = document.getElementById("count");
const placeBtn = document.getElementById("place");
const sizeBtn = document.getElementById("size");
const hint = document.getElementById("hint");
let answers = [];
try { answers = JSON.parse(localStorage.getItem(KEY)) || []; } catch { answers = []; }
let at = answers.length;
let shown = 0;

/** How far one arrow key moves the box, in page units, and the shifted step. */
const STEP = 0.05;
const BIG = 0.25;

// The live placement: where the rectangle sits relative to where the app draws
// it today. Starts at the trial's own offset, which is never zero.
let off = [0, 0];
let moved = 0;
let wrongSize = false;

const num = (el, k) => Number(el.dataset[k]);

function setSize(v) {
  wrongSize = v;
  sizeBtn.setAttribute("aria-pressed", v ? "true" : "false");
}

/**
 * Draw the rectangle at the current offset, clamped to the window.
 *
 * Clamping rather than letting it wander off: a rectangle dragged past the edge
 * is not a placement anybody meant, and hunting for a lost box is a different
 * and much more annoying task than the one being asked.
 */
function draw() {
  const c = cards[at];
  if (!c) return;
  const x = num(c, "x"), y = num(c, "y"), w = num(c, "w"), h = num(c, "h");
  const vx = num(c, "vx"), vy = num(c, "vy"), side = num(c, "side");
  off[0] = Math.min(Math.max(off[0], vx - x), vx + side - w - x);
  off[1] = Math.min(Math.max(off[1], vy - y), vy + side - h - y);
  const r = c.querySelector(".hit");
  r.setAttribute("x", (x + off[0]).toFixed(3));
  r.setAttribute("y", (y + off[1]).toFixed(3));
  placeBtn.disabled = moved === 0;
}

function nudge(dx, dy) {
  if (work.hidden || at >= cards.length) return;
  off = [off[0] + dx, off[1] + dy];
  moved += 1;
  hint.textContent = "";
  draw();
}

function render() {
  if (at >= cards.length) {
    work.hidden = true;
    intro.hidden = true;
    done.hidden = false;
    const big = answers.filter((a) => a.wrongSize).length;
    document.getElementById("tally").textContent =
      answers.length + " placed" +
      (big ? ", and " + big + " where the rectangle was the wrong size for its mark" : "") + ".";
    bank();
    return;
  }
  cards.forEach((c, i) => { c.hidden = i !== at; });
  const c = cards[at];
  off = [num(c, "sx"), num(c, "sy")];
  moved = 0;
  setSize(false);
  hint.textContent = "Move it first — it always starts in the wrong place, so leaving it alone is not an answer.";
  draw();
  fill.style.width = (100 * at / cards.length).toFixed(1) + "%";
  count.textContent = (at + 1) + " of " + cards.length;
  shown = performance.now();
}

// The same session sink the forced-choice page uses: opened by
// \`make session CHECK=...\` there is one, and every placement lands in the
// transcript as it is made; opened as a plain file there is not, these calls do
// nothing, and the localStorage copy plus the download at the end are the whole
// story. It is told where the box was put, never how close that was — nothing on
// this page knows, and the reporting path is not allowed to be where that leaks.
const SINK = typeof window !== "undefined" ? window.HIFTH_SESSION : null;
let banked = false;
let lost = 0;

function place() {
  if (work.hidden || at >= cards.length || moved === 0) return;
  const c = cards[at];
  answers[at] = {
    i: Number(c.dataset.i),
    id: c.dataset.id,
    // Where it was put, and where it started, both relative to the rectangle the
    // app draws today. The start is written down as well as planned, because the
    // pull of a starting point on a landing is a real effect and the only way to
    // measure it is to have both ends of it in the record.
    u: [Math.round(off[0] * 1000) / 1000, Math.round(off[1] * 1000) / 1000],
    from: [num(c, "sx"), num(c, "sy")],
    moves: moved,
    ms: Math.round(performance.now() - shown),
  };
  if (wrongSize) answers[at].wrongSize = true;
  answers.length = at + 1;
  localStorage.setItem(KEY, JSON.stringify(answers));
  if (SINK) {
    SINK.post("observation", { trial: at + 1, of: cards.length, ...answers[at] })
      .then((r) => { if (!r || !r.ok) lost += 1; })
      .catch(() => { lost += 1; });
  }
  at += 1;
  render();
}

function bank() {
  if (!SINK || banked) return;
  banked = true;
  const el = document.getElementById("banked");
  SINK.artifact("mark-placements-" + HEAD.seed + ".json",
                { ...HEAD, finished: new Date().toISOString(), answers })
    .then((r) => {
      el.hidden = false;
      const tail = lost ? " (" + lost + " per-trial trace lines did not reach it; the placements are unaffected.)" : "";
      el.textContent = r && r.ok
        ? "Banked to " + r.path + " — no download needed. Read it, then write the verdict in the session." + tail
        : "Could not bank it to the session. Use the button above and keep the file.";
    })
    .catch(() => {
      el.hidden = false;
      el.textContent = "Could not bank it to the session. Use the button above and keep the file.";
    });
}

// Pointer drag. Capture on the svg rather than on the rectangle: a one-unit-wide
// box is about twenty pixels, and asking somebody to grab it exactly would make
// this a test of aim before it was a test of judgement. Anywhere in the panel
// picks it up, and the box follows the hand's displacement.
let drag = null;
for (const c of cards) {
  const svg = c.querySelector("svg");
  svg.addEventListener("pointerdown", (e) => {
    if (c.hidden) return;
    const r = svg.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, k: num(c, "side") / r.width, ox: off[0], oy: off[1] };
    svg.setPointerCapture(e.pointerId);
    svg.classList.add("dragging");
    e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    off = [drag.ox + (e.clientX - drag.x) * drag.k, drag.oy + (e.clientY - drag.y) * drag.k];
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 2) { moved += 1; hint.textContent = ""; }
    draw();
  });
  const up = (e) => {
    if (!drag) return;
    drag = null;
    svg.classList.remove("dragging");
    if (e.pointerId != null && svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
  };
  svg.addEventListener("pointerup", up);
  svg.addEventListener("pointercancel", up);
}

document.getElementById("start").onclick = () => { intro.hidden = true; work.hidden = false; render(); };
placeBtn.onclick = place;
sizeBtn.onclick = () => setSize(!wrongSize);
addEventListener("keydown", (e) => {
  const s = e.shiftKey ? BIG : STEP;
  const k = e.key.toLowerCase();
  if (k === "arrowleft") { e.preventDefault(); nudge(-s, 0); }
  else if (k === "arrowright") { e.preventDefault(); nudge(s, 0); }
  else if (k === "arrowup") { e.preventDefault(); nudge(0, -s); }
  else if (k === "arrowdown") { e.preventDefault(); nudge(0, s); }
  else if (k === "enter") { e.preventDefault(); place(); }
  else if (k === "s") { e.preventDefault(); setSize(!wrongSize); }
});
document.getElementById("save").onclick = () => {
  const blob = new Blob([JSON.stringify({ ...HEAD, finished: new Date().toISOString(), answers }, null, 2)],
                        { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mark-placements-" + HEAD.seed + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
};
if (at > 0 && at < cards.length) { intro.hidden = true; work.hidden = false; render(); }
else if (at >= cards.length && answers.length) render();
</script>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);

process.stdout.write(
  `${trials.length} placements over ${pages} pages (${repeats} marks shown twice) · seed ${seed} · ` +
    `displacements ${shift.ran} (${head.shiftFingerprint})\n` +
    `${skippedForInk} marks passed over for too little ink under the corrected box\n` +
    `${(html.length / 1e6).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${outPath}\n`,
);
