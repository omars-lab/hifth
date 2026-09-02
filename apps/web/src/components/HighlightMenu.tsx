import { useCallback, useEffect, useRef, useState } from "react";
import { wordDiff, type AppState, type LeafSide, type MergedEdge } from "@hifth/core";
import { useT } from "../i18n";
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
  /**
   * Which physical side of a wide screen the card lands on, or null for the
   * chrome-direction default. On a spread the app passes the side of the leaf
   * the ayah is *not* on, so the card never covers the ayah (desktop.md §5).
   */
  side?: LeafSide | null;
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
 * Rows carry the same affordances as the popover's — expand to see both ayahs
 * cropped out of the printed page with what they do not share washed (spec §3),
 * 44px leap button, and an honest disabled state with "page not
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
  side = null,
}: HighlightMenuProps): JSX.Element | null {
  const { t, dir } = useT();
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
  const title = t.rangeLabel(first, last) ?? `${first}–${last}`;

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={t.rangeAria(title, hops.length)}
        dir={dir}
        data-side={side ?? undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.grip} aria-hidden="true" />
        <header className={styles.head}>
          <span className={styles.glyph} aria-hidden="true">
            ▬
          </span>
          {/* The label carries the language's own digits, so no `.numeric`
              (LTR) treatment here — the title is a phrase, not a figure. */}
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
            ✕
          </button>
        </header>

        {hops.length === 0 ? (
          <p className={styles.empty}>{t.rangeEmpty}</p>
        ) : (
          <ul className={styles.list}>
            {hops.map((edge) => {
              const enabled = canHop(edge.to);
              const toKey = bareTarget(edge.to);
              const label = t.ayahLabel(toKey) ?? edge.to;
              // A word-anchored target (`…#w3`) does not resolve until the
              // word-granular corpus lands (PLAN Loop 4b) — say *that*, rather
              // than blaming the page, when the page itself is vendored.
              const blocker = enabled
                ? null
                : canHop(toKey)
                  ? t.wordLevelPending
                  : t.pageUnavailable;
              // The range member whose edge won the merge — the ayah this row's
              // note is about, and so the diff's "here" and the leap's origin.
              const fromKey = edge.from;
              const diffable = wordDiff(edge, fromKey) !== null;
              const isOpen = expanded === edge.to;
              const diffId = `range-diff-${edge.to.replace(/[^\w-]/g, "-")}`;
              const fromRefs = edge.sources.map((k) => t.ayahRef(k) ?? k).join(t.refJoin);
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
                        {edge.twin && <span className={styles.badge}>{t.twin}</span>}
                        {/* The root is the Arabic word itself, never romanised. */}
                        {edge.root && (
                          <span className={styles.root} lang="ar" dir="rtl">
                            {edge.root}
                          </span>
                        )}
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
                      <span className={styles.from}>{t.rangeFrom(fromRefs)}</span>
                      {/* A curated note is corpus evidence in the annotator's
                          own Arabic, not chrome — see RootLens for the rule. */}
                      {edge.note && (
                        <span className={styles.note} lang="ar" dir="rtl">
                          {edge.note}
                        </span>
                      )}
                      {blocker && <span className={styles.unavailable}>{blocker}</span>}
                    </button>
                    <button
                      type="button"
                      className={styles.hop}
                      disabled={!enabled}
                      onClick={() => onHop(edge)}
                      aria-label={t.hopTo(label)}
                    >
                      <span aria-hidden="true">↪</span>
                    </button>
                  </div>
                  {isOpen && diffable && (
                    <div id={diffId}>
                      <DiffView edge={edge} fromKey={fromKey} />
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
            {t.clearSelection}
          </button>
        </footer>
      </div>
    </>
  );
}
