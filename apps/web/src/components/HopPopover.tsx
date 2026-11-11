import { useCallback, useLayoutEffect, useRef } from "react";
import { type Edge, type LeafSide, type RailChip } from "@hifth/core";
import { useT } from "../i18n";
import { HopRows } from "./HopRows";
import styles from "./HopPopover.module.css";
import { leafStyle, useOverLeaf } from "./over-leaf";
import { useShortBand, useSideCover, type CardSpan } from "./short-band";
import { RailGlyph } from "./RailGlyph";

interface HopPopoverProps {
  /** The open chip's bucket, or null when closed. */
  chip: RailChip | null;
  /** The ayah the hops originate from (the current selection) — the diff's "here". */
  fromKey: string | null;
  /** Whether a hop target's page is vendored (loadable). Unvendored → disabled. */
  canHop: (toKey: string) => boolean;
  /** Perform the hop to an edge's target. */
  onHop: (edge: Edge) => void;
  /** Dismiss the sheet. */
  onClose: () => void;
  /**
   * Which physical side of a wide screen the card lands on, or null for the
   * chrome-direction default. On a spread the app passes the side of the leaf
   * the ayah is *not* on, so the card never covers the ayah (desktop.md §5).
   */
  side?: LeafSide | null;
  /** On a phone, where the list starts, so the page can lift the verse above it; null when it covers nothing. */
  onCover?: (top: number | null) => void;
  /**
   * Where the card spans across the window while it is up and not beside a
   * spread, so a page alone in a wide window can move clear of it.
   */
  onSide?: (span: CardSpan | null) => void;
}

/** Focusable descendants of `root`, in tab order (excludes disabled + hidden). */
function focusables(root: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(sel));
}

/**
 * HopPopover — the bottom-sheet hop list (spec §9). Opened by a rail chip, it
 * lists that bucket's edges hifz-ordered (nearest first), each row a "hop there"
 * arc-arrow that expands to show *why* the pair is confusable (spec §3): both
 * ayahs cropped out of the printed page, with the words they do not share
 * washed. An un-vendored target shows its link + note but the leap is
 * disabled with an honest "page not available yet" (Plan Q6).
 *
 * A11y (Loop 3): a real modal dialog — focus moves in on open, Tab is trapped,
 * Escape closes, and focus returns to the rail chip that opened it. Sheet on
 * phones, floating card on wide screens (CSS).
 */
export function HopPopover({
  chip,
  fromKey,
  canHop,
  onHop,
  onClose,
  side = null,
  onCover,
  onSide,
}: HopPopoverProps): JSX.Element | null {
  const { t, dir } = useT();
  // On a spread the card stands on the facing leaf, beside the verse, so the
  // page stays clear and live: no dimming, no trapped Tab — as the note does.
  const beside = side !== null;
  const place = useOverLeaf(chip !== null, side);
  const sheetRef = useRef<HTMLDivElement>(null);
  const band = useShortBand(chip !== null, beside, sheetRef, onCover);
  useSideCover(chip !== null, beside, sheetRef, onSide);
  // The element focused before the sheet opened, restored on close.
  const restoreRef = useRef<HTMLElement | null>(null);

  const open = chip !== null;

  // Capture the trigger and move focus into the sheet on open; restore on close.
  // Takes the keyboard in the step that draws it, so a key pressed as it appears lands here, not on the page.
  useLayoutEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    restoreRef.current = opener;
    // Focus the first actionable control (or the sheet itself as a fallback).
    // Opened by a link, nothing was pressed: focus the sheet itself, so a screen
    // reader still lands in it but no ring appears round a button nobody reached for.
    const sheet = sheetRef.current;
    const byLink = !opener || opener === document.body;
    if (sheet) (byLink ? sheet : focusables(sheet)[0] ?? sheet).focus();
    return () => {
      restoreRef.current?.focus?.();
    };
  }, [open]);

  // Escape to close + Tab trap, while open.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
    },
    [onClose],
  );

  if (!chip) return null;
  const title = t.hopTitle[chip.direction];

  return (
    <>
      <div
        ref={sheetRef}
        className={styles.sheet}
        style={leafStyle(place, "content")}
        data-over-leaf={place ? "" : undefined}
        role="dialog"
        aria-modal={false}
        data-band={band ? "" : undefined}
        aria-label={t.hopSheetAria(title, chip.count)}
        // The sheet is chrome, so it reads in the chrome's direction — unlike
        // the rail that opened it, which stays on the mus'haf's side. Its
        // wide-screen `inset-inline-end` resolves from this, so the card lands
        // on the side the reader's eye ends on either way.
        dir={dir}
        data-side={side ?? undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {/* Beside a page nothing drags, so it has no handle — as the note. */}
        {side ? null : <div className={styles.grip} aria-hidden="true" />}
        <header className={styles.head}>
          <span className={styles.glyph} aria-hidden="true">
            <RailGlyph glyph={chip.glyph} />
          </span>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
            ✕
          </button>
        </header>

        <HopRows edges={chip.edges} fromKey={fromKey} canHop={canHop} onHop={onHop} />
      </div>
    </>
  );
}
