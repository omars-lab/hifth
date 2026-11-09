import { useId } from "react";
import type { ListenWay } from "../audio";
import { useT } from "../i18n";
import { REPEATS, SPEEDS } from "../listen-way";
import styles from "./ListenOptions.module.css";

/**
 * The play options that open under Listen inside the verse's drawer
 * (selection-drawer ③, a setting; owner, 2026-11-07: "clicking play should
 * expand drawer as well with additional play options"): play on to a verse
 * the reader picks, how many times each verse plays, and how fast.
 */
export function ListenOptions({
  label,
  way,
  onWay,
  onPlayTo,
}: {
  /** The verse's own name, for the section's and Play to's names. */
  label: string;
  way: ListenWay;
  onWay: (way: ListenWay) => void;
  /** Start "Play to" from this verse: the reader then picks where it stops. */
  onPlayTo: () => void;
}): JSX.Element {
  const { t } = useT();
  const id = useId();
  const repeatName = (n: number): string =>
    n === 1 ? t.listenOnce : n === Infinity ? t.listenUntilStop : t.listenTimes(n);
  const speedName = (s: number): string => (s < 1 ? t.listenSlower : s > 1 ? t.listenFaster : t.listenAsRecited);
  return (
    <section className={styles.options} role="region" aria-label={t.listenOptionsAria(label)}>
      <button type="button" className={styles.playTo} onClick={onPlayTo} aria-label={t.vdPlayToAria(label)}>
        <span aria-hidden="true">{"⏭︎"}</span>
        <span>{t.vdPlayTo}</span>
      </button>
      <div className={styles.group} role="radiogroup" aria-labelledby={`${id}-repeat`}>
        <span id={`${id}-repeat`} className={styles.legend}>
          {t.listenRepeatTitle}
        </span>
        {REPEATS.map((n) => (
          <label key={n} className={styles.chip}>
            <input
              type="radio"
              name={`${id}-repeat`}
              checked={way.repeat === n}
              onChange={() => onWay({ ...way, repeat: n })}
            />
            <span>{repeatName(n)}</span>
          </label>
        ))}
      </div>
      <div className={styles.group} role="radiogroup" aria-labelledby={`${id}-speed`}>
        <span id={`${id}-speed`} className={styles.legend}>
          {t.listenSpeedTitle}
        </span>
        {SPEEDS.map((s) => (
          <label key={s} className={styles.chip}>
            <input
              type="radio"
              name={`${id}-speed`}
              checked={way.speed === s}
              onChange={() => onWay({ ...way, speed: s })}
            />
            <span>{speedName(s)}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
