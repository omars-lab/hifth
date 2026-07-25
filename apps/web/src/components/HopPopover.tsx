import { useCallback, useEffect, useRef, useState } from "react";
import { orderForHifz, type Edge, type RailChip } from "@hifth/core";
import { ayahLabel } from "../format";
import { DiffView } from "./DiffView";
import styles from "./HopPopover.module.css";

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
}

const DIRECTION_TITLE: Record<RailChip["direction"], string> = {
  loop: "متشابهات في السورة",
  earlier: "في سور سابقة",
  later: "في سور لاحقة",
  root: "بنفس الجذر",
};

/** Focusable descendants of `root`, in tab order (excludes disabled + hidden). */
function focusables(root: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(sel));
}

/**
 * HopPopover — the bottom-sheet hop list (spec §9). Opened by a rail chip, it
 * lists that bucket's edges hifz-ordered (nearest first), each row a "hop there"
 * arc-arrow that expands to a token diff (spec §3) showing *why* the pair is
 * confusable. An un-vendored target shows its link + note but the leap is
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
}: HopPopoverProps): JSX.Element | null {
  const sheetRef = useRef<HTMLDivElement>(null);
  // The element focused before the sheet opened, restored on close.
  const restoreRef = useRef<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const open = chip !== null;

  // Capture the trigger and move focus into the sheet on open; restore on close.
  useEffect(() => {
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
      if (e.key !== "Tab") return;
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
    [onClose],
  );

  if (!chip) return null;
  const edges = orderForHifz(chip.edges);

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`${DIRECTION_TITLE[chip.direction]} · ${chip.count}`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.grip} aria-hidden="true" />
        <header className={styles.head}>
          <span className={styles.glyph} aria-hidden="true">
            {chip.glyph}
          </span>
          <h2 className={styles.title}>{DIRECTION_TITLE[chip.direction]}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </header>

        <ul className={styles.list}>
          {edges.map((edge) => {
            const enabled = canHop(edge.to);
            const label = ayahLabel(edge.to) ?? edge.to;
            const isOpen = expanded === edge.to;
            const diffId = `diff-${edge.to.replace(/[^\w-]/g, "-")}`;
            return (
              <li key={edge.to} className={styles.row}>
                <div className={styles.rowMain}>
                  <button
                    type="button"
                    className={styles.rowText}
                    aria-expanded={isOpen}
                    aria-controls={fromKey ? diffId : undefined}
                    onClick={() => setExpanded((k) => (k === edge.to ? null : edge.to))}
                  >
                    <span className={styles.rowLabel}>
                      {label}
                      {edge.twin && <span className={styles.badge}>توأم</span>}
                      {edge.root && <span className={styles.root}>{edge.root}</span>}
                      <span className={styles.caret} data-open={isOpen || undefined} aria-hidden="true">
                        ⌄
                      </span>
                    </span>
                    {edge.note && <span className={styles.note}>{edge.note}</span>}
                    {!enabled && (
                      <span className={styles.unavailable}>هذه الصفحة غير متوفّرة بعد</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={styles.hop}
                    disabled={!enabled}
                    onClick={() => onHop(edge)}
                    aria-label={`انتقل إلى ${label}`}
                  >
                    <span aria-hidden="true">↪</span>
                  </button>
                </div>
                {isOpen && fromKey && (
                  <div id={diffId}>
                    <DiffView fromKey={fromKey} toKey={edge.to} />
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
