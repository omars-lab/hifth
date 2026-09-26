import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APPLE_SCRUB_BANDS,
  focusSpread,
  labelBoth,
  markerEmphasisDock,
  nearestPage,
  pageBarFocus,
  pageFraction,
  pageRuns,
  pageTickStep,
  scrubAdvance,
  scrubRateSlowAway,
  stripPxPerPage,
  tapButtonDetent,
} from "@hifth/core";
import { useT } from "../i18n";
import { useMediaQuery } from "../useMediaQuery";
import styles from "./PageSlider.module.css";

// The winning detent strategy, graduated (docs/decisions/page-bar.md §"when a
// reader lets go near a marker"): a marker is a button, the drag is untouched,
// and the marker grows as the pointer nears it. The bar imports only C — the
// losing strategies stay in the core module, kept tryable on the decision page
// by the graduation-losers decision (option A), and never reached from here.
const EMPHASIS = tapButtonDetent.emphasis ?? { near: 0, peak: 1 };

// The fisheye lens (option B, graduated · docs/decisions/page-bar.md §"How does a
// reader find one juz among thirty on a bar this small?"): how far the spread
// reaches, its curve, and how many pages either side of the pointer get their juz
// named. Since 2026-09-25 the bar uses a stronger curve than the decision page drew
// (docs/design/page-bar-zoom-plan.md, step 1), so single pages open wide enough to
// mark beside the pointer; the decision page keeps the curve that was chosen on.
const LENS = pageBarFocus;

// The phone's scrub (option D, graduated · docs/decisions/page-bar-phone-scrub.md):
// sliding the thumb up while dragging slows the knob to half, a quarter, then a
// tenth, at Apple's heights, and a strip of page marks above the thumb zooms in as
// it slows. The strip is STRIP_MAGNIFY times the bar at full speed, so it shows
// every 5th page at full and half speed and single pages from a quarter on. The
// bar imports only D's pieces; A to C stay on the decision page.
const SCRUB_BANDS = APPLE_SCRUB_BANDS;
const STRIP_MAGNIFY = 5;
const STRIP_MAX_W = 300;
const SPEED_NAMES = { 1: "full", 0.5: "half", 0.25: "quarter", 0.1: "tenth" } as const;
const speedName = (rate: number): "full" | "half" | "quarter" | "tenth" =>
  SPEED_NAMES[rate as keyof typeof SPEED_NAMES] ?? "full";

/** A phone drag in progress: where the knob and thumb are, in track pixels from its left. */
interface PhoneDrag {
  pos: number;
  fingerX: number;
  off: number;
  rate: number;
}

interface PageSliderProps {
  /**
   * How long the book is — the printed edition's page count, not the number of
   * pages this build vendored. A slider that spans only what is vendored told a
   * hafiz, for the six loops before 4b, that the mus'haf was three pages long.
   * The two numbers agree for `hafs-kfqc` now and this is still two parameters,
   * because the next edition to be vendored arrives partial the way this one did.
   */
  total: number;
  /** The pages this build actually has, ascending. Empty until the manifest lands. */
  available: readonly number[];
  /** The page currently on the stage. */
  page: number;
  /** One page earlier (−1) or later (+1) among the vendored pages. */
  onStep: (step: 1 | -1) => void;
  /**
   * Land on a page. `landed` is always a page we hold; `asked` is where the
   * thumb was let go, so the caller can say so when the two differ.
   */
  onGoTo: (landed: number, asked: number) => void;
  /**
   * The page each of the 30 juz opens on — the green detents drawn along the
   * track, the coarse landmarks a hafiz reads the book by. One slot per juz in
   * order, and `null` for a juz no vendored page carries, so the drawn detent
   * still knows its own juz number by position. Optional: an empty (or all-null)
   * list draws no detents, and the bar is the plain page scrubber it was.
   */
  juzStarts?: readonly (number | null)[];
  /**
   * The page each of the 60 hizb opens on, in the same shape as `juzStarts`.
   * Only the magnifier reads it: it marks a hizb start between the juz cuts,
   * so a reader can see which half of a juz the pointer is in.
   */
  hizbStarts?: readonly (number | null)[];
  /**
   * Where a page sits in the book, for the scrub readout: the surah at its head,
   * the juz already *running* onto it, and the juz that *begins* on it when one
   * does (`null` otherwise). The bar names a boundary page for both juz — the
   * decided answer — so it takes both numbers and lets the shared boundary rule
   * pick one or a hand-off. A function, not a table, because the caller owns the
   * mapping: it holds the manifest, the bar does not. `null` for a page it cannot
   * place (outside the vendored inventory), which leaves that line off the popover.
   */
  pageContext?: (page: number) => { surah: number; running: number; beginsHere: number | null } | null;
  /**
   * Open the juz a marker stands for — the graduated tap-button (option C). A tap
   * on a detent asks the caller to jump to that juz's opening; the drag is not
   * touched. Optional: without it the detents draw but do nothing, the plain
   * landmarks they were before the decision.
   */
  onJuzTap?: (juz: number) => void;
  /**
   * Spread the bar apart under the pointer — the graduated fisheye (option B,
   * docs/decisions/page-bar.md §"How does a reader find one juz among thirty on a
   * bar this small?"). On a pointer that can hover, the juz landmarks near the
   * cursor fan out far enough to read their numbers, and the exact page under the
   * cursor is named in the bar. A hover affordance only: a finger has no "near
   * without pressing", so on a touch screen this changes nothing. Off, the bar is
   * the plain grow-on-approach scrubber (option C alone). Defaults on — the
   * behaviour the decision chose; the settings sheet is where it is turned off.
   */
  fisheye?: boolean;
}

