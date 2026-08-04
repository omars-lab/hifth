import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nearestPage, pageFraction, pageRuns } from "@hifth/core";
import { useT } from "../i18n";
import styles from "./PageSlider.module.css";

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
}: PageSliderProps): JSX.Element {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  // Non-null only mid-drag: where the thumb is, before anything has been asked
  // of the stage.
  const [scrub, setScrub] = useState<number | null>(null);

  const empty = available.length === 0;
  const value = scrub ?? page;
  // Memoised on the inventory, not recomputed per scrub value: `scrub` changes
  // for every value the thumb passes over, and the inventory does not change
  // during a drag at all.
  const runs = useMemo(() => pageRuns(available), [available]);
  const landing = scrub === null ? null : nearestPage(available, scrub);

  const commit = useCallback(
    (wanted: number) => {
      setScrub(null);
      const landed = nearestPage(available, wanted);
      if (landed === null) return;
      onGoTo(landed, wanted);
    },
    [available, onGoTo],
  );

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

      <div className={styles.track}>
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

        {scrub !== null && (
          <output
            className={styles.bubble}
            style={{
              insetInlineStart: `calc(${pageFraction(scrub, total)} * (100% - var(--thumb)) + var(--thumb) / 2)`,
            }}
          >
            <span className="numeric">{t.pageOfTotal(scrub, total)}</span>
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
          so the fact reaches a listener who will never see the runs. */}
      <span id="hifth-page-inventory" className={styles.inventory}>
        {t.pagesVendored(available.length, total)}
      </span>
    </nav>
  );
}
