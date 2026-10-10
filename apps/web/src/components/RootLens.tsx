import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Edge, LeafSide, RootFamily, RootHop } from "@hifth/core";
import { useT } from "../i18n";
import styles from "./RootLens.module.css";
import { leafStyle, useOverLeaf } from "./over-leaf";
import { useShortBand } from "./short-band";

// The ⬡ button has its own file so it can stay in the start-up script while
// the lens loads on first open. Re-exported here for existing importers.
export { RootLensTrigger } from "./RootLensTrigger";

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
  side = null,
  onCover,
}: RootLensProps): JSX.Element | null {
  const { t, dir } = useT();
  // Beside the verse on a spread: no dimming, no trapped Tab (see HopPopover).
  const beside = side !== null;
  const place = useOverLeaf(families !== null, side);
  const sheetRef = useRef<HTMLDivElement>(null);
  const band = useShortBand(families !== null, beside, sheetRef, onCover);
  // Under the page on a phone, or beside it on a spread: the page stays live.
  const live = beside || band;
  // The element focused before the sheet opened, restored on close.
  const restoreRef = useRef<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const open = families !== null;

  // Takes the keyboard in the step that draws it, so a key pressed as it appears lands here, not on the page.
  useLayoutEffect(() => {
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

  if (!families) return null;

  const hopRow = (hop: RootHop, key: string): JSX.Element => {
    const enabled = canHop(hop.key);
    const label = t.ayahLabel(hop.key) ?? hop.key;
    return (
      <li key={key} className={styles.hopRow}>
        <span className={styles.hopText}>
          <span className={styles.hopLabel}>
            {label}
            {hop.count > 1 && (
              <span className={styles.count} aria-label={t.rootsOccurrences(hop.count)}>
                ×{t.num(hop.count)}
              </span>
            )}
          </span>
          <span className={styles.distance} data-near={hop.dPage === 0 || undefined}>
            {t.distance(hop.dPage)}
            {!enabled && <span className={styles.unavailable}>{t.rootsUnavailable}</span>}
          </span>
        </span>
        <button
          type="button"
          className={styles.hop}
          disabled={!enabled}
          onClick={() => onHop(hop)}
          aria-label={t.hopTo(label)}
        >
          <span aria-hidden="true">{"↪\uFE0E"}</span>
        </button>
      </li>
    );
  };

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
        aria-label={t.rootsAria(families.length)}
        dir={dir}
        data-side={side ?? undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {/* Beside a page nothing drags, so it has no handle — as the note. */}
        {side ? null : <div className={styles.grip} aria-hidden="true" />}
        <header className={styles.head}>
          <span className={styles.glyph} aria-hidden="true">
            ⬡
          </span>
          <h2 className={styles.title}>{t.rootsTitle}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
            ✕
          </button>
        </header>

        {/* The curated bucket, pinned: hand-verified pairs outrank a corpus
            match, so they lead — and this is the ⬡ rail chip's new home. */}
        {curated.length > 0 && (
          <section className={styles.picked}>
            <h3 className={styles.pickedTitle}>
              {t.rootsPicked}
              <span className={styles.pickedNote}>{t.rootsPickedNote}</span>
            </h3>
            <ul className={styles.hops}>
              {curated.map((edge) => {
                const enabled = canHop(edge.to);
                const label = t.ayahLabel(edge.to) ?? edge.to;
                return (
                  <li key={edge.to} className={styles.hopRow}>
                    <span className={styles.hopText}>
                      <span className={styles.hopLabel}>
                        {label}
                        {edge.root && <span className={styles.count}>{edge.root}</span>}
                      </span>
                      {/* A curated note is corpus content, hand-written in
                          Arabic by whoever verified the pair — it is evidence,
                          not chrome, so it is never translated. The fallback
                          when there is no note is chrome, and is. */}
                      <span className={styles.distance} lang={edge.note ? "ar" : undefined}>
                        {edge.note ?? t.rootsSharedRoot}
                        {!enabled && (
                          <span className={styles.unavailable}>{t.rootsUnavailable}</span>
                        )}
                      </span>
                    </span>
                    <button
                      type="button"
                      className={styles.hop}
                      disabled={!enabled || !onHopEdge}
                      onClick={() => onHopEdge?.(edge)}
                      aria-label={t.hopTo(label)}
                    >
                      <span aria-hidden="true">{"↪\uFE0E"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {families.length === 0 ? (
          curated.length === 0 ? (
            <p className={styles.empty}>{loading ? "…" : t.rootsEmpty}</p>
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
                    {/* The root itself is Arabic in both languages — it is the
                        word, not a name for it, and transliterating a triliteral
                        root would be inventing data the corpus never gave. */}
                    <span className={styles.root} lang="ar" dir="rtl">
                      {family.root}
                    </span>
                    <span className={styles.stats}>{t.rootsStats(family.ayahs, family.words)}</span>
                    <span className={styles.caret} data-open={isOpen || undefined} aria-hidden="true">
                      ⌄
                    </span>
                  </button>

                  {isOpen && (
                    <div id={panelId}>
                      {family.hops.length === 0 ? (
                        <p className={styles.hapax}>{t.rootsHapax}</p>
                      ) : family.lemmas.length > 1 ? (
                        family.lemmas.map((group) => (
                          <section key={group.lemma} className={styles.lemma}>
                            {/* A lemma is a Quranic word, like the root above. */}
                            <h3 className={styles.lemmaTitle} lang="ar" dir="rtl">
                              {group.lemma}
                            </h3>
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
                        <p className={styles.more}>{t.rootsTruncated(family.hops.length)}</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <footer className={styles.credit}>
          {t.rootsCredit}{" "}
          <a href="http://corpus.quran.com" target="_blank" rel="noreferrer">
            Quranic Arabic Corpus
          </a>
          {/* The corpus asks for its source to be named and linked (above) *and*
              for its copyright notice to be reproduced in derived works — the
              shards are one, so the line below is an obligation, not a courtesy.
              The full block ships at assets/roots/<edition>/NOTICE.txt. */}
          <span className={styles.copyright}>{"©\uFE0E"} 2011 Kais Dukes · GNU GPL</span>
        </footer>
      </div>
    </>
  );
}
