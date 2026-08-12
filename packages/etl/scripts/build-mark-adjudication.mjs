/**
 * Builds the page a person sits down with: one mark at a time, two rectangles,
 * pick the one that is on it.
 *
 * ## What this is for
 *
 * The placement measurement says the rectangles the app holds are displaced, and
 * proposes moving each page's by a measured amount. It is a machine agreeing
 * with itself: the same code decided the boxes were wrong and decided where they
 * should go instead. Before that correction ships, somebody who is not this code
 * has to be able to see the difference — and "see" has to mean something
 * stronger than looking at the machine's own picture and nodding.
 *
 * So this page never shows a verdict, never says which rectangle came from
 * where, and never says whether the last answer was right. It shows ink and two
 * rectangles. What comes out is a count, and a count is evidence.
 *
 * ## What it will not do
 *
 * It will not tell you how you are doing while you work. Feedback after each
 * trial would teach the pattern — the correction is in the same direction on
 * every page — and by the fortieth trial the person would be reporting what they
 * had learned rather than what they could see. The scoring is a separate script,
 * run afterwards, on a file this page hands back.
 *
 * ## Running it
 *
 *   node packages/etl/scripts/build-mark-adjudication.mjs [--count 100] [--seed 11]
 *
 * Then open the page it names, work it, and save the ruling it offers at the
 * end. Score it with `score-mark-adjudication.mjs`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { planSession, readers, windowFor } from "./lib/adjudication.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ETL = join(HERE, "..");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const seed = Number(arg("--seed", 11));
const count = Number(arg("--count", 100));
const shiftPath = arg("--shift", join(ETL, "out", "mark-shift.json"));
const outPath = arg("--out", join(ETL, "out", "mark-adjudication.html"));
/** How wide a panel is drawn, in pixels. Big enough that a unit is not a hair. */
const PANEL = Number(arg("--panel", 420));

const shiftText = readFileSync(shiftPath, "utf8");
const shift = JSON.parse(shiftText);

/**
 * A fingerprint of the displacements this session was built from.
 *
 * The scorer rebuilds the answers from the seed and this same file. If the file
 * has been re-measured in between, the answers it rebuilds are answers to
 * different questions, and every number it prints would be quietly wrong. Cheap
 * to carry, and it turns a silent mismatch into a refusal.
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

/**
 * One panel: the shipped page's own outlines, clipped to the window, and a
 * rectangle.
 *
 * Deliberately *not* the drawing the evidence page uses. That one traces the
 * other print's outline in green exactly where the corrected rectangle goes,
 * which on this page would be the answer printed beside the question. Here there
 * is ink and one plain rectangle, and nothing else to read.
 */
function panel(trial, shapes, slot) {
  const [x, y, w, h] = trial.box;
  const side = windowFor(trial.box);
  const [jx, jy] = trial.jitter;
  const vx = x + w / 2 - side / 2 + jx;
  const vy = y + h / 2 - side / 2 + jy;
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
  const [dx, dy] = trial.slots[slot];
  return (
    `<svg viewBox="${n2(vx)} ${n2(vy)} ${n2(side)} ${n2(side)}" width="${PANEL}" height="${PANEL}" aria-hidden="true">` +
    parts.join("") +
    `<rect x="${n2(x + dx)}" y="${n2(y + dy)}" width="${n2(w)}" height="${n2(h)}" fill="none" stroke="var(--box)" stroke-width="${n2(side / 320)}"/>` +
    "</svg>"
  );
}

const t0 = Date.now();
const { trials, skippedForInk, pages } = planSession({ seed, count, shifts: shift.shifts });

const inks = new Map();
for (const p of new Set(trials.map((t) => t.page))) inks.set(p, readers.inkFor(p));

/**
 * The trials as the page holds them: what to draw, and nothing about which is
 * which. Kind and answer are dropped here, on purpose — not hidden behind a
 * flag, not commented out, absent. Anyone can view the source of this page and
 * find nothing in it worth finding.
 */
