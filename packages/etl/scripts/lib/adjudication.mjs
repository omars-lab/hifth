/**
 * The session a person actually works: which marks, shown how, and what the
 * right answer was.
 *
 * ## Why it is a forced choice and not a review
 *
 * The obvious tool here is a list of the machine's verdicts with an "agree /
 * disagree" beside each one. That tool cannot produce evidence. A person handed
 * a verdict and asked whether they agree agrees — the verdict is the anchor,
 * the machine sounds confident, and the honest answer to "does this rectangle
 * look right" is usually "I suppose so". What comes back is the machine's own
 * opinion with a human name on it.
 *
 * So the person is never shown a verdict. They are shown one mark and two
 * rectangles, told nothing about either, and asked which one sits on it. One of
 * the two is the corrected placement. If the correction is right, people pick it
 * far more often than half the time; if it is wrong, they do not. Nobody has to
 * be asked whether they trust anything.
 *
 * ## What is in a session, and why each part is there
 *
 * Four kinds of trial, mixed together and indistinguishable while you work:
 *
 * - **as shipped** — the corrected rectangle against the one the app holds
 *   today. This is the question. Everything else exists to make its answer
 *   readable.
 * - **a decoy** — the corrected rectangle against one displaced by the *same
 *   distance* in some other direction. Two jobs. It measures whether a person
 *   can see a displacement this small at all, which is the yardstick the first
 *   number has to be read against; and it breaks the pattern. Without it every
 *   right answer sits the same way on the screen, because the error is in the
 *   same direction on every page, and after twenty trials a person is answering
 *   from the pattern rather than from the ink.
 * - **a catch** — the corrected rectangle against one a whole letter away.
 *   Anybody looking gets these right. Somebody clicking does not, and a session
 *   that fails them is discarded rather than argued about.
 * - **twins** — the same rectangle twice. There is no right answer and "I can't
 *   tell" is the only honest response, which is the one thing that catches a
 *   person who always picks something.
 *
 * ## Where the answers live
 *
 * Nowhere. The plan is a pure function of the seed and the measured
 * displacements, so the scorer rebuilds it from those two rather than reading a
 * key off disk. The page a person works holds no answers, and there is no file
 * to accidentally open, hand over, or check in.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rasterise, readPageInk } from "./ink.mjs";
import { rng } from "./mark-ink.mjs";
import { marksOf } from "./marks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const PAGES = join(REPO, "apps", "web", "public", "assets", "pages", "hafs-kfqc");

/** Samples per page unit, as the placement measurement uses. */
export const RES = 16;

/**
 * How much of the corrected rectangle has to be ink before a mark is worth
 * asking about.
 *
 * The placement measurement calls a rectangle blank below 2%. That is the floor
 * for "there is something here at all"; this is a higher bar, for "there is
 * enough here that a person can see what they are being asked about". A mark
 * that is four samples of ink in the corner of its box is a trial about
 * eyesight rather than about placement.
 */
const INK_FLOOR = 0.1;

/**
 * How far a catch trial's wrong rectangle goes: unmissable, or it catches
 * nobody. Bounded above by the panel window, since a rectangle that fell off the
 * edge would be a different question — "which panel has two rectangles" — and an
 * even easier one.
 */
const CATCH_UNITS = 4.5;

/**
 * Every panel is the same window on the page, wide enough that a catch stays
 * inside it. Fixed rather than fitted to the pair of rectangles, because a
 * window that grew when the rectangles were far apart would announce the catch
 * trials by their zoom level before a person had looked at the ink.
 */
export const windowFor = ([, , w, h]) => Math.max(w, h) + 14;

const TAU = Math.PI * 2;

/**
 * Where the mark rows and the shipped ink come from.
 *
 * Injected rather than imported at the call site for one reason: both readers
 * want the ligature-corpus cache and the shipped pages, which are hundreds of
 * megabytes of gitignored download, and a session planner that could only be
 * exercised on a machine that had them is a session planner nobody tests. With
 * these as arguments the trial arithmetic — the mix, the angles, the balance of
 * left and right — can be checked against a handful of made-up marks.
 */
