import type { RailChip } from "@hifth/core";
import { useT } from "../i18n";
import styles from "./HopRail.module.css";

interface HopRailProps {
  /** Bucketed chips for the current selection (↻ loop, ◀ earlier, ▶ later, ⬡ root). */
  chips: readonly RailChip[];
  /** Which chip's popover is open, by direction, or null. */
  openDirection: RailChip["direction"] | null;
  /** Open/toggle a chip's popover. */
  onOpenChip: (chip: RailChip) => void;
}

/**
 * HopRail — the signature affordance (spec §9, PLAN signature element). A short
 * vertical rail of direction chips beside the selected ayah: each chip is one
 * bucket of hops with its glyph (↻◀▶⬡) and count. Tapping a chip opens its
 * popover. The rail only exists while an ayah is selected and has hops; a
 * hop-less ayah renders nothing (quiet by default).
 */
export function HopRail({ chips, openDirection, onOpenChip }: HopRailProps): JSX.Element | null {
  const { t } = useT();
  if (chips.length === 0) return null;
  return (
    // No `dir` of its own: the rail is pinned to the mus'haf's reading-start
    // edge by `inset-inline-start`, and `<main>` keeps that RTL in both
    // languages. A rail that jumped to the other side of the page because the
    // buttons are in English would be the app forgetting what it is.
    <div className={styles.rail} role="group" aria-label={t.railGroup}>
      {chips.map((chip) => (
        <button
          key={chip.direction}
          type="button"
          className={styles.chip}
          data-direction={chip.direction}
          data-open={openDirection === chip.direction || undefined}
          aria-expanded={openDirection === chip.direction}
          // The badge two lines below has always been Arabic-Indic; the label
          // was not, so a sighted reader saw ٣ and a screen-reader user heard
          // "three" in the middle of an otherwise Arabic phrase. Found by the
          // aria snapshot, which is the only place the two spellings sit
          // side by side.
          aria-label={t.chipAria(t.railDirection[chip.direction], chip.count)}
          onClick={() => onOpenChip(chip)}
        >
          <span className={styles.glyph} aria-hidden="true">
            {chip.glyph}
          </span>
          <span className={`${styles.count} numeric`} aria-hidden="true">
            {t.num(chip.count)}
          </span>
        </button>
      ))}
    </div>
  );
}
