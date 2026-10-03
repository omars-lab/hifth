import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./ScopePyramid.module.css";
import type { ScopeLook } from "../scope-look";

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
  /** How it is drawn: the reader's choice in settings (scope-look.ts). */
  look: ScopeLook;
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
export function ScopePyramid({ tiers, current, label, onPick, look }: ScopePyramidProps): JSX.Element {
  const currentRef = useRef<HTMLButtonElement>(null);
  const [shown, setShown] = useState<string | null>(null);
  const caption = tiers.find((t) => t.id === (shown ?? current));
  const groupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    currentRef.current?.focus();
  }, []);
  const n = tiers.length;
  const edge = (i: number) => ((1 - (APEX + ((1 - APEX) * i) / n)) / 2) * 100;
  // A row is climbed with the side arrows. Turned on its side the pyramid
  // stands widest first, so there the arrow toward its start widens.
  const row = look === "steps" || look === "trail" || look === "side";
  const startward = look === "side" ? 1 : -1;
  return (
    <div className={styles.wrap} data-look={look}>
    <div
      ref={groupRef}
      className={styles.pyramid}
      role="group"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const buttons = [...(groupRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
        const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
        const toStart = row ? (rtl ? "ArrowRight" : "ArrowLeft") : "ArrowUp";
        const toEnd = row ? (rtl ? "ArrowLeft" : "ArrowRight") : "ArrowDown";
        if (e.key === toStart || e.key === toEnd) {
          e.preventDefault();
          const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const step = row ? (e.key === toStart ? startward : -startward) : e.key === toStart ? -1 : 1;
          const next = buttons[Math.min(buttons.length - 1, Math.max(0, at + step))];
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
            style={{ "--tier": i / Math.max(1, n - 1), "--edge": `${top}%` } as CSSProperties}
            onClick={() => onPick(t.id)}
            onFocus={() => setShown(t.id)}
            onBlur={() => setShown(null)}
            onPointerEnter={() => setShown(t.id)}
            onPointerLeave={() => setShown(null)}
          >
            <span
              className={styles.shape}
              data-tier-shape=""
              aria-hidden="true"
              style={
                look === "tall" || look === "slim"
                  ? { clipPath: `polygon(${top}% 0%, ${100 - top}% 0%, ${100 - bottom}% 100%, ${bottom}% 100%)` }
                  : undefined
              }
            />
            <span className={styles.text} aria-hidden="true">
              <kbd className={styles.key}>{t.letter}</kbd>
              {look === "tall" || (look === "trail" && t.id === current) ? <span>{t.short}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
    {look !== "tall" && look !== "trail" && caption ? (
      <div className={styles.caption} aria-hidden="true">
        {caption.short}
      </div>
    ) : null}
    </div>
  );
}
