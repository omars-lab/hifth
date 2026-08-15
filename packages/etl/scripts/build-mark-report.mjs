/**
 * Builds the third page: one mark, its own printed ink around it, and a person
 * who says what is wrong with it in their own vocabulary.
 *
 * ## Why a third instrument
 *
 * The forced choice asks *which of these two*, and the nudge asks *where does it
 * go*. Both are excellent and both assume the answer is a displacement. The
 * sitting of 2026-08-12 stopped because it was not: the reader reported the
 * rectangles wrong in four independent ways at once — off the mark, the wrong
 * size, on the wrong mark, and biting the neighbour — and neither instrument has
 * anywhere to put three of those four. A person who can only answer *how far* is
 * being asked to round every complaint into a distance, and the record then says
 * displacement because displacement was the only word on offer.
 *
 * So this page has five words, and they are deliberately not summable:
 *
 *   move it            a corrected position, our rectangle's size kept
 *   wrong shape        the extent is wrong — a statement about size, not place
 *   box the right ink  a corrected position *and* extent, drawn from scratch
 *   the print is odd   a defect in the mus'haf we vendored, not in our placement
 *   bank it            unclassifiable; recorded, and the reader moves on
 *
 * The first three are answers about us. The fourth is an answer about somebody
 * else's file and belongs in the issue catalog, not in any ruling that grades a
 * correction. The fifth exists because the alternative to a bank-it button is a
 * reader who stalls on one strange mark for ten minutes, or worse, forces it into
 * whichever of the other four is nearest — and a forced answer is indistinguishable
 * from a real one once it is written down.
 *
 * ## Why "wrong shape" is its own answer and never a distance
 *
 * Because the two questions have different causes and different fixes. A shift is
 * the registration being wrong; a wrong extent is the *rectangle* being wrong —
 * the mark we drew is not the mark that is printed, which is a mark-data question.
 * Adding them gives a number that is a fact about neither. This is the same
 * separation the census enforced between shifting and mislabelling, applied one
 * level down.
 *
 * ## What this page will not do
 *
 * Tell you how you are doing. It counts what is left to look at, because a person
 * is entitled to know how long they will be sitting there, and it counts nothing
 * else. There is no tally of how many you called wrong, no running share, no
 * verdict at the end. A reader who can see the score is answering the score.
 *
 * ## Running it
 *
 *   node packages/etl/scripts/build-mark-report.mjs --rows <rows.json> \
 *     [--set placed|fallback|weak|edge|all] [--count 60] [--seed 23] [--out <html>] \
 *     [--band lo,hi] [--part n/m]
 *
 * `--set placed` is the sitting that matters and `--set fallback` is the one that
 * confirms what is already known; they are two sittings and not one, because the
 * two populations are placed by different rules and an answer about one says
 * nothing about the other. Each rectangle is drawn the way the ink-placement option
 * would actually ship it, so the sitting grades that option rather than the one
 * underneath it.
 *
 * The rows file is what a scoring run dumps with `probe-mark-ink.mjs --rows-out`:
 * one row per mark, carrying the box we draw and the offset to the best ink match
 * its search could find. Open the page from a session (`make session CHECK=…`) and
 * every answer lands in the transcript as it is given; open it off the filesystem
 * and it keeps its own copy and offers a download at the end.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { correctionFor } from "./lib/registration-grain.mjs";
import { readPageInk } from "./lib/ink.mjs";
import { marksOf } from "./lib/marks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ETL = join(HERE, "..");
const ROOT = join(ETL, "..", "..");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const rowsPath = arg("--rows", null);
const set = arg("--set", "fallback");
const count = Number(arg("--count", 60));
const seed = Number(arg("--seed", 23));
const radius = Number(arg("--radius", 3));
const wide = Number(arg("--wide", 14));
const iouFloor = Number(arg("--iou", 0.55));
const out = arg("--out", join(ETL, "out", "mark-report.html"));

/**
 * Two flags that exist because somebody asked to look at everything.
 *
 * `--band lo,hi` cuts the chosen set by how convincing the ink match was. The point
 * is not to find more faults faster — it is that the whole plan of looking at "the
 * doubtful ones" assumes that number knows which ones are doubtful, and nothing has
 * ever checked that. Drawn a band at a time, five small sittings answer it: if the
 * barely-accepted band is no worse than the comfortable one, the number is not
 * telling us where to look and no amount of sitting in the low band will help.
 * Bands are never pooled into one sitting for the same reason the two sets are not.
 *
 * `--part n/m` is for the populations small enough to exhaust. It shuffles the pool
 * once, seeded, then hands out the nth of m equal slices — so the m parts together
 * are the pool exactly, no mark twice and none missed, and each part is a file a
 * person can finish in a sitting. It ignores `--count`, which is a sampler's flag.
 */
const band = arg("--band", null);
const part = arg("--part", null);

/**
 * `--answered` is what makes the number left actually go down.
 *
 * Without it every rebuild draws from the whole population again, so a reader who
 * has answered two hundred marks is handed the same sixteen sittings with the same
 * count on them and no evidence anywhere that they did anything. That is a bad way
 * to ask somebody for forty hours.
 *
 * It takes one or more files, comma separated: the running log the serving side
 * appends an answer to as it is given, or a whole sitting handed over at the end,
 * or any mix of the two — they carry the same statements in the same shape, and
 * reading both means a reader is never punished for having banked their work one
 * way rather than the other. Overlap between files is expected and harmless; the
 * marks are gathered into a set.
 *
 * A retraction takes a mark back out of the answered set, which is the whole reason
 * this counts rather than just collects. A reader who says something and then unsays
 * it has not answered — and the running log keeps both statements, because it is
 * appended to and never rewritten.
 */
const answeredPaths = String(arg("--answered", "")).split(",").map((p) => p.trim()).filter(Boolean);

if (!rowsPath) {
  console.error("--rows <file> is required: the per-mark displacements to draw from.");
  console.error("  build them with: probe-mark-ink.mjs --pages-n 604 --grain line-tilt --rows-out <file>");
  process.exit(2);
}

/**
 * The same guard both other instruments carry. A report is a set of statements
 * about particular rectangles, and the rectangles are a function of the
 * displacements; read against a different measurement, every one of them is about
 * a mark that was never on the screen.
 */
function fingerprint(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const rowsText = readFileSync(rowsPath, "utf8");
const parsed = JSON.parse(rowsText);
const all = Array.isArray(parsed) ? parsed : parsed.rows;
const rowsFp = fingerprint(rowsText);

// The rule the options page describes: a mark is placed from its own ink when the
// match is convincing AND the search did not run out of room. The boundary test is
// per axis because the search window is a square — asking whether the straight-line
// distance exceeded the radius inscribes a circle in that square and throws away
// every corner of it, which is an error this repo has already made once and paid
// for. See docs/design/mark-registration.md §⑧.
const EPS = 1e-6;
const atEdge = (r) => Math.abs(Math.abs(r.dx) - radius) < EPS || Math.abs(Math.abs(r.dy) - radius) < EPS;
const placed = (r) => r.iouBest >= iouFloor && !atEdge(r);

/**
 * The four populations, and the one that matters most is the one that was missing.
 *
 * `fallback` is the 0.57% the ink search hands back, and it was the default because
 * it is the part we already know is bad. But the open question about placing each
 * mark from its own ink is not about the marks it refuses — it is about the 99.43%
 * it accepts, which score zero error by construction because the number they are
 * scored against is the number they ship. Nothing tests those. A sitting that only
 * ever looks at the refusals can confirm what was already measured and can never
 * find the failure that would matter, which is a placement that is confidently
 * wrong.
 *
 * So `placed` exists, and it is the honest half of this instrument.
 */
const SETS = {
  fallback: (r) => !placed(r),
  placed: (r) => placed(r),
  weak: (r) => r.iouBest < iouFloor,
  edge: (r) => atEdge(r),
  all: () => true,
};
if (!SETS[set]) {
  console.error(`--set must be one of ${Object.keys(SETS).join(", ")}`);
  process.exit(2);
}
let lo = null;
let hi = null;
if (band) {
  [lo, hi] = band.split(",").map(Number);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
    console.error("--band wants lo,hi with hi above lo, e.g. --band 0.55,0.65");
    process.exit(2);
  }
}
const inBand = (r) => !band || (r.iouBest >= lo && r.iouBest < hi);

/**
 * Which marks already carry an answer somebody is still standing behind.
 *
 * Both shapes reduce to the same list of statements: the running log wraps each one
 * as it arrives, and a handed-over sitting carries them already gathered under
 * `said`. A statement names the mark it is about, and a retraction names the mark it
 * is taking back — so this is a count per mark rather than a set, and a mark whose
 * answers were all withdrawn returns to the pool exactly as if it had never been
 * seen. Anything else would quietly bury the marks a reader found hardest, which are
 * the ones worth the most.
 *
 * A file that cannot be read stops the build. The alternative is a sitting that
 * silently re-asks two hundred questions somebody has already answered, and the
 * reader has no way to tell that from a sitting that was supposed to.
 */
function readAnswered(paths) {
  const net = new Map();
  const bump = (ev) => {
    if (!ev || !ev.id) return;
    const d = ev.kind === "retracted" ? -1 : 1;
    net.set(ev.id, (net.get(ev.id) || 0) + d);
  };
  for (const p of paths) {
    const text = readFileSync(p, "utf8");
    if (p.endsWith(".jsonl")) {
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        const rec = JSON.parse(line);
        bump(rec.payload || rec);
      }
    } else {
      const doc = JSON.parse(text);
      for (const ev of Array.isArray(doc) ? doc : doc.said || []) bump(ev);
    }
  }
  return new Set([...net].filter(([, n]) => n > 0).map(([id]) => id));
}

const answered = answeredPaths.length ? readAnswered(answeredPaths) : new Set();
const whole = all.filter((r) => SETS[set](r) && inBand(r));
const pool = answered.size ? whole.filter((r) => !answered.has(`${r.page}:${r.k}`)) : whole;
if (!pool.length) {
  console.error(
    answered.size && whole.length
      ? `every one of the ${whole.length} marks in set ${set}${band ? ` within ${band}` : ""} has been answered — there is nothing left to sit.`
      : `nothing in set ${set}${band ? ` within ${band}` : ""} — there is no sitting to build here.`,
  );
  process.exit(2);
}

// Seeded, so the same flags draw the same marks. A sitting nobody can reconstruct
// is a sitting whose answers point at nothing.
let s = (seed >>> 0) || 1;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const shuffled = pool
  .map((r) => [rnd(), r])
  .sort((a, b) => a[0] - b[0])
  .map((p) => p[1]);

/**
 * Sampling and exhausting are different jobs, and only one of them is allowed to
 * leave a mark unlooked-at. `--count` takes the front of the shuffle, which is a
 * sample. `--part n/m` takes the nth of m contiguous slices of the same shuffle,
 * and the arithmetic is the whole point: every mark is in exactly one part, so a
 * person who finishes all m has finished the population and can say so.
 */