/**
 * PageSlider — the page bar: scrub the whole mus'haf, with a page turn on each
 * edge.
 *
 * ## Why the track is the print and not the inventory
 *
 * The two numbers here are different things and the bar shows both. The track
 * spans the *print* — 604 pages, the length of the book in the reader's hands —
 * because a control that spanned the vendored inventory would quietly redefine
 * the mus'haf as whatever happens to be in `public/assets` this week. The runs
 * on the track and the count beneath show the *inventory*, and releasing the
 * thumb in a gap lands on the nearest page we have and **announces that it did**
 * (`nearestPageN`). Silently landing somewhere else is the failure mode this bar
 * is built around.
 *
 * This bar was designed against three vendored pages of 604, where the gap was
 * everywhere and the snap fired on nearly every drag. Loop 4b filled it in, and
 * the honest reading is not that the snap is over but that it became the
 * exception it always should have been — reachable through an edition vendored
 * partially, and through an eviction that takes a page back. Both parameters
 * stayed; what changed is which value they usually hold.
 *
 * ## Direction
 *
 * `dir="rtl"`, pinned, in both UI languages — the bar is mus'haf furniture, like
 * the stage and the trail. So page 1 sits at the **right**, the previous-page
 * button is on the right edge and the next-page button on the left, and dragging
 * leftward moves forward through the book. This is the same convention Loop 1
 * recorded and `appKeyAction` encodes as ArrowLeft = +1 page.
 *
 * ## Commit on release, not on every value
 *
 * Each page is a ~170 KB inline SVG, so navigating on every intermediate value
 * of a drag would mount hundreds of pages. React's `onChange` on a range input
 * is the *input* event (every value), so the commit hangs off a natively
 * attached `change` listener instead — which fires on pointer release, and once
 * per keystroke. Between the two, `scrub` drives a local readout so the drag
 * still feels live and tells you where you would land before you let go.
 *
 * ## The arrow keys are ours
 *
 * A range input's own arrows step by `step`, which here is one page of a
 * 604-page track — so inside a sparse inventory every keypress would snap
 * straight back to where it started. We take the arrows and step *between
 * vendored pages* instead. That is now ±1 for `hafs-kfqc` and identical to what
 * the input would have done by itself, which is exactly why it is worth keeping:
 * the two agree by coincidence of the inventory, not by construction.
 * `appKeyAction` stands down on its own while this input has focus (rule 2:
 * focus in a text field), so nothing double-steps.
 */
