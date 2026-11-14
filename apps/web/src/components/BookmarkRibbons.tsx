import { useEffect, useLayoutEffect, useRef, type MouseEvent } from "react";
import type { Bookmark } from "@hifth/core";
import { clearCorner, pullReach, pullsByHand, pullVerdict, PULL_SLOP, useBookmarkHand } from "../bookmark-hand";
import { useT } from "../i18n";
import { labelNudge, useLeftOffLook } from "../left-off-look";
import { useRibbonLength } from "../ribbon-length";
import styles from "./BookmarkRibbons.module.css";

interface BookmarkRibbonsProps {
  /** This page's bookmarks, oldest first, so a ribbon keeps its place. */
  bookmarks: readonly Bookmark[];
  /** Fold the corner: drop a new bookmark on this page. */
  onDrop: () => void;
  /** Unfold the corner: lift every bookmark on this page (the reader can undo it). */
  onUnfold: () => void;
  /** Open one ribbon's drawer. */
  onOpen: (id: string) => void;
  /** Lift one ribbon the reader pushed back up by hand (the reader can undo it). */
  onLift: (id: string) => void;
  /** The ribbon just dropped, which unrolls; every other one is already hanging. */
  freshId?: string | null;
  /** The red seam — where the reader left off — lies on this page. */
  seam?: boolean;
  /**
   * Stand aside and let the pointer through to the page: the harakat, word and
   * mistake tools point at single words and signs, and the corner sits over the
   * first line's.
   */
  aside?: boolean;
}

/**
 * The reader's ribbons, hanging from the head of the page, and the folded corner
 * that drops a new one (docs/decisions/bookmark-fold.md: many ribbons, each named
 * along its length, each opening its own drawer).
 *
 * Mounted as the page stage's overlay, which has a gesture surface under it that
 * reads every press as the start of a pan, a turn or a highlight. So a press that
 * starts on a ribbon or the corner stops here, before the stage can claim it —
 * natively, because the stage's listeners are native too and React's own
 * `stopPropagation` would arrive after they had already run.
 *
 * Which has a price: the gesture library cancels, on its way down, every pointer
 * click whose press it did not see begin as a tap. So a pointer acts on its lift
 * here, not its click, and `onClick` answers only a click no pointer made — the
 * keyboard's Enter or Space, which the library lets through.
 *
 * In the ways that pull by hand (bookmark-hand.ts), a press that moves is a
 * pull instead: down from the corner draws a new ribbon out with the hand and,
 * let go far enough down, drops it; up on a ribbon draws it back in and, let go
 * far enough up, lifts it. The press holds the pointer (pointer capture), so the
 * hand can leave the small corner and still be followed, and the pulling is
 * drawn by setting styles on the element, not React state, so it keeps up with
 * the hand.
 */
