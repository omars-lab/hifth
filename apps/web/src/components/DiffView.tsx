import { diffPair, type DiffToken } from "@hifth/core";
import { useT } from "../i18n";
import styles from "./DiffView.module.css";

interface DiffViewProps {
  /** Source ayah key ("here" — where the reader currently is). */
  fromKey: string;
  /** Hop target ayah key. */
  toKey: string;
}

/**
 * Render one ayah's pre-classified tokens; divergent tokens carry a wash.
 *
 * `lang="ar" dir="rtl"` is pinned and never follows the UI language: this is
 * scripture, and it is the same text in both. The English chrome around it is a
 * label for the reader, not a translation of what is inside.
 */
function TokenRow({ tokens }: { tokens: readonly DiffToken[] }): JSX.Element {
  return (
    <p className={styles.verse} lang="ar" dir="rtl">
      {tokens.map((tok, i) => {
        const cls =
          tok.cls === 1 ? styles.dA : tok.cls === 2 ? styles.dB : undefined;
        // Tokens are phrases; re-join with spaces (the fixture stores them split).
        return (
          <span key={i} className={cls}>
            {tok.text}
            {i < tokens.length - 1 ? " " : ""}
          </span>
        );
      })}
    </p>
  );
}

/**
 * DiffView (spec §3 diff) — the token-level "why these are confusable" panel a
 * hop row expands to. It stacks the source ayah and the target with their
 * divergent readings washed (2:48 vs 2:123 = شفاعة/عدل order swap). Purely a
 * function of the two keys' vendored token text; renders nothing when either
 * side has no text, so the row falls back to its plain note.
 */
export function DiffView({ fromKey, toKey }: DiffViewProps): JSX.Element | null {
  const { t } = useT();
  const pair = diffPair(fromKey, toKey);
  if (!pair) return null;
  const fromLabel = t.ayahLabel(fromKey) ?? fromKey;
  const toLabel = t.ayahLabel(toKey) ?? toKey;

  return (
    <div className={styles.diff}>
      <div className={styles.side}>
        <span className={styles.who}>
          {fromLabel} · {t.hereTag}
        </span>
        <TokenRow tokens={pair.from.tokens} />
      </div>
      <div className={styles.side}>
        <span className={styles.who}>{toLabel}</span>
        <TokenRow tokens={pair.to.tokens} />
      </div>
    </div>
  );
}