let taken;
let slice = "";
if (part) {
  const [n, m] = part.split("/").map(Number);
  if (!Number.isInteger(n) || !Number.isInteger(m) || m < 1 || n < 1 || n > m) {
    console.error("--part wants n/m with 1 <= n <= m, e.g. --part 3/16");
    process.exit(2);
  }
  const from = Math.floor(((n - 1) * shuffled.length) / m);
  const to = Math.floor((n * shuffled.length) / m);
  taken = shuffled.slice(from, to);
  slice = `-p${n}of${m}`;
} else {
  taken = shuffled.slice(0, count);
}
if (band) slice = `-b${lo}_${hi}${slice}`;

/**
 * Dropping the answered marks moves every card, so it has to move the key too.
 *
 * The page keeps a position — how far into this sitting you got — under a key built
 * from what the sitting is. Shrink the pool and leave the key alone and that number
 * points into a set of cards it was never measured against: a reader who had reached
 * card ninety of a hundred and seventeen reopens a rebuilt sitting of eighty and is
 * told it is finished, having never seen most of it. Silently, and in the direction
 * that looks like success.
 *
 * So the answered set is part of the sitting's identity. The cost is the honest one:
 * a sitting in progress must be handed over before the pool moves, because a rebuild
 * that drops marks starts a new sitting rather than continuing the old one. The
 * answers themselves are never at risk — they were banked as they were given.
 */
if (answered.size) slice += `-a${fingerprint([...answered].sort().join(","))}`;

const pick = taken.slice().sort((a, b) => a.page - b.page || a.k - b.k);

/**
 * Where the rectangle the reader is asked about actually sits — and this is the
 * line that decides which option the sitting is about.
 *
 * It used to be the printed line's correction for every mark, which is right for a
 * refused mark and wrong for an accepted one. Drawn that way, a reader looking at
 * the accepted 99.43% would be judging the line correction's rectangle while every
 * answer was filed against the ink placement — a whole sitting spent grading one
 * option and recorded against another, with nothing in the transcript to show it.
 *
 * So each mark is drawn exactly as the ink-placement option would ship it: from its
 * own ink where the match is convincing and the search had room, and inheriting the
 * printed line otherwise. Which of the two placed it is carried on the card and
 * into every answer, because the two are different claims and a scorer that pooled
 * them would report a number that is a fact about neither.
 *
 * The field is named `rule` and not `by`, which is what it was called for about an
 * hour. A corrected placement already answers with a `by` — the amount the reader
 * dragged the rectangle — and the two met in one object with the payload spread
 * last, so the drag silently ate the marker on exactly the answers that carry a
 * correction. That failure is invisible in the page, invisible in the transcript,
 * and would have shown up as a scorer that could not split the two populations on
 * the answers that matter most: the same class of defect this whole comment exists
 * to prevent, one level down.
 */
const { apply } = correctionFor("line-tilt", all);
const placement = (r) => (placed(r) ? { rule: "ink", dx: r.dx, dy: r.dy } : { rule: "line-tilt", ...apply(r) });

const inks = new Map();
const inkFor = (p) => {
  if (!inks.has(p)) {
    inks.set(p, readPageInk(readFileSync(join(ROOT, "apps/web/public/assets/pages/hafs-kfqc", `${p}.svg`), "utf8"), 1 / 64));
  }
  return inks.get(p);
};

/**
 * Which mark this is, as opposed to where it is.
 *
 * The rows carry a name and a rectangle, and a crop of print with four fathas in
 * it makes "a fatha" no answer at all: the reader is asked whether the rectangle
 * is on the right mark and has not been told which mark is the right one. That
 * was the first thing said about this page by the person sitting it, and it is
 * not a wording problem — the identity was thrown away upstream, at the point
 * where the rows were reduced to name-and-rectangle.
 *
 * It was never lost, only unused: the extractor already reports the ligature a
 * mark was drawn inside — the letters it sits on — and its rank among the marks
 * of the same name on those letters, counted right to left. Read it back here
 * rather than widen the rows, because the rows are a measurement and this is a
 * caption: a reader needs it, no scorer does, and a rows file that grows a field
 * every time a page wants a label stops being comparable across the sittings
 * already banked against it.
 *
 * The name is asserted rather than trusted. `k` indexes a document-order walk,
 * so a row file built from a different corpus revision would line up off by one
 * and caption every mark with its neighbour's letters — silently, and in the one
 * direction that would make a correct placement look wrong to the reader.
 */
const idents = new Map();
const identFor = (r) => {
  if (!idents.has(r.page)) idents.set(r.page, marksOf(r.page));
  const m = idents.get(r.page)[r.k];
  if (!m || m.name !== r.name) {
    throw new Error(`page ${r.page} mark ${r.k}: rows say ${r.name}, the print says ${m ? m.name : "no such mark"}`);
  }
  return m;
};

const n2 = (v) => Math.round(v * 100) / 100;
const n3 = (v) => Math.round(v * 1000) / 1000;

/**
 * The mark's neighbourhood, re-emitted from the page's own outlines. Not a
 * screenshot and not a crop of one: the paths are the print's, clipped by bounding
 * box to the window, so the reader is looking at the ink itself at whatever size
 * their screen gives it.
 */
function crop(r) {
  const [x, y, w, h] = r.box;
  const c = placement(r);
  /*
   * Both windows are centred on the rectangle the reader is actually shown, and
   * not on the uncorrected box it was computed from.
   *
   * The difference is not small and it is worst exactly where it hurts. The row
   * carries the rectangle as the shipped transform put it; what gets drawn is that
   * rectangle plus whichever correction placed it. Framing on the first and drawing
   * the second centres the window on a coordinate nothing on the screen shows, so
   * the mark under discussion sits off to one side — a median 1.3 units across and
   * 1.2 down on the refused set, out to 3.2, on a mark 5.6 wide. Zooming in
   * magnified it: the whole point of looking closer is to put the thing being
   * judged in the middle, and it walked it toward the edge instead.
   *
   * Centring on the drawn rectangle also keeps the question honest. The window is
   * now centred on the claim — "the mark belongs here" — so any gap the reader sees
   * between the rectangle and the ink is the answer, read off the middle of the
   * frame rather than inferred across it.
   *
   * What this deliberately does not do is centre on the mark's own ink. That would
   * be the better window and we cannot honestly draw it: where the ink is, is the
   * unknown this sitting exists to measure, and these are precisely the marks whose
   * ink search came back refused. A window centred on a guess would make every
   * placement look correct.
   */
  const ax = x + c.dx;
  const ay = y + c.dy;
  // Two framings, one set of paths. The close one is what you need to judge a
  // placement; the wide one is what you need to know *which letter of which word*
  // is being talked about — and not knowing that is the complaint that stopped the
  // first sitting. The ink is clipped to the wide window and the toggle only moves
  // the viewBox, so carrying both costs nothing.
  const near = Math.max(3.4, w * 0.75);
  const pad = Math.max(near, wide);
  const vx = ax - pad;
  const vy = ay - pad;
  const vw = w + 2 * pad;
  const vh = h + 2 * pad;
  const parts = [];
  for (const sh of inkFor(r.page).shapes) {
    const ds = [];
    for (const ring of sh.rings) {
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
      if (hi < vx || lo > vx + vw || hiy < vy || loy > vy + vh) continue;
      let d = `M${n2(ring[0])} ${n2(ring[1])}`;
      for (let i = 2; i < ring.length; i += 2) d += `L${n2(ring[i])} ${n2(ring[i + 1])}`;
      ds.push(`${d}Z`);
    }
    if (ds.length) parts.push(`<path d="${ds.join("")}" fill="var(--ink)" fill-rule="${sh.fillRule}"/>`);
  }
  return {
    rule: c.rule,
    vb: [n2(vx), n2(vy), n2(vw), n2(vh)],
    near: [n2(ax - near), n2(ay - near), n2(w + 2 * near), n2(h + 2 * near)],
    at: [n3(ax), n3(ay), n3(w), n3(h)],
    svg: `<rect x="${n2(vx)}" y="${n2(vy)}" width="${n2(vw)}" height="${n2(vh)}" fill="var(--paper)"/>${parts.join("")}`,
  };
}


const cards = pick.map((r) => {
  const c = crop(r);
  const m = identFor(r);
  return {
    id: `${r.page}:${r.k}`,
    page: r.page,
    line: r.line,
    name: r.name,
    // The letters the print drew this mark inside, the word they are part of, and
    // where it stands among the marks of its own name on those letters. Empty for
    // a mark the corpus drew under a word but inside no ligature, which is the one
    // case where nothing here can name a letter — and saying nothing is better
    // than naming the wrong one.
    on: m.lig ? m.lig.text : "",
    word: m.hafs ?? "",
    nth: m.nth ?? 1,
    of: m.of ?? 1,
    rule: c.rule,
    box: [n3(r.box[0]), n3(r.box[1]), n3(r.box[2]), n3(r.box[3])],
    at: c.at,
    vb: c.vb,
    near: c.near,
    svg: c.svg,
  };
});

