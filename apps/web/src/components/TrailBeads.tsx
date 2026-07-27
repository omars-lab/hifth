import { ayahLabel } from "../format";
import styles from "./TrailBeads.module.css";

/** One hop origin on the trail: where you were, and its page. */
export interface TrailBead {
  key: string;
  page: number;
}

interface TrailBeadsProps {
  /** Hop origins, oldest → newest. Empty = no trail yet. */
  trail: readonly TrailBead[];
  /** The ayah you are on now (the live bead at the end of the string). */
  currentKey: string | null;
  /** Rewind to a trail bead (pops everything after it). */
  onBeadBack: (index: number) => void;
  /** Clear the current selection (tap the live bead). */
  onClearCurrent: () => void;
}

/**
 * TrailBeads — the subha (prayer-bead) trail (spec §9, PLAN signature element).
 * Each hop threads a bead; tapping an earlier bead rewinds there (the same code
 * path as a forward hop — spec §7). The live bead at the string's end is the
 * current ayah. Empty trail shows a quiet hint instead.
 */
export function TrailBeads({
  trail,
  currentKey,
  onBeadBack,
  onClearCurrent,
}: TrailBeadsProps): JSX.Element {
  if (!currentKey) {
    return <span className={styles.hint}>المس آية على الصفحة لتحديدها</span>;
  }

  const currentLabel = ayahLabel(currentKey) ?? currentKey;

  return (
    <div className={styles.trail} aria-label="المسار">
      <span className={styles.string} aria-hidden="true" />
      {trail.map((bead, i) => {
        const label = ayahLabel(bead.key) ?? bead.key;
        return (
          <button
            key={`${bead.key}-${i}`}
            type="button"
            className={styles.bead}
            onClick={() => onBeadBack(i)}
            aria-label={`ارجع إلى ${label}`}
          >
            <span className={styles.beadDot} aria-hidden="true" />
            <span className={styles.beadLabel}>{label}</span>
          </button>
        );
      })}
      <button
        type="button"
        className={`${styles.bead} ${styles.beadCurrent}`}
        onClick={onClearCurrent}
        aria-current="location"
        aria-label={`الآية الحالية ${currentLabel} — المس للإلغاء`}
      >
        <span className={styles.beadDot} aria-hidden="true" />
        <span className={styles.beadLabel}>{currentLabel}</span>
      </button>
    </div>
  );
}