export function PageSlider({
  total,
  available,
  page,
  onStep,
  onGoTo,
  juzStarts = [],
  hizbStarts = [],
  pageContext,
  onJuzTap,
  fisheye = true,
}: PageSliderProps): JSX.Element {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  // The layer the fisheye draws its labels into — juz numbers fanned open under
  // the pointer and the page beneath it. Drawn imperatively by the effect below,
  // from the same warped positions the markers take.
  const lensRef = useRef<HTMLDivElement>(null);
  // True from the pointerdown that starts a drag until its release. The marker
  // growth reads this: it must never fire mid-drag, or a swollen button would
  // sit under a thumb that is only passing through — the one thing option C's
  // refinement promised it would not do.
  const draggingRef = useRef(false);
  // Non-null only mid-drag: where the thumb is, before anything has been asked
  // of the stage.
  const [scrub, setScrub] = useState<number | null>(null);
  // Non-null only mid-drag on a phone: the knob, the thumb and the speed, which
  // the readout and the strip of page marks above the thumb are drawn from.
  const [phone, setPhone] = useState<PhoneDrag | null>(null);
  const phoneRef = useRef<(PhoneDrag & { lastX: number }) | null>(null);

  // Whether this pointer can hover — a mouse or trackpad, not a finger. The
  // grow-on-approach is a hover effect; a touch device has no "near without
  // pressing", so there the markers stay their plain size and are simply tapped.
  // This is exactly the split the decision named: the refinement answers the
  // phone's fixed-target cost, and the phone is the device it does not run on.
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");

  // What the imperative lens reads, kept current without re-subscribing the
  // pointer listeners on every render. `t` is a fresh object each render and
  // `total` never changes, so threading them through the effect's deps would
  // either churn the listeners or freeze a stale copy — the handlers read the
  // latest here instead.
  const liveRef = useRef({ t, total, juzStarts, hizbStarts, fisheye });
  liveRef.current = { t, total, juzStarts, hizbStarts, fisheye };

  const empty = available.length === 0;
  const value = scrub ?? page;
  // Memoised on the inventory, not recomputed per scrub value: `scrub` changes
  // for every value the thumb passes over, and the inventory does not change
  // during a drag at all.
  const runs = useMemo(() => pageRuns(available), [available]);
  const landing = scrub === null ? null : nearestPage(available, scrub);
  // Where the thumb is over the book — its juz and the surah at that page's head
  // — named in the popover so a scrub is read in the book's own landmarks, not
  // only in a page number. Null off the vendored inventory, which just drops the
  // line rather than guessing.
  const context = scrub === null || !pageContext ? null : pageContext(scrub);
  // Which juz to name, and how. The shared boundary rule (`labelBoth`, option C
  // graduated) takes the page's two juz and returns one number on the 600 clean
  // pages, both on the four a seam cuts; i18n turns that into "Juz 3" or the
  // "Juz 3 → 4" hand-off in the reader's language — the arrow flipping for Arabic.
  const juzLabel =
    context === null
      ? null
      : (() => {
          const both = labelBoth({ running: context.running, beginsHere: context.beginsHere });
          return both.juz.length === 2 && context.beginsHere !== null
            ? t.juzBoth(context.running, context.beginsHere)
            : t.juzN(context.running);
        })();

  const commit = useCallback(
    (wanted: number) => {
      setScrub(null);
      const landed = nearestPage(available, wanted);
      if (landed === null) return;
      onGoTo(landed, wanted);
    },
    [available, onGoTo],
  );

  // The phone's own drag. A native range input gives no say over how fast its
  // thumb follows a finger, so on a phone a pad over the input takes the drag,
  // moves the knob by the graduated rule, and commits on release exactly as the
  // native `change` does. The input underneath keeps the keyboard and the
  // screen reader; the pad is paint and pointer only.
  const geometry = (): { rect: DOMRect; thumb: number; usable: number } | null => {
    const track = trackRef.current;
    if (!track) return null;
    const rect = track.getBoundingClientRect();
    const thumb = parseFloat(getComputedStyle(track).getPropertyValue("--thumb")) || 22;
    return { rect, thumb, usable: Math.max(1, rect.width - thumb) };
  };
  // Track pixels from the left to a page, and back. Page 1 is at the right.
  const pageAtPx = (x: number, g: { rect: DOMRect; thumb: number; usable: number }): number =>
    1 + ((g.rect.width - g.thumb / 2 - x) / g.usable) * (total - 1);
  const phoneMove = (e: React.PointerEvent<HTMLDivElement>, start: boolean): void => {
    const g = geometry();
    if (!g) return;
    const clampX = (x: number): number => Math.max(g.thumb / 2, Math.min(g.rect.width - g.thumb / 2, x));
    const fingerX = clampX(e.clientX - g.rect.left);
    // How far above the bar the thumb is; on or below the bar is full speed.
    const off = Math.max(0, g.rect.top - e.clientY);
    const prev = phoneRef.current;
    let next: PhoneDrag & { lastX: number };
    if (start || !prev) {
      // A touch on the bar moves the knob there, as it always has.
      next = { pos: fingerX, fingerX, off, rate: 1, lastX: e.clientX };
    } else {
      const rate = scrubRateSlowAway(off, SCRUB_BANDS);
      const pos = clampX(scrubAdvance(prev.pos, e.clientX - prev.lastX, rate, prev.off, off, fingerX));
      next = { pos, fingerX, off, rate, lastX: e.clientX };
    }
    phoneRef.current = next;
    setPhone({ pos: next.pos, fingerX: next.fingerX, off: next.off, rate: next.rate });
    setScrub(Math.max(1, Math.min(total, Math.round(pageAtPx(next.pos, g)))));
  };
  const onPadDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0 || empty) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    phoneMove(e, true);
  };
  const onPadMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (phoneRef.current) phoneMove(e, false);
  };
  const onPadUp = (): void => {
    const drag = phoneRef.current;
    const g = geometry();
    phoneRef.current = null;
    setPhone(null);
    if (!drag || !g) return setScrub(null);
    commit(Math.max(1, Math.min(total, Math.round(pageAtPx(drag.pos, g)))));
  };
  const onPadCancel = (): void => {
    phoneRef.current = null;
    setPhone(null);
    setScrub(null);
  };

  // The strip of page marks above the thumb, for the drag under way: the pages
  // around the knob at the strip's zoom for this speed, with the desktop
  // magnifier's rule for which marks have room, the juz openings named, and the
  // page numbers that fit between them.
  const strip = useMemo(() => {
    if (phone === null) return null;
    const g = geometry();
    if (!g) return null;
    const width = Math.min(STRIP_MAX_W, (typeof window === "undefined" ? STRIP_MAX_W : window.innerWidth) - 24);
    const perPage = stripPxPerPage(g.usable / Math.max(1, total - 1), phone.rate, STRIP_MAGNIFY);
    const step = pageTickStep(perPage, LENS.minTickGapPx) ?? 10;
    const cur = pageAtPx(phone.pos, g);
    const juzOf = new Map<number, number>();
    juzStarts.forEach((start, i) => {
      if (start !== null) juzOf.set(start, i + 1);
    });
    const half = width / 2 / perPage;
    const ticks: { x: number; kind: "juz" | "five" | "one" }[] = [];
    const labels: { x: number; w: number; text: string; juz: boolean }[] = [];
    for (let p = Math.max(1, Math.ceil(cur - half)); p <= Math.min(total, Math.floor(cur + half)); p++) {
      const juz = juzOf.get(p);
      if (juz === undefined && p % step !== 0) continue;
      // Later pages lie to the left, as on the bar.
      const x = width / 2 - (p - cur) * perPage;
      ticks.push({ x, kind: juz !== undefined ? "juz" : p % 5 === 0 ? "five" : "one" });
      if (juz !== undefined) labels.push({ x, w: 44, text: t.juzN(juz), juz: true });
      else if (p % 5 === 0) labels.push({ x, w: 22, text: String(p), juz: false });
    }
    // The magnifier's overlap rule: juz names first, then page numbers, nearer the
    // knob first; a name that would touch one already placed, or the strip's
    // edge, is dropped.
    labels.sort((a, b) => Number(b.juz) - Number(a.juz) || Math.abs(a.x - width / 2) - Math.abs(b.x - width / 2));
    const placed: typeof labels = [];
    for (const l of labels) {
      if (l.x < l.w / 2 || l.x > width - l.w / 2) continue;
      if (placed.some((q) => Math.abs(l.x - q.x) < (l.w + q.w) / 2 + 4)) continue;
      placed.push(l);
    }
    // Centred on the thumb, but kept on the screen.
    const centre =
      Math.max(width / 2 + 8, Math.min(window.innerWidth - width / 2 - 8, g.rect.left + phone.fingerX)) - g.rect.left;
    return { width, left: centre - width / 2, ticks, labels: placed };
    // `geometry` reads the live track; the drag state is what changes.
  }, [phone, total, juzStarts, t]);

  // Native `change`, not React's `onChange`: React maps `onChange` on a range
  // input to the `input` event, which fires for every value the thumb passes
  // over. This is the one that means "the reader let go".
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const handle = (): void => commit(Number(el.value));
    el.addEventListener("change", handle);
    return () => el.removeEventListener("change", handle);
  }, [commit]);

  // Two graduated behaviours, both hover-only, both driven from here: option C's
  // grow-on-approach (each marker swells as the pointer nears it) and option B's
  // fisheye (the markers near the pointer also *spread apart* so their juz numbers
  // become readable, and the page under the pointer is named). Neither fires while
  // a drag is under way, so a passing thumb never meets a swollen or shifted
  // button. Only a fine pointer runs this; a finger has no hover to grow toward,
  // and there the markers are tapped at their plain size — the phone layout both
  // decisions left for a real device.
  //
  // Each marker's *rest* centre is computed from its juz's opening page, not read
  // off its box: the spread moves the box, so measuring a centre off an
  // already-shifted marker would feed back on itself. The formula matches the one
  // the markup positions the markers with (`insetInlineStart`, from the right in
  // this RTL bar), so the two never drift.
  useEffect(() => {
    if (!finePointer) return;
    const track = trackRef.current;
    if (!track) return;
    const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
    const marks = (): HTMLElement[] =>
      Array.from(railRef.current?.querySelectorAll<HTMLElement>("[data-testid='juz-detent']") ?? []);
    const applyLens = (px: number | null): void => {
      const { t: tt, total: tot, juzStarts: js, hizbStarts: hs, fisheye: fish } = liveRef.current;
      const layer = lensRef.current;
      const rect = track.getBoundingClientRect();
      const thumb = parseFloat(getComputedStyle(track).getPropertyValue("--thumb")) || 22;
      const usable = Math.max(1, rect.width - thumb);
      const halfPage = usable / Math.max(1, tot - 1) / 2;
      // How much bar is left on a point's side of the pointer. The magnifier
      // never reaches past it, so the first and last pages stay on the bar.
      const lowEnd = rect.left + thumb / 2;
      const highEnd = rect.right - thumb / 2;
      const spread = (x: number, ptr: number): number =>
        ptr + focusSpread(x - ptr, LENS, x < ptr ? ptr - lowEnd : highEnd - ptr);
      // A marker's rest centre in physical pixels, read from *layout* — `offsetLeft`
      // and `offsetWidth` ignore CSS transforms, so they give the untransformed
      // position even while the spread has warped the marker's painted box. That is
      // what keeps the warp from feeding back on itself, and it tracks the real tick
      // exactly (the grow underneath must peak *on* the marker, not beside it) rather
      // than re-deriving the RTL `inset-inline-start` sum by hand.
      const restCentre = (m: HTMLElement): number => {
        const parent = (m.offsetParent as HTMLElement | null) ?? track;
        const pr = parent.getBoundingClientRect();
        return pr.left + parent.clientLeft + m.offsetLeft + m.offsetWidth / 2;
      };

      for (const m of marks()) {
        if (px === null) {
          m.style.transform = "";
          continue;
        }
        const juz = Number(m.dataset.juz);
        const start = js[juz - 1];
        if (start === null || start === undefined) {
          m.style.transform = "";
          continue;
        }
        const centre = restCentre(m);
        const grow = markerEmphasisDock(Math.abs(centre - px), EMPHASIS.near, EMPHASIS.peak);
        if (fish) {
          // Spread the marker outward from the pointer, then grow it in place.
          // Under the magnifier a juz cut lands on the *edge* of its opening page
          // (half a page toward the book's start, rightward in this RTL bar), so
          // it sits on a page mark rather than halfway across a page.
          const edge = centre + halfPage;
          const dx = spread(edge, px) - centre;
          m.style.transform = `translateX(${dx}px) scale(${grow})`;
        } else {
          m.style.transform = `scale(${grow})`;
        }
      }

      // The knob, the page on the stage and the leading end of the fill ride the
      // same spread as the marks, or near the pointer the knob sits a little off
      // the marks around it (zoom plan, step 1's leftover). Their rest positions
      // are read with this shift cleared: both are centred by a CSS translate that
      // layout does not see, and under a lens that widens nine times a few pixels
      // of error became forty. The spread leaves the pointer's own
      // point where it is, so the mouse is only ever over the knob where the knob
      // really rests — a press there still lands on the control underneath.
      const handle = track.querySelector<HTMLElement>("[data-testid='page-handle']");
      const here = track.querySelector<HTMLElement>("[data-testid='page-here']");
      const fill = track.querySelector<HTMLElement>("[data-testid='page-fill']");
      for (const el of [handle, here]) {
        if (!el) continue;
        el.style.translate = "";
        if (px === null || !fish) continue;
        const r = el.getBoundingClientRect();
        const c = r.left + r.width / 2;
        el.style.translate = `${spread(c, px) - c}px 0`;
      }
      if (fill) {
        // Filled from the book's first page, on the right of this bar, to the
        // knob: the right end is past the magnifier and stays; the left end moves.
        fill.style.transform = "";
        const { left, right } = fill.getBoundingClientRect();
        if (px !== null && fish && right - left >= 1) {
          fill.style.transformOrigin = "right center";
          fill.style.transform = `scaleX(${(right - spread(left, px)) / (right - left)})`;
        }
      }

      // The labels are the fisheye's alone. Cleared whenever the pointer leaves or
      // the spread is off, so the plain grow-on-approach bar carries none.
      if (!layer) return;
      if (px === null || !fish) {
        layer.replaceChildren();
        return;
      }
      const fPtr = clamp((rect.right - px - thumb / 2) / usable, 0, 1);
      const pageUnder = clamp(Math.round(1 + fPtr * (tot - 1)), 1, tot);
      const kids: HTMLElement[] = [];

      // Page marks, drawn only where the magnifier leaves room to see them
      // (docs/design/page-bar-zoom-plan.md, step 1): every page right beside the
      // pointer, every 5th a little further out, every 10th beyond that, none
      // past the window. A mark sits on the edge between two pages; the page
      // under the pointer is the accent span between its own two edges.
      const restX = (v: number): number => rect.right - thumb / 2 - ((v - 1) / Math.max(1, tot - 1)) * usable;
      const warpX = (v: number): number => spread(restX(v), px);
      const reachPages = Math.ceil((LENS.radiusPx / usable) * (tot - 1)) + 1;
      // Juz and hizb starts inside the window, each as its own mark on the edge
      // before its opening page: a juz cut is tall and green and named "Juz 30",
      // a hizb cut is shorter and named "Hizb 59". They hang in the same row as
      // the page marks and are named under them, away from the page tag above,
      // so the tag can never crowd them out. A page mark that would sit on one
      // of them is skipped.
      const cuts: { x: number; juz: number | null; hizb: number }[] = [];
      for (let h = 1; h <= hs.length; h++) {
        const start = hs[h - 1];
        if (start === null || start === undefined || start <= 1) continue;
        if (Math.abs(start - pageUnder) > LENS.juzPageWindow) continue;
        const x = warpX(start - 0.5);
        if (Math.abs(x - px) >= LENS.radiusPx) continue;
        cuts.push({ x, juz: h % 2 === 1 ? (h + 1) / 2 : null, hizb: h });
      }
      let lastTick = Number.NaN;
      for (let p = Math.max(1, pageUnder - reachPages); p < Math.min(tot, pageUnder + reachPages); p++) {
        const x = warpX(p + 0.5);
        if (Math.abs(x - px) >= LENS.radiusPx) continue;
        const step = pageTickStep(Math.abs(warpX(p + 1) - warpX(p)), LENS.minTickGapPx);
        if (step === null || p % step !== 0) continue;
        if (Math.abs(x - lastTick) < LENS.minTickGapPx) continue;
        if (cuts.some((c) => Math.abs(c.x - x) < LENS.minTickGapPx / 2)) continue;
        lastTick = x;
        const tick = document.createElement("span");
        tick.className = `${styles.lensTick ?? ""} ${p % 5 === 0 ? (styles.lensTickMajor ?? "") : ""}`;
        tick.dataset.testid = "page-tick";
        tick.style.left = `${x - rect.left}px`;
        kids.push(tick);
      }
      const hereA = warpX(pageUnder - 0.5);
      const hereB = warpX(pageUnder + 0.5);
      const herePage = document.createElement("span");
      herePage.className = styles.lensHere ?? "";
      herePage.style.left = `${Math.min(hereA, hereB) - rect.left}px`;
      herePage.style.width = `${Math.abs(hereB - hereA)}px`;
      kids.push(herePage);

      for (const c of cuts) {
        const mark = document.createElement("span");
        mark.className = c.juz !== null ? (styles.lensJuzCut ?? "") : (styles.lensHizbCut ?? "");
        mark.dataset.testid = c.juz !== null ? "juz-cut" : "hizb-cut";
        mark.style.left = `${c.x - rect.left}px`;
        kids.push(mark);
        const name = document.createElement("span");
        name.className = `${c.juz !== null ? (styles.lensJuz ?? "") : (styles.lensHizb ?? "")} numeric`;
        name.style.left = `${c.x - rect.left}px`;
        name.textContent = c.juz !== null ? tt.juzN(c.juz) : tt.hizbN(c.hizb);
        kids.push(name);
      }
      const pageTag = document.createElement("span");
      pageTag.className = `${styles.lensPage ?? ""} numeric`;
      pageTag.style.left = `${px - rect.left}px`;
      pageTag.textContent = tt.pageN(pageUnder);
      kids.push(pageTag);
      layer.replaceChildren(...kids);
      // Near an end of the bar the tag, centred on the pointer, would hang past
      // it; slide it back inside, the way the marks themselves are kept inside.
      const tagBox = pageTag.getBoundingClientRect();
      const nudge =
        tagBox.left < rect.left ? rect.left - tagBox.left : tagBox.right > rect.right ? rect.right - tagBox.right : 0;
      if (nudge !== 0) pageTag.style.left = `${px - rect.left + nudge}px`;

      // Labels that would overlap give way: the page tag always stays, then the
      // juz numbers nearest the pointer, and any number that would touch one
      // already kept is dropped (zoom plan, step 3).
      const kept: DOMRect[] = [pageTag.getBoundingClientRect()];
      const juzLabels = Array.from(layer.querySelectorAll<HTMLElement>(`.${styles.lensJuz ?? "_"}`));
      const hizbLabels = Array.from(layer.querySelectorAll<HTMLElement>(`.${styles.lensHizb ?? "_"}`));
      const centreOf = (r: DOMRect): number => r.left + r.width / 2;
      // A juz name outranks a hizb name; within each, the one nearer the pointer.
      const byNearness = (els: HTMLElement[]) =>
        els
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .sort((a, b) => Math.abs(centreOf(a.r) - px) - Math.abs(centreOf(b.r) - px));
      const boxes = [...byNearness(juzLabels), ...byNearness(hizbLabels)];
      for (const { el, r } of boxes) {
        const clash = kept.some(
          (k) => r.left < k.right + 2 && r.right > k.left - 2 && r.top < k.bottom && r.bottom > k.top,
        );
        if (clash) el.remove();
        else kept.push(r);
      }
    };
    const onMove = (e: PointerEvent): void => {
      if (draggingRef.current) return;
      applyLens(e.clientX);
    };
    const onLeave = (): void => applyLens(null);
    // A drag begins on the range input under the rail; from its first press
    // until release every marker is pinned to its plain size, so a passing thumb
    // never meets a grown or shifted button.
    const onDown = (): void => {
      draggingRef.current = true;
      applyLens(null);
    };
    const onUp = (): void => {
      draggingRef.current = false;
    };
    const input = inputRef.current;
    track.addEventListener("pointermove", onMove);
    track.addEventListener("pointerleave", onLeave);
    input?.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerleave", onLeave);
      input?.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      applyLens(null);
    };
  }, [finePointer, fisheye]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const first = available[0];
      const last = available[available.length - 1];
      switch (e.key) {
        // Left and Down are "forward" for the same reason ArrowLeft turns the
        // page forward everywhere else in the app: the next page of a mus'haf
        // lies to the left.
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          setScrub(null);
          onStep(1);
          break;
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          setScrub(null);
          onStep(-1);
          break;
        case "Home":
          if (first === undefined) break;
          e.preventDefault();
          setScrub(null);
          onGoTo(first, first);
          break;
        case "End":
          if (last === undefined) break;
          e.preventDefault();
          setScrub(null);
          onGoTo(last, last);
          break;
        default:
          break;
      }
    },
    [available, onStep, onGoTo],
  );

  return (
    /* Pinned RTL in both languages — see the direction note above. `nav` rather
       than a bare div so a screen-reader user can jump to it as a landmark; it
       is the app's second way of moving through the book, after the jumper. */
    <nav className={styles.bar} aria-label={t.pageBar} dir="rtl">
      <button
        type="button"
        className={styles.edge}
        onClick={() => onStep(-1)}
        disabled={empty}
        aria-label={t.prevPage}
      >
        {/* Solid triangles, not ‹ ›: the angle quotes are Bidi_Mirrored, so an
            RTL container silently flips them and both edges end up pointing the
            same way. These are not mirrored, so they mean what they draw —
            earlier in the book is to the right. */}
        <span aria-hidden="true">▸</span>
      </button>

      <div className={styles.track} ref={trackRef}>
        <input
          ref={inputRef}
          type="range"
          className={styles.range}
          min={1}
          max={Math.max(1, total)}
          step={1}
          value={value}
          disabled={empty}
          aria-label={t.pageChoose}
          // The spoken value. Without it a screen reader reads a bare "300",
          // which is a number with no unit in a bar full of numbers.
          aria-valuetext={t.pageOfTotal(value, total)}
          aria-describedby="hifth-page-inventory"
          onChange={(e) => setScrub(Number(e.currentTarget.value))}
          onKeyDown={onKeyDown}
          onBlur={() => setScrub(null)}
        />

        {/* The phone's drag pad (option D, graduated): over the input, under the
            juz buttons, so a tap on a juz still opens it and every other touch on
            the bar is a drag the pad paces. Only where nothing can hover. */}
        {!finePointer && !empty && (
          <div
            className={styles.scrubPad}
            data-testid="scrub-pad"
            aria-hidden="true"
            onPointerDown={onPadDown}
            onPointerMove={onPadMove}
            onPointerUp={onPadUp}
            onPointerCancel={onPadCancel}
          />
        )}

        {/* The inventory, drawn on the track — as runs, not as pages. Each run
            spans from its first held page's fraction of the book to its last,
            offset by half the thumb so it lines up with the thumb's centre
            rather than with the box's edge. `inset-inline-*` keeps it correct
            without knowing which way the track runs.

            One node per *gap*, which is what the picture is about. Drawing one
            per page was right at three of 604 and became a lie at 604 of 604:
            the marks are half a pixel apart there and two pixels wide, so they
            overlapped into a second track that said nothing, while React
            reconciled 604 spans on every value a dragged thumb passed over —
            in the one interaction that is a continuous drag, on the component
            whose whole design is "do not pay per value of a drag". */}
        <div className={styles.runs} aria-hidden="true">
          {runs.map((run) => (
            <span
              key={run.from}
              className={styles.run}
              data-testid="page-run"
              style={{
                insetInlineStart: `calc(${pageFraction(run.from, total)} * (100% - var(--thumb)) + var(--thumb) / 2 - 1px)`,
                inlineSize: `calc(${pageFraction(run.to, total) - pageFraction(run.from, total)} * (100% - var(--thumb)) + 2px)`,
              }}
            />
          ))}
          {/* How far into the book the handle is: filled from the book's first
              page to the handle, the way a progress slider says "you are here,
              and this much is behind you". */}
          <span
            className={styles.fill}
            data-testid="page-fill"
            style={{
              insetInlineStart: "calc(var(--thumb) / 2 - 1px)",
              inlineSize: `calc(${pageFraction(value, total)} * (100% - var(--thumb)) + 2px)`,
            }}
          />
          {/* The page on the stage. Its own element, because it is its own
              fact: the run under it says "these pages are here" and this says
              "you are on this one", and the two only shared a class while a
              held page and a single-page run were the same picture. */}
          <span
            className={styles.here}
            data-testid="page-here"
            style={{
              insetInlineStart: `calc(${pageFraction(page, total)} * (100% - var(--thumb)) + var(--thumb) / 2 - 1px)`,
            }}
          />
        </div>

        {/* The 30 juz, one green detent each, at the page each opens on. These
            are the coarse landmarks a hafiz navigates by — the book is thirty
            parts before it is 604 pages — so they sit above the inventory rail
            as their own layer. Each is now a *button* (the graduated option C):
            a tap opens that juz, and on a pointer that can hover it grows as the
            pointer nears it (the effect above) so it is easy to hit yet never in
            the way of a drag. The rail itself keeps `pointer-events: none`; only
            the buttons take the pointer, so a drag through the gaps between them
            still reaches the thumb. Kept out of the tab order and hidden from a
            screen reader (the input already speaks its value and the juz is named
            in the popover): the marker is a pointer affordance, and the exact
            roads to a juz for a keyboard or a listener are the jump box, the map
            cell and the wheel, unchanged. */}
        {juzStarts.some((start) => start !== null) && (
          <div className={styles.juzRail} aria-hidden="true" ref={railRef}>
            {juzStarts.map((start, i) =>
              start === null ? null : (
                <button
                  key={start}
                  type="button"
                  tabIndex={-1}
                  className={styles.juz}
                  data-testid="juz-detent"
                  data-juz={i + 1}
                  title={t.juzN(i + 1)}
                  onClick={() => onJuzTap?.(i + 1)}
                  style={{
                    insetInlineStart: `calc(${pageFraction(start, total)} * (100% - var(--thumb)) + var(--thumb) / 2 - 1px)`,
                  }}
                />
              ),
            )}
          </div>
        )}

        {/* The fisheye's labels — the juz numbers fanned open under the pointer
            and the exact page beneath it, drawn imperatively by the effect above
            so they ride the same warped positions the markers take. Pure hover
            decoration: aria-hidden and pointer-events off, because the input
            already speaks the page and the juz is named in the popover. Empty
            until a fine pointer hovers with the spread on. */}
        <div className={styles.lens} aria-hidden="true" ref={lensRef} />

        {/* The handle, a round knob painted over the invisible native thumb at
            the same value, so the range input underneath keeps its keyboard and
            screen-reader behaviour. Hidden while the bar is inert (no
            inventory), so no knob floats over a dead track. Follows the drag:
            `value` is the scrub value mid-drag, the loaded page at rest. */}
        {!empty && (
          <span
            className={styles.handle}
            data-testid="page-handle"
            aria-hidden="true"
            style={{
              insetInlineStart: `calc(${pageFraction(value, total)} * (100% - var(--thumb)) + var(--thumb) / 2)`,
            }}
          />
        )}

        {/* On a phone mid-drag, the readout and the strip of page marks ride
            above the thumb — lifted as it slides up, so neither is ever under it. */}
        {scrub !== null && phone !== null && strip !== null && (
          <div
            className={styles.phoneFloat}
            style={{ left: `${strip.left}px`, width: `${strip.width}px`, bottom: `calc(100% + ${phone.off}px)` }}
          >
            <div className={styles.strip} data-testid="scrub-strip" data-speed={speedName(phone.rate)} aria-hidden="true">
              {strip.ticks.map((tk) => (
                <i
                  key={`${tk.kind}-${tk.x.toFixed(2)}`}
                  className={tk.kind === "juz" ? styles.stripJuz : tk.kind === "five" ? styles.stripFive : styles.stripTick}
                  data-testid="strip-tick"
                  style={{ left: `${tk.x}px` }}
                />
              ))}
              {strip.labels.map((l) => (
                <b
                  key={`${l.text}-${l.x.toFixed(2)}`}
                  className={`${l.juz ? styles.stripJuzName : styles.stripPageName} numeric`}
                  style={{ left: `${l.x}px` }}
                >
                  {l.text}
                </b>
              ))}
              <span className={styles.stripHere} />
            </div>
            <output className={styles.bubble}>
              <span className="numeric">{t.pageOfTotal(scrub, total)}</span>
              {context !== null && (
                <span className={styles.context}>
                  {juzLabel} · {t.surahName(context.surah)}
                </span>
              )}
              <span className={styles.speed} data-testid="scrub-speed">
                {phone.rate === 1 ? t.scrubSlowHint : t.scrubSpeed(speedName(phone.rate))}
              </span>
              {landing !== null && landing !== scrub && (
                <span className={styles.snap}>{t.nearestPageN(landing)}</span>
              )}
            </output>
          </div>
        )}

        {scrub !== null && phone === null && (
          <output
            className={styles.bubble}
            style={{
              insetInlineStart: `calc(${pageFraction(scrub, total)} * (100% - var(--thumb)) + var(--thumb) / 2)`,
            }}
          >
            <span className="numeric">{t.pageOfTotal(scrub, total)}</span>
            {/* The book's own landmarks for the page under the thumb: which juz,
                and the surah at its head. Only when the caller can place the page
                — off the vendored inventory the line is left off rather than guessed. */}
            {context !== null && (
              <span className={styles.context}>
                {juzLabel} · {t.surahName(context.surah)}
              </span>
            )}
            {/* Said before you let go, not only after. The drag is the moment
                the reader can still aim somewhere else. */}
            {landing !== null && landing !== scrub && (
              <span className={styles.snap}>{t.nearestPageN(landing)}</span>
            )}
          </output>
        )}
      </div>

      <button
        type="button"
        className={styles.edge}
        onClick={() => onStep(1)}
        disabled={empty}
        aria-label={t.nextPage}
      >
        <span aria-hidden="true">◂</span>
      </button>

      {/* Visible, small and permanent: how much of the book is here. It reads
          «٦٠٤ من ٦٠٤» now, and it stays — it is not a warning that disappears
          when the news is good, it is the bar saying what is behind it, and the
          next edition to be vendored will arrive partial (`e2e/pagebar.spec.ts`
          holds that decision). It is also the slider's accessible description,
          so the fact reaches a listener who will never see the runs. The bar
          runs right to left, so without `dir="auto"` the English line put its
          leading number at the far end ("of 604 pages available 604"). */}
      <span id="hifth-page-inventory" className={styles.inventory} dir="auto">
        {t.pagesVendored(available.length, total)}
      </span>
    </nav>
  );
}
