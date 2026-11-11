import { useId } from "react";
import type { Edge, RailChip, RailDirection } from "@hifth/core";
import { useT } from "../i18n";
import { HopRows } from "./HopRows";
import styles from "./LookalikeSections.module.css";

/** The three groups, always in this order, each shown even when it has none. */
const GROUPS: readonly RailDirection[] = ["loop", "earlier", "later"];

export interface LookalikeSectionsProps {
  /** The verse's look-alike groups, as the rail's chips carry them. */
  chips: readonly RailChip[];
  /** The verse they are look-alikes of. */
  fromKey: string | null;
  canHop: (toKey: string) => boolean;
  onHop: (edge: Edge) => void;
  /** Fold the look-alikes away, leaving the drawer. */
  onClose: () => void;
}

/**
 * A verse's look-alikes inside its drawer, as three sections: the same surah,
 * earlier surahs and later surahs (the owner's comments on the drawer page,
 * 2026-11-07). A section with none says so, so the reader learns there is
 * nothing to confuse that way rather than wondering whether it loaded. The rows
 * are the same as on the chips' card.
 */
export function LookalikeSections({ chips, fromKey, canHop, onHop, onClose }: LookalikeSectionsProps): JSX.Element {
  const { t, dir } = useT();
  const id = useId();
  const total = chips.reduce((sum, c) => sum + c.edges.length, 0);
  return (
    <div className={styles.inline} role="region" aria-label={t.lookalikesAria(total)} dir={dir}>
      <header className={styles.head}>
        <span className={styles.glyph} aria-hidden="true">
          ≈
        </span>
        <h2 className={styles.title}>{t.lookalikesTitle}</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
          ✕
        </button>
      </header>
      {GROUPS.map((direction) => {
        const edges = chips.find((c) => c.direction === direction)?.edges ?? [];
        const headId = `${id}-${direction}`;
        return (
          <section key={direction} className={styles.group} role="group" aria-labelledby={headId}>
            <h3 id={headId} className={styles.groupTitle}>
              {t.hopTitle[direction]}
              {edges.length > 0 && <span className={styles.count}>{t.num(edges.length)}</span>}
            </h3>
            {edges.length > 0 ? (
              <HopRows edges={edges} fromKey={fromKey} canHop={canHop} onHop={onHop} />
            ) : (
              <p className={styles.none}>{t.lookalikesNone}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
