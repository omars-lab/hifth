import styles from "./RailGlyph.module.css";

/**
 * A similar-verses sign: "looks like" (≈), then a smaller mark for which way
 * (↻ this surah, ← earlier, → later). Held left to right, so on the mus'haf's
 * right-to-left side the arrow still comes after the ≈, as it does in the
 * verse menu. A one-character glyph (the roots' ⬡) is drawn as it is.
 */
export function RailGlyph({ glyph }: { glyph: string }) {
  const [sign, ...rest] = Array.from(glyph);
  const mark = rest.join("");
  return (
    <span className={styles.glyph} dir="ltr">
      <span data-sign="">{sign}</span>
      {mark && (
        <span className={styles.mark} data-mark="">
          {mark}
        </span>
      )}
    </span>
  );
}