const HEAD = {
  built: "mark-report",
  rows: rowsPath.replace(`${ROOT}/`, ""),
  rowsFingerprint: rowsFp,
  set,
  // Empty unless a band or a part was asked for, which is deliberate: it goes into
  // the storage key, and a sitting already banked under the plain key must not be
  // orphaned by the arrival of these two flags.
  slice,
  band: band || null,
  part: part || null,
  seed,
  radius,
  iouFloor,
  pool: pool.length,
  of: all.length,
  // What the set held before answered marks were taken out of it, and how many
  // were taken. A transcript has to be able to say which pass of the population it
  // came from, and "80 of 117" means nothing later without the 37.
  population: whole.length,
  alreadyAnswered: whole.length - pool.length,
  shown: cards.length,
  drawnBy: cards.reduce((a, c) => ({ ...a, [c.rule]: (a[c.rule] ?? 0) + 1 }), {}),
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Is this rectangle on the right mark</title>
<style>
:root {
  --paper: #fdfcf9; --ink: #231f20; --field: #ffffff; --edge: #d9d5cc;
  --text: #1a1a1a; --dim: #6b6b6b;
  --ours: #c2410c; --ours-fill: #c2410c1f;
  --yours: #15803d; --yours-fill: #15803d24;
  /* Nothing drawn on the paper is themed, and these four join --paper and --ink in
     saying so. A mus'haf page is white in both themes on purpose — it is a
     photograph of print, not a surface — so a rectangle drawn on it must be picked
     against white and only against white. The pair above are re-themed below and
     stay that way: they are chrome, they sit on --field, and they never touch the
     print. When both were one set, dark mode repainted the rectangles onto that
     unchanged white and the two dropped to 2.49:1 and 1.70:1 — legible enough to
     believe you had looked, which is the direction that reads as agreement. */
  --ours-line: #c2410c; --ours-wash: #c2410c1f;
  --yours-line: #15803d; --yours-wash: #15803d24;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --field: #17181a; --edge: #33363b; --text: #ececec; --dim: #9a9a9a;
    --ours: #fb7f4a; --ours-fill: #fb7f4a24; --yours: #4ade80; --yours-fill: #4ade8024;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--field); color: var(--text);
  font: 16px/1.5 system-ui, -apple-system, sans-serif; }
main { max-width: 40rem; margin: 0 auto;
  padding: 1rem 1rem calc(11rem + env(safe-area-inset-bottom)); }
/* The two things a reader presses on every card, in the same place on every card.
   Before this they were the last things in a long column, so where they landed was
   a function of how tall this card's crop happened to be: on the tallest ones the
   affirm button sat below the fold, and the reader had to scroll to agree. A crop
   is 295 to 529 pixels tall across these marks, so that was not an edge case.
   Fixed rather than sticky, and this is the one place the two differ in kind: a
   sticky element only lifts while its own container still has somewhere to scroll,
   and this is the last thing in the column, so sticky would leave it exactly where
   it was. The column pays for the strip in bottom padding, and the safe-area inset
   keeps the home indicator off the buttons — which is what viewport-fit=cover on
   the meta tag above is for, since without it that inset resolves to zero. */
.dock { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2;
  background: var(--field); border-top: 1px solid var(--edge);
  padding: .5rem 1rem calc(.5rem + env(safe-area-inset-bottom)); }
.dock .acts.one, .dock .nav { max-width: 38rem; margin: 0 auto; }
.dock .nav { margin-top: .5rem; }
h1 { font-size: 1.1rem; margin: 0 0 .25rem; }
.lede { color: var(--dim); font-size: .9rem; margin: 0 0 .3rem; }
/* Seven lines of instructions are what the first card needs and what the sixtieth
   is buried under: they pushed the button a reader presses fifty times in sixty
   below the fold on a phone. They do not simply go — somebody coming back after a
   week needs them — so they fold down to one line once the reader has demonstrably
   read them, and this says so and puts them back. It is a toggle and not a
   disclosure over the answers themselves: shortening an explanation costs nobody an
   answer, whereas hiding the faults behind a tap while agreeing stays free would
   bias the very ratio these sittings exist to measure. */
.swap { margin: 0 0 1rem; }
.swap button { font-size: .8rem; padding: .3rem .7rem; min-height: 44px; color: var(--dim); }
.where { display: flex; justify-content: space-between; align-items: baseline;
  font-size: .9rem; color: var(--dim); margin-bottom: .4rem; }
.where b { color: var(--text); font-size: 1rem; }
/* The letters the mark belongs to, set large enough to be recognised at arm's
   length rather than merely present. They are the answer to "which one of these
   four fathas", so they are the second thing on the card and not a footnote, and
   they are set right-to-left because they are letters and not a label. */
/* The sentence beside the letters is the question, not a footnote to it: on a crop
   holding four of the same mark it is the only thing that says which one is being
   asked about. It was the dimmest and smallest text on the card. */
.ident { display: flex; align-items: baseline; gap: .5rem; flex-wrap: wrap;
  font-size: .9rem; color: var(--text); margin: -.15rem 0 .5rem; }
.ident .letters { direction: rtl; font-size: 1.5rem; line-height: 1.35; color: var(--text);
  font-family: "SF Arabic", "Geeza Pro", "Noto Naskh Arabic", serif; }
.ident .word { direction: rtl; font-size: 1rem; line-height: 1.35; color: var(--dim);
  font-family: "SF Arabic", "Geeza Pro", "Noto Naskh Arabic", serif; }
.ident:empty { display: none; }
/* pan-y, not none: a finger dragging down this image is a reader scrolling to the
   buttons, and swallowing that gesture is how a scroll becomes a recorded answer.
   Only a grab that starts on the rectangle takes the pointer, and the handler says
   so by capturing; drawing mode takes the whole stage because the reader asked for
   it by pressing a button. */
svg.stage { display: block; width: 100%; height: auto; border: 1px solid var(--edge);
  border-radius: 6px; background: var(--paper); touch-action: pan-y; }
svg.stage.drawing { cursor: crosshair; touch-action: none; }
svg.stage rect.grab { cursor: grab; }
/* A gesture that begins on the rectangle is a move, and it must not also be a
   scroll. touch-action is read when the gesture starts and pointer capture cannot
   take it back, so pan-y on the stage lets a phone steal a downward drag halfway
   through and leave the rectangle sitting where it began. The stage keeps pan-y,
   because scrolling past a large picture is the commonest thing a finger does
   here; only the rectangle and the fingertip of slack around it opt out. */
svg.stage rect.grab, svg.stage rect.hit { touch-action: none; }
svg.stage rect.hit { fill: transparent; stroke: none; cursor: grab; }
svg.stage.drawing rect.grab { cursor: crosshair; }
/* The stroke is non-scaling, so this width and this dash pattern are read in screen
   pixels rather than in page units — which is the point. A width in page units is a
   different width on every card, because each card crops the print to its own mark;
   it only looked constant while the stage happened to be exactly the width of the
   column. And the dash is carried as well as the colour: two rectangles that differ
   in one channel only are one rectangle to a reader who does not separate those two
   greens, and to anyone who repaints this palette later. */
svg.stage rect.grab, svg.stage rect.mine { stroke-width: 1.7; }
svg.stage rect.mine { stroke-dasharray: 5 3; }
.view { display: flex; justify-content: flex-end; gap: .4rem; margin-top: .4rem; }
.view button { padding: .3rem .9rem; font-size: .82rem; min-height: 44px; }
/* Buttons rather than handles on the rectangle itself. At the framing that shows
   the whole word a mark is about a dozen pixels across, so an edge to grab would
   be smaller than the finger grabbing it — and even close up, a drag cannot be
   repeated: the reader who wants the same nudge on the next mark has no way to
   ask for it. A press is the same amount every time, which is the only way this
   sitting produces numbers that can be compared across marks. */
.pad { margin: .5rem 0 0; padding: .55rem .6rem; border: 1px solid var(--edge); border-radius: 6px; }
.pad-row { display: flex; align-items: center; gap: .35rem; margin-bottom: .35rem; }
.pad-row span { flex: 1; font-size: .8rem; color: var(--dim); }
.pad-row button { min-width: 48px; min-height: 44px; font-size: 1rem; padding: .3rem; }
.pad .step { font-size: .78rem; color: var(--dim); margin: .3rem 0 0;
  display: flex; flex-wrap: wrap; gap: .35rem .5rem; align-items: center; }
/* The size of a press gets its own line above the slider, because it is the number
   the reader is setting and reading it out of the middle of a row of controls is
   harder than it needs to be. */
.pad .step label { flex: 1 0 100%; }
/* A range input is about twenty pixels tall by default and its thumb is the whole
   target. Forty-four on the box gives the thumb the height the rest of this pad
   already has, and the accent is chrome on the field, not ink on the paper. */
.pad .step input[type="range"] { flex: 1 1 9rem; min-width: 8rem; height: 44px;
  accent-color: var(--ours); }
/* Put it back where it was throws away every correction on this card, so it gets
   the full target and is pushed to the far end of the row rather than sitting
   shoulder to shoulder with the control that only changes the step size. */
.pad .step button { font-size: .78rem; padding: .3rem .7rem; min-height: 44px; }
.pad .step #reset { margin-left: auto; }
.hint { font-size: .82rem; color: var(--dim); margin: .45rem 0 .8rem; min-height: 2.4em; }
.acts { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
/* The answer a reader gives fifty-odd times out of sixty gets its own row and the
   only filled button on the page. It is first because it is the common case, and
   it is not sitting among the four faults because a reader scanning that grid for
   somewhere to put "it looks fine" is a reader being pushed toward a fault. */
.acts.one { grid-template-columns: 1fr; margin-bottom: .5rem; }
button.affirm { border-color: var(--ours); background: var(--ours-fill); font-weight: 600; }
button { font: inherit; font-size: .92rem; padding: .65rem .5rem; border-radius: 6px;
  border: 1px solid var(--edge); background: transparent; color: var(--text); cursor: pointer; }
button:hover { border-color: var(--dim); }
button:focus-visible { outline: 2px solid var(--ours); outline-offset: 2px; }
/* Pressed is what turns these from one-way buttons into toggles. A reader who
   pages back to a mark has to see what they already said without reading the list
   underneath it, and pressing a lit button has to read as taking it back rather
   than as saying the same thing a second time. A border alone was too quiet to do
   that on a phone in daylight, so the fill comes with it. */
button[aria-pressed="true"] { border-color: var(--yours); color: var(--yours);
  background: var(--yours-fill); font-weight: 600; }
/* The one button on the card that is already filled when it is off, so the wash the
   other buttons use to say "pressed" said nothing here — pressed and unpressed
   differed only in a border, and the reader who has just answered gets no
   acknowledgement at all. It goes solid instead, and carries a mark as well as a
   colour, because "did that take?" is a question this page must never provoke: a
   reader who thinks it did not press again, and pressing again takes it back. */
button.affirm[aria-pressed="true"] { border-color: var(--ours); color: var(--field);
  background: var(--ours); }
button.affirm[aria-pressed="true"]::before { content: "\\2713\\00a0"; font-weight: 700; }
/* The ways a printed page can be odd. They are their own row rather than five more
   buttons in the grid above, for two reasons: they only mean anything once somebody
   has said the print is odd, and several of them can be true of one mark at once —
   which the grid's two even columns of faults would have quietly denied. */
.why { margin: .55rem 0 0; }
.why p { font-size: .82rem; color: var(--dim); margin: 0 0 .4rem; }
.chips { display: flex; flex-wrap: wrap; gap: .4rem; }
.chips button { flex: 1 1 9rem; min-height: 44px; font-size: .85rem; padding: .45rem .6rem; }
.nav { display: flex; gap: .5rem; margin-top: 1rem; }
.nav button { flex: 1; }
/* Quiet on purpose. It is here so a reader who put the phone down can pick up
   where they were, not to be watched while they work. */
.far { font-size: .8rem; color: var(--dim); text-align: center; margin: .6rem 0 0; }
/* Available from the first card, not only from the end.
   Somebody nine answers in had no way to hand those nine over: the only save
   control lived behind the end-of-sitting panel, which does not appear until all
   the cards are behind you. So an hour's work was held hostage to finishing the
   hour. Quiet, because it is an escape hatch and not the thing to press next. */
.bank { text-align: center; margin: .5rem 0 0; }
.bank button { font-size: .8rem; padding: .3rem .9rem; min-height: 44px; color: var(--dim); }
.bank p { font-size: .8rem; color: var(--yours); margin: .4rem 0 0; }
.said { list-style: none; margin: .8rem 0 44px; padding: 0; font-size: .87rem; }
.said li { display: flex; gap: .5rem; align-items: center; padding: .3rem 0;
  border-top: 1px solid var(--edge); }
.said b { color: var(--yours); font-weight: 600; }
.said span { color: var(--dim); flex: 1; }
.said button { padding: .1rem .6rem; font-size: .78rem; min-height: 44px;
  white-space: nowrap; }
dialog { border: 1px solid var(--edge); border-radius: 8px; background: var(--field);
  color: var(--text); max-width: 22rem; width: calc(100vw - 2rem); }
dialog::backdrop { background: #0008; }
dialog p { margin: 0 0 .6rem; font-size: .9rem; }
textarea { width: 100%; font: inherit; font-size: .9rem; padding: .5rem; border-radius: 6px;
  border: 1px solid var(--edge); background: var(--paper); color: var(--ink); }
.row { display: flex; gap: .5rem; margin-top: .6rem; }
.row button { flex: 1; }
#done { text-align: center; padding: 2rem 0; }
#banked { font-size: .9rem; color: var(--yours); margin-top: 1rem; }
</style>
</head>
<body>
<main>
<h1>Is this rectangle on the right mark?</h1>
<p class="lede" id="brief" hidden>Is the orange rectangle sitting on the mark the letters below
name? Most of them are, and saying so is a real answer.</p>
<p class="lede" id="full">The orange rectangle is where the app would draw this mark. Around it is the
ink the mus'haf actually prints there, at whatever size your screen gives it. The letters under
the heading are the ones the print drew this mark on — that is the mark the rectangle should be
sitting on, and when a crop holds several of the same name, the line beside them says which.
These marks were drawn at random, so most of them should look right — saying so is a real
answer, and it is the one you should expect to give most often. When something is wrong, more
than one thing can be.</p>
<p class="swap"><button id="ledeSwap"></button></p>

<div id="work">
  <div class="where"><b id="name"></b><span id="loc"></span></div>
  <div class="ident" id="ident"></div>
  <svg class="stage" id="stage" role="img" aria-label="the mark and the ink around it"></svg>
  <div class="view">
    <button id="nudge" aria-pressed="false" aria-expanded="false" aria-controls="pad">Nudge it</button>
    <button id="closer" aria-pressed="false">Look closer</button>
  </div>
  <div class="pad" id="pad" hidden>
    <div class="pad-row">
      <span>Move it</span>
      <button id="mL" aria-label="move it left">←</button>
      <button id="mR" aria-label="move it right">→</button>
      <button id="mU" aria-label="move it up">↑</button>
      <button id="mD" aria-label="move it down">↓</button>
    </div>
    <div class="pad-row">
      <span>Wider or narrower</span>
      <button id="wM" aria-label="narrower">→←</button>
      <button id="wP" aria-label="wider">←→</button>
    </div>
    <div class="pad-row">
      <span>Taller or shorter</span>
      <button id="hM" aria-label="shorter">↓↑</button>
      <button id="hP" aria-label="taller">↑↓</button>
    </div>
    <div class="step">
      <label for="stepr">Each press is <b id="stepv"></b>.</label>
      <input id="stepr" type="range" min="0.01" max="0.5" step="0.01" value="0.5"
        aria-label="how far one press moves the rectangle, in units">
      <button id="reset">Put it back where it was</button>
    </div>
  </div>
  <p class="hint" id="hint"></p>
  <div class="acts">
    <button id="off" aria-pressed="false">It is in the wrong place</button>
    <button id="shape" aria-pressed="false">The rectangle is the wrong shape</button>
    <button id="draw" aria-pressed="false">Box the right ink instead</button>
    <button id="print" aria-pressed="false" aria-expanded="false" aria-controls="odd">Something is odd in the print</button>
    <button id="skip" aria-pressed="false">I cannot say — bank it</button>
  </div>
  <div class="why" id="odd" hidden>
    <p>What is odd about it? Say as many as are true.</p>
    <div class="chips" id="chips"></div>
  </div>
  <ul class="said" id="said"></ul>
  <p class="far" id="far"></p>
  <div class="bank">
    <button id="hand">Hand over what I have said so far</button>
    <p id="handed" hidden></p>
  </div>
  <div class="dock">
    <div class="acts one">
      <button id="right" class="affirm" aria-pressed="false">Nothing wrong — it is on the right mark</button>
    </div>
    <div class="nav">
      <button id="prev">Back</button>
      <button id="next">Next</button>
    </div>
  </div>
</div>

<div id="done" hidden>
  <p>That is all of them.</p>
  <button id="save">Save what you said</button>
  <p id="banked" hidden></p>
</div>
</main>

<dialog id="ask">
  <p id="askWhat"></p>
  <textarea id="askText" rows="3" placeholder="In your own words. One line is plenty."></textarea>
  <div class="row">
    <button id="askCancel">Cancel</button>
    <button id="askOk">Record it</button>
  </div>
</dialog>

<script>
const HEAD = ${JSON.stringify(HEAD)};
const CARDS = ${JSON.stringify(cards)};
const SINK = typeof window !== "undefined" ? window.HIFTH_SESSION : null;
const KEY = "hifth-mark-report-" + HEAD.rowsFingerprint + "-" + HEAD.set + HEAD.slice + "-" + HEAD.seed;

// A page opened straight off the filesystem has no storage at all — 'file:' URLs
// are unique origins and every localStorage call throws, not just the first. So the
// belt is wrapped rather than assumed; losing it is survivable, losing the answer
// the reader had just given because the belt threw is not.
function keep(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* no store here */ } }
function kept() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
function keepSeen(v) { try { localStorage.setItem(KEY + "-seen", String(v)); } catch (e) { /* no store here */ } }
function keptSeen() { try { return Number(localStorage.getItem(KEY + "-seen") || 0); } catch (e) { return 0; } }
function keepAt(v) { try { localStorage.setItem(KEY + "-at", String(v)); } catch (e) { /* no store here */ } }
function keptAt() { try { return Number(localStorage.getItem(KEY + "-at") || 0); } catch (e) { return 0; } }
// Three states, not two: shortened by hand, opened by hand, and never asked. The
// third is what makes the instructions fold themselves after the first card without
// also overruling a reader who has just asked to see them again.
function keepRead(v) { try { localStorage.setItem(KEY + "-read", v); } catch (e) { /* no store here */ } }
function keptRead() { try { return localStorage.getItem(KEY + "-read"); } catch (e) { return null; } }
// How big a press is survives a reload, because it is the size of every answer the
// reader is about to bank and a silent return to the default would change that size
// without changing anything they can see.
function keepStep(v) { try { localStorage.setItem(KEY + "-step", String(v)); } catch (e) { /* no store here */ } }
function keptStep() { try { return Number(localStorage.getItem(KEY + "-step")); } catch (e) { return NaN; } }
function keepGone(v) { try { localStorage.setItem(KEY + "-gone", JSON.stringify(v)); } catch (e) { /* no store here */ } }
function keptGone() { try { return JSON.parse(localStorage.getItem(KEY + "-gone") || "[]"); } catch (e) { return []; } }

let said = kept();
/**
 * What was dealt, and what is left — two lists, because they answer two questions and
 * a reader asked the second one three times.
 *
 * Handing over used to change nothing a reader could see. The count under the card
 * said how far through the deal they were, the deal was fixed when the page was
 * built, and the number that actually falls when work is banked only falls when the
 * sittings are built again from the answers. So a reader who banked an hour, watched
 * the number stay where it was, banked again and watched it stay again, is being told
 * by the only instrument in front of them that nothing they did counted. It counted
 * every time. The page just had no way to say so.
 *
 * So handing over now retires what it handed over. DECK is what is left to answer;
 * GONE is what has been given away and is kept, because a reload that brought the
 * retired marks back would undo the only visible evidence the reader has.
 *
 * What is deliberately NOT retired is the transcript. It stays whole and every
 * hand-over writes the whole of it, because the file is written under one name and a
 * second, smaller write would silently destroy the first — and the running log the
 * server keeps is not a substitute, it has been short of the browser's copy before.
 * Retiring is a fact about the reader's view. It is not a fact about the record.
 *
 * No backticks in here — this whole block is inside a template literal in the
 * builder, and one of them closes it.
 */
let GONE = new Set(keptGone());
let DECK = CARDS.filter(function (c) { return !GONE.has(c.id); });
/**
 * Which card is on the screen — kept, because a reload used to send the reader back
 * to the first one.
 *
 * The transcript survived a reload from the beginning and the place in it did not,
 * which is a worse failure than losing both would have been: the page reopened at
 * card one, showing a mark that had already been answered, with no sign anywhere
 * that it had been. So the reader does it again, and the transcript quietly collects
 * two passes over the same marks.
 *
 * It is the position and not the high-water mark, because those answer different
 * questions and this one is "where was I". A reader who had gone back to look at
 * something again should reopen there, not be thrown forward past it.
 *
 * Clamped on the way in: a stored position can outlive the sitting it was measured
 * against if a rebuild ever changes the card count without changing the key, and
 * landing past the end would show the finished panel to somebody who is not.
 */
let at = Math.max(0, Math.min(keptAt(), DECK.length - 1));
/**
 * How far the reader actually got — and this is not bookkeeping, it is the
 * denominator.
 *
 * This used to be the only denominator, because there was deliberately no "looks
 * right" button: the argument was that a sitting where the common case costs a
 * click is a sitting nobody finishes, so passing a mark WAS the verdict that
 * nothing was wrong with it. The first reader to sit the placed set killed that
 * argument. Shown a mark drawn at random from the ones we believe are already
 * correct — where the expected answer is "nothing" about fifty-seven times out of
 * sixty — they asked where the button for that was, twice. A page that asks what
 * is wrong and offers only ways to say what is wrong does not have a cheap common
 * case; it has an unsayable one, and an unsayable common case is how a reader ends
 * up banking a good mark as could-not-say to make the card go away.
 *
 * So the button exists now and it is the primary control. This count stays, because
 * it is still the only thing that counts a mark the reader passed in silence with
 * Next, and both are needed: it is the denominator, and the affirmations are how
 * much of that denominator somebody actually vouched for. The scorer prints the gap
 * between them. (No backticks anywhere in here — this whole block is inside a
 * template literal, and one closes it.)
 *
 * Without this number the denominator is unknowable. A transcript
 * holding four answers is a reader who looked at sixty marks and found four bad
 * ones, or a reader who looked at five and shut the tab — 6.7% and 80%, the same
 * bytes. Both readings are consistent with everything else the file records, and
 * the scorer would have to pick one and would pick wrong.
 *
 * It is a high-water mark rather than a position, because going Back and forward
 * again must not be able to shrink what was seen.
 */
let seen = keptSeen();
let lost = 0;

// The instructions fold themselves away once the reader has demonstrably read them,
// which is the moment they have gone past the first card. They fold, and do not go:
// somebody returning after a week needs them, and the button that puts them back
// says so in the reader's own words rather than in a chevron.
let chose = keptRead();
function isBrief() { return chose === null ? seen > 0 : chose === "1"; }
function swapLede() {
  const b = isBrief();
  $("brief").hidden = !b;
  $("full").hidden = b;
  $("ledeSwap").textContent = b ? "What am I looking at?" : "I have got it — shorten this";
}
let drawing = false;
let closer = false;
let oddOpen = false;
// Sticky across cards, unlike drawing and the reasons row: a reader who is nudging
// is going to nudge the next one too, and re-opening it sixty times is a fight.
let padOpen = false;

/**
 * The ways a printed page can be odd, as things to press rather than things to
 * type. Somebody asked how to report an abnormal character on a phone, and the
 * honest answer was that they could not: the one button for it opened a dialog and
 * demanded a sentence, so reporting a strange mark cost a keyboard, and a reader
 * mid-sitting skips that every time. These are the sentences, written once here.
 *
 * They are all the same word to the scorer — an odd print is an odd print — and
 * the reason rides along beside it. That is on purpose. Adding words to the answer
 * vocabulary means changing the scorer and its tests and re-reading every ruling
 * already banked against the old six, and none of that is owed by a reader who
 * wants to say which kind of odd they meant.
 *
 * The first element is the key the transcript groups by, and it must not be edited
 * once answers exist against it; the second is what the reader reads, and can be.
 */
const REASONS = [
  ["unfamiliar", "A mark I do not recognise"],
  ["stacked", "Two marks on top of each other"],
  ["malformed", "The shape itself looks wrong"],
  ["stray", "Ink that should not be there"],
  ["missing", "The mark is missing here"],
  ["unsure", "Odd — I cannot say how"],
];

const $ = (id) => document.getElementById(id);
const stage = $("stage");

/**
 * Every answer goes to the session the moment it is given, and to localStorage as
 * a belt. Nothing is held until the end: a phone that locks mid-sitting, or a tab
 * that is closed on the way to lunch, must not cost the answers already given.
 */
function say(kind, payload, card) {
  // Almost every answer is about the card on the screen. A burst of nudges is the
  // exception: it is banked once, a moment after the last press, and the reader may
  // have pressed Next in between — so the card the presses were made on rides along
  // rather than being read back off the page at the moment it lands.
  const c = card || DECK[at];
  // 'rule' rides on every answer because the transcript has to be readable on its
  // own. Which rule drew the rectangle is the difference between "the ink search
  // placed this badly" and "the printed line placed this badly", and a transcript
  // that only says "this is badly placed" cannot be split back apart afterwards.
  //
  // It is spread FIRST and named 'rule' rather than 'by' for the same reason: a
  // corrected placement answers with its own 'by', the amount the reader dragged
  // the rectangle, and the two would collide with the payload winning. Silently,
  // and only on the answers that carry a correction. No backticks in here: this
  // whole block is inside a template literal in the builder.
  const ev = { kind: kind, id: c.id, page: c.page, line: c.line, name: c.name, rule: c.rule, ...payload };
  said.push(ev);
  keep(said);
  if (SINK) {
    SINK.post("report", ev).then(function (r) { if (!r || !r.ok) lost += 1; })
        .catch(function () { lost += 1; });
  }
  render();
}

/**
 * A transcript is appended to, never rewritten, so taking something back is its own
 * statement rather than an erasure. That is the honest shape and it is also the
 * useful one: a reader who says a thing and then unsays it has told us the mark is
 * a hard one, which a silent deletion would have thrown away.
 */
/**
 * Put a card's rectangle where the transcript says the reader left it.
 *
 * The transcript is the truth and the rectangle is a picture of it, so the picture
 * is always recomputed from the transcript rather than tracked alongside it. Two
 * places need exactly this and they used to be one place and a hole:
 *
 * - after a retraction, or the page goes on showing a correction the transcript no
 *   longer contains;
 * - **on load**, which is the hole, and it cost somebody an evening. Answers survive
 *   a reload and the drawn rectangle did not, so twenty-five marks that had been
 *   carefully nudged into place opened again with every box back where it shipped.
 *   Nothing said the corrections were still held. The only reasonable thing a reader
 *   can do with that page is do the work again — and the second pass appends to the
 *   transcript rather than replacing it, so the cost is not only their evening, it
 *   is two different answers for one mark.
 *
 * Where it lands is whatever answer is still standing for this mark: the one before
 * it if the reader nudged twice, and back where it shipped if there is none. No
 * backticks in here — this whole block is inside a template literal in the builder.
 */
function redraw(id) {
  const c = DECK.find(function (x) { return x.id === id; });
  if (!c) return;
  let move = null;
  let size = null;
  for (const e of said) {
    if (e.id !== id) continue;
    if (e.kind === "placement" && e.to) move = e;
    if (e.kind === "wrong-shape" && e.size) size = e;
  }
  c.held = move ? [move.to[0] - (c.at[0] - c.box[0]), move.to[1] - (c.at[1] - c.box[1])] : null;
  c.sized = size ? [size.size[0] - c.at[2], size.size[1] - c.at[3]] : null;
}

function retract(i) {
  const ev = said[i];
  said.splice(i, 1);
  redraw(ev.id);
  keep(said);
  if (SINK) SINK.post("report", { kind: "retracted", id: ev.id, was: ev.kind }).catch(function () { lost += 1; });
  render();
}

/**
 * Where this card's standing answer of a kind sits in the transcript, or -1.
 *
 * "Standing" is the whole trick behind the toggles: a retracted answer is spliced
 * out, so anything still in the list is something the reader is currently saying,
 * and a button can be lit from that rather than from a second pile of state that
 * would drift from it. An odd print takes a reason as well, because several of
 * those can stand at once and they are all the same word.
 */
function standing(kind, why) {
  const id = DECK[at] ? DECK[at].id : null;
  for (let i = said.length - 1; i >= 0; i -= 1) {
    const e = said[i];
    if (e.id === id && e.kind === kind && (why === undefined || e.why === why)) return i;
  }
  return -1;
}

/** Say it if it is not being said, and take it back if it is. */
function toggle(kind, payload) {
  const i = standing(kind, payload ? payload.why : undefined);
  if (i >= 0) { retract(i); return false; }
  say(kind, payload || {});
  return true;
}

function press(el, on) {
  el.setAttribute("aria-pressed", String(!!on));
}

/**
 * Two of the five words carry a sentence the reader typed — the note on an odd
 * print and the note on one they banked — and the answer list is built by string
 * concatenation into innerHTML. A note with an angle bracket in it would close the
 * span early, and the "take it back" buttons after it are what the reader needs to
 * undo the answer they just gave. So the one place reader text meets markup escapes
 * it. Nothing here is hostile; it is a sitting run by one person on their own file.
 * It is that a mangled list is silent, and it eats the undo.
 */
function safe(t) {
  return String(t).replace(/[<>&"]/g, function (c) {
    return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c];
  });
}

const WORDS = {
  "looks-right": "nothing wrong with it",
  placement: "moved it",
  "wrong-shape": "wrong shape",
  "intended-ink": "boxed the right ink",
  "print-defect": "odd in the print",
  exception: "banked, could not say",
};

function ask(what, then) {
  $("askWhat").textContent = what;
  $("askText").value = "";
  const dlg = $("ask");
  dlg.returnValue = "";
  dlg.showModal();
  $("askOk").onclick = function () { dlg.close(); then($("askText").value.trim()); };
  $("askCancel").onclick = function () { dlg.close(); };
}

/* ── nudging by the step ───────────────────────────────────────────────── */

/**
 * Moving and resizing a press at a time, and why it is not a handle on the corner.
 *
 * A drag answers "roughly there". These answer "0.5 of a unit left", which is a
 * different and more useful kind of answer: it is the same amount on every mark,
 * so sixty of them can be averaged into a correction, and a reader can repeat
 * exactly what they did on the last one. It is also the only thing that works at
 * the framing showing the whole word, where the rectangle is about a dozen pixels
 * across and there is no corner a finger could find.
 *
 * How big a press is, was two sizes and is now a range, and the ends are where the
 * two sizes were. Half a unit is a seventh of a mark's height, against a per-page
 * scatter measured at about 0.44 across and 0.34 down — so the top of the range is
 * the size of the error being corrected, and a reader lining a box up starts by
 * covering that distance in one or two presses. A hundredth is a three-hundred-and-
 * sixtieth of the same mark: below the width of the stroke drawing the rectangle at
 * the close framing, which is the point at which pressing again stops changing
 * anything the reader can see. Neither end is arbitrary and neither should be moved
 * without re-reading those numbers.
 *
 * The two sizes came with a control that swapped between them, and it was the wrong
 * shape for what readers were doing with it: the useful press is whatever is left
 * after the first coarse move, it is different on a mark that is a hair out from one
 * that is half a unit out, and 0.1 was simply the nearest thing on offer. A range
 * costs the same one gesture as the swap did and does not make the reader round
 * their intention to one of two numbers. The step lands on hundredths, so every
 * position is a number that reads cleanly in the transcript.
 */
const STEP_MIN = 0.01;
const STEP_MAX = 0.5;
// Anything outside the range, and anything that is not a number at all, comes back
// as the coarse end — which is where the swap opened, so a reader who never touches
// the slider gets exactly the sitting they got before.
function okStep(v) { return v >= STEP_MIN && v <= STEP_MAX ? Math.round(v * 100) / 100 : STEP_MAX; }
let step = okStep(keptStep());

// The smallest rectangle a press is allowed to leave behind. A box shrunk to
// nothing is not an answer about a mark, and it cannot be grabbed to undo.
const FLOOR = 0.6;

// Presses land on the picture at once and in the transcript a moment later. A
// reader lining a box up taps six or seven times in a row, and banking each one
// would turn a single correction into seven answers — which then reads, to anyone
// counting later, as seven separate complaints about one mark.
let pend = null;   // [dx, dy, dw, dh] pressed but not yet said
let pendC = null;  // the card those presses were about
let pendT = 0;

/**
 * A measured answer supersedes a bare one: the reader made one observation and then
 * said it more precisely, and leaving both standing would count the mark twice.
 * The field named here is what the precise form carries and the bare form does not.
 */
function dropVague(kind, c, field) {
  for (let i = said.length - 1; i >= 0; i -= 1) {
    if (said[i].id === c.id && said[i].kind === kind && !said[i][field]) retract(i);
  }
}

function flush() {
  if (pendT) { clearTimeout(pendT); pendT = 0; }
  const p = pend;
  const c = pendC;
  pend = null;
  pendC = null;
  if (!p || !c) return;
  const r3 = function (v) { return Math.round(v * 1000) / 1000; };
  if (Math.abs(p[0]) > 1e-9 || Math.abs(p[1]) > 1e-9) {
    // Shaped exactly like a drag: 'by' is this burst and 'to' is where the
    // rectangle has arrived in total. A burst and a drag are the same answer given
    // two ways, and nothing downstream should have to know which it was.
    const to = [r3(c.at[0] + c.held[0] - c.box[0]), r3(c.at[1] + c.held[1] - c.box[1])];
    // Read where it has arrived BEFORE dropping the bare complaint, and put the
    // offset back after. Taking an answer back re-derives the rectangle's offset from
    // whatever is still standing, which is right when a reader withdraws something
    // and wrong here: the move about to be banked is not in the transcript yet, so
    // that re-derivation would snap the rectangle home and lose the answer with it.
    const held = c.held;
    dropVague("placement", c, "to");
    c.held = held;
    say("placement", { by: [r3(p[0]), r3(p[1])], to: to }, c);
  }
  if (Math.abs(p[2]) > 1e-9 || Math.abs(p[3]) > 1e-9) {
    // A measured shape supersedes a bare one. Somebody who pressed "the rectangle
    // is the wrong shape" and then said how wrong has not made two complaints, and
    // leaving both standing would count the mark twice.
    const size = [r3(c.at[2] + c.sized[0]), r3(c.at[3] + c.sized[1])];
    const sized = c.sized;   // same reason as above
    dropVague("wrong-shape", c, "size");
    c.sized = sized;
    say("wrong-shape", { by: [r3(p[2]), r3(p[3])], size: size, was: [c.at[2], c.at[3]] }, c);
  }
}

function nudge(dx, dy, dw, dh) {
  const c = DECK[at];
  if (pendC && pendC !== c) flush();
  const s = step;
  const h = c.held || [0, 0];
  const z = c.sized || [0, 0];
  // Clamped against the floor, and the burst is credited only what the clamp let
  // through — otherwise a reader leaning on "narrower" banks a shrink the picture
  // never made.
  const nw = Math.max(FLOOR, c.at[2] + z[0] + dw * s) - c.at[2];
  const nh = Math.max(FLOOR, c.at[3] + z[1] + dh * s) - c.at[3];
  c.held = [h[0] + dx * s, h[1] + dy * s];
  c.sized = [nw, nh];
  pendC = c;
  pend = pend || [0, 0, 0, 0];
  pend[0] += dx * s;
  pend[1] += dy * s;
  pend[2] += nw - z[0];
  pend[3] += nh - z[1];
  if (pendT) clearTimeout(pendT);
  pendT = setTimeout(flush, 700);
  paint();
}

/* ── the stage ─────────────────────────────────────────────────────────── */

let moved = null;   // [dx, dy] of the current drag, in page units
let drawn = null;   // [x, y, w, h] of a rectangle being drawn

// Which of the two framings is on the screen. Everything that converts a finger to
// a page unit reads this, not the card, or a drag would land somewhere else than
// where it was released the moment the reader looked closer.
function framing() { return closer ? DECK[at].near : DECK[at].vb; }

// Which card's print is currently in the stage, and the three rectangles laid over
// it. They are held onto because writing the print is by far the most expensive
// thing this page does — 2.0 KB of path data on the smallest card, 23.2 KB on the
// largest — and the drag handler was paying it on every pointer frame, on the
// biggest cards, on a phone. A correction that stutters is a correction the reader
// stops making, and a reader who stops correcting says the rectangle looks right.
// So the print is written once per card and the rectangles move by attribute after
// that. This is what the two crops were always for: looking closer is now one
// viewBox write rather than the whole page over again.
let drawnFor = null;
let hitEl = null;
let boxEl = null;
let mineEl = null;

function mount(c) {
  stage.innerHTML = c.svg +
    '<rect class="hit"/>' +
    '<rect class="grab" fill="var(--ours-wash)" stroke="var(--ours-line)"' +
    ' vector-effect="non-scaling-stroke"/>' +
    '<rect class="mine" fill="var(--yours-wash)" stroke="var(--yours-line)"' +
    ' vector-effect="non-scaling-stroke" visibility="hidden"/>';
  // Counted from the end rather than found by class: the print is somebody else's
  // markup and nothing stops it from carrying a class of its own that matches.
  const kids = stage.children;
  hitEl = kids[kids.length - 3];
  boxEl = kids[kids.length - 2];
  mineEl = kids[kids.length - 1];
  drawnFor = c.id;
}

function place(el, x, y, w, h) {
  el.setAttribute("x", x);
  el.setAttribute("y", y);
  el.setAttribute("width", w);
  el.setAttribute("height", h);
}

function paint() {
  const c = DECK[at];
  if (drawnFor !== c.id) mount(c);
  const vb = framing();
  const a = c.at;
  // The correction the reader has already made on this card, which outlives the
  // gesture that made it. Without it the rectangle springs back to where it
  // shipped the instant the finger lifts, and a reader who has just dragged it
  // onto the right mark is told, in the only language this page has, that it did
  // not take. The answer was banked either way, which is the worse half: the page
  // and the transcript disagreed and only the transcript was right.
  const h = c.held || [0, 0];
  // And the resizing, which grows about the centre rather than off one corner. A
  // reader making a box fit a mark is saying "it should be this big around this
  // thing", and a box that grew rightward would need dragging back afterwards —
  // two answers for one observation, and the second one indistinguishable in the
  // transcript from a genuine placement complaint.
  const z = c.sized || [0, 0];
  const w = a[2] + z[0];
  const hh = a[3] + z[1];
  const x = a[0] + h[0] - z[0] / 2 + (moved ? moved[0] : 0);
  const y = a[1] + h[1] - z[1] / 2 + (moved ? moved[1] : 0);
  stage.setAttribute("viewBox", vb.join(" "));
  // An invisible rectangle carrying the same fingertip of slack the hit test
  // allows, so the region that opts out of scrolling is the region that answers
  // to a grab. A transparent fill is hit-tested; a fill of none would not be.
  // The slack stays per-frame because it is in page units and the two framings
  // are different page-unit widths.
  const t = vb[2] / 30;
  place(hitEl, x - t, y - t, w + 2 * t, hh + 2 * t);
  place(boxEl, x, y, w, hh);
  if (drawn) {
    place(mineEl, drawn[0], drawn[1], drawn[2], drawn[3]);
    mineEl.setAttribute("visibility", "visible");
  } else {
    mineEl.setAttribute("visibility", "hidden");
  }
}

// The viewBox aspect is the crop's own and the element is laid out at width:100%
// with height:auto, so the fit is exact in both axes and one scalar — page units
// per CSS pixel — is the whole mapping from a finger to the print.
function ptIn(e) {
  const r = stage.getBoundingClientRect();
  const vb = framing();
  const k = vb[2] / r.width;
  return [vb[0] + (e.clientX - r.left) * k, vb[1] + (e.clientY - r.top) * k];
}

let from = null;

// A drag is only a move if it began on the rectangle. Anywhere else on the paper
// the gesture belongs to the page, because on a phone the commonest thing a finger
// does over a large image is scroll past it — and a tool that reads that as "the
// mark goes here" writes a placement nobody made, which is worse than recording
// nothing at all. The tolerance is a fingertip's worth of slack around the edge.
function onRect(p) {
  const c = DECK[at];
  const a = c.at;
  // Where the rectangle is now, not where it shipped — a correction the reader has
  // already made moves the thing they will reach for next.
  const h = c.held || [0, 0];
  const z = c.sized || [0, 0];
  const x = a[0] + h[0] - z[0] / 2;
  const y = a[1] + h[1] - z[1] / 2;
  const t = framing()[2] / 30;
  return p[0] >= x - t && p[0] <= x + a[2] + z[0] + t &&
         p[1] >= y - t && p[1] <= y + a[3] + z[1] + t;
}

stage.addEventListener("pointerdown", function (e) {
  const p = ptIn(e);
  if (!drawing && !onRect(p)) return;   // the page keeps this gesture
  try { stage.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
  from = p;
  if (drawing) drawn = [from[0], from[1], 0, 0];
  else moved = [0, 0];
  e.preventDefault();
});
stage.addEventListener("pointermove", function (e) {
  if (!from) return;
  const p = ptIn(e);
  if (drawing) drawn = [Math.min(from[0], p[0]), Math.min(from[1], p[1]),
                        Math.abs(p[0] - from[0]), Math.abs(p[1] - from[1])];
  else moved = [p[0] - from[0], p[1] - from[1]];
  paint();
});
stage.addEventListener("pointerup", function () {
  if (!from) return;
  from = null;
  const r3 = function (v) { return Math.round(v * 1000) / 1000; };
  if (drawing) {
    if (drawn && drawn[2] > 0.3 && drawn[3] > 0.3) {
      say("intended-ink", { box: drawn.map(r3) });
      drawing = false;
      $("draw").setAttribute("aria-pressed", "false");
      stage.classList.remove("drawing");
    }
    drawn = null;
  } else {
    if (moved && (Math.abs(moved[0]) > 0.05 || Math.abs(moved[1]) > 0.05)) {
      // Total displacement from the rectangle that ships, not from where this page
      // happened to start it — the reader's answer has to be readable without also
      // knowing which correction built the page.
      const c = DECK[at];
      const total = [(c.held ? c.held[0] : 0) + moved[0], (c.held ? c.held[1] : 0) + moved[1]];
      dropVague("placement", c, "to");
      say("placement", {
        by: [r3(moved[0]), r3(moved[1])],
        to: [r3(c.at[0] + total[0] - c.box[0]), r3(c.at[1] + total[1] - c.box[1])],
      });
      // 'by' is this drag and 'to' is where the rectangle has ended up in total, so
      // a reader who nudges twice is recorded as having nudged twice and as having
      // arrived once. Setting this after the answer is what keeps that true.
      c.held = total;
    }
    moved = null;
  }
  paint();
});
/**
 * A gesture the browser took away.
 *
 * It fires when something outside this page decides the finger meant something
 * else — a scroll, a system edge swipe, a second finger. The half-finished drag is
 * not an answer and must not be banked as one: the reader was interrupted, and
 * recording where their finger happened to be at that moment invents a placement
 * nobody made. So this abandons rather than commits, and repaints, which puts the
 * rectangle back at its last standing position.
 */
stage.addEventListener("pointercancel", function () {
  if (!from) return;
  from = null;
  moved = null;
  drawn = null;
  paint();
});

/* ── the page ──────────────────────────────────────────────────────────── */

const ORDINALS = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];

/**
 * Say which mark is being asked about, before anything is asked.
 *
 * A crop of print carries several marks and often several of the same name, so
 * the question "is this rectangle on the right mark" has no answer until the
 * reader knows which mark is right. The letters say it, and a rank says it when
 * the letters alone cannot: two fathas on one ligature are told apart by which
 * is further right, which is the order the letters are read in and therefore the
 * only order a sentence about them can use.
 *
 * Written with nodes rather than a string of markup because the letters are the
 * print's own text and this page has no business parsing it as HTML.
 */
function identify(c) {
  const box = $("ident");
  box.textContent = "";
  const letters = c.on || c.word;
  if (!letters) return;

  const g = document.createElement("span");
  g.className = "letters";
  g.textContent = letters;
  g.setAttribute("lang", "ar");
  box.appendChild(g);

  // And the whole word the ligature came out of, when there is more of it. Two or
  // three shapes on their own occur all over the mus'haf, so a reader looking from
  // the letters back to the print has nothing to aim at; the word is the thing they
  // recognise. Ninety-one of a hundred and fifteen cards were carrying it already
  // and throwing it away.
  if (c.word && c.on && c.word !== c.on) {
    const w = document.createElement("span");
    w.className = "word";
    w.textContent = c.word;
    w.setAttribute("lang", "ar");
    box.appendChild(w);
  }

  // The mark's own name belongs in all three of these and used to reach only the
  // last. "The second of three, counting from the right" is a sentence about
  // something the reader has not been told the name of, on a card whose whole
  // question is which mark is meant.
  const say = document.createElement("span");
  if (!c.on) {
    // No ligature: the print drew this mark under the word but on no letter of
    // its own, so the word is the narrowest thing that is still true of it.
    say.textContent = "the " + c.name + " here, somewhere in this word — the print puts it " +
                      "on no letter in particular";
  } else if (c.of > 1) {
    say.textContent = "the " + (ORDINALS[c.nth] || c.nth + "th") + " " + c.name + " of " +
                      c.of + " on these letters, counting from the right";
  } else {
    say.textContent = "the only " + c.name + " on these letters";
  }
  box.appendChild(say);
}

function render() {
  if (at >= DECK.length) {
    $("work").hidden = true;
    $("done").hidden = false;
    return;
  }
  const c = DECK[at];
  swapLede();
  $("name").textContent = c.name;
  $("loc").textContent = "page " + c.page + ", line " + c.line +
                         " · " + (at + 1) + " of " + DECK.length;
  identify(c);
  /*
   * How far you got, and nothing else.
   *
   * Somebody who had banked nine answers asked how many that was now, and the page
   * could not tell them — the only number on it is the position of the card in
   * front of you, which goes backwards when you press Back and says nothing about
   * how much of the sitting is behind you. So this is the high-water mark, which is
   * what the transcript already counts as the denominator.
   *
   * It stops there deliberately. No count of what you called wrong, no share, no
   * running verdict: a reader who can see the score answers the score, and this
   * sitting exists to measure their eye rather than train it. Progress is fair
   * game and a tally is not, which is the same line the co-working transcript
   * draws for the same reason.
   */
  $("far").textContent = seen + " of " + DECK.length + " looked at" +
    (seen < DECK.length ? " · " + (DECK.length - seen) + " to go" : " · that is all of them");
  // Nothing said yet, nothing to hand over. Offering it on a blank sitting would
  // bank an empty transcript, which reads downstream exactly like a sitting
  // somebody finished and found nothing wrong in.
  $("hand").parentNode.hidden = said.length === 0;
  $("hint").textContent = drawing
    ? "Drag a rectangle around the ink this mark should be sitting on."
    : "If it is on the right mark, say so. If it is not, say that — and move it only if you can see where it belongs.";
  paint();

  const mine = [];
  for (let i = 0; i < said.length; i += 1) if (said[i].id === c.id) mine.push(i);
  $("said").innerHTML = mine.map(function (i) {
    const e = said[i];
    // A placement with no numbers is a reader saying it is off without saying how far,
    // which is a whole answer on its own — most of them will not want to fit it.
    const detail = e.kind === "placement"
                   ? (e.by ? "by " + e.by[0] + ", " + e.by[1] + " units" : "somewhere else")
                 : e.kind === "intended-ink" ? e.box[2].toFixed(1) + " × " + e.box[3].toFixed(1) + " units"
                 // A sized shape says what it was as well as what it is, because the
                 // answer is the difference and a reader checking their own work
                 // should not have to go and find the original number.
                 : e.kind === "wrong-shape" && e.size
                   ? e.size[0] + " × " + e.size[1] + " units, was " + e.was[0] + " × " + e.was[1]
                 : safe(e.note || "");
    // The button comes first in the row, which is the opposite of where a
    // take-it-back usually goes and is the whole reason it is here. Right-aligned,
    // it landed in the bottom-right corner — the corner Next occupies, one row
    // lower for every answer given — so the reader's thumb arrived at a control
    // that deletes the answer it had just been pressing Next to leave behind.
    return '<li><button data-drop="' + i + '">take it back</button>' +
           '<b>' + (WORDS[e.kind] || e.kind) + '</b><span>' + detail + '</span></li>';
  }).join("");
  const drops = $("said").querySelectorAll("[data-drop]");
  for (let i = 0; i < drops.length; i += 1) {
    drops[i].onclick = function () { retract(Number(this.getAttribute("data-drop"))); };
  }
  // Every answer this card is currently carrying, lit on the button that says it.
  // Without this a reader who pages back has no way to see what they already
  // answered except by reading the list under it, and pressing a button a second
  // time looks like the only way to change their mind rather than the way to take
  // it back.
  press($("right"), standing("looks-right") >= 0);
  // Lit by a nudge as well as by the button — moving the rectangle is saying it is in
  // the wrong place, and a button that stayed dark through it would be denying the
  // answer the reader just gave.
  press($("off"), standing("placement") >= 0);
  press($("shape"), standing("wrong-shape") >= 0);
  press($("skip"), standing("exception") >= 0);
  let odd = standing("print-defect", "other") >= 0;
  for (const r of REASONS) {
    const on = standing("print-defect", r[0]) >= 0;
    if (on) odd = true;
    press($("why-" + r[0]), on);
  }
  // The reasons open themselves on a card that already carries one, so paging back
  // to a mark shows what was said about the print rather than hiding it behind a
  // press the reader has no reason to think is worth making twice.
  if (odd) oddOpen = true;
  press($("print"), odd);
  $("pad").hidden = !padOpen;
  press($("nudge"), padOpen);
  $("nudge").setAttribute("aria-expanded", String(padOpen));
  $("stepv").textContent = step + " units";
  $("stepr").value = String(step);
  $("print").setAttribute("aria-expanded", String(oddOpen));
  $("odd").hidden = !oddOpen;
  $("prev").disabled = at === 0;
}

$("nudge").onclick = function () {
  padOpen = !padOpen;
  render();
};
for (const b of [["mL", -1, 0, 0, 0], ["mR", 1, 0, 0, 0], ["mU", 0, -1, 0, 0], ["mD", 0, 1, 0, 0],
                 ["wM", 0, 0, -1, 0], ["wP", 0, 0, 1, 0], ["hM", 0, 0, 0, -1], ["hP", 0, 0, 0, 1]]) {
  $(b[0]).onclick = function () { nudge(b[1], b[2], b[3], b[4]); };
}
/**
 * The size a press is, as the reader drags it.
 *
 * On every tick, not only when the thumb is let go: the number beside the slider is
 * the only thing saying what the reader is choosing, and a slider whose readout
 * lands after the gesture is one you have to aim twice.
 *
 * It writes the readout rather than calling render, for two reasons. Redrawing the
 * card mid-drag is work nobody asked for, and render is also the thing that writes
 * the slider's own position — which, on a browser that fires input during the drag,
 * would put the value back under the thumb that is still moving.
 */
$("stepr").oninput = function () {
  step = okStep(Number(this.value));
  keepStep(step);
  $("stepv").textContent = step + " units";
};
/**
 * Back to the rectangle that shipped, and the answers go with it.
 *
 * A reader who has nudged their way somewhere wrong needs a way out that is not
 * eight presses of the opposite arrow — and one that leaves nothing behind, because
 * a placement banked and then undone by hand would still be sitting in the
 * transcript claiming this mark needed moving.
 */
$("reset").onclick = function () {
  flush();
  const c = DECK[at];
  for (let i = said.length - 1; i >= 0; i -= 1) {
    if (said[i].id === c.id && (said[i].kind === "placement" || said[i].kind === "wrong-shape")) retract(i);
  }
  c.held = null;
  c.sized = null;
  render();
};

$("closer").onclick = function () {
  closer = !closer;
  this.setAttribute("aria-pressed", String(closer));
  this.textContent = closer ? "Show the whole word" : "Look closer";
  paint();
};

/**
 * Saying it is in the wrong place without being made to say where the right place is.
 *
 * Until this button, the only way to report a misplaced rectangle was to move it, so
 * every complaint cost a correction — and a reader who can see the box is off but is
 * not sure to a tenth of a unit where it should sit had no honest answer to give.
 * That is a bad trade: the count of misplaced marks is the number the whole sitting
 * exists to produce, and the displacements are a bonus on top of it.
 *
 * Pressing it while it is already lit takes the whole complaint back, and that
 * includes any nudging — a rectangle left sitting where the reader dragged it, with
 * nothing in the transcript saying so, is the page contradicting its own record. It
 * is the same gesture as putting it back where it was, and deliberately so.
 */
$("off").onclick = function () {
  const c = DECK[at];
  if (standing("placement") >= 0) {
    flush();
    for (let i = said.length - 1; i >= 0; i -= 1) {
      if (said[i].id === c.id && said[i].kind === "placement") retract(i);
    }
    c.held = null;
    render();
    return;
  }
  say("placement", {});
};

$("shape").onclick = function () { toggle("wrong-shape", {}); };
$("draw").onclick = function () {
  drawing = !drawing;
  this.setAttribute("aria-pressed", String(drawing));
  stage.classList.toggle("drawing", drawing);
  render();
};

/**
 * The odd-print button opens the reasons rather than recording anything itself.
 *
 * It used to be the answer, and it demanded a typed sentence before it would take
 * one — which on a phone means summoning a keyboard to report a strange-looking
 * mark, and a reader mid-sitting does not do that. So the press is now free and
 * the reasons underneath are the answers. Several of them can stand at once, which
 * is the point: a mark can be both unfamiliar and printed over its neighbour, and
 * being made to pick one of those would have thrown away the more interesting half.
 */
$("print").onclick = function () {
  oddOpen = !oddOpen;
  render();
};
$("chips").innerHTML = REASONS.map(function (r) {
  return '<button id="why-' + r[0] + '" aria-pressed="false">' + r[1] + '</button>';
}).join("") + '<button id="why-other">In my own words…</button>';
for (const r of REASONS) {
  $("why-" + r[0]).onclick = function () { toggle("print-defect", { why: r[0], note: r[1] }); };
}
// Typed reasons are not toggles, because each one is a different sentence and
// there is no second press that could mean "the same sentence again". They come
// back off through the list underneath, like every other answer.
$("why-other").onclick = function () {
  ask("What looks wrong with the printed page here?", function (note) {
    if (note) say("print-defect", { why: "other", note: note });
  });
};
// Drawing is a mode the reader entered for one mark and it does not survive a move;
// the framing does, because that is a preference about their eyes rather than about
// this rectangle, and resetting it every card would be a fight.
function go(d) {
  // Anything pressed and not yet banked is banked now, and against the card it was
  // pressed on. A reader who nudges and immediately presses Next is not withdrawing
  // the nudge.
  flush();
  at = Math.max(0, at + d);
  // Reaching a card is what counts as having looked at the one before it, and the
  // last card is only 'seen' once it is left — which is why this is 'at' and not
  // 'at + 1'. A reader parked on the final card has not passed judgement on it yet.
  if (at > seen) { seen = at; keepSeen(seen); }
  // The place is kept separately from the high-water mark, because they answer two
  // different questions: how far the reader has got, and where they are standing.
  // Only the first survived a reload before, which put every returning reader back
  // on card one however far in they were.
  keepAt(at);
  drawing = false;
  // Same reasoning as drawing: the reasons row is a thing the reader opened about
  // one mark. render() opens it again by itself on any card that already carries a
  // reason, so closing it here loses nothing they said.
  oddOpen = false;
  $("draw").setAttribute("aria-pressed", "false");
  stage.classList.remove("drawing");
  render();
}

/**
 * The common answer, and the only button that both records and moves on — because
 * the alternative is a reader clicking twice sixty times to say nothing is wrong.
 *
 * It is deliberately not exclusive with the faults. A reader who says "nothing
 * wrong", looks closer, and then drags the rectangle has said two contradictory
 * things about one mark, and the honest record of that is both of them: the
 * transcript is appended to, never rewritten, and "take it back" is right there if
 * they meant to replace rather than add. The scorer counts the fault and prints the
 * contradiction rather than silently picking, which is the same rule the rest of
 * this instrument follows.
 *
 * It moves on only when it is being said. Pressing it a second time is a reader who
 * has come back to a mark and no longer thinks it is fine, and carrying them forward
 * from there would be answering a question they had just withdrawn.
 */
$("right").onclick = function () { if (toggle("looks-right", {})) go(1); };

/**
 * Banked without a verdict — and the words are optional now.
 *
 * The answer is recorded before the box opens, so a dialog dismissed by a stray
 * thumb costs a sentence rather than the whole answer. Cancelling leaves it
 * standing with no note, which is what "I cannot say" means on its own anyway.
 *
 * It no longer moves on by itself. It is a toggle like the rest, and a card that
 * walked away the moment it was pressed could never show the reader that they had
 * pressed it.
 */
$("skip").onclick = function () {
  if (!toggle("exception", {})) return;
  ask("Anything worth writing down before moving on?", function (note) {
    if (!note) return;
    const i = standing("exception");
    if (i >= 0) retract(i);
    say("exception", { note: note });
  });
};
$("next").onclick = function () { go(1); };
$("prev").onclick = function () { go(-1); };
$("ledeSwap").onclick = function () { chose = isBrief() ? "0" : "1"; keepRead(chose); swapLede(); };

/**
 * Hand the answers over — from the end of the sitting, or from anywhere in it.
 *
 * One path, two buttons, because there was never a reason for these to be two
 * different things and there was a real cost to the second one not existing.
 * A reader nine answers into a hundred-and-seventeen-card sitting had no way to
 * give those nine to anybody: the save control lived inside the panel that only
 * appears once every card is behind you, so the way to hand over an hour was to
 * spend the next five. Now it is offered under every card.
 *
 * Handing over mid-sitting takes nothing away. The answers stay in the browser
 * under the same key, the position is untouched, and pressing it again later
 * writes the whole set again — it is a copy, not a submission, and there is no
 * state in which a reader has to remember whether they already pressed it.
 *
 * The argument only chooses which line the outcome is written on. No backticks in
 * here: this whole block is inside a template literal in the builder.
 */
/**
 * Take the handed-over marks off the deck, and put the reader back on it.
 *
 * Retracted answers are already gone from the transcript — it is the standing set,
 * and retracting splices — so a mark named here is one the reader is still standing
 * behind. That is exactly the arithmetic the builder does when it is told which
 * marks not to deal again, which is the point: the number under the card and the
 * number the next build prints have to be the same number, or one of them is lying.
 *
 * The position moves with the deck rather than being reset. A reader standing on a
 * card lands on that same card if it survived, and on the next surviving one if it
 * did not — being thrown back to the start for having banked their work would be
 * the same insult in the other direction. The high-water mark is recounted the same
 * way: it keeps the marks passed in silence, which are still owed an answer, and
 * loses the ones that have been given away.
 *
 * Returns how many left. No backticks in here — this is inside a template literal.
 */
function retire() {
  const gone = new Set(said.map(function (e) { return e.id; }));
  if (!gone.size) return 0;
  const left = [];
  let passed = 0;
  let land = -1;
  for (let i = 0; i < DECK.length; i += 1) {
    if (gone.has(DECK[i].id)) { GONE.add(DECK[i].id); continue; }
    if (land < 0 && i >= at) land = left.length;
    if (i < seen) passed += 1;
    left.push(DECK[i]);
  }
  const went = DECK.length - left.length;
  if (!went) return 0;
  DECK = left;
  // Past the end when nothing survived at or after where they stood: there is no
  // card to show and render() says so, which is the truth rather than a wrap-around.
  at = land < 0 ? DECK.length : land;
  seen = Math.min(passed, DECK.length);
  keepGone([...GONE]);
  keepSeen(seen);
  keepAt(at);
  render();
  return went;
}

/*
 * Two different counts wear the same word, and mixing them up is how a sitting comes
 * back reading two thousand per cent.
 *
 * On the screen, how many have been looked at is a fact about what is LEFT: the deck
 * shrinks when marks are handed over, so the number under the card has to shrink with
 * it or it goes on counting cards the reader can no longer reach. That is the one
 * retiring recomputes.
 *
 * In the file, it is a fact about the WHOLE SITTING, and it is the denominator of the
 * only rate this instrument produces. Passing a mark without saying anything is itself
 * a verdict — it says nothing is wrong with it — so the rate is answers over marks
 * actually put in front of somebody, and a mark handed over an hour ago was still put
 * in front of them. That number can only ever go up.
 *
 * Everything already retired was answered, so it was looked at; what survives and has
 * been passed is the rest. The two sets do not overlap, because retiring takes its
 * marks out of the second as it puts them into the first. Retiring runs after this,
 * so both halves are read here as they stood when the reader pressed the button.
 *
 * No backticks in here — this is inside a template literal in the builder.
 */
function handOver(mid) {
  flush();
  const doc = { ...HEAD, finished: new Date().toISOString(), seen: GONE.size + seen, said: said, whole: !mid };
  const name = "mark-report-" + HEAD.set + HEAD.slice + "." + HEAD.seed + ".json";
  // Counted before the deck moves under it: this is how many answers the file
  // carries, which is every answer of the sitting and not only the new ones.
  const total = said.length;
  /*
   * Whatever else happened, a file left the page — so what it carried comes off the
   * deck. A reader who downloaded it and never sent it on is in the same position as
   * one who banked it: they are holding the answers, and this sitting is not going to
   * ask for them a second time.
   *
   * Where the outcome is written is decided after retiring rather than before,
   * because retiring the last of the deck ends the sitting, and the line under the
   * card goes away with the card. Writing into it then would put the one sentence
   * that says the work was saved onto a panel nobody is looking at.
   */
  const settle = function (msg) {
    const went = retire();
    const tail = went ? " " + went + " marks come off this sitting" + (DECK.length ? "; " + DECK.length + " left." : " — that was the last of them.") : "";
    const el = $(mid && at < DECK.length ? "handed" : "banked");
    el.hidden = false;
    el.textContent = msg + tail;
  };
  if (!SINK) {
    // No sink means the page was opened as a file, or served by something that
    // only serves. A download is the honest answer, and the reader has to keep it.
    download(doc, name);
    settle("Downloaded " + name + " — keep it, this device has the only other copy.");
    return;
  }
  SINK.artifact(name, doc).then(function (r) {
    const note = lost ? " (" + lost + " lines did not reach it as you gave them; this file has them all.)" : "";
    if (r && r.ok) return settle("Banked " + total + " answers to " + r.path + " — no download needed." + note);
    download(doc, name);
    settle("Could not bank it to the session — downloaded " + name + " instead.");
  }).catch(function () { download(doc, name); settle("Could not reach the session — downloaded " + name + " instead."); });
}

$("save").onclick = function () { handOver(false); };
$("hand").onclick = function () { handOver(true); };

function download(doc, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 1)], { type: "application/json" }));
  a.download = name;
  a.click();
}