export function BookmarkRibbons({
  bookmarks,
  onDrop,
  onUnfold,
  onOpen,
  onLift,
  freshId = null,
  seam = false,
  aside = false,
}: BookmarkRibbonsProps): JSX.Element {
  const { t } = useT();
  const ribbonLength = useRibbonLength();
  // How the red ribbon is told from the reader's own bookmarks (left-off-look.ts).
  // With tabs, every bookmark is a named tab whatever ribbon length is set.
  const leftOffLook = useLeftOffLook();
  const hand = useBookmarkHand();
  const rootRef = useRef<HTMLDivElement>(null);
  const act = useRef<(button: HTMLButtonElement) => void>(() => {});
  const pulls = useRef(pullsByHand(hand));
  pulls.current = pullsByHand(hand);
  const pulled = useRef<{ drop: () => void; lift: (id: string) => void }>({ drop: onDrop, lift: onLift });
  pulled.current = { drop: onDrop, lift: onLift };
  // A page that holds a bookmark keeps its corner folded down until the reader
  // unfolds it (docs/decisions/bookmark-fold.md, 2026-09-25): so the corner
  // folds a flat page and unfolds a folded one.
  const folded = bookmarks.length > 0;
  act.current = (button) => {
    const id = button.dataset.bookmark;
    if (id) onOpen(id);
    else if (button.dataset.folded !== undefined) onUnfold();
    else onDrop();
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let pressed: HTMLButtonElement | null = null;
    // Where a pulling press began, and how long the pressed ribbon was then.
    let start: { x: number; y: number; pointer: number; length: number } | null = null;
    const buttonOf = (e: Event) => (e.target as Element | null)?.closest("button") ?? null;
    const on = (b: HTMLButtonElement) => (b.dataset.bookmark !== undefined ? "ribbon" : "corner");
    const stop = (e: Event) => {
      if (buttonOf(e)) e.stopPropagation();
    };
    const letGo = () => {
      if (pressed) {
        delete pressed.dataset.pulling;
        pressed.style.removeProperty("--pull");
        pressed.style.removeProperty("--push");
      }
      pressed = null;
      start = null;
    };
    const down = (e: PointerEvent) => {
      letGo();
      pressed = buttonOf(e);
      if (!pressed) return;
      e.stopPropagation();
      if (!pulls.current || e.button > 0) return;
      start = { x: e.clientX, y: e.clientY, pointer: e.pointerId, length: pressed.getBoundingClientRect().height };
      try {
        pressed.setPointerCapture(e.pointerId);
      } catch {
        /* a pointer that is already gone: the press ends on its own */
      }
    };
    const move = (e: PointerEvent) => {
      if (!pressed || !start || e.pointerId !== start.pointer) return;
      e.stopPropagation();
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) <= PULL_SLOP) return;
      pressed.dataset.pulling = "";
      if (on(pressed) === "corner") pressed.style.setProperty("--pull", `${pullReach("corner", dy)}px`);
      else pressed.style.setProperty("--push", String(pullReach("ribbon", dy, start.length)));
    };
    const up = (e: PointerEvent) => {
      const b = pressed;
      if (b && start && e.pointerId === start.pointer) {
        const verdict = pullVerdict(on(b), e.clientX - start.x, e.clientY - start.y, start.length);
        const id = b.dataset.bookmark;
        letGo();
        if (verdict === "click") act.current(b);
        else if (verdict === "drop") pulled.current.drop();
        else if (verdict === "lift" && id) pulled.current.lift(id);
        return;
      }
      const over = buttonOf(e);
      if (over && over === b) act.current(over);
      letGo();
    };
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", up);
    root.addEventListener("pointercancel", letGo);
    root.addEventListener("touchstart", stop, { passive: true });
    return () => {
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", letGo);
      root.removeEventListener("touchstart", stop);
    };
  }, []);

  // Keep the "Left off" label on the screen: where the page runs to the
  // screen's edge it slides along the ribbon (labelNudge). Set on the element,
  // not in state, and measured again whenever the window or the page resizes.
  const labelRef = useRef<HTMLSpanElement>(null);
  const showLabel = seam && leftOffLook === "label";
  useLayoutEffect(() => {
    const label = labelRef.current;
    const root = rootRef.current;
    if (!showLabel || !label || !root) return;
    const seamEl = root.querySelector<HTMLElement>("[data-bookmark-seam]");
    if (!seamEl) return;
    const place = () => {
      const s = seamEl.getBoundingClientRect();
      const width = label.getBoundingClientRect().width;
      // The stage may be magnified: the nudge is in the label's own pixels.
      const scale = label.offsetWidth > 0 ? width / label.offsetWidth : 1;
      const nudge = labelNudge((s.left + s.right) / 2, width, document.documentElement.clientWidth, s.width);
      label.style.setProperty("--label-nudge", `${nudge / (scale || 1)}px`);
    };
    place();
    const sizes = new ResizeObserver(place);
    sizes.observe(root);
    sizes.observe(label);
    window.addEventListener("resize", place);
    return () => {
      sizes.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [showLabel]);

  // Only a click no pointer made: a pointer has already acted on its lift.
  const onKeyClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0) act.current(e.currentTarget);
  };

  return (
    <div ref={rootRef} className={styles.overlay} data-bookmark-overlay="" data-aside={aside ? "" : undefined}
      data-ribbon={leftOffLook === "tabs" ? "tab" : ribbonLength}
      data-left-off={leftOffLook}
      data-hand={pullsByHand(hand) ? "pull" : "tap"}
      data-clear-corner={clearCorner(hand) ? "" : undefined}
    >
      {seam && <span className={styles.seam} role="img" aria-label={t.bmSeam} title={t.bmSeam} data-bookmark-seam="" />}
      {showLabel && (
        <span ref={labelRef} className={styles.seamLabel} aria-hidden="true" data-left-off-label="">{t.bmSeamShort}</span>
      )}
      <button
        type="button"
        className={styles.fold}
        onClick={onKeyClick}
        aria-label={folded ? t.bmUnfold(bookmarks.length) : t.bmDrop}
        title={folded ? t.bmUnfold(bookmarks.length) : t.bmDrop}
        data-bookmark-fold=""
        data-folded={folded ? "" : undefined}
      >
        <span className={styles.foldUnder} aria-hidden="true" />
        <span className={styles.foldShadow} aria-hidden="true">
          <span className={styles.foldFlap} />
        </span>
        {/* The new ribbon, coming out of the corner with the hand as it pulls. */}
        <span className={styles.pullRibbon} aria-hidden="true" data-bookmark-pull="" />
      </button>
      <ul className={styles.ribbons}>
        {bookmarks.map((b, i) => (
          <li key={b.id} className={styles.slot}>
            <button
              type="button"
              className={styles.ribbon}
              data-tone={(i % 3) + 1}
              data-fresh={b.id === freshId || undefined}
              data-bookmark={b.id}
              onClick={onKeyClick}
              aria-label={t.bmRibbon(b.name)}
              title={b.name}
            >
              <span className={styles.name}>{b.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
