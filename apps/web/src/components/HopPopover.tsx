import { Suspense, useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  arrangePassages,
  orderForHifz,
  qulVerseUrlFromKey,
  wordDiff,
  type Edge,
  type LeafSide,
  type RailChip,
} from "@hifth/core";
import { edgeNote } from "../edge-note";
import { useT } from "../i18n";
import { usePassageRows } from "../passage-rows";
// Loaded the first time a look-alike is opened out (see ./later.tsx).
import { DiffView } from "./later";
import styles from "./HopPopover.module.css";
import { leafStyle, useOverLeaf } from "./over-leaf";
import { useShortBand } from "./short-band";
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
}: HopPopoverProps): JSX.Element | null {
  const { t, dir, lang } = useT();
  const passageRows = usePassageRows();
  // On a spread the card stands on the facing leaf, beside the verse, so the
  // page stays clear and live: no dimming, no trapped Tab — as the note does.
  const beside = side !== null;
  const place = useOverLeaf(chip !== null, side);
  const sheetRef = useRef<HTMLDivElement>(null);
  const band = useShortBand(chip !== null, beside, sheetRef, onCover);
  // Under the page on a phone, or beside it on a spread: the page stays live.
  const live = beside || band;
  // The element focused before the sheet opened, restored on close.
  const restoreRef = useRef<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const open = chip !== null;

  // Capture the trigger and move focus into the sheet on open; restore on close.
  // Takes the keyboard in the step that draws it, so a key pressed as it appears lands here, not on the page.
  useLayoutEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    // Focus the first actionable control (or the sheet itself as a fallback).
    const sheet = sheetRef.current;
    if (sheet) (focusables(sheet)[0] ?? sheet).focus();
    return () => {
      restoreRef.current?.focus?.();
      setExpanded(null);
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
      if (e.key !== "Tab" || live) return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const items = focusables(sheet);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose, live],
  );

  if (!chip) return null;
  // A passage listed beside a verse inside it is laid out as the reader chose (item 47).
  const rows = arrangePassages(orderForHifz(chip.edges), passageRows);
  const title = t.hopTitle[chip.direction];

  return (
    <>
      {!live && <div className={styles.scrim} onClick={onClose} aria-hidden="true" />}
      <div
        ref={sheetRef}
        className={styles.sheet}
        style={leafStyle(place, "content")}
        data-over-leaf={place ? "" : undefined}
        role="dialog"
        aria-modal={!live}
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

        <ul className={styles.list}>
          {rows.map(({ edge, inside }) => {
            const enabled = canHop(edge.to);
            // A look-alike that is a whole passage is named as the passage.
            const label =
              (edge.through ? t.rangeLabel(edge.to, edge.through) : t.ayahLabel(edge.to)) ?? edge.to;
            // When we do not carry the target's page, the leap is honestly
            // disabled — but the verse still exists, so we link out to it on the
            // outside library rather than dead-ending (the qul-reliance
            // decision's "link back to it" half). Ships a URL, not bytes.
            const qulUrl = enabled ? null : qulVerseUrlFromKey(edge.to);
            // A pair that matches in more than one place names no words, so
            // there is nothing to lay side by side: its row does not offer to open.
            const comparable = fromKey !== null && wordDiff(edge, fromKey) !== null;
            const isOpen = comparable && expanded === edge.to;
            const note = edgeNote(edge, lang);
            const diffId = `diff-${edge.to.replace(/[^\w-]/g, "-")}`;
            return (
              <li key={edge.to} className={styles.row} data-inside={inside || undefined}>
                <div className={styles.rowMain}>
                  <button
                    type="button"
                    className={styles.rowText}
                    aria-expanded={comparable ? isOpen : undefined}
                    aria-controls={comparable ? diffId : undefined}
                    onClick={comparable ? () => setExpanded((k) => (k === edge.to ? null : edge.to)) : undefined}
                  >
                    <span className={styles.rowLabel}>
                      {label}
                      {edge.twin && <span className={styles.badge}>{t.twin}</span>}
                      {edge.root && <span className={styles.root}>{edge.root}</span>}
                      {comparable && (
                        <span className={styles.caret} data-open={isOpen || undefined} aria-hidden="true">
                          ⌄
                        </span>
                      )}
                    </span>
                    {note && (
                      <span className={styles.note} lang={note.lang} dir={note.dir}>
                        {note.text}
                      </span>
                    )}
                    {/* A passage is measured against the verse inside it that matches best;
                        the closed row says which, so the reader knows where to look. */}
                    {edge.through && edge.like && (
                      <span className={styles.note}>{t.likeVerse(t.ayahRef(edge.like.to) ?? edge.like.to)}</span>
                    )}
                    {/* With no words to mark, the row still says why it is listed. */}
                    {edge.match && (
                      <span className={styles.note}>
                        {edge.match === "repeat" ? t.matchRepeat : t.matchLoose}
                      </span>
                    )}
                    {edge.ctx && <span className={styles.note}>{t.nextTellsApart}</span>}
                    {!enabled && (
                      <span className={styles.unavailable}>{t.pageUnavailable}</span>
                    )}
                  </button>
                  {qulUrl ? (
                    <a
                      className={styles.qul}
                      href={qulUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t.openOnQulAria(label)}
                    >
                      <span className={styles.qulLabel}>{t.openOnQul}</span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      className={styles.hop}
                      disabled={!enabled}
                      onClick={() => onHop(edge)}
                      aria-label={t.hopTo(label)}
                    >
                      <span aria-hidden="true">↪</span>
                    </button>
                  )}
                </div>
                {isOpen && fromKey !== null && (
                  <div id={diffId}>
                    <Suspense fallback={null}>
                      <DiffView edge={edge} fromKey={fromKey} />
                    </Suspense>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