// Everything the reader has already said, put back on the page before they see it.
// The transcript is the only record of a correction, so a card is only drawn where
// they left it if something replays it — and the first draw is the one that matters,
// because a card opening at its shipped rectangle reads as work that did not save.
function replay() {
  for (const id of new Set(said.map(function (e) { return e.id; }))) redraw(id);
}

/**
 * Put the reader back where they were, from whatever record still exists.
 *
 * The browser store is not a dependable place to keep a sitting and it should never
 * have been the only one. It is per-origin, so opening this machine by its tailnet
 * name and by its tailnet address are two different memories of the same sitting and
 * neither can see the other; and a browser may drop it whenever it likes. Either way
 * the reader is handed a sitting that has forgotten them, with every answer they gave
 * still sitting safely on the machine that served the page.
 *
 * So the machine is asked. What it has is merged with whatever the browser kept —
 * not preferred over it, because the browser may hold answers given while the machine
 * was asleep, and the machine may hold answers given in a browser that has since
 * forgotten them. Both are partial and neither is authoritative.
 *
 * The place comes last and only if the browser had none: the furthest card carrying
 * an answer, and then one past it, because a reader who answered card forty wants to
 * arrive at forty-one.
 */
function merge(lists, undone) {
  const out = [];
  const have = new Map();
  for (const list of lists) {
    const want = new Map();
    for (const e of list) {
      if (!e || !e.id) continue;
      const s = JSON.stringify(e);
      const n = (want.get(s) || 0) + 1;
      want.set(s, n);
      // Duplicates are real — two nudges of one box are two answers — so this counts
      // rather than de-duplicates, and only appends what a list holds beyond the rest.
      if (n > (have.get(s) || 0)) { out.push(e); have.set(s, n); }
    }
  }
  // The log carries retractions as their own lines while a hand-over has already
  // applied its own, so a retracted answer can arrive back from the log. Applying
  // every retraction at the end takes it out again, whichever list it came from.
  for (const r of undone) {
    for (let i = out.length - 1; i >= 0; i -= 1) {
      if (out[i].id === r.id && out[i].kind === r.was) { out.splice(i, 1); break; }
    }
  }
  return out;
}

