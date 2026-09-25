import { useEffect, useRef, type MouseEvent } from "react";
import type { Bookmark } from "@hifth/core";
import { useT } from "../i18n";
import styles from "./BookmarkRibbons.module.css";

interface BookmarkRibbonsProps {
  /** This page's bookmarks, oldest first, so a ribbon keeps its place. */
  bookmarks: readonly Bookmark[];
  /** Fold the corner: drop a new bookmark on this page. */
  onDrop: () => void;
  /** Open one ribbon's drawer. */
  onOpen: (id: string) => void;
  /** The ribbon just dropped, which unrolls; every other one is already hanging. */
  freshId?: string | null;
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
 */
export function BookmarkRibbons({
  bookmarks,
  onDrop,
  onOpen,
  freshId = null,
}: BookmarkRibbonsProps): JSX.Element {
  const { t } = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const act = useRef<(button: HTMLButtonElement) => void>(() => {});
  act.current = (button) => {
    const id = button.dataset.bookmark;
    if (id) onOpen(id);
    else onDrop();
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let pressed: HTMLButtonElement | null = null;
    const buttonOf = (e: Event) => (e.target as Element | null)?.closest("button") ?? null;
    const stop = (e: Event) => {
      if (buttonOf(e)) e.stopPropagation();
    };
    const down = (e: PointerEvent) => {
      pressed = buttonOf(e);
      if (pressed) e.stopPropagation();
    };
    const up = (e: PointerEvent) => {
      const b = buttonOf(e);
      if (b && b === pressed) act.current(b);
      pressed = null;
    };
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointerup", up);
    root.addEventListener("touchstart", stop, { passive: true });
    return () => {
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("touchstart", stop);
    };
  }, []);

  // Only a click no pointer made: a pointer has already acted on its lift.
  const onKeyClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0) act.current(e.currentTarget);
  };

  return (
    <div ref={rootRef} className={styles.overlay} data-bookmark-overlay="">
      <button
        type="button"
        className={styles.fold}
        onClick={onKeyClick}
        aria-label={t.bmDrop}
        title={t.bmDrop}
        data-bookmark-fold=""
      >
        <span className={styles.foldShadow} aria-hidden="true">
          <span className={styles.foldFlap} />
        </span>
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
            >
              <span className={styles.name}>{b.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
