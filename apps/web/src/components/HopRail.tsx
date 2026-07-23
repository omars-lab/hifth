import type { RailChip } from "@hifth/core";
import { toArabicDigits } from "../format";
import styles from "./HopRail.module.css";

interface HopRailProps {
  /** Bucketed chips for the current selection (↻ loop, ◀ earlier, ▶ later, ⬡ root). */
  chips: readonly RailChip[];
  /** Which chip's popover is open, by direction, or null. */
  openDirection: RailChip["direction"] | null;
  /** Open/toggle a chip's popover. */
  onOpenChip: (chip: RailChip) => void;
}

/** Arabic hint for each direction, announced to screen readers. */
const DIRECTION_LABEL: Record<RailChip["direction"], string> = {
  loop: "متشابهات في السورة",
  earlier: "متشابهات في سور سابقة",
  later: "متشابهات في سور لاحقة",
  root: "جذر مشترك",
};

/**
 * HopRail — the signature affordance (spec §9, PLAN signature element). A short
 * vertical rail of direction chips beside the selected ayah: each chip is one
 * bucket of hops with its glyph (↻◀▶⬡) and count. Tapping a chip opens its
 * popover. The rail only exists while an ayah is selected and has hops; a
 * hop-less ayah renders nothing (quiet by default).
 */
export function HopRail({ chips, openDirection, onOpenChip }: HopRailProps): JSX.Element | null {
  if (chips.length === 0) return null;
  return (
    <div className={styles.rail} role="group" aria-label="روابط الآية">
      {chips.map((chip) => (
        <button
          key={chip.direction}
          type="button"
          className={styles.chip}
          data-direction={chip.direction}
          data-open={openDirection === chip.direction || undefined}
          aria-expanded={openDirection === chip.direction}
          aria-label={`${DIRECTION_LABEL[chip.direction]} · ${chip.count}`}
          onClick={() => onOpenChip(chip)}
        >
          <span className={styles.glyph} aria-hidden="true">
            {chip.glyph}
          </span>
          <span className={`${styles.count} numeric`} aria-hidden="true">
            {toArabicDigits(chip.count)}
          </span>
        </button>
      ))}
    </div>
  );
}