function recover() {
  if (!SINK || !SINK.answers) return;
  // The deal, not what is left of it. An answer about a mark this reader has already
  // handed over still belongs in their transcript — dropping it here would shrink the
  // next hand-over, and the next hand-over overwrites the last one under the same name.
  const mine = new Set(CARDS.map(function (c) { return c.id; }));
  SINK.answers("mark-report-" + HEAD.set + HEAD.slice + "." + HEAD.seed + ".json").then(function (r) {
    if (!r || !r.ok) return;
    const here = (r.log || []).filter(function (e) { return e && e.id && mine.has(e.id); });
    const was = said.length;
    said = merge(
      [(r.banked || []).filter(function (e) { return e && e.id && mine.has(e.id); }), said, here],
      here.filter(function (e) { return e.kind === "retracted"; })
    );
    if (said.length === was) return;
    keep(said);
    replay();

    // Only when the browser had nothing to say about it. A reader who has moved around
    // this sitting today should not be thrown to the end of what they did yesterday.
    if (at === 0) {
      let last = -1;
      for (const e of said) last = Math.max(last, DECK.findIndex(function (c) { return c.id === e.id; }));
      at = Math.max(0, Math.min(last + 1, DECK.length - 1));
      if (at > seen) { seen = at; keepSeen(seen); }
      keepAt(at);
    }
    render();
    $("far").textContent += " · " + (said.length - was) + " answers came back from the session";
  }).catch(function () { /* the page works without it, as it did before */ });
}