const cards = trials
  .map((t) => {
    const shapes = inks.get(t.page);
    return `<section class="trial" data-i="${t.i}" data-id="${esc(t.id)}" hidden>
<div class="pair">
<figure><figcaption>A</figcaption>${panel(t, shapes, 0)}</figure>
<figure><figcaption>B</figcaption>${panel(t, shapes, 1)}</figure>
</div>
<p class="where">page ${t.page} · ${t.surah}:${t.aya}</p>
</section>`;
  })
  .join("\n");

const head = {
  built: new Date().toISOString(),
  seed,
  count: trials.length,
  pages,
  shiftRan: shift.ran,
  shiftFingerprint: fingerprint(shiftText),
  /**
   * What this build of the page asked for, so a ruling can say which questions it
   * was in a position to answer.
   *
   * Without it, a ruling worked before the second question existed would score as
   * "nobody ever said a rectangle failed to close around its mark" — a strong claim
   * about the boxes, produced entirely by a page that had no way to say otherwise.
   * That is the exact shape of quiet lie the rest of this check is built to avoid,
   * so the scorer is told what was on the screen rather than left to assume.
   */
  asks: ["choice", "neither"],
};

const html = `<!doctype html><meta charset="utf-8"><title>Hifth — which box is on the mark?</title>
<style>
:root{color-scheme:light dark;--ink:#231f20;--box:#d33;--paper:#fff}
@media (prefers-color-scheme:dark){:root{--ink:#e8e4de;--box:#ff6b5e;--paper:#141414}}
body{font:15px/1.55 system-ui,sans-serif;margin:0;padding:22px;max-width:1100px}
h1{font-size:20px;margin:0 0 4px}
.intro{max-width:56em}
.intro h2{font-size:16px;margin:20px 0 4px}
.intro p{margin:0 0 8px}
.pair{display:flex;gap:22px;flex-wrap:wrap;justify-content:center}
figure{margin:0}
figcaption{text-align:center;font-weight:700;font-size:18px;margin:0 0 6px;letter-spacing:.04em}
svg{background:var(--paper);border:1px solid #8886;border-radius:6px;display:block;max-width:100%;height:auto}
.where{text-align:center;color:#8a8a8a;font-size:12px;margin:10px 0 0}
.bar{height:6px;background:#8883;border-radius:3px;overflow:hidden;margin:0 0 16px}
.bar i{display:block;height:100%;background:currentColor;width:0}
.ask{text-align:center;font-weight:600;margin:0 0 12px}
.acts{display:flex;gap:10px;justify-content:center;margin:16px 0 0;flex-wrap:wrap}
button{font:inherit;padding:9px 18px;border-radius:8px;border:1px solid #8886;background:#8881;cursor:pointer}
button:hover{background:#8883}
button:focus-visible{outline:2px solid currentColor;outline-offset:2px}
kbd{font:12px ui-monospace,monospace;border:1px solid #8886;border-radius:4px;padding:0 4px}
.done{max-width:52em}
.count{color:#8a8a8a;font-size:13px;text-align:center;margin:0 0 10px}
/* Pressed state drawn in the rectangle's own colour, but as an outline rather than a
   fill: a solid --box behind the label would put white on light red in one scheme and
   near-black on salmon in the other, and this page is worked for twenty minutes. */
#neither{font-size:14px;padding:7px 14px}
#neither[aria-pressed="true"]{color:var(--box);border-color:var(--box);font-weight:700;
  box-shadow:inset 0 0 0 1px var(--box)}
</style>
<h1>Which box is on the mark?</h1>

<div id="intro" class="intro">
<h2>What are you being asked to do?</h2>
<p>You will see one small piece of a page of the mus'haf, twice, side by side. Each
copy has one red rectangle drawn on it, and usually one of the two sits where a
rectangle ought to sit — closed around a single vowel or mark — while the other sits
somewhere else. Pick the one that looks right.</p>

<h2>Why does it matter which one you pick?</h2>
<p>The app draws these rectangles to point at a mark when a reader taps it. Our own
measurement says the ones it draws today are slightly off, and proposes moving them.
Nothing here tells you which rectangle is which, so if the proposed move is a real
improvement you will pick it much more often than half the time, and if it is not you
will not. That count is the only thing that decides this.</p>

<h2>What if you cannot tell them apart?</h2>
<p>Say so. Some of these are genuinely too close to call, and a few are the same
rectangle twice with no right answer at all — those are there to check that the
answers mean something. Guessing to avoid saying "can't tell" makes the result worse,
not better.</p>

<h2>What if neither rectangle closes around the mark?</h2>
<p>That happens, and it is worth saying out loud rather than swallowing: a rectangle can
be in the right place and still be the wrong size, so the mark pokes out of both copies.
Tick <em>neither closes around it</em>, and then still pick whichever of the two is
<em>closer</em> — that is a separate question and it does still have an answer.</p>
<p>Keeping them separate is the whole reason there is a tick rather than a fourth button.
Where the rectangle sits and how big it is are two different faults with two different
repairs, and a single button that meant "wrong somehow" would blend them into one number
that could not be acted on. The tick is counted on its own, and it never costs the trial.</p>

<h2>How long does it take, and can you stop?</h2>
<p>${trials.length} of them, and about ${Math.max(2, Math.round(trials.length * 0.12))} minutes if you
do not linger. Your place is kept in this browser, so you can close the page and come back. You will
not be told how you are doing until the end, and even then not whether any single
answer was right — being told would teach you the pattern, and then you would be
reporting the pattern instead of what you can see.</p>

<h2>Keys</h2>
<p><kbd>A</kbd> or <kbd>←</kbd> for the left, <kbd>B</kbd> or <kbd>→</kbd> for the right,
<kbd>space</kbd> for can't tell, <kbd>N</kbd> to say neither closes around it.</p>
<div class="acts"><button id="start">Start</button></div>
</div>

<main id="work" hidden>
<div class="bar"><i id="fill"></i></div>
<p class="count" id="count"></p>
<p class="ask">Which rectangle is on the mark?</p>
${cards}
<div class="acts">
<button data-choice="0">A <kbd>←</kbd></button>
<button data-choice="-1">Can't tell <kbd>space</kbd></button>
<button data-choice="1">B <kbd>→</kbd></button>
</div>
<div class="acts">
<button id="neither" type="button" aria-pressed="false">Neither closes around it <kbd>N</kbd></button>
</div>
<p class="count">If the mark pokes out of both rectangles, tick that first — then still say which
of the two is closer.</p>
</main>

<div id="done" class="done" hidden>
<h2>That is all of them — thank you.</h2>
<p>Save the file below and hand it to whoever asked you to do this. It holds your
answers and nothing else; the score is worked out separately, from the same recipe
that built this page.</p>
<div class="acts"><button id="save">Save the ruling</button></div>
<p class="count" id="tally"></p>
<p class="count" id="banked" hidden></p>
</div>

<script id="head" type="application/json">${JSON.stringify(head)}</script>
<script>
const HEAD = JSON.parse(document.getElementById("head").textContent);
const KEY = "hifth.adjudication." + HEAD.seed + "." + HEAD.shiftFingerprint;
const cards = [...document.querySelectorAll(".trial")];
const work = document.getElementById("work");
const intro = document.getElementById("intro");
const done = document.getElementById("done");
const fill = document.getElementById("fill");
const count = document.getElementById("count");
let answers = [];
try { answers = JSON.parse(localStorage.getItem(KEY)) || []; } catch { answers = []; }
let at = answers.length;
let shown = 0;

// A second question, asked alongside the first rather than instead of it.
//
// A rectangle can be in the right place and the wrong size, and then the mark pokes
// out of both panels and "which one is on it" has no honest answer. The temptation is
// a fourth button — neither — and it is the wrong shape twice over. It would eat the
// trials that still carry a usable preference, since "closer" remains answerable when
// both are wrong; and it would blend two faults with two different repairs into one
// count nobody could act on. So: a tick that rides along with whatever is chosen,
// scored on its own axis, never subtracted from the one the check exists to measure.
let neither = false;
const neitherBtn = document.getElementById("neither");
function setNeither(v) {
  neither = v;
  neitherBtn.setAttribute("aria-pressed", v ? "true" : "false");
}

// Opened by \`make session CHECK=placement-correction-by-eye\`, this page finds a
// small sink on the window and every answer lands in that session's transcript as
// it is given. Opened as a plain file — which is still supported and still the
// documented fallback — there is no sink, the two calls below do nothing, and the
// localStorage copy plus the download at the end are the whole story.
//
// The sink is told *what was chosen*, never whether it was right, because nothing
// on this page knows: the answer key does not exist until the scorer rebuilds it
// from the seed. That is the property the whole check rests on, so the reporting
// path is not allowed to be the place it leaks.
const SINK = typeof window !== "undefined" ? window.HIFTH_SESSION : null;
let banked = false;
let lost = 0;

function render() {
  if (at >= cards.length) {
    work.hidden = true;
    intro.hidden = true;
    done.hidden = false;
    const told = answers.filter((a) => a.choice >= 0).length;
    const short = answers.filter((a) => a.neither).length;
    document.getElementById("tally").textContent =
      answers.length + " answered, " + (answers.length - told) + " of them can't-tell" +
      (short ? ", and " + short + " where neither rectangle closed around the mark" : "") + ".";
    bank();
    return;
  }
  cards.forEach((c, i) => { c.hidden = i !== at; });
  setNeither(false);
  fill.style.width = (100 * at / cards.length).toFixed(1) + "%";
  count.textContent = (at + 1) + " of " + cards.length;
  shown = performance.now();
}

function answer(choice) {
  if (work.hidden || at >= cards.length) return;
  answers[at] = { i: Number(cards[at].dataset.i), id: cards[at].dataset.id, choice,
                  ms: Math.round(performance.now() - shown) };
  // Written only when it is true, so a ruling from a page that never asked and a
  // ruling where nobody ticked anything stay distinguishable at the top of the file
  // rather than in the shape of every row.
  if (neither) answers[at].neither = true;
  answers.length = at + 1;
  localStorage.setItem(KEY, JSON.stringify(answers));
  // Per-trial, best-effort: the durable record of this session is the ruling
  // banked at the end, plus the localStorage copy that survives a reload. A
  // dropped trace line costs a timestamp, not an answer — but it is counted and
  // said out loud at the end rather than swallowed.
  if (SINK) {
    SINK.post("observation", { trial: at + 1, of: cards.length, ...answers[at] })
      .then((r) => { if (!r || !r.ok) lost += 1; })
      .catch(() => { lost += 1; });
  }
  at += 1;
  render();
}

// The ruling, banked to the session rather than to the downloads folder. Called
// on every render of the finished screen, guarded by a flag: a reload after the
// last trial should not append a second copy of the same ruling.
function bank() {
  if (!SINK || banked) return;
  banked = true;
  const el = document.getElementById("banked");
  SINK.artifact("mark-ruling-" + HEAD.seed + ".json",
                { ...HEAD, finished: new Date().toISOString(), answers })
    .then((r) => {
      el.hidden = false;
      const tail = lost ? " (" + lost + " per-trial trace lines did not reach it; the ruling is unaffected.)" : "";
      el.textContent = r && r.ok
        ? "Banked to " + r.path + " — no download needed. Score it, then write the verdict in the session." + tail
        : "Could not bank it to the session. Use the button above and keep the file.";
    })
    .catch(() => {
      el.hidden = false;
      el.textContent = "Could not bank it to the session. Use the button above and keep the file.";
    });
}

document.getElementById("start").onclick = () => { intro.hidden = true; work.hidden = false; render(); };
for (const b of document.querySelectorAll("[data-choice]")) {
  b.onclick = () => answer(Number(b.dataset.choice));
}
neitherBtn.onclick = () => setNeither(!neither);
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "a" || k === "arrowleft") answer(0);
  else if (k === "b" || k === "arrowright") answer(1);
  else if (k === " " || k === "0") { e.preventDefault(); answer(-1); }
  else if (k === "n") { e.preventDefault(); setNeither(!neither); }
  else return;
});
document.getElementById("save").onclick = () => {
  const blob = new Blob([JSON.stringify({ ...HEAD, finished: new Date().toISOString(), answers }, null, 2)],
                        { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mark-ruling-" + HEAD.seed + ".json";
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
  `${trials.length} trials over ${pages} pages · seed ${seed} · displacements ${shift.ran} (${head.shiftFingerprint})\n` +
    `${skippedForInk} marks passed over for too little ink under the corrected box\n` +
    `${(html.length / 1e6).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${outPath}\n`,
);
