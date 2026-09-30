import type { RailChip } from "@hifth/core";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useT } from "../i18n";
import styles from "./HopRail.module.css";

interface HopRailProps {
  /** Bucketed chips for the current selection (↻ loop, ◀ earlier, ▶ later, ⬡ root). */
  chips: readonly RailChip[];
  /** Which chip's popover is open, by direction, or null. */
  openDirection: RailChip["direction"] | null;
  /** Open/toggle a chip's popover. */
  onOpenChip: (chip: RailChip) => void;
  /**
   * A card is open on the rail's own corner (the right, where the mus'haf's
   * reading starts), so the rail crosses to the other corner rather than sit
   * half under it. False when nothing covers it.
   */
  crossed?: boolean;
  /**
   * Where the rail ends, in window px from the top — its lowest chip's bottom
   * edge — or null while it has no chips. The rail floats over the page's top
   * corner, so a page that moves a verse up to the top of the screen needs to
   * know how far down the chips reach, or it puts the verse's first line under
   * them (native-shell ⑩). Reported after every layout, not only on mount: a
   * new selection can change how many chips there are.
   */
  onBand?: (bottom: number | null) => void;
}

/**
 * HopRail — the signature affordance (spec §9, PLAN signature element). A short
 * vertical rail of direction chips beside the selected ayah: each chip is one
 * bucket of hops with its glyph (↻◀▶⬡) and count. Tapping a chip opens its
 * popover. The rail only exists while an ayah is selected and has hops; a
 * hop-less ayah renders nothing (quiet by default).
 */
export function HopRail({ chips, openDirection, onOpenChip, crossed = false, onBand }: HopRailProps): JSX.Element | null {
  const { t } = useT();
  const railRef = useRef<HTMLDivElement>(null);
  const count = chips.length;
  useLayoutEffect(() => {
    if (!onBand) return;
    const rail = railRef.current;
    onBand(count === 0 || !rail ? null : rail.getBoundingClientRect().bottom);
  }, [count, crossed, onBand]);
  useEffect(() => () => onBand?.(null), [onBand]);
  if (count === 0) return null;
  return (
    // No `dir` of its own: the rail is pinned to the mus'haf's reading-start
    // edge by `inset-inline-start`, and `<main>` keeps that RTL in both
    // languages. A rail that jumped to the other side of the page because the
    // buttons are in English would be the app forgetting what it is.
    <div
      ref={railRef}
      className={styles.rail}
      role="group"
      aria-label={t.railGroup}
      data-crossed={crossed || undefined}
    >
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