replay();
render();
recover();
</script>
</body>
</html>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(
  `${HEAD.pool} of ${HEAD.of} marks in the ${set} set` +
    (HEAD.alreadyAnswered ? ` · ${HEAD.alreadyAnswered} already answered, left out` : "") +
    ` · ${cards.length} drawn · displacements ${rowsFp}`,
);
console.log(`  drawn by ${Object.entries(HEAD.drawnBy).map(([k, v]) => `${k} ${v}`).join(", ")}`);

/**
 * What this many marks can and cannot find — printed before the sitting rather than
 * discovered after it. With n answers and nothing wrong in any of them, the rule of
 * three puts the upper bound on the true rate at about 3/n; a sitting of 60 that
 * comes back clean has shown the failure rate is under roughly 5%, and has shown
 * nothing whatever about whether it is 1% or 0.01%.
 *
 * This is here because a clean sitting is exactly the result somebody will want to
 * quote as "we checked it", and the honest version of that sentence has a number in
 * it. The instrument that will be over-read is the one that has to say so itself.
 */
console.log(`  a clean sitting of ${cards.length} bounds the failure rate at about ${((3 / cards.length) * 100).toFixed(1)}% — not at zero`);
console.log(`wrote ${out.replace(`${ROOT}/`, "")}`);
