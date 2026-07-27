import { useCallback, useEffect, useRef, useState } from "react";
import type { Edge, RootFamily, RootHop } from "@hifth/core";
import { ayahLabel, toArabicDigits } from "../format";
import styles from "./RootLens.module.css";

interface RootLensTriggerProps {
  /** Distinct roots on the selection. */
  count: number;
  /**
   * Curated `shared-root` edges on the selection (Loop 6a). They ride *inside*
   * the lens, so the trigger must appear for them even on an ayah the corpus
   * has no roots for — otherwise a hand-verified pair would be unreachable.
   */
  curated?: number;
  open: boolean;
  onToggle: () => void;
}

/**
 * The ⬡ trigger — **the app's only ⬡** since Loop 6a.
 *
 * The collision it resolves: the hop rail used to carry a ⬡ chip counting the
 * *curated* shared-root edges (a handful, hand-verified) while this button
 * counted the *corpus-wide* root families (1,642 roots). Same glyph, two counts,
 * and a hafiz has every reason to read one as a subset of the other — which
 * neither the data nor the curation can promise. The rail's other three chips
 * are directions of one edge type (↻ same surah, ◀ earlier, ▶ later); ⬡ was a
 * *type* wearing a direction's clothes and never belonged there.
 *
 * So: the rail is mutashabihat by direction, full stop, and ⬡ means roots, in
 * one place, with one number. The curated edges are not dropped — they are
 * pinned at the top of the lens, marked as hand-verified, which is where a more
 * trustworthy row should sit anyway.
 */
export function RootLensTrigger({
  count,
  curated = 0,
  open,
  onToggle,
}: RootLensTriggerProps): JSX.Element | null {
  if (count === 0 && curated === 0) return null;
  const label =
    curated > 0
      ? `الجذور · ${toArabicDigits(count)} · ${toArabicDigits(curated)} مختارة`
      : `الجذور · ${toArabicDigits(count)}`;
  return (
    <button
      type="button"
      className={styles.trigger}
      aria-expanded={open}
      aria-label={label}
      onClick={onToggle}
    >
      <span aria-hidden="true">⬡</span>
      <span className="numeric" aria-hidden="true">
        {toArabicDigits(count)}
      </span>
      {curated > 0 && (
        <span className={styles.pickedDot} aria-hidden="true" />
      )}
    </button>
  );
}

interface RootLensProps {
  /** The selection's root families (nearest page first), or null when closed. */
  families: readonly RootFamily[] | null;
  /** True while the root shards for the selection are still in flight. */
  loading?: boolean;
  /**
   * Curated `shared-root` edges for the selection — the ex-rail-⬡ bucket,
   * pinned above the corpus families (Loop 6a; see `RootLensTrigger`).
   */
  curated?: readonly Edge[];
  /** Whether a target's page is vendored (loadable). Unvendored → disabled. */
  canHop: (toKey: string) => boolean;
  /** Navigate to an occurrence (the hop carries its page, so L3 need not resolve). */
  onHop: (hop: RootHop) => void;
  /** Navigate along a curated edge (same hop path; the edge carries its target). */
  onHopEdge?: (edge: Edge) => void;
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
  curated = [],
  canHop,
  onHop,
  onHopEdge,
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

        {/* The curated bucket, pinned: hand-verified pairs outrank a corpus
            match, so they lead — and this is the ⬡ rail chip's new home. */}
        {curated.length > 0 && (
          <section className={styles.picked}>
            <h3 className={styles.pickedTitle}>
              مختارة
              <span className={styles.pickedNote}>محقّقة يدويًا</span>
            </h3>
            <ul className={styles.hops}>
              {curated.map((edge) => {
                const enabled = canHop(edge.to);
                const label = ayahLabel(edge.to) ?? edge.to;
                return (
                  <li key={edge.to} className={styles.hopRow}>
                    <span className={styles.hopText}>
                      <span className={styles.hopLabel}>
                        {label}
                        {edge.root && <span className={styles.count}>{edge.root}</span>}
                      </span>
                      <span className={styles.distance}>
                        {edge.note ?? "جذر مشترك"}
                        {!enabled && (
                          <span className={styles.unavailable}> · غير متوفّرة بعد</span>
                        )}
                      </span>
                    </span>
                    <button
                      type="button"
                      className={styles.hop}
                      disabled={!enabled || !onHopEdge}
                      onClick={() => onHopEdge?.(edge)}
                      aria-label={`انتقل إلى ${label}`}
                    >
                      <span aria-hidden="true">↪</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {families.length === 0 ? (
          curated.length === 0 ? (
            <p className={styles.empty}>{loading ? "…" : "لا جذور معروفة لهذه الآية"}</p>
          ) : null
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
          {/* The corpus asks for its source to be named and linked (above) *and*
              for its copyright notice to be reproduced in derived works — the
              shards are one, so the line below is an obligation, not a courtesy.
              The full block ships at assets/roots/<edition>/NOTICE.txt. */}
          <span className={styles.copyright}>© 2011 Kais Dukes · GNU GPL</span>
        </footer>
      </div>
    </>
  );
}