export const readers = {
  marksFor: marksOf,
  inkFor: (page) => readPageInk(readFileSync(join(PAGES, `${page}.svg`), "utf8"), 1 / (4 * RES)).shapes,
};

const inkFraction = (shapes, [x, y, w, h]) => {
  const cols = Math.max(1, Math.round(w * RES));
  const rows = Math.max(1, Math.round(h * RES));
  const mask = rasterise(shapes, x, y, cols, rows, RES);
  let on = 0;
  for (let i = 0; i < mask.length; i += 1) if (mask[i]) on += 1;
  return on / mask.length;
};

/**
 * Exactly the mix asked for, then shuffled — rather than each trial drawing its
 * own kind at random, which would leave a short session with three catches or
 * none and no way to say which happened.
 */
function kindOrder(n, rand) {
  const catches = Math.max(3, Math.round(n * 0.12));
  const twins = Math.max(2, Math.round(n * 0.08));
  const rest = Math.max(0, n - catches - twins);
  const decoys = Math.round(rest * 0.44);
  const kinds = [
    ...Array(catches).fill("catch"),
    ...Array(twins).fill("twin"),
    ...Array(decoys).fill("decoy"),
    ...Array(rest - decoys).fill("shipped"),
  ];
  for (let i = kinds.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  return kinds;
}

const shuffled = (xs, rand) => {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Candidates, taken a page at a time in rotation.
 *
 * Round-robin rather than a shuffle of everything, because a plain shuffle over
 * 40 pages of 500 marks gives a session that is mostly a handful of pages, and
 * the question is about a per-page correction. Every page that has one should be
 * asked about.
 */
function pool(shifts, want, rand, io) {
  const perPage = new Map();
  for (const s of shuffled(shifts, rand)) {
    const ms = shuffled(io.marksFor(s.page), rand);
    perPage.set(s.page, { shift: s, marks: ms, at: 0 });
  }
  const inks = new Map();
  const out = [];
  let exhausted = 0;
  let blank = 0;
  while (out.length < want && exhausted < perPage.size) {
    exhausted = 0;
    for (const [page, st] of perPage) {
      if (out.length >= want) break;
      if (st.at >= st.marks.length) {
        exhausted += 1;
        continue;
      }
      if (!inks.has(page)) inks.set(page, io.inkFor(page));
      const shapes = inks.get(page);
      let taken = null;
      while (st.at < st.marks.length && !taken) {
        const m = st.marks[st.at];
        st.at += 1;
        const [x, y, w, h] = m.box;
        const corrected = [x + st.shift.dx, y + st.shift.dy, w, h];
        if (inkFraction(shapes, corrected) >= INK_FLOOR) taken = { mark: m, shift: st.shift };
        else blank += 1;
      }
      if (taken) out.push(taken);
    }
  }
  return { candidates: out, skippedForInk: blank };
}

/**
 * @param seed    any integer; the same seed and the same displacements rebuild
 *                the same session, answers included.
 * @param count   how many trials. A hundred takes about fifteen minutes and puts
 *                the interval on the headline number at roughly ±10 points.
 * @param shifts  `[{page, dx, dy}]` — the measured displacement per page, which
 *                is the thing being put on trial.
 */
export function planSession({ seed, count, shifts, io = readers }) {
  const rand = rng(seed);
  const kinds = kindOrder(count, rand);
  const { candidates, skippedForInk } = pool(shifts, kinds.length, rand, io);
  if (candidates.length < kinds.length) {
    throw new Error(`only ${candidates.length} marks passed the ink floor; asked for ${kinds.length}`);
  }
  const trials = candidates.map((cand, i) => {
    const kind = kinds[i];
    const { dx, dy } = cand.shift;
    const right = [dx, dy];
    const mag = Math.hypot(dx, dy) || 1;
    let other;
    if (kind === "shipped") other = [0, 0];
    else if (kind === "twin") other = [dx, dy];
    else {
      // A decoy moves the same distance the correction does; a catch moves far
      // enough that the rectangle is plainly on a different letter.
      const dist = kind === "catch" ? CATCH_UNITS : mag;
      let th = 0;
      const away = Math.atan2(-dy, -dx); // the direction "as shipped" lies in
      for (let t = 0; t < 8; t += 1) {
        th = rand() * TAU;
        const gap = Math.abs(((th - away + Math.PI) % TAU) - Math.PI);
        if (kind === "catch" || gap > Math.PI / 6) break;
      }
      other = [dx + dist * Math.cos(th), dy + dist * Math.sin(th)];
    }
    const rightFirst = rand() < 0.5;
    return {
      i,
      id: `p${cand.mark.page}k${cand.mark.k}`,
      kind,
      page: cand.mark.page,
      k: cand.mark.k,
      name: cand.mark.name,
      surah: cand.mark.surah,
      aya: cand.mark.aya,
      idx: cand.mark.idx,
      box: cand.mark.box,
      d: cand.mark.d,
      fit: cand.mark.fit,
      slots: rightFirst ? [right, other] : [other, right],
      // Which panel holds the corrected rectangle. Null for twins, where both do
      // and neither answer is wrong.
      answer: kind === "twin" ? null : rightFirst ? 0 : 1,
      // Framing wobble, so the corrected rectangle is not always dead centre of
      // its panel — which would give the whole thing away in three trials.
      jitter: [(rand() - 0.5) * 1.6, (rand() - 0.5) * 1.6],
    };
  });
  return { trials, skippedForInk, pages: new Set(trials.map((t) => t.page)).size };
}

/**
 * How far the rectangle starts from where the app draws it today: a fixed
 * distance, in a direction that is different every trial.
 *
 * Three things ride on the number. It has to be well clear of both placements a
 * forced choice would have offered — they sit about one unit apart — or somebody
 * could land on an answer by not moving, and "I left it alone" would score as
 * agreement. It has to leave the rectangle inside its window with room to spare,
 * or the trial becomes a hunt for a clipped box rather than a judgement about
 * ink. And the *direction* has to be spread evenly, because a hand stops short
 * of where the eye says — every hand does — which drags the landing back toward
 * wherever it started. Spread evenly, that drag cancels in the average and can
 * be measured; pointed the same way each time, it would be baked into the answer
 * as if it were a property of the boxes.
 */
export const START_R = 3;

/**
 * How many trials apart a mark's two showings must be.
 *
 * The pair exists to measure the reader's own precision — put the same box
 * twice, see how far apart the two landings fall — and that is only a precision
 * measurement if the second placement is a fresh judgement rather than a
 * remembered one.
 */
export const REPEAT_GAP = 10;

/**
 * Which pages a session is allowed to ask about.
 *
 * ## Why this is a separate step and not a shuffle
 *
 * The first placing session drew its marks from every page that had a measured
 * correction, which at the time was forty of them — the same forty the correction
 * had been fitted on. That made it an in-sample check by construction, and it made
 * the *size* of the correction unmeasurable for a second reason nobody noticed
 * until afterwards: across those forty pages the proposed move barely varied, and
 * a regression of the residual on a quantity that does not vary has no leverage.
 * The gain came out -0.10 ± 0.68. "Exactly right" and "a fifth short" were the
 * same answer.
 *
 * Over all 604 pages the move does vary — the across component spans 1.75 units
 * where the original forty spanned 0.31. So the two defects have one fix, and it
 * is a choice of pages rather than a bigger session: **take pages the correction
 * has never been checked on, and take them from the ends of the range rather than
 * at random.** Sampling the ends is what buys the leverage; a random draw from 604
 * pages would mostly return the middle, which is the sample that already failed.
 *
 * ## Why the answer is written down rather than recomputed
 *
 * The scorer rebuilds a session from the seed and the displacements alone. If the
 * builder filtered those displacements and the scorer did not, every trial index
 * would point at a different mark and the arithmetic would be confident nonsense.
 * The scorer could re-run this function — but then a change here silently
 * re-scores every sitting ever banked against it. So the *result* travels in the
 * session head: an ordered list of page numbers, which the scorer replays. This
 * function is how the list is chosen; it is not what makes the reading reproduce.
 *
 * @param shifts   `[{page, dx, dy}]` — every page with a measured correction.
 * @param exclude  page numbers to drop: the pages the correction was fitted on,
 *                 so what is left is genuinely held out.
 * @param pages    how many to return. More than are eligible returns all of them.
 * @param spread   `"extremes"` takes from both ends of both axes — the pages that
 *                 carry the leverage. `"all"` keeps every eligible page, which is
 *                 what a coverage block wants and what the old behaviour was.
 * @returns page numbers, ascending. Ascending because it is read by people; the
 *          order is preserved into the head either way, and the shuffle inside
 *          `pool` is what actually decides who gets asked first.
 */
export function selectPages({ shifts, exclude = [], pages, spread = "extremes" }) {
  const drop = new Set(exclude);
  const eligible = shifts.filter((s) => !drop.has(s.page));
  if (spread === "all" || !(pages > 0) || pages >= eligible.length) {
    return eligible.map((s) => s.page).sort((a, b) => a - b);
  }
  // Ties broken by page number throughout, so the same input always gives the
  // same list on any engine. A sort that is only *nearly* total is a
  // reproducibility bug that shows up once, months later, on someone else's node.
  const by = (k) => (a, b) => a[k] - b[k] || a.page - b.page;
  const taken = new Set();
  const take = (rows, n) => {
    for (const r of rows) {
      if (taken.size >= pages || n <= 0) break;
      if (taken.has(r.page)) continue;
      taken.add(r.page);
      n -= 1;
    }
  };
  const quarter = Math.max(1, Math.floor(pages / 4));
  const dx = eligible.slice().sort(by("dx"));
  take(dx, quarter);
  take(dx.slice().reverse(), quarter);
  const dy = eligible.slice().sort(by("dy"));
  take(dy, quarter);
  take(dy.slice().reverse(), quarter);
  // Whatever is left over goes to the pages furthest from the middle of the
  // measured cloud, which is the same principle the four tails above apply one
  // axis at a time. Rounding is why there is a remainder at all: four quarters of
  // an odd number do not add up, and the leftovers should not fall to the centre
  // by default.
  const mid = (k) => {
    const v = eligible.map((s) => s[k]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  const [mx, my] = [mid("dx"), mid("dy")];
  const far = eligible
    .map((s) => ({ ...s, d: Math.hypot(s.dx - mx, s.dy - my) }))
    .sort((a, b) => b.d - a.d || a.page - b.page);
  take(far, pages - taken.size);
  return [...taken].sort((a, b) => a - b);
}

/**
 * A session of the other kind: no choosing, only placing.
 *
 * The forced choice can say *our correction is preferred to what ships*. It can
 * never say *by how much*, nor *in which direction it is still wrong*, because
 * the only two answers on offer are the two we thought of. This asks the
 * question the other way round: here is a mark and a rectangle that starts in
 * the wrong place; put it where it goes. Where it lands is a measurement, and
 * subtracting our correction from it gives the residual — the number that would
 * actually change the boxes.
 *
 * It is a separate program from the forced choice, and has to be. Dragging a box
 * into place inside a two-panel trial *is* the answer key: whichever panel the
 * landing is nearer is by construction the one we called right, and the blinding
 * is gone. Adjusting after answering leaks nearly as badly across a session,
 * since the correction points the same way on almost every page and a reader
 * learns that direction long before the trials run out.
 *
 * @param seed    any integer; the same seed and the same displacements rebuild
 *                the same session.
 * @param count   how many placements, repeats included.
 * @param shifts  `[{page, dx, dy}]` — the measured displacement per page. Used
 *                to pick marks that have ink under them, and kept on each trial
 *                so the scorer can subtract it. It is never sent to the page.
 */
export function planNudge({ seed, count, shifts, io = readers }) {
  const rand = rng(seed);
  const repeats = Math.min(Math.max(3, Math.round(count * 0.15)), Math.floor(count / 2));
  const distinct = Math.max(1, count - repeats);
  const { candidates, skippedForInk } = pool(shifts, distinct, rand, io);
  if (candidates.length < distinct) {
    throw new Error(`only ${candidates.length} marks passed the ink floor; asked for ${distinct}`);
  }
  const wobble = () => {
    const th = rand() * TAU;
    return {
      start: [START_R * Math.cos(th), START_R * Math.sin(th)],
      // Framing wobble, for the same reason the forced choice has one: a window
      // centred on the shipped rectangle would make the centre of the panel a
      // free answer, and a reader would be aiming at the frame rather than at
      // the ink.
      jitter: [(rand() - 0.5) * 2.4, (rand() - 0.5) * 2.4],
    };
  };
  const showing = (cand, repeat) => ({
    id: `p${cand.mark.page}k${cand.mark.k}`,
    page: cand.mark.page,
    k: cand.mark.k,
    name: cand.mark.name,
    surah: cand.mark.surah,
    aya: cand.mark.aya,
    idx: cand.mark.idx,
    box: cand.mark.box,
    d: cand.mark.d,
    fit: cand.mark.fit,
    // Who the trial is about, as opposed to where the answer is. The word it
    // sits in, the letters the corpus drew it on, and which of that word's marks
    // of this name it is, counting from the right.
    //
    // None of this is the answer and all of it is needed. A crop of print this
    // size carries several marks and often two of the same name; without a way
    // to say which one, a reader either guesses or places the rectangle on the
    // wrong mark, and a placement on the wrong mark is a whole-letter error
    // recorded as a registration error. The identification separates candidates
    // a letter apart; the measurement is a fraction of a letter, and nothing
    // here narrows that.
    hafs: cand.mark.hafs ?? null,
    lig: cand.mark.lig ?? null,
    nth: cand.mark.nth ?? 1,
    of: cand.mark.of ?? 1,
    // What the machine says the correction is, relative to the shipped box.
    // The builder strips it; only the scorer ever reads it.
    shift: [cand.shift.dx, cand.shift.dy],
    repeat,
    ...wobble(),
  });
  const out = shuffled(candidates, rand).map((c) => showing(c, 0));
  // Second showings are inserted, not appended. A precision estimate built
  // entirely out of the last fifteen trials measures the end of an hour rather
  // than a hand, and it is the hand the rest of the arithmetic is divided by.
  // For the same reason the *first* showings are drawn from across the session
  // rather than off the top of it.
  const eligible = out.slice(0, Math.max(1, out.length - REPEAT_GAP));
  for (const first of shuffled(eligible, rand).slice(0, repeats)) {
    const at = out.indexOf(first);
    const lo = at + REPEAT_GAP;
    const put = lo >= out.length ? out.length : lo + Math.floor(rand() * (out.length - lo + 1));
    out.splice(put, 0, { ...first, repeat: 1, ...wobble() });
  }
  const trials = out.map((t, i) => ({ i, ...t }));
  return { trials, repeats, skippedForInk, pages: new Set(trials.map((t) => t.page)).size };
}

/**
 * The four things that have to match before two sittings can be compared.
 *
 * A second reader is only evidence if they answered the *same* questions. The
 * trial list is rebuilt from the seed rather than stored, so two rulings can look
 * alike in every visible field and still be lists of different marks — and
 * nothing would throw, because every trial index would resolve. The differences
 * would simply be subtractions of unrelated numbers, and they would come out
 * looking like two readers who disagree wildly.
 *
 * So each input to the rebuild is checked by name, and each one is reported with
 * what it would have done, because "seed differs" is a fact and "different seeds
 * build different trial lists" is the reason it matters.
 *
 * The fifth check is the opposite shape and just as load-bearing: two rulings
 * that agree on all four but also agree on the *reader* are one person compared
 * with themselves. That returns beautiful agreement and answers nothing, which
 * makes it the one failure here that would never be caught by reading the output.
 *
 * @returns `[{field, why}]` — empty when the two may be compared.
 */
export function sameBuild(a, b) {
  const out = [];
  const check = (field, why, get = (r) => r[field]) => {
    if (String(get(a) ?? "") !== String(get(b) ?? "")) out.push({ field, why });
  };
  check("kind", "these are not both placing sessions");
  check("seed", "different seeds build different trial lists");
  check("count", "different lengths build different trial lists");
  check("shiftFingerprint", "these were placed against different displacements");
  check("select.fp", "these were built over different pages", (r) => r.select?.fp);
  if (!out.length && (a.reader ?? "A") === (b.reader ?? "A")) {
    out.push({ field: "reader", why: "both of these are the same reader, so this compares a hand with itself" });
  }
  return out;
}
