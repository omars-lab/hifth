import { useCallback, useEffect, useRef, useState } from "react";
import type { RootFamily, RootHop } from "@hifth/core";
import { ayahLabel, toArabicDigits } from "../format";
import styles from "./RootLens.module.css";

interface RootLensTriggerProps {
  /** Distinct roots on the selection; 0 renders nothing. */
  count: number;
  open: boolean;
  onToggle: () => void;
}

/**
 * The ⬡ trigger. It lives beside the trail rather than on the hop rail: the
 * rail's ⬡ chip is the *curated* shared-root edges (hand-picked pairs), while
 * this opens the corpus-wide lens — same glyph, different promise, so they stay
 * separate surfaces until Loop 6 decides whether to merge them.
 */
export function RootLensTrigger({
  count,
  open,
  onToggle,
}: RootLensTriggerProps): JSX.Element | null {
  if (count === 0) return null;
  return (
    <button
      type="button"
      className={styles.trigger}
      aria-expanded={open}
      aria-label={`الجذور · ${toArabicDigits(count)}`}
      onClick={onToggle}
    >
      <span aria-hidden="true">⬡</span>
      <span className="numeric" aria-hidden="true">
        {toArabicDigits(count)}
      </span>
    </button>
  );
}

interface RootLensProps {
  /** The selection's root families (nearest page first), or null when closed. */
  families: readonly RootFamily[] | null;
  /** True while the root shards for the selection are still in flight. */
  loading?: boolean;
  /** Whether a target's page is vendored (loadable). Unvendored → disabled. */
  canHop: (toKey: string) => boolean;
  /** Navigate to an occurrence (the hop carries its page, so L3 need not resolve). */
  onHop: (hop: RootHop) => void;
  /** Dismiss the sheet. */
  onClose: () => void;
}

/** Focusable descendants of `root`, in tab order (excludes disabled + hidden). */
function focusables(root: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(sel));
}

/** "نفس الصفحة" / "صفحتان بعد" — page distance the way a hafiz says it. */
function distanceLabel(dPage: number): string {
  if (dPage === 0) return "نفس الصفحة";
  const n = Math.abs(dPage);
  const pages =
    n === 1
      ? "صفحة واحدة"
      : n === 2
        ? "صفحتان"
        : n <= 10
          ? `${toArabicDigits(n)} صفحات`
          : `${toArabicDigits(n)} صفحة`;
  return `${pages} ${dPage > 0 ? "بعد" : "قبل"}`;
}

/**
 * RootLens — the ⬡ family view (spec §9, PLAN §Loop 5).
 *
 * Lists the roots on the current selection, each expanding into the other ayahs
 * that carry it, **nearest page first** — the ordering is the whole point: a
 * hafiz recalls by proximity in the mushaf, so a root three pages back is worth
 * more than the same root twenty juz away. Families themselves are ordered by
 * their closest occurrence, then by rarity, so the rows that can actually help
 * sit at the top. Granularity is the ayah (word anchors wait on Loop 4b).
 *
 * When the source distinguishes several lemmas of one root, the hops are shown
 * under lemma sub-headings; a hop using two lemmas appears under both, which is
 * exactly what the sub-grouping is for.
 *
 * A11y: the same contract as HopPopover — a real modal dialog, focus in on open,
 * Tab trapped, Escape closes, focus restored to the trigger. (The helpers are
 * duplicated rather than shared: the two sheets are diverging surfaces, and one
 * shared "sheet" abstraction would be premature at two instances.)
 *
 * Attribution is not optional here: the Quranic Arabic Corpus terms require the
 * source be named and linked wherever its annotation is used (SOURCES.md), hence
 * the credit line in the footer.
 */
export function RootLens({
  families,
  loading = false,
  canHop,
  onHop,
  onClose,
}: RootLensProps): JSX.Element | null {
  const sheetRef = useRef<HTMLDivElement>(null);
  // The element focused before the sheet opened, restored on close.
  const restoreRef = useRef<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const open = families !== null;

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

  // Open the nearest family by default — the lens should say something useful
  // before the first tap. Keyed on the top family so a new selection re-opens.
  const top = families?.[0]?.root ?? null;
  useEffect(() => {
    setExpanded(top);
  }, [top]);

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

  if (!families) return null;

  const hopRow = (hop: RootHop, key: string): JSX.Element => {
    const enabled = canHop(hop.key);
    const label = ayahLabel(hop.key) ?? hop.key;
    return (
      <li key={key} className={styles.hopRow}>
        <span className={styles.hopText}>
          <span className={styles.hopLabel}>
            {label}
            {hop.count > 1 && (
              <span className={styles.count} aria-label={`${toArabicDigits(hop.count)} كلمات`}>
                ×{toArabicDigits(hop.count)}
              </span>
            )}
          </span>
          <span className={styles.distance} data-near={hop.dPage === 0 || undefined}>
            {distanceLabel(hop.dPage)}
            {!enabled && <span className={styles.unavailable}> · غير متوفّرة بعد</span>}
          </span>
        </span>
        <button
          type="button"
          className={styles.hop}
          disabled={!enabled}
          onClick={() => onHop(hop)}
          aria-label={`انتقل إلى ${label}`}
        >
          <span aria-hidden="true">↪</span>
        </button>
      </li>
    );
  };

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`الجذور · ${toArabicDigits(families.length)}`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.grip} aria-hidden="true" />
        <header className={styles.head}>
          <span className={styles.glyph} aria-hidden="true">
            ⬡
          </span>
          <h2 className={styles.title}>الجذور</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </header>

        {families.length === 0 ? (
          <p className={styles.empty}>{loading ? "…" : "لا جذور معروفة لهذه الآية"}</p>
        ) : (
          <ul className={styles.list}>
            {families.map((family) => {
              const isOpen = expanded === family.root;
              const panelId = `root-${family.root.replace(/\s+/g, "-")}`;
              return (
                <li key={family.root} className={styles.family}>
                  <button
                    type="button"
                    className={styles.familyHead}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() =>
                      setExpanded((r) => (r === family.root ? null : family.root))
                    }
                  >
                    <span className={styles.root}>{family.root}</span>
                    <span className={styles.stats}>
                      {toArabicDigits(family.ayahs)} آية · {toArabicDigits(family.words)} كلمة
                    </span>
                    <span className={styles.caret} data-open={isOpen || undefined} aria-hidden="true">
                      ⌄
                    </span>
                  </button>

                  {isOpen && (
                    <div id={panelId}>
                      {family.hops.length === 0 ? (
                        <p className={styles.hapax}>لا تتكرّر في المصحف</p>
                      ) : family.lemmas.length > 1 ? (
                        family.lemmas.map((group) => (
                          <section key={group.lemma} className={styles.lemma}>
                            <h3 className={styles.lemmaTitle}>{group.lemma}</h3>
                            <ul className={styles.hops}>
                              {group.hops.map((hop) => hopRow(hop, `${group.lemma}:${hop.key}`))}
                            </ul>
                          </section>
                        ))
                      ) : (
                        <ul className={styles.hops}>
                          {family.hops.map((hop) => hopRow(hop, hop.key))}
                        </ul>
                      )}
                      {family.truncated && (
                        <p className={styles.more}>
                          أقرب {toArabicDigits(family.hops.length)} مواضع فقط
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <footer className={styles.credit}>
          الجذور من{" "}
          <a href="http://corpus.quran.com" target="_blank" rel="noreferrer">
            Quranic Arabic Corpus
          </a>
        </footer>
      </div>
    </>
  );
}
