import { type SkinId } from "@hifth/core";
import { useT } from "../i18n";
import styles from "./SkinToggle.module.css";

interface SkinToggleProps {
  /** The skin currently applied (L3 owns it; the stage applies it). */
  skin: SkinId;
  /** Flip between plain and tajweed. */
  onChange: (skin: SkinId) => void;
  /** Open the legend sheet — the only place rule identity is spelled out. */
  onOpenLegend: () => void;
}

/**
 * SkinToggle — plain ⇄ tajweed, plus the way into the legend.
 *
 * Two controls, not one: the toggle is the switch, the ⓘ is the key. Colour
 * alone can never carry rule identity (WCAG 1.4.1), so the legend is part of the
 * feature rather than help content — which is also why it is reachable *before*
 * the skin is on.
 *
 * **The beta badge is permanent furniture until a hafiz signs off** (PLAN §6
 * testing plan: "Tajweed skin ships behind a beta flag until hafiz approval").
 * It sits on the toggle itself, in both states, so nobody turns the skin on
 * without having seen it — a tajweed error in a memorisation tool is the kind of
 * bug that teaches a mistake.
 */
export function SkinToggle({ skin, onChange, onOpenLegend }: SkinToggleProps): JSX.Element {
  const { t } = useT();
  const on = skin === "tajweed";
  return (
    <div className={styles.group} role="group" aria-label={t.skinGroup}>
      <button
        type="button"
        className={styles.toggle}
        aria-pressed={on}
        onClick={() => onChange(on ? "plain" : "tajweed")}
      >
        <span className={styles.label}>{t.tajweed}</span>
        <span className={styles.beta}>{t.beta}</span>
      </button>
      <button
        type="button"
        className={styles.legendBtn}
        onClick={onOpenLegend}
        aria-label={t.legendAria}
      >
        <span aria-hidden="true">ⓘ</span>
      </button>
    </div>
  );
}
