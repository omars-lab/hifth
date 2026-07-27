import { useCallback, useEffect, useRef, useState } from "react";
import { diffPair, type AppState, type MergedEdge } from "@hifth/core";
import { ayahLabel, ayahRef, rangeLabel } from "../format";
import { DiffView } from "./DiffView";
import { ShareSheet } from "./ShareSheet";
import styles from "./HighlightMenu.module.css";

interface HighlightMenuProps {
  /** The highlighted range's ayah keys in reading order, or null when nothing is highlighted. */
  rangeKeys: readonly string[] | null;
  /** The range's merged, deduped, hifz-ordered hops (`Adjacency.hopsForRange`). */
  hops: readonly MergedEdge[];
  /** Whether a hop target's page is vendored (loadable). Unvendored → disabled. */
  canHop: (toKey: string) => boolean;
  /** Perform the hop; the edge carries the range member it came from. */
  onHop: (edge: MergedEdge) => void;
  /** The range as a spec-§7 AppState, for the copy-link action (range form). */
  shareState: AppState | null;
  /** Drop the highlight entirely (the menu's "clear"). */
  onClear: () => void;
  /** Dismiss the menu, keeping the highlight. */
  onClose: () => void;
}

/** Focusable descendants of `root`, in tab order (excludes disabled + hidden). */
function focusables(root: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(sel));
}

/** Target key without its word anchor (`…/2:122#w3` → `…/2:122`). */
function bareTarget(to: string): string {
  const hash = to.indexOf("#");
  return hash === -1 ? to : to.slice(0, hash);
}

/**
 * HighlightMenu — what the drag-to-highlight gesture releases into (spec §9).
 * Where `HopPopover` answers "where does *this ayah* go?", this answers it for a
 * whole highlighted passage: one merged list, deduped by (target, type), each
 * row naming the range member it came from so a merged hop is never anonymous.
 * Rows carry the same affordances as the popover's — expand for the token diff
 * (spec §3), 44px leap button, and an honest disabled state with "page not
 * available yet" for an un-vendored target (Plan Q6). Copy-link shares the range
 * itself through the §7 range form (`#/hafs-kfqc/2:47-2:48`).
 *
 * A11y: a real modal dialog on the same contract as HopPopover — focus moves in
 * on open, Tab is trapped, Escape closes, focus returns to whatever opened it.
 * Sheet on phones, floating card on wide screens (CSS).
 */
export function HighlightMenu({
  rangeKeys,
  hops,
  canHop,
  onHop,
  shareState,
  onClear,
  onClose,
}: HighlightMenuProps): JSX.Element | null {
  const sheetRef = useRef<HTMLDivElement>(null);
  // The element focused before the menu opened, restored on close.
  const restoreRef = useRef<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const open = rangeKeys !== null && rangeKeys.length > 0;

  // Capture the trigger and move focus into the menu on open; restore on close.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
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

  if (!open) return null;
  const first = rangeKeys[0]!;
  const last = rangeKeys[rangeKeys.length - 1]!;
  const title = rangeLabel(first, last) ?? `${first}–${last}`;

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`مقطع محدَّد · ${title} · ${hops.length} روابط`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.grip} aria-hidden="true" />
        <header className={styles.head}>
          <span className={styles.glyph} aria-hidden="true">
            ▬
          </span>
          {/* Arabic label + Arabic-Indic digits: RTL text, so no `.numeric` (LTR) here. */}
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </header>

        {hops.length === 0 ? (
          <p className={styles.empty}>لا روابط في هذا المقطع بعد</p>
        ) : (
          <ul className={styles.list}>
            {hops.map((edge) => {
              const enabled = canHop(edge.to);
              const toKey = bareTarget(edge.to);
              const label = ayahLabel(toKey) ?? edge.to;
              // A word-anchored target (`…#w3`) does not resolve until the
              // word-granular corpus lands (PLAN Loop 4b) — say *that*, rather
              // than blaming the page, when the page itself is vendored.
              const blocker = enabled
                ? null
                : canHop(toKey)
                  ? "الربط على مستوى الكلمة يصل مع الحزمة القادمة"
                  : "هذه الصفحة غير متوفّرة بعد";
              // The range member this row came from — also the diff's "here".
              const fromKey = edge.sources[0]!;
              const diffable = diffPair(fromKey, toKey) !== null;
              const isOpen = expanded === edge.to;
              const diffId = `range-diff-${edge.to.replace(/[^\w-]/g, "-")}`;
              const fromRefs = edge.sources
                .map((k) => ayahRef(k) ?? k)
                .join("، ");
              return (
                <li key={`${edge.type} ${edge.to}`} className={styles.row}>
                  <div className={styles.rowMain}>
                    <button
                      type="button"
                      className={styles.rowText}
                      aria-expanded={diffable ? isOpen : undefined}
                      aria-controls={diffable ? diffId : undefined}
                      onClick={() => setExpanded((k) => (k === edge.to ? null : edge.to))}
                    >
                      <span className={styles.rowLabel}>
                        {label}
                        {edge.twin && <span className={styles.badge}>توأم</span>}
                        {edge.root && <span className={styles.root}>{edge.root}</span>}
                        {diffable && (
                          <span
                            className={styles.caret}
                            data-open={isOpen || undefined}
                            aria-hidden="true"
                          >
                            ⌄
                          </span>
                        )}
                      </span>
                      <span className={styles.from}>{`من ${fromRefs}`}</span>
                      {edge.note && <span className={styles.note}>{edge.note}</span>}
                      {blocker && <span className={styles.unavailable}>{blocker}</span>}
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
                  {isOpen && diffable && (
                    <div id={diffId}>
                      <DiffView fromKey={fromKey} toKey={toKey} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <footer className={styles.actions}>
          <ShareSheet state={shareState} hasTrail={false} variant="range" />
          <button type="button" className={styles.clear} onClick={onClear}>
            إلغاء التحديد
          </button>
        </footer>
      </div>
    </>
  );
}
