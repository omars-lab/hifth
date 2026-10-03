import { useEffect, useRef, type CSSProperties } from "react";
import styles from "./ScopePyramid.module.css";

export interface ScopeTier {
  readonly id: string;
  /** What a screen reader says: "Page 7", "A word of Al-Baqarah · 2:40". */
  readonly name: string;
  /** What the tier shows: "Page 7", "Word". */
  readonly short: string;
  /** The key that picks it, by its place on the keyboard, so it works on an Arabic layout too. */
  readonly letter: string;
  /** A part this note cannot be about from here (no verse, no harakah under its pin): greyed, so the shape stays whole. */
  readonly disabled?: boolean;
}

interface ScopePyramidProps {
  /** Narrowest first: the top of the pyramid. */
  tiers: readonly ScopeTier[];
  current: string;
  label: string;
  onPick: (id: string) => void;
}

/** How wide the top of the pyramid is, as a share of its base. */
const APEX = 0.26;

/**
 * The parts a note could be about, stacked as a pyramid: one harakah at the
 * narrow top, the whole Qur'an at the base (docs/design/scoped-notes.md,
 * step 7). Each tier is drawn as a slice of one slope, wider than the one
 * above it, so the reader sees at a glance that each part holds the ones
 * above it. Its letter picks it while the pyramid has focus, and the arrows
 * climb it; the current part takes focus when it opens.
 */
export function ScopePyramid({ tiers, current, label, onPick }: ScopePyramidProps): JSX.Element {
  const currentRef = useRef<HTMLButtonElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    currentRef.current?.focus();
  }, []);
  const n = tiers.length;
  const edge = (i: number) => ((1 - (APEX + ((1 - APEX) * i) / n)) / 2) * 100;
  return (
    <div
      ref={groupRef}
      className={styles.pyramid}
      role="group"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const buttons = [...(groupRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next = buttons[Math.min(buttons.length - 1, Math.max(0, at + (e.key === "ArrowUp" ? -1 : 1)))];
          next?.focus();
          return;
        }
        const tier = tiers.find((t) => e.code === `Key${t.letter}`);
        if (!tier) return;
        // Every letter of the pyramid is its own here, a greyed one too, so none reaches the toolbar.
        e.preventDefault();
        e.stopPropagation();
        if (!tier.disabled) onPick(tier.id);
      }}
    >
      {tiers.map((t, i) => {
        const top = edge(i);
        const bottom = edge(i + 1);
        return (
          <button
            key={t.id}
            ref={t.id === current ? currentRef : undefined}
            type="button"
            className={styles.tier}
            aria-label={t.name}
            aria-pressed={t.id === current}
            aria-keyshortcuts={t.letter}
            disabled={t.disabled}
            style={{ "--tier": i / Math.max(1, n - 1) } as CSSProperties}
            onClick={() => onPick(t.id)}
          >
            <span
              className={styles.shape}
              data-tier-shape=""
              aria-hidden="true"
              style={{
                clipPath: `polygon(${top}% 0%, ${100 - top}% 0%, ${100 - bottom}% 100%, ${bottom}% 100%)`,
              }}
            />
            <span className={styles.text} aria-hidden="true">
              <kbd className={styles.key}>{t.letter}</kbd>
              {t.short}
            </span>
          </button>
        );
      })}
    </div>
  );
}
